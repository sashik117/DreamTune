export const PLAYBACK_STATE_KEY = 'dreamtune-playback-state-v1';
export const MEDIA_SESSION_POSITION_UPDATE_MS = 5000;

export function serializeSong(song) {
  if (!song?.id) return null;
  return {
    id: song.id,
    title: song.title || '',
    artist: song.artist || '',
    cover_url: song.cover_url || '',
    native_cover_url: song.native_cover_url || '',
    cover_position: song.cover_position || '50% 50%',
    cover_scale: song.cover_scale || 1,
    file_url: song.file_url || '',
    offline_file_url: song.offline_file_url || '',
    duration: song.duration || 0,
    trim_start: song.trim_start || 0,
    trim_end: song.trim_end || 0,
    lyrics: song.lyrics || '',
    is_offline: Boolean(song.is_offline),
  };
}

export function dedupeSongs(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function shuffleSongs(items = [], currentSongId = null) {
  const deduped = dedupeSongs(items);
  const current = currentSongId ? deduped.find(song => song.id === currentSongId) : null;
  const rest = deduped.filter(song => song.id !== currentSongId);
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current ? [current, ...rest] : rest;
}
