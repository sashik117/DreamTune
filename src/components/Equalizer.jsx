import { useEffect, useRef } from 'react';

export default function Equalizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barCount = 48;
      const step = Math.floor(bufferLength / barCount);
      const barW = (W / barCount) * 0.7;
      const gap = (W / barCount) * 0.3;

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
        const avg = sum / step;
        const barH = isPlaying ? (avg / 255) * H * 0.9 : H * 0.04;

        const x = i * (barW + gap);
        const y = H - barH;

        // gradient: bottom red → top pink/transparent
        const gradient = ctx.createLinearGradient(0, H, 0, 0);
        gradient.addColorStop(0, 'hsla(0, 90%, 55%, 0.9)');
        gradient.addColorStop(0.5, 'hsla(340, 80%, 65%, 0.7)');
        gradient.addColorStop(1, 'hsla(320, 70%, 75%, 0.1)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        ctx.fill();
      }
    };

    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [analyser, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={80}
      className="w-full h-20 opacity-80"
    />
  );
}