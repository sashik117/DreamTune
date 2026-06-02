import { useEffect } from 'react';
import { supabase } from '@/api/SupabaseClient';
import { removePlaylist, removeSongsFromPlaylists, upsertPlaylist } from '../../playlists/model/playlistModel';
import { removeTracks, upsertTrack } from '../../tracks/model/trackModel';

export function useLibraryRealtime({ currentUserId, setSongs, setPlaylists, setEditingSong }) {
  useEffect(() => {
    if (!currentUserId) return undefined;
    const channel = supabase
      .channel('songs_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.user_id && row.user_id !== currentUserId) return;
        if (payload.event === 'INSERT' && payload.new) setSongs(prev => upsertTrack(prev, payload.new));
        if (payload.event === 'UPDATE' && payload.new) setSongs(prev => upsertTrack(prev, payload.new));
        if (payload.event === 'DELETE' && payload.old) setSongs(prev => removeTracks(prev, payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId, setSongs]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const handleLocalEntityChange = (event) => {
      const payload = event.detail || {};
      const table = payload.table;
      const row = payload.new || payload.old;

      if (table === 'songs') {
        if (row?.user_id && row.user_id !== currentUserId) return;
        if (payload.event === 'INSERT' && payload.new) setSongs(prev => upsertTrack(prev, payload.new));
        if (payload.event === 'UPDATE' && payload.new) {
          setSongs(prev => upsertTrack(prev, payload.new));
          setEditingSong(prev => prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev);
        }
        if (payload.event === 'DELETE' && payload.old) {
          setSongs(prev => removeTracks(prev, payload.old.id));
          setPlaylists(prev => removeSongsFromPlaylists(prev, payload.old.id));
        }
      }

      if (table === 'playlists') {
        if (row?.user_id && row.user_id !== currentUserId) return;
        if (payload.event === 'INSERT' && payload.new) setPlaylists(prev => upsertPlaylist(prev, payload.new));
        if (payload.event === 'UPDATE' && payload.new) setPlaylists(prev => upsertPlaylist(prev, payload.new));
        if (payload.event === 'DELETE' && payload.old) setPlaylists(prev => removePlaylist(prev, payload.old.id));
      }
    };

    window.addEventListener('dreamtune-entity-change', handleLocalEntityChange);
    return () => window.removeEventListener('dreamtune-entity-change', handleLocalEntityChange);
  }, [currentUserId, setEditingSong, setPlaylists, setSongs]);

  useEffect(() => {
    if (!currentUserId) return undefined;
    const channel = supabase
      .channel('playlists_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.user_id && row.user_id !== currentUserId) return;
        if (payload.event === 'INSERT' && payload.new) setPlaylists(prev => upsertPlaylist(prev, payload.new));
        if (payload.event === 'UPDATE' && payload.new) setPlaylists(prev => upsertPlaylist(prev, payload.new));
        if (payload.event === 'DELETE' && payload.old) setPlaylists(prev => removePlaylist(prev, payload.old.id));
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId, setPlaylists]);
}
