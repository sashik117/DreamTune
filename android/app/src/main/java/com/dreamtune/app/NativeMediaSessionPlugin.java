package com.dreamtune.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSession")
public class NativeMediaSessionPlugin extends Plugin {
    private AudioManager audioManager;
    private AudioDeviceCallback audioDeviceCallback;

    private final BroadcastReceiver mediaCommandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            notifyMediaAction(intent.getStringExtra("action"), intent.getDoubleExtra("position", 0));
        }
    };

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) {
                notifyMediaAction("pause", 0);
            }
        }
    };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        IntentFilter filter = new IntentFilter(DreamTunePlaybackService.ACTION_MEDIA_COMMAND);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(mediaCommandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(mediaCommandReceiver, filter);
        }

        IntentFilter noisyFilter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(noisyReceiver, noisyFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(noisyReceiver, noisyFilter);
        }

        registerAudioDeviceCallback();
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), DreamTunePlaybackService.class);
        intent.setAction(DreamTunePlaybackService.ACTION_UPDATE);
        boolean isPlaying = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        intent.putExtra("title", call.getString("title", "DreamTune"));
        intent.putExtra("artist", call.getString("artist", ""));
        intent.putExtra("coverUrl", call.getString("coverUrl", ""));
        intent.putExtra("isPlaying", isPlaying);
        intent.putExtra("position", call.getDouble("position", 0.0));
        intent.putExtra("duration", call.getDouble("duration", 0.0));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Intent intent = new Intent(getContext(), DreamTunePlaybackService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    private void notifyMediaAction(String action, double position) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("position", position);
        notifyListeners("mediaAction", data, true);
    }

    private void registerAudioDeviceCallback() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || audioManager == null || audioDeviceCallback != null) return;
        audioDeviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                if (hasExternalAudioOutput(removedDevices)) {
                    notifyMediaAction("pause", 0);
                }
            }
        };
        audioManager.registerAudioDeviceCallback(audioDeviceCallback, new Handler(Looper.getMainLooper()));
    }

    private boolean hasExternalAudioOutput(AudioDeviceInfo[] devices) {
        if (devices == null) return false;
        for (AudioDeviceInfo device : devices) {
            if (device == null || !device.isSink()) continue;
            int type = device.getType();
            if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
                    || type == AudioDeviceInfo.TYPE_WIRED_HEADSET
                    || type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                    || type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
                    || type == AudioDeviceInfo.TYPE_USB_HEADSET
                    || type == AudioDeviceInfo.TYPE_USB_DEVICE
                    || type == AudioDeviceInfo.TYPE_HEARING_AID
                    || type == AudioDeviceInfo.TYPE_BLE_HEADSET
                    || type == AudioDeviceInfo.TYPE_BLE_SPEAKER) {
                return true;
            }
        }
        return false;
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(mediaCommandReceiver);
        } catch (Exception ignored) {}
        try {
            getContext().unregisterReceiver(noisyReceiver);
        } catch (Exception ignored) {}
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && audioManager != null && audioDeviceCallback != null) {
            audioManager.unregisterAudioDeviceCallback(audioDeviceCallback);
            audioDeviceCallback = null;
        }
        super.handleOnDestroy();
    }
}
