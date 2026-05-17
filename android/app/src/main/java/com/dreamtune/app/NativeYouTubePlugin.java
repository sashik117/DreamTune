package com.dreamtune.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;

import java.io.File;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeYouTube")
public class NativeYouTubePlugin extends Plugin {
    private static final String PREFS = "dreamtune-native-youtube";
    private static final String COMPLETED_KEY = "download_completed";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean initialized = false;

    @PluginMethod
    public void download(PluginCall call) {
        String videoId = call.getString("videoId", "").trim();
        if (!videoId.matches("^[A-Za-z0-9_-]{11}$")) {
            call.reject("Valid videoId is required");
            return;
        }

        executor.execute(() -> {
            try {
                ensureInitialized();

                File dir = new File(getContext().getFilesDir(), "youtube");
                if (!dir.exists() && !dir.mkdirs()) {
                    throw new IllegalStateException("Could not create youtube cache directory");
                }

                String baseName = System.currentTimeMillis() + "-" + videoId;
                String outputTemplate = new File(dir, baseName + ".%(ext)s").getAbsolutePath();

                try {
                    YoutubeDL.getInstance().execute(buildDownloadRequest(videoId, outputTemplate));
                } catch (Exception firstError) {
                    cleanupPartialFiles(videoId);
                    if (!maybeUpdateYoutubeDL()) {
                        throw firstError;
                    }
                    YoutubeDL.getInstance().execute(buildDownloadRequest(videoId, outputTemplate));
                }

                File downloaded = findDownloadedFile(dir, baseName);
                if (downloaded == null || downloaded.length() <= 0) {
                    throw new IllegalStateException("Audio file was not created");
                }

                JSObject result = new JSObject();
                result.put("file_url", Uri.fromFile(downloaded).toString());
                result.put("cover_url", "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg");
                result.put("file_name", downloaded.getName());
                result.put("size", downloaded.length());
                result.put("native", true);
                call.resolve(result);
            } catch (Exception error) {
                cleanupPartialFiles(videoId);
                call.reject(error.getMessage() != null ? error.getMessage() : "Native YouTube download failed", error);
            }
        });
    }

    @PluginMethod
    public void queue(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null || items.length() == 0) {
            call.reject("Download queue items are required");
            return;
        }

        Intent intent = new Intent(getContext(), DreamTuneDownloadService.class);
        intent.setAction(DreamTuneDownloadService.ACTION_QUEUE);
        intent.putExtra("items", items.toString());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        JSObject result = new JSObject();
        result.put("queued", items.length());
        call.resolve(result);
    }

    @PluginMethod
    public void completed(PluginCall call) {
        JSObject result = new JSObject();
        result.put("items", getCompletedDownloads());
        call.resolve(result);
    }

    @PluginMethod
    public void clearCompleted(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null || ids.length() == 0) {
            call.resolve();
            return;
        }

        Set<String> removeIds = new HashSet<>();
        for (int i = 0; i < ids.length(); i++) {
            removeIds.add(String.valueOf(ids.opt(i)));
        }

        JSONArray current = getCompletedDownloads();
        JSONArray next = new JSONArray();
        for (int i = 0; i < current.length(); i++) {
            JSONObject item = current.optJSONObject(i);
            if (item == null || removeIds.contains(item.optString("id"))) continue;
            next.put(item);
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(COMPLETED_KEY, next.toString()).apply();
        call.resolve();
    }

    private synchronized void ensureInitialized() throws YoutubeDLException {
        if (initialized) return;
        YoutubeDL.getInstance().init(getContext());
        initialized = true;
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

    private boolean maybeUpdateYoutubeDL() {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastUpdate = prefs.getLong("yt_dlp_updated_at", 0);
        if (now - lastUpdate < 24L * 60L * 60L * 1000L) return false;

        try {
            YoutubeDL.getInstance().updateYoutubeDL(context, YoutubeDL.UpdateChannel._STABLE);
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
        File dir = new File(getContext().getFilesDir(), "youtube");
        File[] files = dir.listFiles((file, name) -> name.contains(videoId) && (name.endsWith(".part") || name.endsWith(".tmp")));
        if (files == null) return;
        for (File file : files) {
            // Best-effort cleanup only; a failed delete is harmless and should not mask the real error.
            file.delete();
        }
    }

    private JSONArray getCompletedDownloads() {
        try {
            String value = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(COMPLETED_KEY, "[]");
            return new JSONArray(value);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }
}
