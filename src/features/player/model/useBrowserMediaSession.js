import { useEffect } from 'react';

export function updateBrowserMediaSessionMetadata(song) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title || 'Unknown song',
    artist: song.artist || 'Unknown artist',
    artwork: song.cover_url ? [{ src: song.cover_url, sizes: '512x512', type: 'image/jpeg' }] : []
  });
}

export function useBrowserMediaSession({
  audioRef,
  playbackRequestRef,
  restorePositionRef,
  currentSongId,
  currentTime,
  queue,
  songs,
  loadAndPlay,
  playNext,
  playPrev,
  resumeCurrentAudio,
  setIsPlaying,
}) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => {
      if (currentSongId && (!audioRef.current.src || audioRef.current.error)) {
        const song = songs.find(item => item.id === currentSongId) || queue.find(item => item.id === currentSongId);
        if (song) {
          loadAndPlay(song, { startAt: currentTime || restorePositionRef.current || 0 });
          navigator.mediaSession.playbackState = 'playing';
          return;
        }
      }
      resumeCurrentAudio();
      navigator.mediaSession.playbackState = 'playing';
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      playbackRequestRef.current.shouldPlay = false;
      audioRef.current.pause();
      setIsPlaying(false);
      navigator.mediaSession.playbackState = 'paused';
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }, [audioRef, currentSongId, currentTime, loadAndPlay, playNext, playPrev, playbackRequestRef, queue, restorePositionRef, resumeCurrentAudio, setIsPlaying, songs]);
}
