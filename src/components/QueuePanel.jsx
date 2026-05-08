import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, GripVertical, Music, ListMusic } from 'lucide-react';

function SoundBars() {
  return (
    <div className="flex gap-0.5 items-end h-4 flex-shrink-0">
      {[70, 100, 50, 85].map((h, i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-primary rounded-full"
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ height: `${h}%`, transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  );
}

export default function QueuePanel({ queue, currentSongId, onReorder, onRemove, onPlay, onClose }) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed inset-0 z-[70] bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Черга</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{queue.length}</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Music className="w-12 h-12 opacity-30" />
          <p className="text-sm">Черга порожня</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs text-muted-foreground mb-3 px-1">Утримуй і перетягуй, щоб змінити порядок</p>
          <Reorder.Group axis="y" values={queue} onReorder={onReorder} className="space-y-1">
            <AnimatePresence>
              {queue.map((song, i) => {
                const isActive = song.id === currentSongId;
                return (
                  <Reorder.Item
                    key={song.id}
                    value={song}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-secondary/60'
                    }`}
                    onClick={() => onPlay(song)}
                  >
                    <div className="text-muted-foreground touch-none cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                      {song.cover_url
                        ? <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground" /></div>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist || 'Невідомий'}</p>
                    </div>

                    {isActive ? (
                      <SoundBars />
                    ) : (
                      <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
                    )}

                    <button
                      onClick={e => { e.stopPropagation(); onRemove(song.id); }}
                      className="p-1.5 hover:bg-muted rounded-full transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </Reorder.Item>
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
        </div>
      )}
    </motion.div>
  );
}
