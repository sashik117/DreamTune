export function getSongPlayableSeconds(song) {
  if (!song) return 0;
  const duration = Number(song.duration || 0);
  const start = Math.max(0, Number(song.trim_start || 0));
  const rawEnd = Number(song.trim_end || 0);
  const end = rawEnd > start ? rawEnd : duration;
  const seconds = Math.max(0, (end || duration || 0) - start);
  return Number.isFinite(seconds) ? seconds : 0;
}

export function getPlaylistSeconds(songs = []) {
  return songs.reduce((total, song) => total + getSongPlayableSeconds(song), 0);
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
