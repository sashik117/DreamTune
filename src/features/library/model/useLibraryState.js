import { useEffect, useRef, useState } from 'react';
import { writeOfflinePlaylists } from '../../playlists/model/playlistModel';

export function useLibraryState({ loading = false } = {}) {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const songsRef = useRef([]);
  const playlistsRef = useRef([]);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    playlistsRef.current = playlists;
    if (loading && !playlists.length) return;
    writeOfflinePlaylists(playlists);
  }, [loading, playlists]);

  return {
    songs,
    setSongs,
    playlists,
    setPlaylists,
    songsRef,
    playlistsRef,
  };
}
