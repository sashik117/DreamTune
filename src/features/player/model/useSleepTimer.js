import { useCallback, useEffect, useRef, useState } from 'react';

export function useSleepTimer({ audioRef, playbackRequestRef, volume, setVolumeState, setIsPlaying }) {
  const timerRef = useRef({ timeout: null, ticker: null, fade: null, originalVolume: 0.8 });
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [sleepDimming, setSleepDimming] = useState(false);

  const clearSleepTimer = useCallback(() => {
    const timers = timerRef.current;
    if (timers.timeout) clearTimeout(timers.timeout);
    if (timers.ticker) clearInterval(timers.ticker);
    if (timers.fade) clearInterval(timers.fade);
    timerRef.current = { ...timers, timeout: null, ticker: null, fade: null };
    setSleepRemaining(0);
    setSleepDimming(false);
  }, []);

  const startSleepFade = useCallback(() => {
    const timers = timerRef.current;
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
        playbackRequestRef.current.shouldPlay = false;
        audioRef.current.pause();
        audioRef.current.volume = originalVolume;
        setVolumeState(originalVolume);
        setIsPlaying(false);
        setSleepRemaining(0);
        setSleepDimming(false);
      }
    }, 250);
  }, [audioRef, playbackRequestRef, setIsPlaying, setVolumeState, volume]);

  const setSleepTimer = useCallback((minutes) => {
    clearSleepTimer();
    const safeMinutes = Number(minutes);
    if (!Number.isFinite(safeMinutes) || safeMinutes <= 0) return;

    const totalSeconds = Math.round(safeMinutes * 60);
    setSleepRemaining(totalSeconds);
    timerRef.current.timeout = setTimeout(startSleepFade, totalSeconds * 1000);
    timerRef.current.ticker = setInterval(() => {
      setSleepRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
  }, [clearSleepTimer, startSleepFade]);

  useEffect(() => clearSleepTimer, [clearSleepTimer]);

  return {
    sleepRemaining,
    sleepDimming,
    setSleepTimer,
    clearSleepTimer,
  };
}
