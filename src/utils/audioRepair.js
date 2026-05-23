import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from './audioCache';
import { isNativeFileUrl } from './audioUrls';
import { persistAudioFileUrl } from './audioPersistence';
import { canUseNativeYouTube, downloadYouTubeOnDevice, startYouTubeDownloadQueue } from './nativeYouTube';

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function searchYouTubeDirect(query) {
  const pipedInstances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi-libre.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.syncpundit.io',
  ];

  for (const base of pipedInstances) {
    try {
      const data = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const results = items
        .map(item => {
          const id = String(item.url || '').match(/[?&]v=([\w-]{11})/)?.[1];
          return id ? { video_id: id, title: item.title, thumbnail: item.thumbnail } : null;
        })
        .filter(Boolean);
      if (results.length) return results;
    } catch {}
  }

  const invidiousInstances = [
    'https://inv.thepixora.com',
    'https://yt.chocolatemoo53.com',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
  ];

  for (const base of invidiousInstances) {
    try {
      const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const results = (Array.isArray(data) ? data : [])
        .filter(item => item?.type === 'video' && item?.videoId)
        .map(item => ({
          video_id: item.videoId,
          title: item.title,
          thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
        }));
      if (results.length) return results;
    } catch {}
  }

  return [];
}

async function findYouTubeCandidates(song) {
  const title = String(song?.title || '').trim();
  const artist = String(song?.artist || '').trim();
  const baseQuery = `${artist} ${title}`.trim() || title;
  if (!baseQuery) return [];

  const queries = Array.from(new Set([
    `${baseQuery} audio`,
    `${baseQuery} official audio`,
    `${baseQuery} lyrics`,
    baseQuery,
  ]));

  const candidates = [];
  for (const query of queries) {
    let foundForQuery = false;
    try {
      const meta = await media.searchYouTube(query);
      const results = meta?.results?.length ? meta.results : meta?.video_id ? [meta] : [];
      for (const result of results) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
          foundForQuery = true;
        }
      }
    } catch {}

    if (!foundForQuery) {
      const direct = await searchYouTubeDirect(query);
      for (const result of direct) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    }

    if (candidates.length >= 6) break;
  }

  return candidates;
}

export async function queueBrokenSongRepairs(songs, { limit = 250 } = {}) {
  if (!canUseNativeYouTube() || !Array.isArray(songs) || !songs.length) {
    return { checked: 0, broken: 0, queued: 0 };
  }

  const candidates = songs
    .filter(song => song?.id && isNativeFileUrl(song.file_url))
    .slice(0, limit);
  const queueItems = [];

  for (const song of candidates) {
    const baseQuery = `${song.artist || ''} ${song.title || ''}`.trim();
    if (!baseQuery) continue;
    queueItems.push({
      id: `repair-${song.id}-${Date.now()}-${queueItems.length}`,
      songId: song.id,
      repair: true,
      query: `${baseQuery} audio`,
      existing_file_url: song.file_url || '',
      title: song.title || 'DreamTune track',
      artist: song.artist || '',
      cover_url: song.cover_url || '',
    });
  }

  if (queueItems.length) {
    await startYouTubeDownloadQueue(queueItems);
  }

  return { checked: candidates.length, broken: queueItems.length, queued: queueItems.length };
}

async function resolveReplacementAudio(videoId) {
  if (canUseNativeYouTube()) {
    try {
      const native = await downloadYouTubeOnDevice(videoId);
      const nativeUrl = native?.native_file_url || native?.file_url;
      if (nativeUrl) return nativeUrl;
    } catch (error) {
      console.warn('Native repair download failed:', error);
    }
  }

  try {
    const data = await media.downloadYouTube(videoId);
    if (data?.file_url) return data.file_url;
  } catch (error) {
    console.warn('Server repair download failed:', error);
  }

  return '';
}

export async function repairSongAudio(song) {
  const candidates = await findYouTubeCandidates(song);
  for (const candidate of candidates.slice(0, 5)) {
    const fileUrl = await resolveReplacementAudio(candidate.video_id);
    if (!fileUrl) continue;

    const stableFileUrl = await persistAudioFileUrl(fileUrl, song);
    const repairedSong = { ...song, file_url: stableFileUrl };
    const updated = await entities.Song.update(song.id, { file_url: stableFileUrl });
    await downloadSong({ ...repairedSong, ...updated, file_url: stableFileUrl }, () => {});
    return { ...repairedSong, ...updated, file_url: stableFileUrl };
  }

  return null;
}
