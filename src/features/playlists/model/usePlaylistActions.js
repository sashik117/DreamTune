import { useCallback } from 'react';
import { entities } from '@/api/SupabaseClient';
import { mergePlaylistSongIds, upsertPlaylist } from './playlistModel';

export function usePlaylistActions({ playlists, setPlaylists }) {
  const handlePlaylistAdded = useCallback((playlist) => {
    setPlaylists(prev => upsertPlaylist(prev, playlist));
  }, [setPlaylists]);

  const handlePlaylistUpdated = useCallback((playlist) => {
    setPlaylists(prev => upsertPlaylist(prev, playlist));
  }, [setPlaylists]);

  const handleAddSongsToPlaylist = useCallback(async (songIds, playlistId) => {
    const playlist = playlists.find(pl => pl.id === playlistId);
    if (!playlist) return null;
    const merged = mergePlaylistSongIds(playlist.song_ids, songIds);
    const updated = await entities.Playlist.update(playlistId, { song_ids: merged });
    setPlaylists(prev => upsertPlaylist(prev, updated));
    return updated;
  }, [playlists, setPlaylists]);

  return {
    handlePlaylistAdded,
    handlePlaylistUpdated,
    handleAddSongsToPlaylist,
  };
}
