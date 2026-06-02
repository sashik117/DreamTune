import { useCallback, useEffect, useRef } from 'react';
import { entities, getAuthToken } from '@/api/SupabaseClient';
import { cleanupAudioCache, getDownloadedSongIds, getDownloadedSongsMeta } from '../../../utils/audioCache';
import { queueBrokenSongRepairs } from '../../../utils/audioRepair';
import { canUseNativeYouTube, startYouTubeDownloadQueue } from '../../../utils/nativeYouTube';
import { readOfflinePlaylists } from '../../playlists/model/playlistModel';
import { buildLibrarySyncItem, mergeTracksWithOfflineMeta } from '../../tracks/model/trackModel';
import { readCachedUser } from '../../users/model/sessionStorage';
import { toast } from 'sonner';

export function useLibraryLoader({ isNativeApp, setSongs, setPlaylists, setLoading, applyCurrentUser, setCurrentUser }) {
  const staleAudioRepairStartedRef = useRef(false);
  const libraryOfflineSyncStartedRef = useRef(false);
  const libraryOfflineSyncQueuedRef = useRef(new Set());

  useEffect(() => {
    cleanupAudioCache({ maxBytes: isNativeApp ? 256 * 1024 * 1024 : undefined })
      .catch((error) => console.warn('Audio cache cleanup failed:', error));
  }, [isNativeApp]);

  const scheduleStaleAudioRepair = useCallback((librarySongs) => {
    if (staleAudioRepairStartedRef.current || !canUseNativeYouTube() || !librarySongs?.length) return;
    staleAudioRepairStartedRef.current = true;
    queueBrokenSongRepairs(librarySongs)
      .then(({ queued }) => {
        if (queued > 0) toast.success(`Repairing ${queued} old tracks in the background`);
      })
      .catch((error) => console.warn('Stale audio repair check failed:', error));
  }, []);

  const scheduleLibraryOfflineSync = useCallback(async (librarySongs) => {
    if (
      libraryOfflineSyncStartedRef.current ||
      !canUseNativeYouTube() ||
      !navigator.onLine ||
      !Array.isArray(librarySongs) ||
      !librarySongs.length
    ) return;

    libraryOfflineSyncStartedRef.current = true;

    try {
      const downloadedIds = await getDownloadedSongIds();
      const missingSongs = librarySongs
        .filter(song => song?.id)
        .filter(song => !downloadedIds.has(song.id))
        .filter(song => !libraryOfflineSyncQueuedRef.current.has(song.id))
        .filter(song => song.file_url || song.title || song.artist);

      if (!missingSongs.length) return;

      missingSongs.forEach(song => libraryOfflineSyncQueuedRef.current.add(song.id));
      const queueItems = missingSongs.map(buildLibrarySyncItem).filter(item => item.sourceFileUrl || item.query);
      if (!queueItems.length) return;

      await startYouTubeDownloadQueue(queueItems);
      toast.success(`Saving ${queueItems.length} library tracks offline in the background`);
    } catch (error) {
      libraryOfflineSyncStartedRef.current = false;
      console.warn('Library offline sync could not be queued:', error);
    }
  }, []);

  const loadOfflineShell = useCallback(async () => {
    const cachedUser = readCachedUser();
    if (getAuthToken() && cachedUser?.id) applyCurrentUser(cachedUser);
    else setCurrentUser(null);
    const offlineSongs = await getDownloadedSongsMeta();
    setSongs(offlineSongs);
    setPlaylists(readOfflinePlaylists());
    setLoading(false);
  }, [applyCurrentUser, setCurrentUser, setLoading, setPlaylists, setSongs]);

  const loadSongs = useCallback(async () => {
    try {
      const [data, offlineSongs] = await Promise.all([
        entities.Song.list(),
        getDownloadedSongsMeta().catch(() => []),
      ]);
      const merged = mergeTracksWithOfflineMeta(data, offlineSongs);
      setSongs(merged);
      scheduleStaleAudioRepair(merged);
      scheduleLibraryOfflineSync(merged);
    } catch (err) {
      console.error('Failed to load songs:', err);
      const offlineSongs = await getDownloadedSongsMeta();
      if (offlineSongs.length) {
        setSongs(offlineSongs);
      } else if (navigator.onLine) {
        toast.error('Could not load tracks from your account. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [scheduleLibraryOfflineSync, scheduleStaleAudioRepair, setLoading, setSongs]);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await entities.Playlist.list();
      setPlaylists(data);
    } catch (err) {
      console.error('Failed to load playlists:', err);
      setPlaylists(readOfflinePlaylists());
    }
  }, [setPlaylists]);

  return {
    loadSongs,
    loadPlaylists,
    loadOfflineShell,
  };
}
