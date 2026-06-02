import { media } from '@/api/SupabaseClient';
import { downloadYouTubeOnDevice } from '@/utils/nativeYouTube';

export async function fetchSpotifyTracks(playlistUrl) {
  return media.getSpotifyPlaylist(playlistUrl);
}

export async function searchSpotifyTracks(query) {
  const data = await media.searchSpotifyTracks(query, 12);
  return data.tracks || [];
}

export function normalizeSpotifyQuery(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeTrackText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(official|audio|video|lyrics?|remaster(?:ed)?|hd|4k)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function trackIdentity(track) {
  return `${normalizeTrackText(track?.artist)}::${normalizeTrackText(track?.title)}`;
}

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function searchYouTubeDirect(query) {
  const bases = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi-libre.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.syncpundit.io'];
  for (const base of bases) {
    try {
      const data = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const found = items.map(item => {
        const id = String(item.url || '').match(/[?&]v=([\w-]{11})/)?.[1];
        return id ? { video_id: id, title: item.title, thumbnail: item.thumbnail } : null;
      }).filter(Boolean).slice(0, 8);
      if (found.length) return found;
    } catch {}
  }
  const invidious = ['https://inv.thepixora.com', 'https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be'];
  for (const base of invidious) {
    try {
      const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const found = (Array.isArray(data) ? data : []).filter(item => item?.type === 'video' && item.videoId).map(item => ({
        video_id: item.videoId,
        title: item.title,
        thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
      })).slice(0, 8);
      if (found.length) return found;
    } catch {}
  }
  try {
    const data = await fetchJson(`https://yt.lemnoslife.com/search?part=snippet&q=${encodeURIComponent(query)}&type=video`);
    const found = (data.items || []).map(item => {
      const id = item?.id?.videoId || item?.videoId;
      return id ? {
        video_id: id,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      } : null;
    }).filter(Boolean).slice(0, 8);
    if (found.length) return found;
  } catch {}
  return [];
}

async function resolveDirectAudioUrl(videoId) {
  const bases = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi-libre.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.syncpundit.io'];
  for (const base of bases) {
    try {
      const data = await fetchJson(`${base}/streams/${videoId}`, 10000);
      const audio = (data.audioStreams || []).filter(item => item?.url).sort((a, b) => Number(b.bitrate || b.quality || 0) - Number(a.bitrate || a.quality || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }
  const invidious = ['https://inv.thepixora.com', 'https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be'];
  for (const base of invidious) {
    try {
      const data = await fetchJson(`${base}/api/v1/videos/${videoId}`, 10000);
      const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
      const audio = formats.filter(item => item?.url && String(item.type || item.mimeType || '').toLowerCase().includes('audio')).sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }
  return '';
}

async function findYouTubeCandidatesForTrack(track) {
  const baseQuery = `${track.artist || ''} ${track.title || ''}`.trim();
  const queries = Array.from(new Set([
    `${baseQuery} audio`,
    `${baseQuery} official audio`,
    `${baseQuery} lyrics`,
    track.youtube_query || baseQuery,
  ].filter(Boolean)));

  const candidates = [];
  for (const query of queries) {
    try {
      const meta = await media.searchYouTube(query);
      const results = meta.results?.length ? meta.results : [meta];
      for (const result of results) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    } catch (error) {
      console.warn('YouTube search failed:', query, error);
      const directResults = await searchYouTubeDirect(query);
      for (const result of directResults) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    }
    if (candidates.length >= 6) break;
  }
  return candidates;
}

export async function getAudioForTrack(track) {
  const candidates = await findYouTubeCandidatesForTrack(track);
  let audio = null;
  let result = null;
  for (const [index, candidate] of candidates.slice(0, 4).entries()) {
    if (index < 3) {
      try {
        const native = await downloadYouTubeOnDevice(candidate.video_id);
        if (native?.native_file_url || native?.file_url) {
          audio = { file_url: native.native_file_url || native.file_url, cover_url: native.cover_url || candidate.thumbnail, native: true };
          result = candidate;
          break;
        }
      } catch (error) {
        console.warn('Native YouTube candidate failed:', candidate.title || candidate.video_id, error);
      }
    }
    try {
      audio = await media.downloadYouTube(candidate.video_id);
      result = candidate;
      break;
    } catch (error) {
      console.warn('YouTube candidate failed:', candidate.title || candidate.video_id, error);
      const directUrl = await resolveDirectAudioUrl(candidate.video_id);
      if (directUrl) {
        audio = { file_url: directUrl, cover_url: candidate.thumbnail };
        result = candidate;
        break;
      }
    }
  }
  if (!audio?.file_url && track.preview_url) {
    audio = { file_url: track.preview_url, cover_url: track.cover_url };
    result = { video_id: '', thumbnail: track.cover_url };
  }
  if (!audio?.file_url) return null;
  let spotifyCoverUrl = track.cover_url || '';
  if (!spotifyCoverUrl && track.source_url) {
    try {
      const cover = await media.getSpotifyCover(track.source_url);
      spotifyCoverUrl = cover.cover_url || '';
    } catch {}
  }
  const fallbackCoverUrl = audio.cover_url || result.thumbnail || `https://img.youtube.com/vi/${result.video_id}/hqdefault.jpg`;
  return {
    fileUrl: audio.file_url,
    videoId: result?.video_id || '',
    coverUrl: spotifyCoverUrl || fallbackCoverUrl,
    spotifyCoverUrl,
    fallbackCoverUrl,
  };
}
