package com.dreamtune.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeMediaSession")
public class NativeMediaSessionPlugin extends Plugin {
    private final BroadcastReceiver mediaCommandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            JSObject data = new JSObject();
            data.put("action", intent.getStringExtra("action"));
            data.put("position", intent.getDoubleExtra("position", 0));
            notifyListeners("mediaAction", data, true);
        }
    };

    @Override
    public void load() {
        IntentFilter filter = new IntentFilter(DreamTunePlaybackService.ACTION_MEDIA_COMMAND);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(mediaCommandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(mediaCommandReceiver, filter);
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        Intent intent = new Intent(getContext(), DreamTunePlaybackService.class);
        intent.setAction(DreamTunePlaybackService.ACTION_UPDATE);
        intent.putExtra("title", call.getString("title", "DreamTune"));
        intent.putExtra("artist", call.getString("artist", ""));
        intent.putExtra("coverUrl", call.getString("coverUrl", ""));
        intent.putExtra("isPlaying", Boolean.TRUE.equals(call.getBoolean("isPlaying", false)));
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

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().unregisterReceiver(mediaCommandReceiver);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
