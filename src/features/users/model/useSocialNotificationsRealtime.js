import { useEffect } from 'react';
import { supabase } from '@/api/SupabaseClient';

export function useSocialNotificationsRealtime({ currentUserId, onRefresh }) {
  useEffect(() => {
    if (!currentUserId) return undefined;
    const channel = supabase
      .channel('social_notifications_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.receiver_id === currentUserId || row?.sender_id === currentUserId) onRefresh?.();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_playlist_invites' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.receiver_id === currentUserId || row?.sender_id === currentUserId) onRefresh?.();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUserId, onRefresh]);
}
