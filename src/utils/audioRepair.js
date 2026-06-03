import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from './audioCache';
import { isNativeFileUrl } from './audioUrls';
import { persistAudioFileUrl } from './audioPersistence';
import { canUseNativeYouTube, downloadYouTubeOnDevice, startYouTubeDownloadQueue } from './nativeYouTube';

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
    try {
      const meta = await media.searchYouTube(query);
      const results = meta?.results?.length ? meta.results : meta?.video_id ? [meta] : [];
      for (const result of results) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    } catch {}

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
