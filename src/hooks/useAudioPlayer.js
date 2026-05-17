import { useState, useRef, useEffect, useCallback } from 'react';
import { getCachedAudio, cacheAudio, getDownloadedSongsMeta } from '../utils/audioCache';
import { resolvePlayableAudioUrl } from '../utils/audioUrls';
import { repairSongAudio } from '../utils/audioRepair';
import { addNativeMediaActionListener, clearNativeMediaSession, updateNativeMediaSession } from '../utils/nativeMediaSession';
import { toast } from 'sonner';

export default function useAudioPlayer(songs, visualPulseEnabled = false) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const filtersRef = useRef({ sub: null, bass: null, low: null, mid: null, high: null, treble: null });
  const bassRafRef = useRef(null);
  const sleepTimerRef = useRef({ timeout: null, ticker: null, fade: null, originalVolume: 0.8 });
  const repeatHitsRef = useRef({ songId: null, count: 0 });
  const manualQueueRef = useRef(false);
  const nativeSessionRef = useRef({ songId: null, title: '', artist: '', coverUrl: '', isPlaying: null, lastUpdate: 0 });
  const loadingAudioRef = useRef(false);
  const repairingSongIdRef = useRef(null);
  const repairAttemptsRef = useRef(new Set());

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
  const [bassLevel, setBassLevel] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [sleepDimming, setSleepDimming] = useState(false);

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.volume = 0.8;
    audioRef.current.crossOrigin = 'anonymous';
  }

  useEffect(() => {
    const refreshCachedSongs = () => {
      getDownloadedSongsMeta()
        .then(rows => setCachedSongs(new Set(rows.map(row => row.id || row.songId).filter(Boolean))))
        .catch(() => {});
    };
    refreshCachedSongs();
    window.addEventListener('dreamtune-offline-cache-change', refreshCachedSongs);
    return () => window.removeEventListener('dreamtune-offline-cache-change', refreshCachedSongs);
  }, []);

  useEffect(() => {
    const pauseForPreview = () => {
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

  useEffect(() => {
    if (!visualPulseEnabled || !analyserRef.current || !isPlaying) {
      setBassLevel(0);
      setVoiceLevel(0);
      document.documentElement.style.setProperty('--music-pulse-scale', '1');
      document.documentElement.style.setProperty('--music-pulse-intensity', '0');
      document.documentElement.style.setProperty('--music-voice-intensity', '0');
      return;
    }

    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const nyquist = audioCtxRef.current ? audioCtxRef.current.sampleRate / 2 : 24000;
    let smoothedBass = 0;
    let smoothedVoice = 0;
    let lastUiUpdate = 0;
    const binFor = (hz) => Math.min(data.length - 1, Math.max(0, Math.round((hz / nyquist) * data.length)));
    const averageBand = (fromHz, toHz) => {
      const from = binFor(fromHz);
      const to = Math.max(from + 1, binFor(toHz));
      let sum = 0;
      for (let i = from; i <= to; i++) sum += data[i] || 0;
      return sum / (to - from + 1) / 255;
    };

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const rawBass = averageBand(45, 180);
      const rawVoice = (averageBand(250, 1200) * 0.65) + (averageBand(1200, 3600) * 0.35);
      const bassIntensity = Math.min(1, Math.max(0, (rawBass - 0.06) * 3.2));
      const voiceIntensity = Math.min(1, Math.max(0, (rawVoice - 0.04) * 2.4));

      smoothedBass = smoothedBass * 0.62 + bassIntensity * 0.38;
      smoothedVoice = smoothedVoice * 0.72 + voiceIntensity * 0.28;

      document.documentElement.style.setProperty('--music-pulse-scale', (1 + smoothedBass * 0.15).toFixed(4));
      document.documentElement.style.setProperty('--music-pulse-intensity', smoothedBass.toFixed(4));
      document.documentElement.style.setProperty('--music-voice-intensity', smoothedVoice.toFixed(4));

      const now = performance.now();
      if (now - lastUiUpdate > 120) {
        lastUiUpdate = now;
        setBassLevel(smoothedBass);
        setVoiceLevel(smoothedVoice);
      }
      bassRafRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      if (bassRafRef.current) cancelAnimationFrame(bassRafRef.current);
      document.documentElement.style.setProperty('--music-pulse-scale', '1');
      document.documentElement.style.setProperty('--music-pulse-intensity', '0');
      document.documentElement.style.setProperty('--music-voice-intensity', '0');
    };
  }, [isPlaying, currentSongId, visualPulseEnabled]);

  const setEq = useCallback((band, value) => {
    if (filtersRef.current[band]) filtersRef.current[band].gain.value = value;
    setEqState(prev => ({ ...prev, [band]: value }));
  }, []);

  const replayCurrentTrim = useCallback((song) => {
    const { start } = getTrimBounds(song);
    audioRef.current.currentTime = start;
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
      toast.error('Ой, не вдалося завантажити звук, спробуй ще раз! 🌸');
      setIsPlaying(false);
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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

  const updateMediaSession = useCallback((song) => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || 'Невідома пісня',
      artist: song.artist || 'Невідомий',
      artwork: song.cover_url ? [{ src: song.cover_url, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }, []);

  const loadAndPlay = useCallback(async (song) => {
    initAudioChain();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

    const prepareAndPlay = async (targetSong) => {
      const playableUrl = resolvePlayableAudioUrl(targetSong.file_url);
      const cached = await getCachedAudio(targetSong.file_url);
      const src = cached || playableUrl;
      loadingAudioRef.current = true;

      // Only change src if different to avoid reload
      if (audioRef.current.src !== src) {
        audioRef.current.src = src;
        audioRef.current.load();
      }
      const { start } = getTrimBounds(targetSong);
      if (start > 0) {
        const setTrimStart = () => { audioRef.current.currentTime = start; };
        if (audioRef.current.readyState >= 1) setTrimStart();
        else audioRef.current.addEventListener('loadedmetadata', setTrimStart, { once: true });
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
      updateMediaSession(targetSong);
      return { cached, src };
    };

    let activeSong = song;
    let cached = null;

    try {
      ({ cached } = await prepareAndPlay(activeSong));
    } catch (e) {
      loadingAudioRef.current = false;
      console.warn('Audio playback failed:', { fileUrl: activeSong.file_url, error: e });

      if (activeSong?.id && !repairAttemptsRef.current.has(activeSong.id)) {
        repairAttemptsRef.current.add(activeSong.id);
        repairingSongIdRef.current = activeSong.id;
        toast.loading('Звук зламався, перескачую трек заново...', { id: `repair-${activeSong.id}` });
        try {
          const repairedSong = await repairSongAudio(activeSong);
          repairingSongIdRef.current = null;
          if (repairedSong?.file_url) {
            activeSong = repairedSong;
            setQueue(prev => prev.map(item => item.id === repairedSong.id ? { ...item, ...repairedSong } : item));
            ({ cached } = await prepareAndPlay(activeSong));
            toast.success('Готово, звук відновлено', { id: `repair-${activeSong.id}` });
          } else {
            toast.error('Не вдалося відновити цей трек автоматично', { id: `repair-${activeSong.id}` });
            setIsPlaying(false);
            return;
          }
        } catch (repairError) {
          repairingSongIdRef.current = null;
          console.warn('Audio repair failed:', repairError);
          toast.error('Не вдалося відновити цей трек автоматично', { id: `repair-${activeSong.id}` });
          setIsPlaying(false);
          return;
        }
      } else {
        toast.error('Ой, не вдалося завантажити звук, спробуй ще раз! 🌸');
        setIsPlaying(false);
        return;
      }
    }
    
    if (!cached) {
      cacheAudio(activeSong.file_url).then(() => {
        setCachedSongs(prev => new Set([...prev, activeSong.id]));
      }).catch(() => {});
    } else {
      setCachedSongs(prev => new Set([...prev, activeSong.id]));
    }
  }, [initAudioChain, updateMediaSession, getTrimBounds, requestMainAudioFocus]);

  // Build queue from songs when shuffle changes or songs changes
  useEffect(() => {
    if (manualQueueRef.current) {
      return;
    }
    if (!songs.length) {
      setQueue([]);
      if (currentSongId) {
        audioRef.current.pause();
        setCurrentSongId(null);
        setIsPlaying(false);
        setProgress(0);
      }
      return;
    }
    if (shuffle) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
    } else {
      setQueue([...songs]);
    }
  }, [songs, shuffle, currentSongId]);

  const playSong = useCallback((song) => {
    if (currentSongId === song.id) {
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
      else {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        requestMainAudioFocus();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }
    manualQueueRef.current = false;
    setQueue(shuffle ? [...songs].sort(() => Math.random() - 0.5) : [...songs]);
    loadAndPlay(song);
  }, [currentSongId, isPlaying, loadAndPlay, shuffle, songs, requestMainAudioFocus]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      requestMainAudioFocus();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying, requestMainAudioFocus]);

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
    setQueue(prev => [...prev, song]);
  }, []);

  const playNext_queue = useCallback((song) => {
    setQueue(prev => {
      const idx = prev.findIndex(s => s.id === currentSongId);
      const filtered = prev.filter(s => s.id !== song.id);
      const insertAt = idx >= 0 ? idx + 1 : 0;
      return [...filtered.slice(0, insertAt), song, ...filtered.slice(insertAt)];
    });
  }, [currentSongId]);

  const removeFromQueue = useCallback((songId) => {
    setQueue(prev => prev.filter(s => s.id !== songId));
  }, []);

  const reorderQueue = useCallback((newQueue) => {
    setQueue(newQueue);
  }, []);

  const playPlaylist = useCallback((playlistSongs, { shuffle: shouldShuffle = false, startSongId = null } = {}) => {
    const playable = playlistSongs.filter(Boolean);
    if (!playable.length) return;
    let ordered = shouldShuffle
      ? [...playable].sort(() => Math.random() - 0.5)
      : playable;
    if (startSongId && !shouldShuffle) {
      const startIndex = ordered.findIndex(song => song.id === startSongId);
      if (startIndex > 0) ordered = [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)];
    }
    manualQueueRef.current = true;
    setQueue(ordered);
    setShuffle(shouldShuffle);
    loadAndPlay(ordered[0]);
  }, [loadAndPlay]);

  // Media Session
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => {
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
      requestMainAudioFocus();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      navigator.mediaSession.playbackState = 'playing';
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current.pause(); setIsPlaying(false);
      navigator.mediaSession.playbackState = 'paused';
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }, [playNext, playPrev, requestMainAudioFocus]);

  const seek = useCallback((percent) => {
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const { start, end } = getTrimBounds(song);
    const activeEnd = end || audioRef.current.duration || 0;
    if (audioRef.current.duration) audioRef.current.currentTime = start + (percent / 100) * Math.max(0, activeEnd - start);
  }, [songs, queue, currentSongId, getTrimBounds]);

  const seekToSeconds = useCallback((seconds) => {
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    const { start, end } = getTrimBounds(song);
    const activeEnd = end || audioRef.current.duration || 0;
    const nextTime = start + Math.max(0, Number(seconds) || 0);
    if (audioRef.current.duration) audioRef.current.currentTime = Math.min(activeEnd || audioRef.current.duration, nextTime);
  }, [songs, queue, currentSongId, getTrimBounds]);

  const setVolume = useCallback((v) => {
    audioRef.current.volume = v;
    setVolumeState(v);
  }, []);

  const clearSleepTimer = useCallback(() => {
    const timers = sleepTimerRef.current;
    if (timers.timeout) clearTimeout(timers.timeout);
    if (timers.ticker) clearInterval(timers.ticker);
    if (timers.fade) clearInterval(timers.fade);
    sleepTimerRef.current = { ...timers, timeout: null, ticker: null, fade: null };
    setSleepRemaining(0);
    setSleepDimming(false);
  }, []);

  const startSleepFade = useCallback(() => {
    const timers = sleepTimerRef.current;
    if (timers.fade) clearInterval(timers.fade);
    if (timers.ticker) clearInterval(timers.ticker);

    const originalVolume = audioRef.current.volume || volume;
    timers.originalVolume = originalVolume;
    setSleepDimming(true);

    const steps = 40;
    let step = 0;
    timers.fade = setInterval(() => {
      step += 1;
      const nextVolume = Math.max(0, originalVolume * (1 - step / steps));
      audioRef.current.volume = nextVolume;
      setVolumeState(nextVolume);

      if (step >= steps) {
        clearInterval(timers.fade);
        timers.fade = null;
        audioRef.current.pause();
        audioRef.current.volume = originalVolume;
        setVolumeState(originalVolume);
        setIsPlaying(false);
        setSleepRemaining(0);
        setSleepDimming(false);
      }
    }, 250);
  }, [volume]);

  const setSleepTimer = useCallback((minutes) => {
    clearSleepTimer();
    if (!minutes) return;

    const totalSeconds = minutes * 60;
    setSleepRemaining(totalSeconds);
    sleepTimerRef.current.timeout = setTimeout(startSleepFade, totalSeconds * 1000);
    sleepTimerRef.current.ticker = setInterval(() => {
      setSleepRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
  }, [clearSleepTimer, startSleepFade]);

  useEffect(() => clearSleepTimer, [clearSleepTimer]);

  useEffect(() => {
    let mounted = true;
    let handle = null;
    Promise.resolve(addNativeMediaActionListener((event) => {
      const action = event?.action;
      if (action === 'play') {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        requestMainAudioFocus();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      if (action === 'pause') {
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
  }, [playNext, playPrev, requestMainAudioFocus, seekToSeconds]);

  useEffect(() => {
    const song = songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId);
    if (!song) {
      nativeSessionRef.current = { songId: null, title: '', artist: '', coverUrl: '', isPlaying: null, lastUpdate: 0 };
      clearNativeMediaSession();
      return;
    }
    const now = Date.now();
    const previous = nativeSessionRef.current;
    const metadataChanged =
      previous.songId !== song.id ||
      previous.title !== song.title ||
      previous.artist !== song.artist ||
      previous.coverUrl !== song.cover_url ||
      previous.isPlaying !== isPlaying;
    if (!metadataChanged && now - previous.lastUpdate < 900) return;
    nativeSessionRef.current = {
      songId: song.id,
      title: song.title || '',
      artist: song.artist || '',
      coverUrl: song.cover_url || '',
      isPlaying,
      lastUpdate: now,
    };
    updateNativeMediaSession({
      title: song.title || 'DreamTune',
      artist: song.artist || '',
      coverUrl: song.cover_url || '',
      isPlaying,
      position: currentTime || 0,
      duration: duration || 0,
    });
  }, [songs, queue, currentSongId, isPlaying, currentTime, duration]);

  return {
    currentSong: songs.find(s => s.id === currentSongId) || queue.find(s => s.id === currentSongId) || null,
    isPlaying, progress, currentTime, duration, volume, shuffle, repeat,
    analyser: analyserRef.current,
    bassLevel, voiceLevel, sleepRemaining, sleepDimming,
    cachedSongs, eq, queue,
    playSong, playPlaylist, togglePlayPause, playNext, playPrev, seek, setVolume,
    setEq, addToQueue, playNextInQueue: playNext_queue, removeFromQueue, reorderQueue,
    setSleepTimer,
    setShuffle: () => {
      manualQueueRef.current = false;
      setShuffle(p => !p);
    },
    setRepeat: () => setRepeat(p => (p + 1) % 4),
  };
}
