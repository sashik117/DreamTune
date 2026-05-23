import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CoverArt from '../CoverArt';
import FavoriteButton from '../FavoriteButton';

export default function MiniPlayer({ currentSong, isPlaying, onPlayPause, onNext, onPrev, onToggleFavorite, onExpand, progress, coverShape = 'square', canFavorite = true }) {
  if (!currentSong) return null;
  const progressValue = Math.max(0, Math.min(100, Number(progress) || 0));
  const isCircleMode = coverShape === 'circle';

  return (
    <AnimatePresence>
      <motion.div
        key="mini-player"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="mini-player-shell pointer-events-none"
      >
        {/* Cozy frosted card */}
        <div className={`bg-card/90 backdrop-blur-2xl border-t border-border/70 shadow-2xl shadow-primary/15 overflow-hidden pointer-events-auto mini-player-card ${isCircleMode ? 'circle' : 'square'}`}>
          {/* Gradient progress bar */}
          <div className={`mini-player-progress-line ${isCircleMode ? 'circle' : 'square'}`}>
            <motion.div
              className="mini-player-progress-fill"
              style={{
                width: `${progressValue}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
              }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="px-4 py-3 cursor-pointer" onClick={onExpand}>
            <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
              {/* Cover */}
              {isCircleMode ? (
                <div
                  className="mini-cover-progress circle"
                  style={{ '--mini-progress': `${progressValue}%` }}
                  aria-hidden="true"
                >
                  <CoverArt song={currentSong} className="mini-cover-art shadow-md" fallbackClassName="text-sm" />
                </div>
              ) : (
                <CoverArt song={currentSong} className="w-12 h-12 rounded-[18px] flex-shrink-0 shadow-md" fallbackClassName="text-sm" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist || 'Unknown artist'}</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {canFavorite && (
                  <FavoriteButton active={Boolean(currentSong.is_favorite)} onClick={(_, nextFavorite) => onToggleFavorite(nextFavorite)} />
                )}
                <motion.button whileTap={{ scale: 0.82 }} onClick={onPrev} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <SkipBack className="w-4 h-4 text-foreground" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.86 }}
                  onClick={onPlayPause}
                  animate={isPlaying ? { boxShadow: ['0 0 0 0 hsl(var(--primary)/0.3)', '0 0 14px 4px hsl(var(--primary)/0.2)', '0 0 0 0 hsl(var(--primary)/0)'] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="p-2 rounded-full transition-all"
                  style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
                >
                  <AnimatePresence mode="wait">
                    {isPlaying ? (
                      <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.14 }}>
                        <Pause className="w-4 h-4 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.14 }}>
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
                <motion.button whileTap={{ scale: 0.82 }} onClick={onNext} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <SkipForward className="w-4 h-4 text-foreground" />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
