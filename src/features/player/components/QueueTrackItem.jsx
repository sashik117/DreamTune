import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, X } from 'lucide-react';
import { useRef } from 'react';
import CoverArt from '@/components/CoverArt';

export default function QueueTrackItem({ song, index, currentSong, currentIndex, smallCoverRadius, onQueuePlay, onQueueRemove }) {
  const controls = useDragControls();
  const pressTimerRef = useRef(null);
  const didDragRef = useRef(false);
  const pressPointRef = useRef({ x: 0, y: 0 });
  const isActive = song.id === currentSong.id;
  const isPlayed = currentIndex >= 0 && index < currentIndex;
  const status = isActive ? 'Now' : isPlayed ? 'Played' : 'Next';
  const clearPressTimer = () => {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
  };
  const startLongPressDrag = (event) => {
    clearPressTimer();
    didDragRef.current = false;
    pressPointRef.current = { x: event.clientX, y: event.clientY };
    pressTimerRef.current = window.setTimeout(() => {
      didDragRef.current = true;
      controls.start(event);
    }, 170);
  };
  const cancelLongPressDrag = (event) => {
    if (event?.type === 'pointermove' && pressTimerRef.current) {
      const dx = Math.abs(event.clientX - pressPointRef.current.x);
      const dy = Math.abs(event.clientY - pressPointRef.current.y);
      if (dx < 8 && dy < 8) return;
    }
    clearPressTimer();
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };
  const handlePlayClick = (event) => {
    if (didDragRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onQueuePlay?.(song);
  };

  return (
    <Reorder.Item
      value={song}
      dragListener={false}
      dragControls={controls}
      data-current={isActive ? 'true' : undefined}
      layout
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
      dragTransition={{ bounceStiffness: 420, bounceDamping: 34 }}
      onPointerDown={startLongPressDrag}
      onPointerMove={cancelLongPressDrag}
      onPointerUp={cancelLongPressDrag}
      onPointerCancel={cancelLongPressDrag}
      className={`flex min-h-14 touch-pan-y select-none items-center gap-2 rounded-2xl border p-2 shadow-sm transition ${
        isActive
          ? 'border-primary/70 bg-primary/12 ring-1 ring-primary/35'
          : isPlayed
            ? 'border-border/40 bg-secondary/35 opacity-55'
            : 'border-transparent bg-secondary/65'
      }`}
      whileDrag={{ scale: 1.015, zIndex: 20, boxShadow: '0 18px 36px hsl(var(--foreground) / 0.18)' }}
    >
      <button
        type="button"
        aria-label="Drag track"
        onPointerDown={(event) => {
          event.stopPropagation();
          didDragRef.current = true;
          controls.start(event);
        }}
        onPointerUp={() => { didDragRef.current = false; }}
        className="flex min-h-10 min-w-8 touch-none items-center justify-center rounded-xl text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CoverArt song={song} className={`h-10 w-10 ${smallCoverRadius} shrink-0`} fallbackClassName="text-xs" />
        <button onClick={handlePlayClick} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-sm font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
          <p className="truncate text-xs text-muted-foreground">{song.artist || 'Unknown artist'} / {status}</p>
        </button>
      </div>
      <button onClick={(event) => { event.stopPropagation(); onQueueRemove?.(song.id); }} className="rounded-full p-2 hover:bg-card" aria-label="Remove from queue">
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </Reorder.Item>
  );
}
