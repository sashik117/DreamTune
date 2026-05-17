package com.dreamtune.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DreamTuneDownloadService extends Service {
    public static final String ACTION_QUEUE = "com.dreamtune.app.download.QUEUE";

    private static final String CHANNEL_ID = "dreamtune_downloads_v2";
    private static final String RESULT_CHANNEL_ID = "dreamtune_download_results";
    private static final String PREFS = "dreamtune-native-youtube";
    private static final String QUEUE_KEY = "download_queue";
    private static final String COMPLETED_KEY = "download_completed";
    private static final int NOTIFICATION_ID = 2191;

    private static boolean initialized = false;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private boolean workerRunning = false;
    private int batchTotal = 0;
    private int batchDone = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DreamTune:Downloads");
        wakeLock.setReferenceCounted(false);
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        if (wifiManager != null) {
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "DreamTune:DownloadWifi");
            wifiLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        publish("Preparing background downloads", true);
        if (intent != null && ACTION_QUEUE.equals(intent.getAction())) {
            appendQueue(intent.getStringExtra("items"));
        }
        startWorkerIfNeeded();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        executor.shutdownNow();
        super.onDestroy();
    }

    private synchronized void startWorkerIfNeeded() {
        if (workerRunning) return;
        workerRunning = true;
        batchTotal = getQueue().length();
        batchDone = 0;
        executor.execute(this::processQueue);
    }

    private void processQueue() {
        try {
            acquireWakeLock();
            ensureInitialized(this);

            while (true) {
                JSONObject item = pollQueue();
                if (item == null) break;

                String title = item.optString("title", "DreamTune track");
                String artist = item.optString("artist", "");
                String label = formatTrackLabel(title, artist);

                if (shouldSkipExistingRepair(item)) {
                    batchDone++;
                    publish("Checked " + batchDone + " of " + Math.max(batchTotal, batchDone), false);
                    continue;
                }

                publish("Downloading: " + label, false);

                JSONObject completed = new JSONObject(item.toString());
                boolean success = false;
                String errorMessage = "";
                try {
                    File downloaded = downloadItem(item);
                    completed.put("status", "done");
                    completed.put("file_url", Uri.fromFile(downloaded).toString());
                    completed.put("file_name", downloaded.getName());
                    completed.put("size", downloaded.length());
                    success = true;
                } catch (Exception error) {
                    completed.put("status", "failed");
                    errorMessage = error.getMessage() != null ? error.getMessage() : "Download failed";
                    completed.put("error", errorMessage);
                }

                appendCompleted(completed);
                notifyTrackFinished(label, success, errorMessage);
                batchDone++;
                publish("Downloaded " + batchDone + " of " + Math.max(batchTotal, batchDone), false);
            }
        } catch (Exception error) {
            appendServiceError(error);
        } finally {
            synchronized (this) {
                workerRunning = false;
            }
            releaseWakeLock();
            stopForegroundCompat();
            stopSelf();
        }
    }

    private File downloadItem(JSONObject item) throws Exception {
        String source = buildSource(item);
        String sourceKey = buildSourceKey(item, source);

        File dir = new File(getFilesDir(), "youtube");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Could not create youtube cache directory");
        }

        String baseName = System.currentTimeMillis() + "-" + sourceKey;
        String outputTemplate = new File(dir, baseName + ".%(ext)s").getAbsolutePath();

        try {
            YoutubeDL.getInstance().execute(buildDownloadRequest(source, outputTemplate));
        } catch (Exception firstError) {
            cleanupPartialFiles(baseName);
            cleanupPartialFiles(sourceKey);
            if (!maybeUpdateYoutubeDL()) throw firstError;
            YoutubeDL.getInstance().execute(buildDownloadRequest(source, outputTemplate));
        }

        File downloaded = findDownloadedFile(dir, baseName);
        if (downloaded == null || downloaded.length() <= 0) {
            throw new IllegalStateException("Audio file was not created");
        }
        return downloaded;
    }

    private String buildSource(JSONObject item) {
        String videoId = item.optString("videoId", "").trim();
        if (videoId.matches("^[A-Za-z0-9_-]{11}$")) {
            return "https://www.youtube.com/watch?v=" + videoId;
        }

        String query = item.optString("query", "").trim();
        if (query.isEmpty()) {
            query = formatTrackLabel(item.optString("title", ""), item.optString("artist", ""));
        }
        if (query.trim().isEmpty()) {
            throw new IllegalArgumentException("videoId or query is required");
        }
        return "ytsearch1:" + query;
    }

    private String buildSourceKey(JSONObject item, String source) {
        String videoId = item.optString("videoId", "").trim();
        if (videoId.matches("^[A-Za-z0-9_-]{11}$")) return videoId;
        String songId = item.optString("songId", "").trim();
        if (!songId.isEmpty()) return sanitizeFilePart(songId);
        return Integer.toHexString(source.hashCode());
    }

    private String sanitizeFilePart(String value) {
        String cleaned = value == null ? "" : value.replaceAll("[^A-Za-z0-9_-]", "_");
        return cleaned.isEmpty() ? "dreamtune" : cleaned;
    }

    private YoutubeDLRequest buildDownloadRequest(String source, String outputTemplate) {
        YoutubeDLRequest request = new YoutubeDLRequest(source);
        request.addOption("-f", "bestaudio[ext=m4a][abr<=192]/bestaudio[abr<=192]/bestaudio[ext=m4a]/bestaudio/best");
        request.addOption("-o", outputTemplate);
        request.addOption("--default-search", "ytsearch1");
        request.addOption("--no-playlist");
        request.addOption("--restrict-filenames");
        request.addOption("--no-warnings");
        request.addOption("--no-mtime");
        request.addOption("--force-overwrites");
        request.addOption("--socket-timeout", "20");
        request.addOption("--retries", "4");
        request.addOption("--fragment-retries", "2");
        request.addOption("--concurrent-fragments", "4");
        return request;
    }

    private static synchronized void ensureInitialized(Context context) throws YoutubeDLException {
        if (initialized) return;
        YoutubeDL.getInstance().init(context);
        initialized = true;
    }

    private boolean maybeUpdateYoutubeDL() {
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastUpdate = prefs.getLong("yt_dlp_updated_at", 0);
        if (now - lastUpdate < 24L * 60L * 60L * 1000L) return false;

        try {
            YoutubeDL.getInstance().updateYoutubeDL(this, YoutubeDL.UpdateChannel._STABLE);
            prefs.edit().putLong("yt_dlp_updated_at", now).apply();
            return true;
        } catch (Exception ignored) {
            prefs.edit().putLong("yt_dlp_updated_at", now).apply();
            return false;
        }
    }

    private boolean shouldSkipExistingRepair(JSONObject item) {
        if (!item.optBoolean("repair", false)) return false;
        File existing = fileFromUrl(item.optString("existing_file_url", item.optString("file_url", "")));
        return existing != null && existing.exists() && existing.length() > 0;
    }

    private File fileFromUrl(String url) {
        if (url == null || url.trim().isEmpty()) return null;
        try {
            Uri uri = Uri.parse(url);
            if (!"file".equalsIgnoreCase(uri.getScheme())) return null;
            String path = uri.getPath();
            return path == null || path.trim().isEmpty() ? null : new File(path);
        } catch (Exception ignored) {
            return null;
        }
    }

    private File findDownloadedFile(File dir, String baseName) {
        File[] files = dir.listFiles((file, name) -> name.startsWith(baseName + ".") && !name.endsWith(".part"));
        if (files == null || files.length == 0) return null;

        File best = null;
        for (File file : files) {
            if (best == null || file.length() > best.length()) best = file;
        }
        return best;
    }

    private void cleanupPartialFiles(String marker) {
        if (marker == null || marker.isEmpty()) return;
        File dir = new File(getFilesDir(), "youtube");
        File[] files = dir.listFiles((file, name) -> name.contains(marker) && (name.endsWith(".part") || name.endsWith(".tmp")));
        if (files == null) return;
        for (File file : files) file.delete();
    }

    private synchronized void appendQueue(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JSONArray current = getQueue();
            JSONArray incoming = new JSONArray(json);
            Set<String> queuedKeys = new HashSet<>();
            for (int i = 0; i < current.length(); i++) {
                String key = queueIdentity(current.optJSONObject(i));
                if (!key.isEmpty()) queuedKeys.add(key);
            }

            int added = 0;
            for (int i = 0; i < incoming.length(); i++) {
                JSONObject item = incoming.getJSONObject(i);
                String key = queueIdentity(item);
                if (!key.isEmpty() && queuedKeys.contains(key)) continue;
                current.put(item);
                if (!key.isEmpty()) queuedKeys.add(key);
                added++;
            }
            if (workerRunning) batchTotal += added;
            saveArray(QUEUE_KEY, current);
        } catch (Exception ignored) {}
    }

    private String queueIdentity(JSONObject item) {
        if (item == null) return "";
        String songId = item.optString("songId", "").trim();
        if (!songId.isEmpty()) return "song:" + songId;
        String id = item.optString("id", "").trim();
        if (!id.isEmpty()) return "id:" + id;
        String videoId = item.optString("videoId", "").trim();
        if (!videoId.isEmpty()) return "video:" + videoId;
        String query = item.optString("query", "").trim();
        if (!query.isEmpty()) return "query:" + query;
        return "";
    }

    private synchronized JSONObject pollQueue() {
        JSONArray queue = getQueue();
        if (queue.length() == 0) return null;
        JSONObject first = queue.optJSONObject(0);
        queue.remove(0);
        saveArray(QUEUE_KEY, queue);
        return first;
    }

    private synchronized void appendCompleted(JSONObject item) {
        JSONArray completed = getCompleted();
        completed.put(item);
        saveArray(COMPLETED_KEY, completed);
    }

    private void appendServiceError(Exception error) {
        try {
            JSONObject item = new JSONObject();
            item.put("id", "service-" + System.currentTimeMillis());
            item.put("status", "failed");
            item.put("title", "DreamTune");
            item.put("artist", "");
            item.put("error", error.getMessage() != null ? error.getMessage() : "Background download service failed");
            appendCompleted(item);
        } catch (Exception ignored) {}
    }

    private JSONArray getQueue() {
        return getArray(QUEUE_KEY);
    }

    private JSONArray getCompleted() {
        return getArray(COMPLETED_KEY);
    }

    private JSONArray getArray(String key) {
        try {
            String value = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key, "[]");
            return new JSONArray(value);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private void saveArray(String key, JSONArray array) {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(key, array.toString()).apply();
    }

    private void acquireWakeLock() {
        try {
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire(6L * 60L * 60L * 1000L);
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {}
    }

    private void publish(String text, boolean indeterminate) {
        startForeground(NOTIFICATION_ID, buildNotification(text, indeterminate));
    }

    private String formatTrackLabel(String title, String artist) {
        String cleanTitle = title == null ? "" : title.trim();
        String cleanArtist = artist == null ? "" : artist.trim();
        if (cleanArtist.isEmpty()) return cleanTitle.isEmpty() ? "DreamTune track" : cleanTitle;
        if (cleanTitle.isEmpty()) return cleanArtist;
        return cleanArtist + " - " + cleanTitle;
    }

    private void notifyTrackFinished(String label, boolean success, String errorMessage) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            getPackageManager().getLaunchIntentForPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, RESULT_CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setSmallIcon(R.drawable.ic_stat_dreamtune)
            .setContentTitle(success ? "DreamTune: track downloaded" : "DreamTune: download failed")
            .setContentText(success ? label : (label + (errorMessage == null || errorMessage.isEmpty() ? "" : " - " + errorMessage)))
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setShowWhen(true);

        manager.notify((int) (System.currentTimeMillis() % 100000) + 2300, builder.build());
    }

    private Notification buildNotification(String text, boolean indeterminate) {
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            getPackageManager().getLaunchIntentForPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        int max = Math.max(batchTotal, batchDone);
        builder
            .setSmallIcon(R.drawable.ic_stat_dreamtune)
            .setContentTitle("DreamTune is downloading")
            .setContentText(text)
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setShowWhen(false)
            .setProgress(max > 0 ? max : 100, Math.min(batchDone, max), indeterminate || max == 0);
        return builder.build();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "DreamTune downloads",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Background playlist downloads for DreamTune");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);

        NotificationChannel resultChannel = new NotificationChannel(
            RESULT_CHANNEL_ID,
            "DreamTune download results",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        resultChannel.setDescription("Completed DreamTune download notifications");
        resultChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(resultChannel);
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }
}
