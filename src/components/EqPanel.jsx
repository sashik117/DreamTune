import { useEffect, useRef } from 'react';
import { Sliders, Zap, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';

const BANDS = [
  { key: 'sub', label: '60', hz: 'Hz' },
  { key: 'bass', label: '230', hz: 'Hz' },
  { key: 'low', label: '910', hz: 'Hz' },
  { key: 'mid', label: '2k', hz: 'Hz' },
  { key: 'high', label: '4k', hz: 'Hz' },
  { key: 'treble', label: '14k', hz: 'Hz' },
];

const PRESETS = {
  flat: { label: 'Flat', values: { sub: 0, bass: 0, low: 0, mid: 0, high: 0, treble: 0 } },
  hardBass: { label: 'Hard Bass', values: { sub: 12, bass: 11, low: 5, mid: -2, high: 2, treble: 3 } },
  nightDrive: { label: 'Night Drive', values: { sub: 7, bass: 6, low: 2, mid: 0, high: 4, treble: 5 } },
  lofi: { label: 'Lo-Fi', values: { sub: 4, bass: 5, low: 2, mid: -2, high: -4, treble: -5 } },
  vocal: { label: 'Vocal Clear', values: { sub: -2, bass: -1, low: 0, mid: 5, high: 5, treble: 4 } },
  club: { label: 'Club', values: { sub: 10, bass: 8, low: 3, mid: -1, high: 5, treble: 6 } },
  softPop: { label: 'Soft Pop', values: { sub: 3, bass: 4, low: 1, mid: 2, high: 3, treble: 3 } },
};

function Spectrum({ analyser, isPlaying }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 42;
      const step = Math.max(1, Math.floor(data.length / bars));
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
        const value = isPlaying ? sum / step / 255 : 0.08;
        const barHeight = Math.max(5, value * h * 0.95);
        const x = (i / bars) * w;
        const barWidth = (w / bars) * 0.66;
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, 'hsla(188, 76%, 70%, 0.85)');
        gradient.addColorStop(1, 'hsla(326, 82%, 72%, 0.95)');
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 10 + value * 14;
        ctx.shadowColor = 'hsla(326, 82%, 72%, 0.55)';
        ctx.beginPath();
        ctx.roundRect(x, h - barHeight, barWidth, barHeight, 5);
        ctx.fill();
      }
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, isPlaying]);

  return <canvas ref={canvasRef} width={360} height={96} className="w-full h-24 opacity-95" />;
}

export default function EqPanel({ eq, onEqChange, analyser, isPlaying }) {
  const applyPreset = (preset) => {
    Object.entries(PRESETS[preset].values).forEach(([k, v]) => onEqChange(k, v));
  };

  const hardBassValue = Math.max(eq.sub ?? 0, eq.bass ?? 0);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="bg-gradient-to-r from-primary/18 to-accent/12 border border-primary/25 rounded-2xl p-4 shadow-lg shadow-primary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Жорсткий bass boost</span>
          </div>
          <span className={`text-sm font-bold tabular-nums ${hardBassValue > 7 ? 'text-primary' : 'text-muted-foreground'}`}>
            {hardBassValue > 0 ? `+${hardBassValue}` : hardBassValue} dB
          </span>
        </div>
        <input
          type="range" min={-6} max={12} step={1} value={eq.bass ?? 0}
          onChange={e => {
            const value = Number(e.target.value);
            onEqChange('bass', value);
            onEqChange('sub', Math.min(12, value + 1));
          }}
          className="w-full cursor-pointer"
          style={{ accentColor: 'hsl(var(--primary))' }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>м'яко</span><span>качає</span><span>дуже жорстко</span>
        </div>
      </div>

      <div className="bg-card/80 border border-border rounded-2xl p-3 backdrop-blur-xl">
        <Spectrum analyser={analyser} isPlaying={isPlaying} />
      </div>

      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Пресети під вайб</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([key, p]) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              onClick={() => applyPreset(key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary hover:bg-primary/20 hover:text-primary border border-border transition-colors"
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">6-смуговий EQ</span>
          </div>
          <button onClick={() => applyPreset('flat')} className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-around gap-1">
          {BANDS.map(({ key, label, hz }) => {
            const val = eq[key] ?? 0;
            return (
              <div key={key} className="flex flex-col items-center gap-1 flex-1">
                <div className="relative h-28 flex items-center justify-center">
                  <input
                    type="range" min={-12} max={12} step={1} value={val}
                    onChange={e => onEqChange(key, Number(e.target.value))}
                    className="cursor-pointer"
                    style={{
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      width: 22,
                      height: 96,
                      accentColor: 'hsl(var(--primary))'
                    }}
                  />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${val > 0 ? 'text-primary' : val < 0 ? 'text-accent' : 'text-muted-foreground'}`}>
                  {val > 0 ? `+${val}` : val}
                </span>
                <span className="text-[10px] font-semibold text-foreground leading-none">{label}</span>
                <span className="text-[9px] text-muted-foreground leading-none">{hz}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
