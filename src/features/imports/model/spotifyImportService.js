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
