import { Pause, Play } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CoverArt from '@/components/CoverArt';
import EqPanel from '@/components/EqPanel';
import LyricsView from '@/components/LyricsView';

export default function PlayerAuxTab({
  type,
  currentSong,
  currentTime,
  duration,
  isPlaying,
  smallCoverRadius,
  onPlayPause,
  onSongUpdated,
  eq,
  onEqChange,
  analyser,
}) {
  return (
    <div className="relative z-10 h-full min-h-0 overflow-hidden flex flex-col px-5 pt-[calc(82px+env(safe-area-inset-top,0px))] full-player-safe-bottom">
      <div className={`flex items-center gap-3 ${type === 'lyrics' ? 'mb-4' : 'mb-6'} flex-shrink-0`}>
        <CoverArt song={currentSong} className={`w-10 h-10 ${smallCoverRadius} flex-shrink-0`} fallbackClassName="text-xs" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{currentSong.title}</p>
          <p className="text-xs text-muted-foreground truncate">{currentSong.artist || 'Unknown artist'}</p>
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onPlayPause} className="p-2 rounded-full flex-shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}>
          <AnimatePresence mode="wait">
            {isPlaying
              ? <motion.div key="p" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}><Pause className="w-4 h-4 text-primary-foreground fill-primary-foreground" /></motion.div>
              : <motion.div key="pl" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }}><Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" /></motion.div>
            }
          </AnimatePresence>
        </motion.button>
      </div>
      {type === 'lyrics' ? (
        <LyricsView song={currentSong} currentTime={currentTime} duration={duration} isPlaying={isPlaying} onLyricsUpdated={onSongUpdated} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <EqPanel eq={eq || { sub: 0, bass: 0, low: 0, mid: 0, high: 0, treble: 0 }} onEqChange={onEqChange} analyser={analyser} isPlaying={isPlaying} />
        </div>
      )}
    </div>
  );
}
