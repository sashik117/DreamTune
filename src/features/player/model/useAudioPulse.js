import { useEffect, useRef, useState } from 'react';

export function useAudioPulse({ analyserRef, audioCtxRef, isPlaying, currentSongId, enabled }) {
  const rafRef = useRef(null);
  const [bassLevel, setBassLevel] = useState(0);
  const [voiceLevel, setVoiceLevel] = useState(0);

  useEffect(() => {
    if (!enabled || !analyserRef.current || !isPlaying) {
      setBassLevel(0);
      setVoiceLevel(0);
      document.documentElement.style.setProperty('--music-pulse-scale', '1');
      document.documentElement.style.setProperty('--music-pulse-intensity', '0');
      document.documentElement.style.setProperty('--music-voice-intensity', '0');
      return undefined;
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
      for (let index = from; index <= to; index += 1) sum += data[index] || 0;
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
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.documentElement.style.setProperty('--music-pulse-scale', '1');
      document.documentElement.style.setProperty('--music-pulse-intensity', '0');
      document.documentElement.style.setProperty('--music-voice-intensity', '0');
    };
  }, [analyserRef, audioCtxRef, currentSongId, enabled, isPlaying]);

  return { bassLevel, voiceLevel };
}
