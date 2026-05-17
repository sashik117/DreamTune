package com.dreamtune.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.InputStream;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DreamTunePlaybackService extends Service {
    public static final String ACTION_UPDATE = "com.dreamtune.app.media.UPDATE";
    public static final String ACTION_CLEAR = "com.dreamtune.app.media.CLEAR";
    public static final String ACTION_MEDIA_COMMAND = "com.dreamtune.app.media.COMMAND";
    private static final String ACTION_PLAY = "com.dreamtune.app.media.PLAY";
    private static final String ACTION_PAUSE = "com.dreamtune.app.media.PAUSE";
    private static final String ACTION_NEXT = "com.dreamtune.app.media.NEXT";
    private static final String ACTION_PREVIOUS = "com.dreamtune.app.media.PREVIOUS";
    private static final String CHANNEL_ID = "dreamtune_playback";
    private static final int NOTIFICATION_ID = 1177;

    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaSession mediaSession;
    private PowerManager.WakeLock wakeLock;
    private Bitmap artwork;
    private String lastCoverUrl = "";
    private String title = "DreamTune";
    private String artist = "";
    private boolean isPlaying = false;
    private long positionMs = 0;
    private long durationMs = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        mediaSession = new MediaSession(this, "DreamTune");
        mediaSession.setActive(true);
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { sendCommand("play", 0); }
            @Override public void onPause() { sendCommand("pause", 0); }
            @Override public void onSkipToNext() { sendCommand("next", 0); }
            @Override public void onSkipToPrevious() { sendCommand("previous", 0); }
            @Override public void onSeekTo(long pos) { sendCommand("seek", Math.max(0, pos) / 1000.0); }
        });

        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "DreamTune:Playback");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_UPDATE;
        if (ACTION_CLEAR.equals(action)) {
            stopPlaybackService();
            return START_NOT_STICKY;
        }
        if (ACTION_PLAY.equals(action)) {
            isPlaying = true;
            sendCommand("play", 0);
            publish();
            return START_STICKY;
        }
        if (ACTION_PAUSE.equals(action)) {
            isPlaying = false;
            sendCommand("pause", 0);
            publish();
            return START_STICKY;
        }
        if (ACTION_NEXT.equals(action)) {
            sendCommand("next", 0);
            publish();
            return START_STICKY;
        }
        if (ACTION_PREVIOUS.equals(action)) {
            sendCommand("previous", 0);
            publish();
            return START_STICKY;
        }

        if (intent != null) {
            title = intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "DreamTune";
            artist = intent.getStringExtra("artist") != null ? intent.getStringExtra("artist") : "";
            isPlaying = intent.getBooleanExtra("isPlaying", false);
            positionMs = Math.max(0, Math.round(intent.getDoubleExtra("position", 0) * 1000));
            durationMs = Math.max(0, Math.round(intent.getDoubleExtra("duration", 0) * 1000));
            String coverUrl = intent.getStringExtra("coverUrl") != null ? intent.getStringExtra("coverUrl") : "";
            loadArtworkIfNeeded(coverUrl);
        }
        publish();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        artworkExecutor.shutdownNow();
        super.onDestroy();
    }

    private void publish() {
        updateWakeLock();
        updateMetadata();
        updatePlaybackState();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    private void updateMetadata() {
        MediaMetadata.Builder builder = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) {
            builder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork);
            builder.putBitmap(MediaMetadata.METADATA_KEY_ART, artwork);
        }
        mediaSession.setMetadata(builder.build());
    }

    private void updatePlaybackState() {
        long actions = PlaybackState.ACTION_PLAY
            | PlaybackState.ACTION_PAUSE
            | PlaybackState.ACTION_PLAY_PAUSE
            | PlaybackState.ACTION_SKIP_TO_NEXT
            | PlaybackState.ACTION_SKIP_TO_PREVIOUS
            | PlaybackState.ACTION_SEEK_TO;
        int state = isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED;
        mediaSession.setPlaybackState(new PlaybackState.Builder()
            .setActions(actions)
            .setState(state, positionMs, isPlaying ? 1f : 0f)
            .build());
    }

    private Notification buildNotification() {
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            getPackageManager().getLaunchIntentForPackage(getPackageName()),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setSmallIcon(R.drawable.ic_stat_dreamtune)
            .setContentTitle(title)
            .setContentText(artist)
            .setContentIntent(contentIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(isPlaying)
            .addAction(notificationAction(R.drawable.ic_media_previous, "Previous", ACTION_PREVIOUS))
            .addAction(notificationAction(isPlaying ? R.drawable.ic_media_pause : R.drawable.ic_media_play, isPlaying ? "Pause" : "Play", isPlaying ? ACTION_PAUSE : ACTION_PLAY))
            .addAction(notificationAction(R.drawable.ic_media_next, "Next", ACTION_NEXT))
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));

        if (artwork != null) builder.setLargeIcon(artwork);
        if (durationMs > 0) builder.setProgress((int) Math.min(Integer.MAX_VALUE, durationMs), (int) Math.min(Integer.MAX_VALUE, positionMs), false);
        return builder.build();
    }

    private Notification.Action notificationAction(int icon, String title, String action) {
        Intent intent = new Intent(this, DreamTunePlaybackService.class);
        intent.setAction(action);
        PendingIntent pendingIntent = PendingIntent.getService(
            this,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new Notification.Action.Builder(icon, title, pendingIntent).build();
    }

    private void sendCommand(String action, double position) {
        Intent intent = new Intent(ACTION_MEDIA_COMMAND);
        intent.setPackage(getPackageName());
        intent.putExtra("action", action);
        intent.putExtra("position", position);
        sendBroadcast(intent);
    }

    private void loadArtworkIfNeeded(String coverUrl) {
        if (coverUrl.equals(lastCoverUrl)) return;
        lastCoverUrl = coverUrl;
        artwork = null;
        if (coverUrl.isEmpty() || !coverUrl.startsWith("http")) return;

        artworkExecutor.execute(() -> {
            Bitmap bitmap = null;
            try (InputStream stream = new URL(coverUrl).openStream()) {
                bitmap = BitmapFactory.decodeStream(stream);
            } catch (Exception ignored) {}
            Bitmap finalBitmap = bitmap;
            mainHandler.post(() -> {
                if (coverUrl.equals(lastCoverUrl)) {
                    artwork = finalBitmap;
                    publish();
                }
            });
        });
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "DreamTune playback",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Music controls for DreamTune");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private void updateWakeLock() {
        if (isPlaying && !wakeLock.isHeld()) {
            wakeLock.acquire();
        } else if (!isPlaying) {
            releaseWakeLock();
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
    }

    private void stopPlaybackService() {
        releaseWakeLock();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }
}
