export function isHttpAudioUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

export function buildLibrarySyncItem(song, index) {
  const title = String(song?.title || '').trim();
  const artist = String(song?.artist || '').trim();
  const query = `${artist} ${title}`.trim();
  const originalFileUrl = song?.file_url || '';

  return {
    id: `library-sync-${song.id}-${Date.now()}-${index}`,
    songId: song.id,
    librarySync: true,
    sourceFileUrl: isHttpAudioUrl(originalFileUrl) ? originalFileUrl : '',
    original_file_url: originalFileUrl,
    query: query ? `${query} audio` : '',
    title: title || 'DreamTune track',
    artist,
    cover_url: song?.cover_url || '',
    duration: song?.duration || 0,
    trim_start: song?.trim_start || 0,
    trim_end: song?.trim_end || 0,
    lyrics: song?.lyrics || '',
  };
}

export function mergeTracksWithOfflineMeta(serverTracks = [], offlineTracks = []) {
  const offlineById = new Map((offlineTracks || []).map(song => [song.id, song]));
  return (serverTracks || []).map(song => {
    const offline = offlineById.get(song.id);
    if (!offline) return song;
    return {
      ...song,
      cover_url: offline.cover_url || song.cover_url,
      native_cover_url: offline.native_cover_url || song.cover_url || '',
      offline_file_url: offline.offline_file_url || '',
      is_offline: true,
    };
  });
}

export function upsertTrack(tracks = [], track) {
  if (!track?.id) return tracks;
  return tracks.some(item => item.id === track.id)
    ? tracks.map(item => item.id === track.id ? { ...item, ...track } : item)
    : [track, ...tracks];
}

export function prependNewTracks(tracks = [], incomingTracks = []) {
  const existing = new Set(tracks.map(track => track.id));
  return [...incomingTracks.filter(track => track?.id && !existing.has(track.id)), ...tracks];
}

export function removeTracks(tracks = [], songIds = []) {
  const ids = new Set((Array.isArray(songIds) ? songIds : [songIds]).filter(Boolean).map(String));
  if (!ids.size) return tracks;
  return tracks.filter(song => !ids.has(String(song.id)));
}
