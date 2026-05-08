import { useEffect, useRef } from 'react';

export default function BassWaveRing({
  analyser,
  isPlaying = false,
  size = 240,
  bars = 96,
  children,
  className = '',
  style,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const bleedX = size * 0.18;
    const bleedTop = size * 0.18;
    const bleedBottom = size * 0.34;
    const canvasWidth = size + bleedX * 2;
    const canvasHeight = size + bleedTop + bleedBottom;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const baseRadius = size * 0.39;
    const minLine = size * 0.018;
    const maxLine = size * 0.12;
    const maxVisibleLine = size * 0.155;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const smooth = new Array(bars).fill(0);

    const sampleBin = (index, length) => {
      if (!data) return 0;
      const t = index / Math.max(1, length - 1);
      const curved = Math.pow(t, 1.55);
      const bin = Math.min(data.length - 1, Math.floor(curved * (data.length - 1)));
      return data[bin] / 255;
    };

    const averageBins = (from, to) => {
      if (!data) return 0;
      const start = Math.max(0, Math.min(data.length - 1, from));
      const end = Math.max(start + 1, Math.min(data.length, to));
      let total = 0;
      for (let i = start; i < end; i++) total += data[i] / 255;
      return total / (end - start);
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      if (analyser && isPlaying) analyser.getByteFrequencyData(data);

      const bassPulse = analyser && isPlaying
        ? (
            sampleBin(0, Math.ceil(bars / 2)) +
            sampleBin(1, Math.ceil(bars / 2)) +
            sampleBin(2, Math.ceil(bars / 2)) +
            sampleBin(3, Math.ceil(bars / 2))
          ) / 4
        : 0;
      const lowBody = analyser && isPlaying ? averageBins(2, 34) : 0;
      const vocalBody = analyser && isPlaying ? averageBins(34, 118) : 0;
      const songPulse = Math.min(1, bassPulse * 0.5 + lowBody * 0.45 + vocalBody * 0.22);

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const mirroredIndex = i <= bars / 2 ? i : bars - i;
        const raw = analyser && isPlaying ? sampleBin(mirroredIndex, Math.ceil(bars / 2)) : 0;
        const neighbor = analyser && isPlaying
          ? (
              sampleBin(Math.max(0, mirroredIndex - 1), Math.ceil(bars / 2)) +
              sampleBin(Math.min(Math.ceil(bars / 2), mirroredIndex + 1), Math.ceil(bars / 2))
            ) * 0.5
          : 0;
        const lowerArc = Math.max(0, Math.sin(angle));
        const mainEnergy = raw * 0.62 + neighbor * 0.24 + songPulse * 0.18;
        const lowerEnergyFloor = Math.pow(lowerArc, 1.35) * songPulse * 0.86;
        const energy = Math.min(1, Math.max(mainEnergy, lowerEnergyFloor));

        const speed = energy > smooth[i] ? 0.5 : 0.2;
        smooth[i] += (energy - smooth[i]) * speed;
        const lineLength = Math.min(
          maxVisibleLine,
          minLine + Math.pow(smooth[i], 0.8) * maxLine,
        );
        const inner = baseRadius;
        const outer = baseRadius + lineLength;
        const x1 = centerX + Math.cos(angle) * inner;
        const y1 = centerY + Math.sin(angle) * inner;
        const x2 = centerX + Math.cos(angle) * outer;
        const y2 = centerY + Math.sin(angle) * outer;

        const hueMix = i / bars;
        ctx.strokeStyle = hueMix < 0.55
          ? `hsla(326, 82%, ${66 + smooth[i] * 14}%, ${0.45 + smooth[i] * 0.55})`
          : `hsla(188, 76%, ${62 + smooth[i] * 18}%, ${0.38 + smooth[i] * 0.5})`;
        ctx.lineWidth = 1.5 + smooth[i] * 2.6;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 6 + smooth[i] * 17;
        ctx.shadowColor = hueMix < 0.55
          ? 'hsla(326, 82%, 72%, 0.72)'
          : 'hsla(188, 76%, 68%, 0.68)';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isPlaying, size, bars]);

  return (
    <div className={`relative ${className}`} style={style}>
      <canvas
        ref={canvasRef}
        className="absolute left-1/2 top-1/2 pointer-events-none"
        style={{ transform: 'translate(-50%, -50%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute rounded-full music-pulse-avatar"
        style={{
          inset: `${size / 2 - size * 0.36}px`,
          boxShadow: isPlaying
            ? '0 0 calc(18px + (var(--music-pulse-intensity, 0) * 38px)) hsl(var(--primary) / 0.38)'
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
