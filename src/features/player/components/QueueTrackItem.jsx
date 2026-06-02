import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, X } from 'lucide-react';
import CoverArt from '@/components/CoverArt';

export default function QueueTrackItem({ song, index, currentSong, currentIndex, smallCoverRadius, onQueuePlay, onQueueRemove }) {
  const controls = useDragControls();
  const isActive = song.id === currentSong.id;
  const isPlayed = currentIndex >= 0 && index < currentIndex;
  const status = isActive ? 'Now' : isPlayed ? 'Played' : 'Next';

  return (
    <Reorder.Item
      value={song}
      dragListener={false}
      dragControls={controls}
      data-current={isActive ? 'true' : undefined}
      className={`flex min-h-14 items-center gap-2 rounded-2xl border p-2 shadow-sm transition ${
        isActive
          ? 'border-primary/70 bg-primary/12 ring-1 ring-primary/35'
          : isPlayed
            ? 'border-border/40 bg-secondary/35 opacity-55'
            : 'border-transparent bg-secondary/65'
      }`}
      whileDrag={{ scale: 1.02, zIndex: 20 }}
    >
      <button
        type="button"
        aria-label="Drag track"
        onPointerDown={(event) => controls.start(event)}
        className="flex min-h-10 min-w-8 touch-none items-center justify-center rounded-xl text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CoverArt song={song} className={`h-10 w-10 ${smallCoverRadius} shrink-0`} fallbackClassName="text-xs" />
        <button onClick={() => onQueuePlay?.(song)} className="min-w-0 flex-1 text-left">
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
