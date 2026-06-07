import { ListMusic, Music, X } from 'lucide-react';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import QueueTrackItem from '@/features/player/components/QueueTrackItem';

export default function PlayerQueueSheet({
  open,
  onClose,
  queue = [],
  queueScrollRef,
  currentSong,
  currentQueueIndex,
  smallCoverRadius,
  onQueuePlay,
  onQueueRemove,
  onQueueReorder,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close queue"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[94] bg-black/25 backdrop-blur-[2px]"
          />
          <motion.div initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.98 }} className="fixed left-3 right-3 bottom-[calc(18px+env(safe-area-inset-bottom,0px))] z-[95] max-h-[min(70dvh,520px)] overflow-hidden rounded-3xl border border-border bg-card/95 p-3 shadow-2xl shadow-black/35 backdrop-blur-2xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-primary" />
                <p className="text-sm font-black text-foreground">Up next</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{queue?.length || 0}</span>
              </div>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-secondary">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {!queue?.length ? (
              <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                <Music className="w-4 h-4" /> Queue is empty
              </div>
            ) : (
              <div ref={queueScrollRef} className="max-h-[304px] overflow-y-auto overscroll-contain pr-1">
                <Reorder.Group axis="y" values={queue} onReorder={onQueueReorder || (() => {})} className="space-y-1">
                  {queue.map((song, index) => (
                    <QueueTrackItem
                      key={song.id}
                      song={song}
                      index={index}
                      currentSong={currentSong}
                      currentIndex={currentQueueIndex}
                      smallCoverRadius={smallCoverRadius}
                      onQueuePlay={onQueuePlay}
                      onQueueRemove={onQueueRemove}
                    />
                  ))}
                </Reorder.Group>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
