import { useCallback, useEffect, useRef } from 'react';
import { addNativeMediaActionListener, clearNativeMediaSession, updateNativeMediaSession } from '@/utils/nativeMediaSession';
import { MEDIA_SESSION_POSITION_UPDATE_MS } from '@/features/player/model/playbackQueue';

export function useNativePlayerSession({
  audioRef,
  playbackRequestRef,
  restorePositionRef,
  currentSongId,
  currentTime,
  duration,
  isPlaying,
  queue,
  songs,
  loadAndPlay,
  playNext,
  playPrev,
  resumeCurrentAudio,
  seekToSeconds,
  setIsPlaying,
}) {
  const sessionRef = useRef({ songId: null, title: '', artist: '', coverUrl: '', isPlaying: null, lastUpdate: 0 });

  const getNativeCoverUrl = useCallback((song) => {
    const cover = String(song?.native_cover_url || song?.cover_url || '').trim();
    if (!cover || cover.startsWith('blob:') || cover.startsWith('data:')) return '';
    return cover;
  }, []);

  useEffect(() => {
    let mounted = true;
    let handle = null;
    Promise.resolve(addNativeMediaActionListener((event) => {
      const action = event?.action;
      if (action === 'play') {
        if (currentSongId && (!audioRef.current.src || audioRef.current.error)) {
          const song = songs.find(item => item.id === currentSongId) || queue.find(item => item.id === currentSongId);
          if (song) {
            loadAndPlay(song, { startAt: currentTime || restorePositionRef.current || 0 });
            return;
          }
        }
        resumeCurrentAudio();
      }
      if (action === 'pause') {
        playbackRequestRef.current.shouldPlay = false;
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (action === 'stop') {
        playbackRequestRef.current.shouldPlay = false;
        audioRef.current.pause();
        setIsPlaying(false);
      }
      if (action === 'next') playNext();
      if (action === 'previous') playPrev();
      if (action === 'seek') seekToSeconds(Number(event?.position || 0));
    })).then((listener) => {
      if (!mounted) listener?.remove?.();
      else handle = listener;
    });

    return () => {
      mounted = false;
      handle?.remove?.();
    };
  }, [audioRef, currentSongId, currentTime, loadAndPlay, playNext, playPrev, playbackRequestRef, queue, restorePositionRef, resumeCurrentAudio, seekToSeconds, setIsPlaying, songs]);

  useEffect(() => {
    const song = songs.find(item => item.id === currentSongId) || queue.find(item => item.id === currentSongId);
    if (!song) {
      sessionRef.current = { songId: null, title: '', artist: '', coverUrl: '', isPlaying: null, lastUpdate: 0 };
      clearNativeMediaSession();
      return;
    }
    const now = Date.now();
    const previous = sessionRef.current;
    const coverUrl = getNativeCoverUrl(song);
    const metadataChanged =
      previous.songId !== song.id ||
      previous.title !== song.title ||
      previous.artist !== song.artist ||
      previous.coverUrl !== coverUrl ||
      previous.isPlaying !== isPlaying;
    if (!metadataChanged) {
      if (!isPlaying) return;
      if (now - previous.lastUpdate < MEDIA_SESSION_POSITION_UPDATE_MS) return;
    }
    sessionRef.current = {
      songId: song.id,
      title: song.title || '',
      artist: song.artist || '',
      coverUrl,
      isPlaying,
      lastUpdate: now,
    };
    updateNativeMediaSession({
      title: song.title || 'DreamTune',
      artist: song.artist || '',
      coverUrl,
      isPlaying,
      position: currentTime || 0,
      duration: duration || 0,
    });
  }, [currentSongId, currentTime, duration, getNativeCoverUrl, isPlaying, queue, songs]);
}
