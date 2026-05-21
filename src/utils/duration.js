import { getCachedAudio } from './audioCache';
import { resolvePlayableAudioUrl } from './audioUrls';

const durationCache = new Map();
const METADATA_TIMEOUT_MS = 6000;

function getTrimmedSeconds(song, naturalDuration) {
  const duration = Number(naturalDuration || 0);
  const start = Math.max(0, Number(song?.trim_start || 0));
  const rawEnd = Number(song?.trim_end || 0);
  const end = rawEnd > start ? rawEnd : duration;
  const seconds = Math.max(0, (end || duration || 0) - start);
  return Number.isFinite(seconds) ? seconds : 0;
}

export function getSongPlayableSeconds(song) {
  if (!song) return 0;
  return getTrimmedSeconds(song, Number(song.duration || 0));
}

export function getPlaylistSeconds(songs = []) {
  return songs.reduce((total, song) => total + getSongPlayableSeconds(song), 0);
}

function getDurationCacheKey(song) {
  return [
    song?.id || '',
    song?.file_url || '',
    song?.duration || 0,
    song?.trim_start || 0,
    song?.trim_end || 0,
  ].join('|');
}

export async function resolveSongPlayableSeconds(song) {
  const knownSeconds = getSongPlayableSeconds(song);
  if (knownSeconds > 0) return knownSeconds;
  if (!song?.file_url || typeof Audio === 'undefined') return 0;

  const key = getDurationCacheKey(song);
  if (durationCache.has(key)) return durationCache.get(key);

  const promise = new Promise((resolve) => {
    let settled = false;
    let audio = null;
    let objectUrl = '';
    let timeoutId = null;

    const finish = (seconds) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (audio) {
        audio.removeAttribute('src');
        audio.load();
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(seconds);
    };

    (async () => {
      try {
        objectUrl = await getCachedAudio(song.file_url);
        const src = objectUrl || resolvePlayableAudioUrl(song.file_url);
        if (!src) {
          finish(0);
          return;
        }

        audio = new Audio();
        audio.preload = 'metadata';
        audio.addEventListener('loadedmetadata', () => {
          const naturalDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
          finish(getTrimmedSeconds(song, naturalDuration));
        }, { once: true });
        audio.addEventListener('error', () => finish(0), { once: true });
        timeoutId = setTimeout(() => finish(0), METADATA_TIMEOUT_MS);
        audio.src = src;
        audio.load();
      } catch {
        finish(0);
      }
    })();
  });

  durationCache.set(key, promise);
  const seconds = await promise;
  durationCache.set(key, Promise.resolve(seconds));
  return seconds;
}

export async function resolvePlaylistSeconds(songs = [], onProgress) {
  const list = songs.filter(Boolean);
  let total = getPlaylistSeconds(list);
  onProgress?.(total);

  const missing = list.filter(song => getSongPlayableSeconds(song) <= 0 && song.file_url);
  if (!missing.length) return total;

  let index = 0;
  const workerCount = Math.min(4, missing.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (index < missing.length) {
      const song = missing[index];
      index += 1;
      const seconds = await resolveSongPlayableSeconds(song);
      total += seconds;
      onProgress?.(total);
    }
  });

  await Promise.all(workers);
  return total;
}

export function formatPlaylistDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  if (!total) return '0 хв';
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours && minutes) return `${hours} год ${minutes} хв`;
  if (hours) return `${hours} год`;
  return `${Math.max(1, minutes)} хв`;
}
