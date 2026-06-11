import { Capacitor, registerPlugin } from '@capacitor/core';
import { resolvePlayableAudioUrl } from './audioUrls';

const NativeFileExport = registerPlugin('NativeFileExport');

function isAndroidApp() {
  return Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';
}

function cleanFilePart(value, fallback) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 90)
    || fallback;
}

function extensionFromUrl(url) {
  const clean = String(url || '').split('?')[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] || 'mp3';
}

function pickSourceUrl(song) {
  return [
    song?.offline_file_url,
    song?.source_file_url,
    song?.file_url,
    resolvePlayableAudioUrl(song?.offline_file_url),
    resolvePlayableAudioUrl(song?.source_file_url),
    resolvePlayableAudioUrl(song?.file_url),
  ].find(Boolean) || '';
}

function trimPayload(song) {
  const trimStart = Math.max(0, Number(song?.trim_start || 0));
  const trimEnd = Math.max(0, Number(song?.trim_end || 0));
  const duration = Math.max(0, Number(song?.duration || 0));
  return { trimStart, trimEnd, duration };
}

function hasTrim(song) {
  const { trimStart, trimEnd, duration } = trimPayload(song);
  if (trimStart > 0.05) return true;
  return trimEnd > trimStart + 0.05 && (!duration || trimEnd < duration - 0.25);
}

async function browserDownload(song, sourceUrl) {
  if (hasTrim(song)) {
    throw new Error('Trimmed export is available in the Android app.');
  }

  const playableUrl = resolvePlayableAudioUrl(sourceUrl);
  if (!playableUrl) throw new Error('Audio source is missing');
  const response = await fetch(playableUrl);
  if (!response.ok) throw new Error('Could not download audio');
  const blob = await response.blob();
  const artist = cleanFilePart(song?.artist, '');
  const title = cleanFilePart(song?.title, 'DreamTune track');
  const fileName = `${artist ? `${artist} - ` : ''}${title}.${extensionFromUrl(playableUrl)}`;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  return { file_name: fileName, trimmed: false };
}

export async function exportSongToDevice(song) {
  const sourceUrl = pickSourceUrl(song);
  if (!sourceUrl) throw new Error('Audio source is missing');

  if (!isAndroidApp()) {
    return browserDownload(song, sourceUrl);
  }

  return NativeFileExport.exportAudio({
    sourceUrl,
    title: cleanFilePart(song?.title, 'DreamTune track'),
    artist: cleanFilePart(song?.artist, ''),
    ...trimPayload(song),
  });
}

export async function exportSongsToDevice(songs, onProgress) {
  const rows = Array.isArray(songs) ? songs.filter(Boolean) : [];
  if (!rows.length) return { done: 0, failed: 0, results: [] };

  const results = [];
  let done = 0;
  let failed = 0;

  for (const song of rows) {
    try {
      const result = await exportSongToDevice(song);
      results.push({ song, result, ok: true });
      done += 1;
    } catch (error) {
      results.push({ song, error, ok: false });
      failed += 1;
    }
    onProgress?.({ done, failed, total: rows.length, song });
  }

  return { done, failed, results };
}
