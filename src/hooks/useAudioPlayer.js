import { useState, useRef, useEffect, useCallback } from 'react';
import { getCachedAudio, cacheAudio, getDownloadedSongIds, saveOfflineSongMeta } from '../utils/audioCache';
import { isNativeFileUrl, resolvePlayableAudioUrl } from '../utils/audioUrls';
import { repairSongAudio } from '../utils/audioRepair';
import { toast } from 'sonner';
import { dedupeSongs, PLAYBACK_STATE_KEY, serializeSong, shuffleSongs } from '@/features/player/model/playbackQueue';
import { useAudioPulse } from '@/features/player/model/useAudioPulse';
import { updateBrowserMediaSessionMetadata, useBrowserMediaSession } from '@/features/player/model/useBrowserMediaSession';
import { useNativePlayerSession } from '@/features/player/model/useNativePlayerSession';
import { useSleepTimer } from '@/features/player/model/useSleepTimer';

export default function useAudioPlayer(songs, visualPulseEnabled = false) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const filtersRef = useRef({ sub: null, bass: null, low: null, mid: null, high: null, treble: null });
  const repeatHitsRef = useRef({ songId: null, count: 0 });
  const manualQueueRef = useRef(false);
  const loadingAudioRef = useRef(false);
  const repairingSongIdRef = useRef(null);
  const repairAttemptsRef = useRef(new Set());
  const restoredPlaybackRef = useRef(false);
  const restorePositionRef = useRef(0);
  const lastSavedPlaybackRef = useRef(0);
  const playbackRequestRef = useRef({ id: 0, shouldPlay: false });
  const lastAudioErrorToastRef = useRef(0);

  const [currentSongId, setCurrentSongId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(0);
  const [cachedSongs, setCachedSongs] = useState(new Set());
  const [eq, setEqState] = useState({ sub: 0, bass: 0, low: 0, mid: 0, high: 0, treble: 0 });
  const [queue, setQueue] = useState([]); // ordered play queue
  const { bassLevel, voiceLevel } = useAudioPulse({
    analyserRef,
    audioCtxRef,
    isPlaying,
    currentSongId,
    enabled: visualPulseEnabled,
  });
  const { sleepRemaining, sleepDimming, setSleepTimer } = useSleepTimer({
    audioRef,
    playbackRequestRef,
    volume,
    setVolumeState,
    setIsPlaying,
  });

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = 0.8;
    audioRef.current.crossOrigin = 'anonymous';
  }

  useEffect(() => {
    const refreshCachedSongs = () => {
      getDownloadedSongIds()
        .then(ids => setCachedSongs(ids))
        .catch(() => {});
    };
    refreshCachedSongs();
    window.addEventListener('dreamtune-offline-cache-change', refreshCachedSongs);
    return () => window.removeEventListener('dreamtune-offline-cache-change', refreshCachedSongs);
  }, []);

  useEffect(() => {
    const pauseForPreview = () => {
      playbackRequestRef.current.shouldPlay = false;
      if (!audioRef.current?.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('dreamtune-preview-play', pauseForPreview);
    return () => window.removeEventListener('dreamtune-preview-play', pauseForPreview);
  }, []);

  const requestMainAudioFocus = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dreamtune-main-play'));
  }, []);

  const getTrimBounds = useCallback((song) => {
    const start = Number(song?.trim_start || 0);
    const naturalEnd = Number.isFinite(audioRef.current?.duration) ? audioRef.current.duration : 0;
    const savedEnd = Number(song?.trim_end || 0);
    const end = savedEnd > start ? savedEnd : naturalEnd;
    return { start: Math.max(0, start), end: Math.max(start || 0, end || 0) };
  }, []);

  const initAudioChain = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaElementSource(audioRef.current);
      const sub = ctx.createBiquadFilter();
      sub.type = 'lowshelf'; sub.frequency.value = 60;
      const bass = ctx.createBiquadFilter();
      bass.type = 'peaking'; bass.frequency.value = 230; bass.Q.value = 1;
      const low = ctx.createBiquadFilter();
      low.type = 'peaking'; low.frequency.value = 910; low.Q.value = 1;
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking'; mid.frequency.value = 2000; mid.Q.value = 1;
      const high = ctx.createBiquadFilter();
      high.type = 'peaking'; high.frequency.value = 4000; high.Q.value = 1;
      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf'; treble.frequency.value = 14000;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(sub);
      sub.connect(bass);
      bass.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(treble);
      treble.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      filtersRef.current = { sub, bass, low, mid, high, treble };
    } catch (e) {
      // AudioContext may fail on some browsers; playback still works without it
    }
  }, []);

  const setEq = useCallback((band, value) => {
    if (filtersRef.current[band]) filtersRef.current[band].gain.value = value;
    setEqState(prev => ({ ...prev, [band]: value }));
  }, []);

  const replayCurrentTrim = useCallback((song) => {
    const { start } = getTrimBounds(song);
    audioRef.current.currentTime = start;
    playbackRequestRef.current.shouldPlay = true;
    requestMainAudioFocus();
    audioRef.current.play();
  }, [getTrimBounds, requestMainAudioFocus]);

  const shouldRepeatCurrent = useCallback((song) => {
    if (!repeat || !song) return false;
    if (repeatHitsRef.current.songId !== song.id) {
      repeatHitsRef.current = { songId: song.id, count: 0 };
    }
    if (repeatHitsRef.current.count >= repeat) return false;
    repeatHitsRef.current.count += 1;
    return true;
  }, [repeat]);

  useEffect(() => {
    const audio = audioRef.current;
    const handleTimeUpdate = () => {
      const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
      const { start, end } = getTrimBounds(song);
      const activeEnd = end || audio.duration || 0;
      const span = Math.max(0.1, activeEnd - start);
      const localTime = Math.min(span, Math.max(0, audio.currentTime - start));
      restorePositionRef.current = localTime;
      setCurrentTime(localTime);
      setDuration(span);
      if (audio.duration) setProgress(Math.min(100, Math.max(0, ((audio.currentTime - start) / span) * 100)));
      if (song && activeEnd && audio.currentTime >= activeEnd) {
        if (shouldRepeatCurrent(song)) {
          replayCurrentTrim(song);
        } else {
          playNext();
        }
      }
    };
    const handleEnded = () => {
      const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
      if (shouldRepeatCurrent(song)) replayCurrentTrim(song);
      else playNext();
    };
    const handleError = () => {
      if (loadingAudioRef.current || repairingSongIdRef.current) return;
      const now = Date.now();
      if (now - lastAudioErrorToastRef.current > 5000) {
        lastAudioErrorToastRef.current = now;
        toast.error('Could not load audio. Try again.');
      }
      setIsPlaying(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [currentSongId, songs, queue, shuffle, repeat, getTrimBounds, replayCurrentTrim, shouldRepeatCurrent]);

  useEffect(() => {
    if (!currentSongId) return;
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    if (!song || !audioRef.current?.duration) return;
    const { start, end } = getTrimBounds(song);
    const activeEnd = end || audioRef.current.duration || 0;
    const span = Math.max(0.1, activeEnd - start);
    if (audioRef.current.currentTime < start || audioRef.current.currentTime > activeEnd) {
      audioRef.current.currentTime = start;
    }
    setCurrentTime(Math.min(span, Math.max(0, audioRef.current.currentTime - start)));
    setDuration(span);
    setProgress(Math.min(100, Math.max(0, ((audioRef.current.currentTime - start) / span) * 100)));
  }, [currentSongId, songs, queue, getTrimBounds]);

  const loadAndPlay = useCallback(async (song, options = {}) => {
    const startAt = Number.isFinite(options.startAt) ? Math.max(0, Number(options.startAt)) : null;
    const requestId = playbackRequestRef.current.id + 1;
    playbackRequestRef.current = { id: requestId, shouldPlay: true };
    const isActiveRequest = () => playbackRequestRef.current.id === requestId;
    const shouldContinuePlaying = () => isActiveRequest() && playbackRequestRef.current.shouldPlay;

    initAudioChain();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

    const prepareAndPlay = async (targetSong) => {
      const sourceUrl = targetSong.file_url || targetSong.offline_file_url;
      const playableUrl = resolvePlayableAudioUrl(sourceUrl);
      const cached = await getCachedAudio(sourceUrl);
      const src = cached || playableUrl;
      loadingAudioRef.current = true;

      // Only change src if different to avoid reload
      if (audioRef.current.src !== src) {
        audioRef.current.src = src;
        audioRef.current.load();
      }
      const { start } = getTrimBounds(targetSong);
      const targetStart = startAt === null ? start : start + startAt;
      if (targetStart > 0) {
        const setTrimStart = () => { audioRef.current.currentTime = targetStart; };
        if (audioRef.current.readyState >= 1) setTrimStart();
        else audioRef.current.addEventListener('loadedmetadata', setTrimStart, { once: true });
      }

      if (!shouldContinuePlaying()) {
        loadingAudioRef.current = false;
        setCurrentSongId(targetSong.id);
        setIsPlaying(false);
        updateBrowserMediaSessionMetadata(targetSong);
        return { cached, src, skipped: true };
      }

      requestMainAudioFocus();
      await audioRef.current.play();
      loadingAudioRef.current = false;
      const { start: activeStart, end: activeEnd } = getTrimBounds(targetSong);
      const span = Math.max(0, (activeEnd || audioRef.current.duration || 0) - activeStart);
      setCurrentTime(Math.max(0, audioRef.current.currentTime - activeStart));
      setDuration(span || audioRef.current.duration || 0);
      setCurrentSongId(targetSong.id);
      repeatHitsRef.current = { songId: targetSong.id, count: 0 };
      setIsPlaying(true);
      updateBrowserMediaSessionMetadata(targetSong);
      return { cached, src };
    };

    let activeSong = song;
    let cached = null;

    try {
      ({ cached } = await prepareAndPlay(activeSong));
    } catch (e) {
      loadingAudioRef.current = false;
      console.warn('Audio playback failed:', { fileUrl: activeSong.file_url, error: e });

      const canTryRepair = Boolean(
        navigator.onLine &&
        activeSong?.id &&
        !isNativeFileUrl(activeSong.file_url) &&
        !isNativeFileUrl(activeSong.offline_file_url) &&
        !repairAttemptsRef.current.has(activeSong.id)
      );

      if (canTryRepair) {
        repairAttemptsRef.current.add(activeSong.id);
        repairingSongIdRef.current = activeSong.id;
        toast.loading('Audio is unavailable, repairing this track...', { id: `repair-${activeSong.id}` });
        try {
          const repairedSong = await repairSongAudio(activeSong);
          repairingSongIdRef.current = null;
          if (repairedSong?.file_url) {
            activeSong = repairedSong;
            setQueue(prev => prev.map(item => item.id === repairedSong.id ? { ...item, ...repairedSong } : item));
            toast.success('Done, audio restored', { id: `repair-${activeSong.id}` });
            if (!isActiveRequest()) return;
            const result = await prepareAndPlay(activeSong);
            cached = result?.cached || null;
            if (result?.skipped) return;
          } else {
            toast.error('Could not restore this track automatically', { id: `repair-${activeSong.id}` });
            setIsPlaying(false);
            return;
          }
        } catch (repairError) {
          repairingSongIdRef.current = null;
          console.warn('Audio repair failed:', repairError);
          toast.error('Could not restore this track automatically', { id: `repair-${activeSong.id}` });
          setIsPlaying(false);
          return;
        }
      } else {
        const now = Date.now();
        if (now - lastAudioErrorToastRef.current > 5000) {
          lastAudioErrorToastRef.current = now;
          toast.error(navigator.onLine ? 'Could not load audio. Try again.' : 'This track is not ready offline yet.');
        }
        setIsPlaying(false);
        return;
      }
    }

    if (isNativeFileUrl(activeSong.file_url) || isNativeFileUrl(activeSong.offline_file_url)) {
      setCachedSongs(prev => new Set([...prev, activeSong.id]));
      saveOfflineSongMeta(activeSong, undefined, {
        offlineFileUrl: activeSong.offline_file_url || activeSong.file_url,
      }).catch(() => {});
    } else if (!cached && navigator.onLine) {
      cacheAudio(activeSong.file_url).then(() => {
        setCachedSongs(prev => new Set([...prev, activeSong.id]));
        saveOfflineSongMeta(activeSong).catch(() => {});
      }).catch(() => {});
    } else {
      setCachedSongs(prev => new Set([...prev, activeSong.id]));
      saveOfflineSongMeta(activeSong).catch(() => {});
    }
  }, [initAudioChain, getTrimBounds, requestMainAudioFocus]);

  const resumeCurrentAudio = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    playbackRequestRef.current.shouldPlay = true;
    requestMainAudioFocus();
    const audio = audioRef.current;
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const resumeAt = Math.max(0, Number(currentTime || restorePositionRef.current || 0));

    if (song && (!audio.src || audio.error || audio.readyState === 0)) {
      loadAndPlay(song, { startAt: resumeAt });
      return;
    }

    if (song && Number.isFinite(audio.duration) && resumeAt > 0) {
      const { start, end } = getTrimBounds(song);
      const target = Math.min(end || audio.duration, start + resumeAt);
      if (Math.abs(audio.currentTime - target) > 1.5) audio.currentTime = target;
    }

    audio.play().then(() => setIsPlaying(true)).catch(() => {
      if (song) loadAndPlay(song, { startAt: resumeAt });
    });
  }, [currentSongId, currentTime, getTrimBounds, loadAndPlay, queue, requestMainAudioFocus, songs]);

  // Keep the library queue fresh without replacing playlist queues.
  useEffect(() => {
    if (!songs.length) return;
    setQueue(prev => {
      const freshById = new Map(songs.map(song => [song.id, song]));
      if (!prev.length && !manualQueueRef.current) return dedupeSongs(songs);
      return dedupeSongs(prev.map(item => freshById.get(item.id) || item));
    });
  }, [songs]);

  const playSong = useCallback((song) => {
    if (currentSongId === song.id) {
      if (isPlaying) {
        playbackRequestRef.current.shouldPlay = false;
        audioRef.current.pause();
        setIsPlaying(false);
      }
      else {
        if (!audioRef.current.src || audioRef.current.error) {
          loadAndPlay(song, { startAt: currentTime || restorePositionRef.current || 0 });
          return;
        }
        resumeCurrentAudio();
      }
      return;
    }
    manualQueueRef.current = false;
    const libraryQueue = dedupeSongs(songs.length ? songs : [song]);
    setQueue(shuffle ? shuffleSongs(libraryQueue, song.id) : libraryQueue);
    loadAndPlay(song);
  }, [currentSongId, currentTime, isPlaying, loadAndPlay, resumeCurrentAudio, shuffle, songs]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      playbackRequestRef.current.shouldPlay = false;
      audioRef.current.pause();
      setIsPlaying(false);
    }
    else {
      if (currentSongId && (!audioRef.current.src || audioRef.current.error)) {
        const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
        if (song) {
          loadAndPlay(song, { startAt: currentTime || restorePositionRef.current || 0 });
          return;
        }
      }
      resumeCurrentAudio();
    }
  }, [currentSongId, currentTime, isPlaying, loadAndPlay, queue, resumeCurrentAudio, songs]);

  const playNext = useCallback(() => {
    if (!queue.length) return;
    const idx = queue.findIndex(s => s.id === currentSongId);
    const nextIdx = (idx + 1) % queue.length;
    loadAndPlay(queue[nextIdx]);
  }, [queue, currentSongId, loadAndPlay]);

  const playPrev = useCallback(() => {
    if (!queue.length) return;
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const { start } = getTrimBounds(song);
    if (audioRef.current.currentTime - start > 3) { audioRef.current.currentTime = start; return; }
    const idx = queue.findIndex(s => s.id === currentSongId);
    loadAndPlay(queue[(idx - 1 + queue.length) % queue.length]);
  }, [queue, currentSongId, loadAndPlay, songs, getTrimBounds]);

  // Queue management
  const addToQueue = useCallback((song) => {
    setQueue(prev => prev.some(item => item.id === song.id) ? prev : [...prev, song]);
  }, []);

  const playNext_queue = useCallback((song) => {
    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === currentSongId);
      const filtered = prev.filter(s => s.id !== song.id);
      const insertAt = idx >= 0 ? idx + 1 : 0;
      return [...filtered.slice(0, insertAt), song, ...filtered.slice(insertAt)];
    });
  }, [currentSongId]);

  const playQueueSong = useCallback((song) => {
    if (!song?.id) return;
    manualQueueRef.current = true;
    if (currentSongId === song.id) {
      if (!isPlaying) resumeCurrentAudio();
      return;
    }
    setQueue(prev => prev.some(item => item.id === song.id) ? prev : [...prev, song]);
    loadAndPlay(song);
  }, [currentSongId, isPlaying, loadAndPlay, resumeCurrentAudio]);

  const removeFromQueue = useCallback((songId) => {
    setQueue(prev => prev.filter(s => s.id !== songId));
  }, []);

  const reorderQueue = useCallback((newQueue) => {
    setQueue(newQueue);
  }, []);

  const playPlaylist = useCallback((playlistSongs, { shuffle: shouldShuffle = false, startSongId = null } = {}) => {
    const playable = dedupeSongs(playlistSongs.filter(Boolean));
    if (!playable.length) return;
    let ordered = shouldShuffle
      ? shuffleSongs(playable, startSongId)
      : playable;
    if (startSongId) {
      const startIndex = ordered.findIndex(song => song.id === startSongId);
      if (startIndex > 0) ordered = [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)];
    }
    manualQueueRef.current = true;
    setQueue(ordered);
    setShuffle(shouldShuffle);
    loadAndPlay(ordered[0]);
  }, [loadAndPlay]);

  useEffect(() => {
    if (restoredPlaybackRef.current || currentSongId) return;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(PLAYBACK_STATE_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (!saved?.currentSongId) return;
    const savedQueue = dedupeSongs(saved.queue || []);
    const freshById = new Map(songs.map(song => [song.id, song]));
    const restoredQueue = dedupeSongs((savedQueue.length ? savedQueue : songs).map(item => freshById.get(item.id) || item));
    const restoredSong = freshById.get(saved.currentSongId)
      || restoredQueue.find(song => song.id === saved.currentSongId)
      || savedQueue.find(song => song.id === saved.currentSongId);
    if (!restoredSong?.id) return;

    restoredPlaybackRef.current = true;
    manualQueueRef.current = Boolean(saved.manualQueue || savedQueue.length);
    restorePositionRef.current = Math.max(0, Number(saved.currentTime || 0));
    setQueue(restoredQueue.length ? restoredQueue : [restoredSong]);
    setCurrentSongId(restoredSong.id);
    setCurrentTime(restorePositionRef.current);
    setDuration(Number(saved.duration || restoredSong.duration || 0));
    setProgress(saved.duration ? Math.min(100, (restorePositionRef.current / saved.duration) * 100) : 0);
    setShuffle(Boolean(saved.shuffle));
    setRepeat(Number(saved.repeat || 0));
    if (Number.isFinite(saved.volume)) {
      audioRef.current.volume = saved.volume;
      setVolumeState(saved.volume);
    }
    setIsPlaying(false);
  }, [currentSongId, songs]);

  useEffect(() => {
    if (!currentSongId) return;
    const now = Date.now();
    if (now - lastSavedPlaybackRef.current < 1200) return;
    lastSavedPlaybackRef.current = now;
    const currentSong = songs.find(song => song.id === currentSongId) || queue.find(song => song.id === currentSongId);
    const payload = {
      currentSongId,
      currentTime,
      duration,
      isPlaying,
      shuffle,
      repeat,
      volume,
      manualQueue: manualQueueRef.current,
      queue: dedupeSongs(queue.length ? queue : (currentSong ? [currentSong] : [])).map(serializeSong).filter(Boolean),
      savedAt: now,
    };
    try {
      localStorage.setItem(PLAYBACK_STATE_KEY, JSON.stringify(payload));
    } catch {}
  }, [currentSongId, currentTime, duration, isPlaying, queue, repeat, shuffle, songs, volume]);

  const seek = useCallback((percent) => {
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const { start, end } = getTrimBounds(song);
    const activeEnd = end || audioRef.current.duration || 0;
    if (audioRef.current.duration) {
      const nextLocalTime = (percent / 100) * Math.max(0, activeEnd - start);
      restorePositionRef.current = Math.max(0, nextLocalTime);
      audioRef.current.currentTime = start + nextLocalTime;
    }
  }, [songs, queue, currentSongId, getTrimBounds]);

  const seekToSeconds = useCallback((seconds) => {
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const { start, end } = getTrimBounds(song);
    const activeEnd = end || audioRef.current.duration || 0;
    const nextTime = start + Math.max(0, Number(seconds) || 0);
    if (audioRef.current.duration) {
      restorePositionRef.current = Math.max(0, Number(seconds) || 0);
      audioRef.current.currentTime = Math.min(activeEnd || audioRef.current.duration, nextTime);
    }
  }, [songs, queue, currentSongId, getTrimBounds]);

  const setVolume = useCallback((v) => {
    audioRef.current.volume = v;
    setVolumeState(v);
  }, []);

  useBrowserMediaSession({
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
  });

  useNativePlayerSession({
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
  });

  return {
    currentSong: songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId) || null,
    isPlaying, progress, currentTime, duration, volume, shuffle, repeat,
    analyser: analyserRef.current,
    bassLevel, voiceLevel, sleepRemaining, sleepDimming,
    cachedSongs, eq, queue,
    playSong, playQueueSong, playPlaylist, togglePlayPause, playNext, playPrev, seek, setVolume,
    setEq, addToQueue, playNextInQueue: playNext_queue, removeFromQueue, reorderQueue,
    setSleepTimer,
    setShuffle: () => {
      setShuffle(prev => {
        const next = !prev;
        if (next) {
          setQueue(prevQueue => shuffleSongs(prevQueue.length ? prevQueue : songs, currentSongId));
        }
        return next;
      });
    },
    setRepeat: () => setRepeat(p => (p + 1) % 4),
  };
}
