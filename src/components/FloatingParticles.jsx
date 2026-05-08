import { useMemo } from 'react';

const PARTICLES = [
  { glyph: '♪', size: 16 },
  { glyph: '♫', size: 14 },
  { glyph: '✦', size: 12 },
  { glyph: '✿', size: 15 },
  { glyph: '✧', size: 13 },
  { glyph: '❀', size: 12 },
  { glyph: '☾', size: 14 },
  { glyph: '★', size: 11 },
];

export default function FloatingParticles() {
  const particles = useMemo(() => (
    Array.from({ length: 14 }, (_, i) => {
      const p = PARTICLES[i % PARTICLES.length];
      return {
        id: i,
        glyph: p.glyph,
        size: p.size + Math.random() * 4,
        left: `${5 + Math.random() * 90}%`,
        top: `${5 + Math.random() * 90}%`,
        delay: `${(Math.random() * 6).toFixed(1)}s`,
        duration: `${6 + Math.random() * 6}s`,
        opacity: 0.26 + Math.random() * 0.32,
      };
    })
  ), []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {particles.map(p => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `float ${p.duration} ease-in-out infinite`,
            animationDelay: p.delay,
            color: 'hsl(var(--primary))',
            textShadow: '0 0 16px hsl(var(--primary) / 0.45)',
            filter: 'blur(0.15px)',
            userSelect: 'none',
          }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
}
