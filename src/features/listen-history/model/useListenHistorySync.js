import { useCallback, useEffect } from 'react';
import { entities } from '@/api/SupabaseClient';
import { appendPendingHistory, readPendingHistory, writePendingHistory } from './pendingListenHistory';

export function useListenHistorySync({ currentUserId, currentSong, isPlaying }) {
  const trackHistory = useCallback(async (song) => {
    if (!song) return;
    const row = {
      song_id: song.id,
      song_title: song.title,
      song_artist: song.artist || '',
      listened_at: Date.now(),
    };
    entities.ListenHistory.create(row).catch(() => appendPendingHistory(row));
  }, []);

  const flushPendingHistory = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = readPendingHistory();
    if (!pending.length) return;
    const remaining = [];
    for (const row of pending) {
      try {
        await entities.ListenHistory.create(row);
      } catch {
        remaining.push(row);
      }
    }
    writePendingHistory(remaining);
  }, []);

  useEffect(() => {
    if (!currentUserId) return undefined;
    flushPendingHistory();
    window.addEventListener('online', flushPendingHistory);
    return () => window.removeEventListener('online', flushPendingHistory);
  }, [currentUserId, flushPendingHistory]);

  useEffect(() => {
    if (currentSong && isPlaying) {
      trackHistory(currentSong);
    }
  }, [currentSong?.id, trackHistory]);
}
