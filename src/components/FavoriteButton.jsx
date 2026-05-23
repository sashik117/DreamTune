import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const particles = [
  { x: -16, y: -13, d: 0 },
  { x: 15, y: -14, d: 0.02 },
  { x: -18, y: 8, d: 0.04 },
  { x: 18, y: 9, d: 0.06 },
  { x: 0, y: -21, d: 0.08 },
];

export default function FavoriteButton({
  active,
  onClick,
  size = 'sm',
  className = '',
  iconClassName = '',
  ariaLabel = 'Favorite',
}) {
  const [burstId, setBurstId] = useState(0);
  const [visualActive, setVisualActive] = useState(Boolean(active));
  const iconSize = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  const pad = size === 'lg' ? 'p-2' : 'p-2';

  useEffect(() => {
    setVisualActive(Boolean(active));
  }, [active]);

  const handleClick = (event) => {
    event.stopPropagation();
    const nextActive = !visualActive;
    setVisualActive(nextActive);
    if (nextActive) setBurstId(id => id + 1);
    onClick?.(event, nextActive);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={handleClick}
      className={`relative ${pad} hover:bg-primary/10 rounded-full transition-colors overflow-visible ${className}`}
      aria-label={ariaLabel}
    >
      <AnimatePresence>
        {burstId > 0 && (
          <motion.span
            key={`ring-${burstId}`}
            initial={{ scale: 0.35, opacity: 0.85 }}
            animate={{ scale: 2.15, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.48, ease: 'easeOut' }}
            className="absolute inset-1 rounded-full border-2 border-primary pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {burstId > 0 && particles.map((particle, index) => (
          <motion.span
            key={`particle-${burstId}-${index}`}
            initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
            animate={{ x: particle.x, y: particle.y, scale: [0.45, 1, 0.2], opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, delay: particle.d, ease: 'easeOut' }}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] pointer-events-none"
          />
        ))}
      </AnimatePresence>

      <motion.span
        key={`${active}-${burstId}`}
        initial={burstId > 0 ? { scale: 0.68, rotate: -12 } : false}
        animate={burstId > 0 ? { scale: [0.68, 1.42, 0.92, 1.08, 1], rotate: [-12, 10, -5, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 block"
      >
        <Heart
          className={`${iconSize} transition-colors ${visualActive ? 'fill-primary text-primary drop-shadow-[0_0_10px_hsl(var(--primary))]' : 'text-muted-foreground'} ${iconClassName}`}
        />
      </motion.span>
    </motion.button>
  );
}
