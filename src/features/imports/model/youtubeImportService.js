import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { media } from '@/api/SupabaseClient';
import { downloadYouTubeOnDevice } from '@/utils/nativeYouTube';
import { repairMojibake } from '@/utils/text';

export async function findYouTubeResults(query) {
  try {
    const data = await media.searchYouTube(query);
    const serverResults = data.results?.length ? data.results : data.video_id ? [data] : [];
    if (serverResults.length) return serverResults;
  } catch (error) {
    console.warn('Server YouTube search failed:', error.message || error);
  }
  return [];
}

export function getVideoId(item) {
  return String(
    item?.video_id ||
    item?.videoId ||
    String(item?.url || item?.link || '').match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] ||
    ''
  ).trim();
}

export function getYouTubeThumbnail(item, videoId = getVideoId(item)) {
  const rawThumbnail = String(
    item?.youtube_thumbnail_url ||
    item?.youtubeThumbnail ||
    item?.thumbnail ||
    ''
  ).trim();

  if (rawThumbnail && !/spotify|scdn\.co/i.test(rawThumbnail)) {
    return rawThumbnail.startsWith('//') ? `https:${rawThumbnail}` : rawThumbnail;
  }

  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

export function normalizeYouTubeResult(item) {
  const videoId = getVideoId(item);
  const youtubeThumbnail = getYouTubeThumbnail(item, videoId);
  return {
    ...item,
    video_id: item?.video_id || videoId,
    videoId,
    youtube_thumbnail_url: youtubeThumbnail,
    thumbnail: youtubeThumbnail,
  };
}

export async function openExternalUrl(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform?.()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function getAudioUrl(videoId, { native = true } = {}) {
  if (native) {
    try {
      const nativeAudio = await downloadYouTubeOnDevice(videoId);
      if (nativeAudio?.native_file_url || nativeAudio?.file_url) return nativeAudio.native_file_url || nativeAudio.file_url;
    } catch (error) {
      console.warn('Native YouTube download failed, trying server:', error.message || error);
    }
  }
  try {
    const data = await media.downloadYouTube(videoId);
    if (data.file_url) return data.file_url;
  } catch (error) {
    console.warn('Server YouTube download failed:', error.message || error);
  }
  return '';
}

export async function getPreviewAudioUrl(videoId, { forceServer = false } = {}) {
  void forceServer;
  return getAudioUrl(videoId, { native: false });
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function normalizeCoverText(value) {
  return repairMojibake(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|visualizer|remaster(?:ed)?|hd|4k)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findSpotifyCover(title, artist) {
  const cleanTitle = repairMojibake(title || '').trim();
  const cleanArtist = repairMojibake(artist || '').trim();
  const queries = Array.from(new Set([
    `${cleanArtist} ${cleanTitle}`.trim(),
    cleanTitle,
  ].filter(Boolean)));
  const titleTokens = new Set(normalizeCoverText(cleanTitle).split(' ').filter(token => token.length > 2));

  for (const query of queries) {
    try {
      const data = await media.searchSpotifyTracks(query, 8);
      const best = (data.tracks || [])
        .filter(track => track?.cover_url)
        .map(track => {
          const haystack = normalizeCoverText(`${track.artist || ''} ${track.title || ''}`);
          let score = 0;
          for (const token of titleTokens) if (haystack.includes(token)) score += 1;
          if (cleanArtist && haystack.includes(normalizeCoverText(cleanArtist))) score += 2;
          return { track, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.track;
      if (best?.cover_url) return best.cover_url;
    } catch (error) {
      console.warn('Spotify cover lookup failed:', error.message || error);
    }
  }

  return '';
}
