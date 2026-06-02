export const OFFLINE_PLAYLISTS_KEY = 'dreamtune-offline-playlists-v1';

export function readOfflinePlaylists() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_PLAYLISTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function writeOfflinePlaylists(playlists) {
  try {
    localStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(playlists || []));
  } catch {}
}

export function normalizeSongIds(songIds = []) {
  return Array.from(new Set((Array.isArray(songIds) ? songIds : []).filter(Boolean).map(String)));
}

export function mergePlaylistSongIds(currentSongIds = [], incomingSongIds = []) {
  return normalizeSongIds([...currentSongIds, ...incomingSongIds]);
}

export function removeSongsFromPlaylists(playlists = [], songIds = []) {
  const ids = new Set((Array.isArray(songIds) ? songIds : [songIds]).filter(Boolean).map(String));
  if (!ids.size) return playlists;
  return playlists.map(playlist => ({
    ...playlist,
    song_ids: (playlist.song_ids || []).filter(id => !ids.has(String(id))),
  }));
}

export function upsertPlaylist(playlists = [], playlist) {
  if (!playlist?.id) return playlists;
  return playlists.some(item => item.id === playlist.id)
    ? playlists.map(item => item.id === playlist.id ? { ...item, ...playlist } : item)
    : [playlist, ...playlists];
}

export function removePlaylist(playlists = [], playlistId) {
  return playlists.filter(playlist => playlist.id !== playlistId);
}
