import { useCallback } from 'react';
import { entities } from '@/api/SupabaseClient';
import { removeSongsFromPlaylists } from '../../playlists/model/playlistModel';
import { prependNewTracks, removeTracks, upsertTrack } from './trackModel';

export function useTrackActions({ currentUserId, setSongs, setPlaylists, setEditingSong }) {
  const handleToggleFavorite = useCallback(async (song, forcedFavorite) => {
    if (song?.user_id && currentUserId && song.user_id !== currentUserId) return;
    const nextFavorite = typeof forcedFavorite === 'boolean' ? forcedFavorite : !song.is_favorite;
    const optimisticSong = { ...song, is_favorite: nextFavorite };
    setSongs(prev => upsertTrack(prev, optimisticSong));
    window.dispatchEvent(new CustomEvent('dreamtune-favorite-change', { detail: { song: optimisticSong } }));
    try {
      const updated = await entities.Song.update(song.id, { is_favorite: nextFavorite });
      const mergedSong = { ...song, ...updated, is_favorite: nextFavorite };
      setSongs(prev => upsertTrack(prev, mergedSong));
      window.dispatchEvent(new CustomEvent('dreamtune-favorite-change', { detail: { song: mergedSong } }));
    } catch (err) {
      setSongs(prev => upsertTrack(prev, song));
      window.dispatchEvent(new CustomEvent('dreamtune-favorite-change', { detail: { song } }));
      throw err;
    }
  }, [currentUserId, setSongs]);

  const handleDelete = useCallback(async (song) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${song.title || 'track'}" forever?`)) return false;
    setSongs(prev => removeTracks(prev, song.id));
    setPlaylists(prev => removeSongsFromPlaylists(prev, song.id));
    await entities.Song.delete(song.id);
    return true;
  }, [setPlaylists, setSongs]);

  const handleDeleteMany = useCallback(async (songIds) => {
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${songIds.length} songs forever?`)) return false;
    setSongs(prev => removeTracks(prev, songIds));
    setPlaylists(prev => removeSongsFromPlaylists(prev, songIds));
    await Promise.all(songIds.map(id => entities.Song.delete(id)));
    return true;
  }, [setPlaylists, setSongs]);

  const handleSongAdded = useCallback((newSong) => {
    setSongs(prev => upsertTrack(prev, newSong));
  }, [setSongs]);

  const handleSongsAdded = useCallback((newSongs) => {
    setSongs(prev => prependNewTracks(prev, newSongs));
  }, [setSongs]);

  const handleSongUpdated = useCallback((updatedSong) => {
    setSongs(prev => upsertTrack(prev, updatedSong));
    setEditingSong(prev => prev?.id === updatedSong.id ? { ...prev, ...updatedSong } : prev);
  }, [setEditingSong, setSongs]);

  return {
    handleToggleFavorite,
    handleDelete,
    handleDeleteMany,
    handleSongAdded,
    handleSongsAdded,
    handleSongUpdated,
  };
}
