import { ListMusic, Moon, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, TimerOff, Volume2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import BassWaveRing from '@/components/BassWaveRing';
import CoverArt from '@/components/CoverArt';
import FavoriteButton from '@/components/FavoriteButton';
import PlayerQueueSheet from '@/features/player/components/PlayerQueueSheet';
import { formatPlayerTime as formatTime, formatSleepRemaining as formatRemaining, repeatToastMessage } from '@/features/player/model/playerUi';
import { toast } from 'sonner';

export default function PlayerMainTab({
  currentSong,
  isPlaying,
  progress,
  currentTime,
  duration,
  volume,
  shuffle,
  repeat,
  analyser,
  coverShape,
  canFavorite,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onShuffleToggle,
  onRepeatToggle,
  onToggleFavorite,
  sleepRemaining,
  onSleepTimerChange,
  showSleepMenu,
  onToggleSleepMenu,
  onCloseSleepMenu,
  showInlineQueue,
  onToggleQueue,
  onCloseQueue,
  queue,
  queueScrollRef,
  currentQueueIndex,
  smallCoverRadius,
  onQueuePlay,
  onQueueRemove,
  onQueueReorder,
}) {
  const isCircleCover = coverShape === 'circle';
  const fullCoverRadius = isCircleCover ? 'rounded-full' : 'rounded-[28px]';

  return (
    <>
      <div className="relative z-10 flex-1 flex items-center justify-center px-8 pt-[calc(82px+env(safe-area-inset-top,0px))] pb-2 min-h-0 overflow-visible">
        {isCircleCover ? (
          <BassWaveRing analyser={analyser} isPlaying={isPlaying} size={300} bars={108} className="w-full aspect-square" style={{ maxWidth: 'min(300px, calc(100vw - 64px))' }}>
            <CoverArt song={currentSong} className={`w-full h-full ${fullCoverRadius} shadow-2xl`} fallbackClassName="text-5xl sm:text-6xl" />
          </BassWaveRing>
        ) : (
          <div className="w-full aspect-square music-pulse-avatar" style={{ maxWidth: 'min(300px, calc(100vw - 64px))' }}>
            <CoverArt song={currentSong} className={`w-full h-full ${fullCoverRadius} shadow-2xl`} fallbackClassName="text-5xl sm:text-6xl" />
          </div>
        )}
      </div>

      <div className="relative z-10 px-5 full-player-safe-bottom pt-1 space-y-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{currentSong.title}</h2>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{currentSong.artist || 'Unknown artist'}</p>
          </div>
          {canFavorite && (
            <FavoriteButton
              active={Boolean(currentSong.is_favorite)}
              onClick={(_, nextFavorite) => onToggleFavorite(nextFavorite)}
              size="lg"
              className="-mr-2 hover:bg-secondary/50 flex-shrink-0"
            />
          )}
        </div>

        <div className="space-y-1">
          <Slider value={[progress]} max={100} step={0.1} onValueChange={([value]) => onSeek(value)} className="cursor-pointer" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              const nextShuffle = !shuffle;
              onShuffleToggle();
              toast.success(nextShuffle ? 'Shuffle enabled' : 'Shuffle disabled');
            }}
            className={`p-2 rounded-full transition-colors ${shuffle ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Shuffle className="w-5 h-5" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onPrev} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
            <SkipBack className="w-6 h-6 text-foreground fill-foreground" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onPlayPause}
            className="p-4 rounded-full hover:brightness-110 transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Pause className="w-6 h-6 text-primary-foreground fill-primary-foreground" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Play className="w-6 h-6 text-primary-foreground fill-primary-foreground ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onNext} className="p-2 hover:bg-secondary/50 rounded-full transition-colors">
            <SkipForward className="w-6 h-6 text-foreground fill-foreground" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              const nextRepeat = (repeat + 1) % 4;
              onRepeatToggle();
              toast.success(repeatToastMessage(nextRepeat));
            }}
            className={`relative p-2 rounded-full transition-colors ${repeat ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Repeat className="w-5 h-5" />
            {repeat > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] leading-4 text-primary-foreground font-bold">
                {repeat}
              </span>
            )}
          </motion.button>
        </div>

        <div className="flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Slider value={[volume * 100]} max={100} step={1} onValueChange={([value]) => onVolumeChange(value / 100)} className="cursor-pointer" />
        </div>

        <div className="relative flex items-center justify-between gap-2 pb-1">
          <button
            onClick={onToggleSleepMenu}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors ${sleepRemaining ? 'bg-primary/12 text-primary' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
          >
            <Moon className="w-4 h-4" />
            <span>{sleepRemaining ? formatRemaining(sleepRemaining) : 'Sleep'}</span>
          </button>
          <button
            onClick={onToggleQueue}
            className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors ${showInlineQueue ? 'bg-primary/12 text-primary' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
          >
            <ListMusic className="w-4 h-4" />
            <span>{queue?.length || 0}</span>
          </button>
          {sleepRemaining > 0 && (
            <button
              onClick={() => onSleepTimerChange?.(0)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-secondary/70 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Cancel sleep timer"
            >
              <TimerOff className="w-4 h-4" />
              Reset
            </button>
          )}
          <AnimatePresence>
            {showSleepMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute bottom-12 left-0 right-0 rounded-3xl border border-border bg-card p-3 shadow-2xl shadow-black/30"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-black text-foreground">Sleep timer</p>
                  <button onClick={onCloseSleepMenu} className="rounded-full p-1.5 hover:bg-secondary">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 15, 30, 45, 60].map(minutes => (
                    <button
                      key={minutes}
                      onClick={() => { onSleepTimerChange?.(minutes); onCloseSleepMenu(); }}
                      className="min-h-11 rounded-2xl bg-secondary px-3 py-2 text-sm font-black text-foreground hover:bg-primary/15 hover:text-primary"
                    >
                      {minutes === 60 ? '1h' : `${minutes}m`}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <PlayerQueueSheet
          open={showInlineQueue}
          onClose={onCloseQueue}
          queue={queue}
          queueScrollRef={queueScrollRef}
          currentSong={currentSong}
          currentQueueIndex={currentQueueIndex}
          smallCoverRadius={smallCoverRadius}
          onQueuePlay={onQueuePlay}
          onQueueRemove={onQueueRemove}
          onQueueReorder={onQueueReorder}
        />
      </div>
    </>
  );
}
