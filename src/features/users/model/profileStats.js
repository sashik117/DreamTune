export function getProfileCounts(songs = [], playlists = []) {
  return {
    publicPlaylists: playlists.filter(playlist => playlist.is_public),
    favoriteCount: songs.filter(song => song.is_favorite).length,
    artistCount: new Set(songs.map(song => song.artist).filter(Boolean)).size,
  };
}

export function buildPeriodStats(listenHistory = [], songs = [], period = 7) {
  const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
  const listens = listenHistory.filter(item => Number(item.listened_at || 0) >= cutoff);
  const listenedSongIds = new Set(listens.map(item => item.song_id).filter(Boolean));
  const listenedSongs = songs.filter(song => listenedSongIds.has(song.id));
  return {
    listens: listens.length,
    tracks: listenedSongIds.size,
    artists: new Set(listenedSongs.map(song => song.artist).filter(Boolean)).size,
    topTrack: listens.reduce((acc, item) => {
      const key = item.song_id || `${item.song_title}-${item.song_artist}`;
      acc[key] = acc[key] || { title: item.song_title || 'Unknown track', artist: item.song_artist || '', count: 0 };
      acc[key].count += 1;
      return acc;
    }, {}),
  };
}

export function getTopTrack(periodStats) {
  const tracks = Object.values(periodStats?.topTrack || {});
  return tracks.sort((a, b) => b.count - a.count)[0] || null;
}
