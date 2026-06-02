export function resolveCollabPlaylistSongs(playlist, sharedSongs = [], songs = []) {
  return (playlist.song_ids || [])
    .map(id => sharedSongs.find(song => song.id === id) || songs.find(song => song.id === id))
    .filter(Boolean);
}

export function isCollabPlaylistOwner(playlist, currentUser) {
  return playlist.owner_id === currentUser?.id || playlist.owner_email === currentUser?.email;
}

export function getCollabMemberCount(playlist) {
  return ((playlist.collaborator_ids || []).length || (playlist.collaborator_emails || []).length) + 1;
}

export function getPlaylistDurationKey(playlistSongs = []) {
  return playlistSongs
    .map(song => [song.id, song.file_url, song.duration || 0, song.trim_start || 0, song.trim_end || 0].join(':'))
    .join('|');
}

export function pluralSong(count) {
  return count === 1 ? 'song' : 'songs';
}

export function pluralMember(count) {
  return count === 1 ? 'member' : 'members';
}

export function parsePlaylistCoverPosition(value) {
  const [x = '50%', y = '50%'] = String(value || '50% 50%').split(' ');
  return { x: Number(x.replace('%', '')) || 50, y: Number(y.replace('%', '')) || 50 };
}
