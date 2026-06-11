package com.dreamtune.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "NativeFileExport")
public class NativeFileExportPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void exportAudio(PluginCall call) {
        String sourceUrl = call.getString("sourceUrl", "").trim();
        if (sourceUrl.isEmpty()) {
            call.reject("Audio source is missing");
            return;
        }

        executor.execute(() -> {
            SourceFile source = null;
            File trimmedFile = null;
            try {
                JSObject data = call.getData();
                String title = data.optString("title", "DreamTune track");
                String artist = data.optString("artist", "");
                double trimStart = Math.max(0, data.optDouble("trimStart", 0));
                double trimEnd = Math.max(0, data.optDouble("trimEnd", 0));
                double duration = Math.max(0, data.optDouble("duration", 0));
                boolean shouldTrim = shouldTrim(trimStart, trimEnd, duration);

                source = prepareSourceFile(sourceUrl);
                File exportFile = source.file;
                String mimeType = source.mimeType;
                String extension = source.extension;
                boolean trimmed = false;

                if (shouldTrim) {
                    boolean webmTrim = mimeType != null && mimeType.toLowerCase(Locale.US).contains("webm");
                    String trimExtension = webmTrim ? "webm" : "m4a";
                    String trimMimeType = webmTrim ? "audio/webm" : "audio/mp4";
                    trimmedFile = new File(getContext().getCacheDir(), "dreamtune-export-" + System.currentTimeMillis() + "." + trimExtension);
                    trimAudio(source.file, trimmedFile, trimStart, trimEnd);
                    exportFile = trimmedFile;
                    mimeType = trimMimeType;
                    extension = trimExtension;
                    trimmed = true;
                }

                String fileName = buildFileName(title, artist, extension);
                Uri exportedUri = saveToMusic(exportFile, fileName, mimeType);

                JSObject result = new JSObject();
                result.put("uri", exportedUri.toString());
                result.put("file_name", fileName);
                result.put("size", exportFile.length());
                result.put("trimmed", trimmed);
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage() != null ? error.getMessage() : "Could not export audio", error);
            } finally {
                if (source != null && source.temporary) source.file.delete();
                if (trimmedFile != null) trimmedFile.delete();
            }
        });
    }

    private boolean shouldTrim(double start, double end, double duration) {
        if (start > 0.05) return true;
        if (end <= start + 0.05) return false;
        return duration <= 0 || end < duration - 0.25;
    }

    private SourceFile prepareSourceFile(String sourceUrl) throws Exception {
        if (sourceUrl.startsWith("file:")) {
            File file = new File(Uri.parse(sourceUrl).getPath());
            if (!file.exists()) throw new IllegalStateException("Audio file does not exist");
            return new SourceFile(file, false, extensionFor(sourceUrl, ""), mimeFor(sourceUrl, ""));
        }

        File capacitorFile = capacitorFileFromUrl(sourceUrl);
        if (capacitorFile != null) {
            if (!capacitorFile.exists()) throw new IllegalStateException("Audio file does not exist");
            return new SourceFile(capacitorFile, false, extensionFor(capacitorFile.getName(), ""), mimeFor(capacitorFile.getName(), ""));
        }

        if (sourceUrl.startsWith("content:")) {
            File copy = copyToTemp(getContext().getContentResolver().openInputStream(Uri.parse(sourceUrl)), extensionFor(sourceUrl, ""));
            return new SourceFile(copy, true, extensionFor(copy.getName(), ""), mimeFor(sourceUrl, ""));
        }

        if (sourceUrl.startsWith("http://") || sourceUrl.startsWith("https://")) {
            HttpURLConnection connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("User-Agent", "DreamTune/1.0");
            connection.setRequestProperty("Accept", "audio/*,*/*;q=0.8");
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                connection.disconnect();
                throw new IllegalStateException("Audio download failed: HTTP " + code);
            }
            String contentType = connection.getContentType();
            File copy = copyToTemp(connection.getInputStream(), extensionFor(sourceUrl, contentType));
            connection.disconnect();
            return new SourceFile(copy, true, extensionFor(copy.getName(), contentType), mimeFor(sourceUrl, contentType));
        }

        File file = new File(sourceUrl);
        if (!file.exists()) throw new IllegalStateException("Audio file does not exist");
        return new SourceFile(file, false, extensionFor(file.getName(), ""), mimeFor(file.getName(), ""));
    }

    private File capacitorFileFromUrl(String value) {
        int marker = value.indexOf("/_capacitor_file_/");
        if (marker < 0) return null;
        String path = value.substring(marker + "/_capacitor_file_".length());
        try {
            path = URLDecoder.decode(path, "UTF-8");
        } catch (Exception ignored) {}
        if (!path.startsWith("/")) path = "/" + path;
        return new File(path);
    }

    private File copyToTemp(InputStream input, String extension) throws Exception {
        if (input == null) throw new IllegalStateException("Audio source could not be opened");
        File file = new File(getContext().getCacheDir(), "dreamtune-source-" + System.currentTimeMillis() + "." + extension);
        try (InputStream in = input; FileOutputStream out = new FileOutputStream(file)) {
            copy(in, out);
        }
        if (!file.exists() || file.length() <= 0) throw new IllegalStateException("Audio source is empty");
        return file;
    }

    private void trimAudio(File input, File output, double startSeconds, double endSeconds) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        MediaMuxer muxer = null;
        try {
            extractor.setDataSource(input.getAbsolutePath());
            int audioTrack = -1;
            MediaFormat inputFormat = null;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    audioTrack = i;
                    inputFormat = format;
                    break;
                }
            }
            if (audioTrack < 0 || inputFormat == null) throw new IllegalStateException("No audio track found to trim");

            String mime = inputFormat.getString(MediaFormat.KEY_MIME);
            int outputFormat = (mime != null && mime.toLowerCase(Locale.US).contains("webm"))
                ? MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM
                : MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4;
            muxer = new MediaMuxer(output.getAbsolutePath(), outputFormat);
            int outputTrack = muxer.addTrack(inputFormat);
            muxer.start();

            extractor.selectTrack(audioTrack);
            long startUs = Math.max(0, (long) (startSeconds * 1_000_000L));
            long endUs = endSeconds > startSeconds ? (long) (endSeconds * 1_000_000L) : -1L;
            if (startUs > 0) extractor.seekTo(startUs, MediaExtractor.SEEK_TO_CLOSEST_SYNC);

            int maxInputSize = inputFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)
                ? inputFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
                : 1024 * 1024;
            ByteBuffer buffer = ByteBuffer.allocate(Math.max(64 * 1024, maxInputSize));
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            boolean wroteSamples = false;

            while (true) {
                int trackIndex = extractor.getSampleTrackIndex();
                if (trackIndex < 0) break;
                if (trackIndex != audioTrack) {
                    extractor.advance();
                    continue;
                }

                long sampleTime = extractor.getSampleTime();
                if (sampleTime < 0) break;
                if (endUs > 0 && sampleTime > endUs) break;
                if (sampleTime + 10_000L < startUs) {
                    extractor.advance();
                    continue;
                }

                info.offset = 0;
                info.size = extractor.readSampleData(buffer, 0);
                if (info.size < 0) break;
                info.presentationTimeUs = Math.max(0, sampleTime - startUs);
                info.flags = extractor.getSampleFlags();
                muxer.writeSampleData(outputTrack, buffer, info);
                wroteSamples = true;
                extractor.advance();
            }

            if (!wroteSamples || !output.exists() || output.length() <= 0) {
                throw new IllegalStateException("Could not create trimmed audio");
            }
        } finally {
            try { extractor.release(); } catch (Exception ignored) {}
            if (muxer != null) {
                try { muxer.stop(); } catch (Exception ignored) {}
                try { muxer.release(); } catch (Exception ignored) {}
            }
        }
    }

    private Uri saveToMusic(File source, String fileName, String mimeType) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Audio.Media.MIME_TYPE, mimeType);
            values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/DreamTune");
            values.put(MediaStore.Audio.Media.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("Could not create exported audio file");
            try (OutputStream out = resolver.openOutputStream(uri); FileInputStream in = new FileInputStream(source)) {
                if (out == null) throw new IllegalStateException("Could not open exported audio file");
                copy(in, out);
            }
            values.clear();
            values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return uri;
        }

        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "DreamTune");
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create Music/DreamTune");
        File output = new File(dir, fileName);
        try (FileInputStream in = new FileInputStream(source); FileOutputStream out = new FileOutputStream(output)) {
            copy(in, out);
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { output.getAbsolutePath() }, new String[] { mimeType }, null);
        return Uri.fromFile(output);
    }

    private void copy(InputStream in, OutputStream out) throws Exception {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
        out.flush();
    }

    private String buildFileName(String title, String artist, String extension) {
        String base = ((artist == null || artist.trim().isEmpty()) ? "" : artist.trim() + " - ") + (title == null ? "" : title.trim());
        base = base.replaceAll("[\\\\/:*?\"<>|]+", " ").replaceAll("\\s+", " ").trim();
        if (base.isEmpty()) base = "DreamTune track";
        if (base.length() > 90) base = base.substring(0, 90).trim();
        return base + "." + extension;
    }

    private String extensionFor(String source, String contentType) {
        String lower = source == null ? "" : source.toLowerCase(Locale.US);
        for (String ext : new String[] { "m4a", "mp3", "ogg", "wav", "webm", "aac", "flac" }) {
            if (lower.matches(".*\\." + ext + "(\\?.*)?$")) return ext;
        }
        String type = contentType == null ? "" : contentType.toLowerCase(Locale.US);
        if (type.contains("mp4") || type.contains("m4a")) return "m4a";
        if (type.contains("mpeg") || type.contains("mp3")) return "mp3";
        if (type.contains("ogg")) return "ogg";
        if (type.contains("wav")) return "wav";
        if (type.contains("webm")) return "webm";
        if (type.contains("aac")) return "aac";
        if (type.contains("flac")) return "flac";
        return "mp3";
    }

    private String mimeFor(String source, String contentType) {
        if (contentType != null && contentType.toLowerCase(Locale.US).startsWith("audio/")) return contentType.split(";")[0].trim();
        String ext = extensionFor(source, contentType);
        if ("m4a".equals(ext) || "aac".equals(ext)) return "audio/mp4";
        if ("mp3".equals(ext)) return "audio/mpeg";
        if ("ogg".equals(ext)) return "audio/ogg";
        if ("wav".equals(ext)) return "audio/wav";
        if ("webm".equals(ext)) return "audio/webm";
        if ("flac".equals(ext)) return "audio/flac";
        return "audio/mpeg";
    }

    private static class SourceFile {
        final File file;
        final boolean temporary;
        final String extension;
        final String mimeType;

        SourceFile(File file, boolean temporary, String extension, String mimeType) {
            this.file = file;
            this.temporary = temporary;
            this.extension = extension;
            this.mimeType = mimeType;
        }
    }
}
