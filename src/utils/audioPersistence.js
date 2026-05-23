import { storage } from '@/api/SupabaseClient';
import { isNativeFileUrl, resolvePlayableAudioUrl } from './audioUrls';

function cleanPart(value, fallback) {
  const text = String(value || '').trim() || fallback;
  return text
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70)
    || fallback;
}

function audioExtension(type) {
  if (String(type || '').includes('mp4')) return 'm4a';
  if (String(type || '').includes('ogg')) return 'ogg';
  if (String(type || '').includes('wav')) return 'wav';
  return 'mp3';
}

export async function persistAudioFileUrl(fileUrl, song = {}) {
  if (!isNativeFileUrl(fileUrl) || typeof File === 'undefined') return fileUrl;

  try {
    const response = await fetch(resolvePlayableAudioUrl(fileUrl));
    if (!response.ok) throw new Error(`Audio copy failed: HTTP ${response.status}`);

    const blob = await response.blob();
    if (!blob.size) throw new Error('Audio copy failed: empty file');

    const name = [
      cleanPart(song.artist, 'dreamtune'),
      cleanPart(song.title, 'track'),
      Date.now(),
    ].join('-');
    const type = blob.type || 'audio/mpeg';
    const file = new File([blob], `${name}.${audioExtension(type)}`, { type });
    const stableUrl = await storage.uploadFile(file, 'songs');
    return stableUrl || fileUrl;
  } catch (error) {
    console.warn('Could not persist native audio copy:', error);
    return fileUrl;
  }
}
