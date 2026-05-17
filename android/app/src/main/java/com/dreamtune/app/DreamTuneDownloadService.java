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
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DreamTuneDownloadService extends Service {
    public static final String ACTION_QUEUE = "com.dreamtune.app.download.QUEUE";
    private static final String CHANNEL_ID = "dreamtune_downloads";
    private static final String PREFS = "dreamtune-native-youtube";
    private static final String QUEUE_KEY = "download_queue";
    private static final String COMPLETED_KEY = "download_completed";
    private static final int NOTIFICATION_ID = 2191;

    private static boolean initialized = false;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private PowerManager.WakeLock wakeLock;
    private boolean workerRunning = false;
    private int batchTotal = 0;
    private int batchDone = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DreamTune:Downloads");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        publish("Готую фонове скачування", true);
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

                String title = item.optString("title", "DreamTune");
                String artist = item.optString("artist", "");
                publish((artist.isEmpty() ? title : artist + " - " + title), false);

                JSONObject completed = new JSONObject(item.toString());
                try {
                    File downloaded = downloadItem(item);
                    completed.put("status", "done");
                    completed.put("file_url", Uri.fromFile(downloaded).toString());
                    completed.put("file_name", downloaded.getName());
                    completed.put("size", downloaded.length());
                } catch (Exception error) {
                    cleanupPartialFiles(item.optString("videoId", ""));
                    completed.put("status", "failed");
                    completed.put("error", error.getMessage() != null ? error.getMessage() : "Download failed");
                }

                appendCompleted(completed);
                batchDone++;
                publish("Завантажено " + batchDone + " з " + Math.max(batchTotal, batchDone), false);
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
        String videoId = item.optString("videoId", "").trim();
        if (!videoId.matches("^[A-Za-z0-9_-]{11}$")) {
            throw new IllegalArgumentException("Valid videoId is required");
        }

        File dir = new File(getFilesDir(), "youtube");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Could not create youtube cache directory");
        }

        String baseName = System.currentTimeMillis() + "-" + videoId;
        String outputTemplate = new File(dir, baseName + ".%(ext)s").getAbsolutePath();
        try {
            YoutubeDL.getInstance().execute(buildDownloadRequest(videoId, outputTemplate));
        } catch (Exception firstError) {
            cleanupPartialFiles(videoId);
            if (!maybeUpdateYoutubeDL()) throw firstError;
            YoutubeDL.getInstance().execute(buildDownloadRequest(videoId, outputTemplate));
        }

        File downloaded = findDownloadedFile(dir, baseName);
        if (downloaded == null || downloaded.length() <= 0) {
            throw new IllegalStateException("Audio file was not created");
        }
        return downloaded;
    }

    private YoutubeDLRequest buildDownloadRequest(String videoId, String outputTemplate) {
        YoutubeDLRequest request = new YoutubeDLRequest("https://www.youtube.com/watch?v=" + videoId);
        request.addOption("-f", "bestaudio[ext=m4a][abr<=192]/bestaudio[abr<=192]/bestaudio[ext=m4a]/bestaudio/best");
        request.addOption("-o", outputTemplate);
        request.addOption("--no-playlist");
        request.addOption("--restrict-filenames");
        request.addOption("--no-warnings");
        request.addOption("--no-mtime");
        request.addOption("--force-overwrites");
        request.addOption("--socket-timeout", "12");
        request.addOption("--retries", "2");
        request.addOption("--fragment-retries", "1");
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

    private File findDownloadedFile(File dir, String baseName) {
        File[] files = dir.listFiles((file, name) -> name.startsWith(baseName + ".") && !name.endsWith(".part"));
        if (files == null || files.length == 0) return null;

        File best = null;
        for (File file : files) {
            if (best == null || file.length() > best.length()) best = file;
        }
        return best;
    }

    private void cleanupPartialFiles(String videoId) {
        if (videoId == null || videoId.isEmpty()) return;
        File dir = new File(getFilesDir(), "youtube");
        File[] files = dir.listFiles((file, name) -> name.contains(videoId) && (name.endsWith(".part") || name.endsWith(".tmp")));
        if (files == null) return;
        for (File file : files) file.delete();
    }

    private synchronized void appendQueue(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JSONArray current = getQueue();
            JSONArray incoming = new JSONArray(json);
            for (int i = 0; i < incoming.length(); i++) current.put(incoming.getJSONObject(i));
            if (workerRunning) batchTotal += incoming.length();
            saveArray(QUEUE_KEY, current);
        } catch (Exception ignored) {}
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
            if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
    }

    private void publish(String text, boolean indeterminate) {
        startForeground(NOTIFICATION_ID, buildNotification(text, indeterminate));
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
            .setContentTitle("DreamTune качає плейлист")
            .setContentText(text)
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setShowWhen(false)
            .setProgress(max > 0 ? max : 100, Math.min(batchDone, max), indeterminate || max == 0);
        return builder.build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "DreamTune downloads",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Background playlist downloads for DreamTune");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }
}
