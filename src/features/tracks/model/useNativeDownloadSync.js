import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { entities } from '@/api/SupabaseClient';
import { downloadSong } from '../../../utils/audioCache';
import { persistAudioFileUrl } from '../../../utils/audioPersistence';
import { isNativeFileUrl } from '../../../utils/audioUrls';
import { canUseNativeYouTube, clearCompletedYouTubeDownloads, getCompletedYouTubeDownloads } from '../../../utils/nativeYouTube';

export function useNativeDownloadSync({
  currentUserId,
  songsRef,
  playlistsRef,
  setSongs,
  handlePlaylistUpdated,
  handleSongsAdded,
}) {
  const syncCompletedNativeDownloads = useCallback(async () => {
    if (!currentUserId || !canUseNativeYouTube()) return;
    const completed = await getCompletedYouTubeDownloads();
    if (!completed.length) return;

    const processedIds = [];
    const createdSongs = [];
    const updatedExistingSongs = [];
    const playlistAdds = new Map();
    let failedCount = 0;
    let repairedCount = 0;
    let librarySyncedCount = 0;

    for (const item of completed.slice(0, 12)) {
      if (item.status !== 'done' || !item.file_url) {
        failedCount++;
        if (item.id) processedIds.push(item.id);
        continue;
      }

      try {
        if (item.librarySync && item.songId) {
          const existingSong = songsRef.current.find(song => song.id === item.songId) || {};
          const nativeFileUrl = item.native_file_url || item.file_url;
          const originalFileUrl = item.original_file_url || item.originalFileUrl || item.sourceFileUrl || item.source_file_url || existingSong.file_url || '';
          let stableFileUrl = originalFileUrl || existingSong.file_url || nativeFileUrl;
          let syncedSong = {
            ...existingSong,
            id: item.songId,
            title: existingSong.title || item.title || 'DreamTune track',
            artist: existingSong.artist || item.artist || '',
            cover_url: existingSong.cover_url || item.cover_url || item.coverUrl || '',
            file_url: stableFileUrl,
            duration: existingSong.duration || item.duration || 0,
            trim_start: existingSong.trim_start || item.trim_start || 0,
            trim_end: existingSong.trim_end || item.trim_end || 0,
            lyrics: existingSong.lyrics || item.lyrics || '',
          };

          if (!stableFileUrl || isNativeFileUrl(stableFileUrl)) {
            stableFileUrl = await persistAudioFileUrl(nativeFileUrl, syncedSong);
            syncedSong = { ...syncedSong, file_url: stableFileUrl || nativeFileUrl };
            if (stableFileUrl && stableFileUrl !== existingSong.file_url) {
              const updated = await entities.Song.update(item.songId, { file_url: stableFileUrl });
              syncedSong = { ...syncedSong, ...updated, file_url: stableFileUrl };
            }
          }

          await downloadSong(syncedSong, () => {}, { sourceUrl: nativeFileUrl });
          updatedExistingSongs.push(syncedSong);
          librarySyncedCount++;
          if (item.id) processedIds.push(item.id);
          continue;
        }

        if (item.repair && item.songId) {
          const nativeFileUrl = item.native_file_url || item.file_url;
          const fileUrl = await persistAudioFileUrl(nativeFileUrl, item);
          const updatedSong = await entities.Song.update(item.songId, { file_url: fileUrl });
          const repairedSong = {
            ...updatedSong,
            file_url: fileUrl,
            cover_url: updatedSong.cover_url || item.cover_url || item.coverUrl || '',
          };
          await downloadSong(repairedSong, () => {}, { sourceUrl: nativeFileUrl });
          updatedExistingSongs.push(repairedSong);
          repairedCount++;
          if (item.id) processedIds.push(item.id);
          continue;
        }

        const nativeFileUrl = item.native_file_url || item.file_url;
        const fileUrl = await persistAudioFileUrl(nativeFileUrl, item);
        const song = await entities.Song.create({
          title: item.title || 'YouTube track',
          artist: item.artist || '',
          cover_url: item.cover_url || item.coverUrl || '',
          file_url: fileUrl,
          is_favorite: false,
        });
        await downloadSong(song, () => {}, { sourceUrl: nativeFileUrl });
        createdSongs.push(song);
        if (item.playlistId) {
          const group = playlistAdds.get(item.playlistId) || { songIds: [], coverUrl: '' };
          group.songIds.push(song.id);
          group.coverUrl ||= song.cover_url || '';
          playlistAdds.set(item.playlistId, group);
        }
        if (item.id) processedIds.push(item.id);
      } catch (error) {
        failedCount++;
        if (item.id) processedIds.push(item.id);
        console.warn('Could not import completed native download:', error);
      }
    }

    if (updatedExistingSongs.length) {
      const updatesById = new Map(updatedExistingSongs.map(song => [song.id, song]));
      setSongs(prev => prev.map(song => updatesById.has(song.id) ? { ...song, ...updatesById.get(song.id) } : song));
    }

    for (const [playlistId, group] of playlistAdds.entries()) {
      try {
        let playlist = playlistsRef.current.find(item => item.id === playlistId);
        if (!playlist) playlist = await entities.Playlist.get(playlistId).catch(() => null);
        if (!playlist) continue;
        const updated = await entities.Playlist.update(playlistId, {
          song_ids: Array.from(new Set([...(playlist.song_ids || []), ...group.songIds])),
          cover_url: playlist.cover_url || group.coverUrl || '',
        });
        handlePlaylistUpdated({ ...playlist, ...updated });
      } catch (error) {
        console.warn('Could not attach background songs to playlist:', error);
      }
    }

    if (createdSongs.length) {
      handleSongsAdded(createdSongs);
      toast.success(`Added ${createdSongs.length} tracks in the background`);
    }
    if (librarySyncedCount) toast.success(`${librarySyncedCount} library tracks are available offline`);
    if (repairedCount) toast.success(`Repaired ${repairedCount} old tracks`);
    if (failedCount) toast.error(`Could not download ${failedCount} tracks in the background`);
    if (processedIds.length) await clearCompletedYouTubeDownloads(processedIds);
  }, [currentUserId, handlePlaylistUpdated, handleSongsAdded, playlistsRef, setSongs, songsRef]);

  useEffect(() => {
    if (!currentUserId || !canUseNativeYouTube()) return undefined;
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        await syncCompletedNativeDownloads();
      } finally {
        busy = false;
      }
    };
    run();
    const timer = window.setInterval(run, 12000);
    const onVisibility = () => {
      if (!document.hidden) run();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [currentUserId, syncCompletedNativeDownloads]);
}
