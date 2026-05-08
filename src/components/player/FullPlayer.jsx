import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, Repeat, Shuffle, Volume2, Moon, TimerOff, MoreVertical, ListPlus, Plus, Share2, Scissors, ListMusic, X, Music, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Slider } from "@/components/ui/slider";
import LyricsView from '../LyricsView';
import EqPanel from '../EqPanel';
import CoverArt from '../CoverArt';
import BassWaveRing from '../BassWaveRing';
import FavoriteButton from '../FavoriteButton';
import { toast } from 'sonner';

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function formatRemaining(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function repeatToastMessage(value) {
  if (!value) return '\u041f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u043d\u044f \u0432\u0438\u043c\u043a\u043d\u0435\u043d\u043e';
  const suffix = value === 1 ? '\u0440\u0430\u0437' : '\u0440\u0430\u0437\u0438';
  return `\u041f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u043d\u044f \u0443\u0432\u0456\u043c\u043a\u043d\u0435\u043d\u043e: ${value} ${suffix}`;
}

const TABS = [
  { key: 'player', label: '\u041f\u043b\u0435\u0454\u0440' },
  { key: 'lyrics', label: '\u0422\u0435\u043a\u0441\u0442' },
  { key: 'eq', label: 'EQ' },
];

export default function FullPlayer({
  currentSong, isPlaying, onPlayPause, onNext, onPrev,
  onToggleFavorite, onCollapse, progress, currentTime, duration,
  onSeek, volume, onVolumeChange, shuffle, onShuffleToggle, repeat, onRepeatToggle,
  analyser, onSongUpdated, eq, onEqChange,
  queue, onQueueReorder, onQueueRemove, onQueuePlay,
  sleepRemaining = 0, sleepDimming = false, onSleepTimerChange,
  coverShape = 'square', canFavorite = true, playlists = [], onAddSongsToPlaylist, onAddCurrentToQueue, onEditCurrent
}) {
  // Handle lyrics line click в†’ seek
  useEffect(() => {
    const handler = (e) => {
      if (!duration || duration === 0) return;
      const seekPct = (e.detail.time / duration) * 100;
      onSeek(seekPct);
    };
    window.addEventListener('lyrics-seek', handler);
    return () => window.removeEventListener('lyrics-seek', handler);
  }, [duration, onSeek]);
  const [tab, setTab] = useState('player');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showInlineQueue, setShowInlineQueue] = useState(false);
  if (!currentSong) return null;
  const isCircleCover = coverShape === 'circle';
  const fullCoverRadius = isCircleCover ? 'rounded-full' : 'rounded-[28px]';
  const smallCoverRadius = isCircleCover ? 'rounded-full' : 'rounded-xl';

  const handleAddToPlaylist = async (playlistId) => {
    if (!currentSong?.id || !onAddSongsToPlaylist) return;
    await onAddSongsToPlaylist([currentSong.id], playlistId);
    setShowPlaylistPicker(false);
    setShowMoreMenu(false);
    toast.success('\u0414\u043e\u0434\u0430\u043d\u043e \u0432 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442');
  };

  const handleShare = async () => {
    const text = `${currentSong.title}${currentSong.artist ? ` - ${currentSong.artist}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: currentSong.title, text });
      else {
        await navigator.clipboard?.writeText(text);
        toast.success('\u041d\u0430\u0437\u0432\u0443 \u0441\u043a\u043e\u043f\u0456\u0439\u043e\u0432\u0430\u043d\u043e');
      }
    } catch {
      toast.error('\u041d\u0435 \u0432\u0438\u0439\u0448\u043b\u043e \u043f\u043e\u0434\u0456\u043b\u0438\u0442\u0438\u0441\u044f');
    } finally {
      setShowMoreMenu(false);
    }
  };

  const handleQueueDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const nextQueue = Array.from(queue || []);
    const [moved] = nextQueue.splice(result.source.index, 1);
    nextQueue.splice(result.destination.index, 0, moved);
    onQueueReorder?.(nextQueue);
  };

  return (
    <>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={`fixed inset-0 z-[60] cozy-gradient-bg flex flex-col overflow-hidden ${sleepDimming ? 'sleep-dim' : ''}`}
        style={{
          '--player-cover-glow': currentSong.cover_url ? `url("${currentSong.cover_url}")` : 'none',
        }}
      >
        {currentSong.cover_url && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src={currentSong.cover_url}
              alt=""
              className="w-full h-full object-cover scale-110 blur-3xl transition-opacity duration-300"
              style={{ opacity: 'calc(0.14 + (var(--music-voice-intensity, 0) * 0.08))' }}
            />
          </div>
        )}

        {/* Header */}
        <div className="fixed left-0 right-0 top-0 z-[90] flex items-center justify-between px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-2 bg-background/70 backdrop-blur-2xl border-b border-border/40">
          <motion.button whileTap={{ scale: 0.88 }} onClick={onCollapse} className="p-2 -ml-2 bg-card/90 border border-border/70 shadow-lg shadow-primary/10 hover:bg-secondary rounded-full transition-colors">
            <ChevronDown className="w-6 h-6 text-foreground" />
          </motion.button>
          <div className="flex bg-card/95 backdrop-blur-xl rounded-full p-1 gap-1 border border-border/80 shadow-lg shadow-primary/10">
            {TABS.map(t => (
              <motion.button
                key={t.key}
                whileTap={{ scale: 0.94 }}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tab === t.key ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
              >
                {t.label}
              </motion.button>
            ))}
          </div>
          <div className="relative">
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowMoreMenu(value => !value)} className="p-2 -mr-2 bg-card/90 border border-border/70 shadow-lg shadow-primary/10 hover:bg-secondary rounded-full transition-colors" aria-label="More actions">
              <MoreVertical className="w-5 h-5 text-foreground" />
            </motion.button>
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute right-0 top-12 w-64 rounded-3xl border border-border bg-card p-2 shadow-2xl shadow-black/30"
                >
                  <button onClick={() => setShowPlaylistPicker(value => !value)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                    <Plus className="w-4 h-4 text-primary" /> {'\u0414\u043e\u0434\u0430\u0442\u0438 \u0434\u043e \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u0430'}
                  </button>
                  {showPlaylistPicker && (
                    <div className="mx-1 mb-1 max-h-44 overflow-y-auto rounded-2xl bg-secondary p-1">
                      {playlists.length ? playlists.map(playlist => (
                        <button key={playlist.id} onClick={() => handleAddToPlaylist(playlist.id)} className="block w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-foreground hover:bg-card">
                          {playlist.name}
                        </button>
                      )) : <p className="px-3 py-2 text-xs text-muted-foreground">{'\u041f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u0456\u0432 \u0449\u0435 \u043d\u0435\u043c\u0430\u0454'}</p>}
                    </div>
                  )}
                  <button onClick={() => { onAddCurrentToQueue?.(currentSong); setShowMoreMenu(false); toast.success('\u0414\u043e\u0434\u0430\u043d\u043e \u0434\u043e \u0447\u0435\u0440\u0433\u0438'); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                    <ListPlus className="w-4 h-4 text-primary" /> {'\u0414\u043e\u0434\u0430\u0442\u0438 \u0434\u043e \u0447\u0435\u0440\u0433\u0438'}
                  </button>
                  <button onClick={() => { onEditCurrent?.(currentSong); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                    <Scissors className="w-4 h-4 text-primary" /> {'\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438'}
                  </button>
                  <button onClick={handleShare} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                    <Share2 className="w-4 h-4 text-primary" /> {'\u041f\u043e\u0434\u0456\u043b\u0438\u0442\u0438\u0441\u044f'}
                  </button>
                  <button onClick={() => { setShowInlineQueue(value => !value); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                    <ListMusic className="w-4 h-4 text-primary" /> {'\u0427\u0435\u0440\u0433\u0430'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Player Tab */}
        {tab === 'player' && (
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
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{currentSong.artist || 'РќРµРІС–РґРѕРјРёР№'}</p>
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
                <div className="relative">
                  <Slider value={[progress]} max={100} step={0.1} onValueChange={([v]) => onSeek(v)} className="cursor-pointer" />
                  {/* Pulsing dot on thumb handled by Slider but we add custom glow */}
                </div>
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
                    toast.success(nextShuffle ? '\u041f\u0435\u0440\u0435\u043c\u0456\u0448\u0443\u0432\u0430\u043d\u043d\u044f \u0443\u0432\u0456\u043c\u043a\u043d\u0435\u043d\u043e' : '\u041f\u0435\u0440\u0435\u043c\u0456\u0448\u0443\u0432\u0430\u043d\u043d\u044f \u0432\u0438\u043c\u043a\u043d\u0435\u043d\u043e');
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
                <Slider value={[volume * 100]} max={100} step={1} onValueChange={([v]) => onVolumeChange(v / 100)} className="cursor-pointer" />
              </div>

              <div className="relative flex items-center justify-between gap-2 pb-1">
                <button
                  onClick={() => setShowSleepMenu(value => !value)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold transition-colors ${sleepRemaining ? 'bg-primary/12 text-primary' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
                >
                  <Moon className="w-4 h-4" />
                  <span>{sleepRemaining ? formatRemaining(sleepRemaining) : 'Sleep'}</span>
                </button>
                <button
                  onClick={() => setShowInlineQueue(value => !value)}
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
                    {'\u0421\u043a\u0438\u043d\u0443\u0442\u0438'}
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
                        <p className="text-sm font-black text-foreground">{'\u0420\u0435\u0436\u0438\u043c \u0441\u043d\u0443'}</p>
                        <button onClick={() => setShowSleepMenu(false)} className="rounded-full p-1.5 hover:bg-secondary">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[5, 10, 15, 30, 45, 60].map(minutes => (
                          <button
                            key={minutes}
                            onClick={() => { onSleepTimerChange?.(minutes); setShowSleepMenu(false); }}
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

              <AnimatePresence>
                {showInlineQueue && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="rounded-3xl border border-border bg-card p-3 shadow-xl shadow-black/15">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ListMusic className="w-4 h-4 text-primary" />
                        <p className="text-sm font-black text-foreground">{'\u041d\u0430\u0441\u0442\u0443\u043f\u043d\u0456'}</p>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{queue?.length || 0}</span>
                      </div>
                      <button onClick={() => setShowInlineQueue(false)} className="rounded-full p-1.5 hover:bg-secondary">
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                    {!queue?.length ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                        <Music className="w-4 h-4" /> {'\u0427\u0435\u0440\u0433\u0430 \u043f\u043e\u0440\u043e\u0436\u043d\u044f'}
                      </div>
                    ) : (
                      <DragDropContext onDragEnd={handleQueueDragEnd}>
                        <Droppable droppableId="player-queue">
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="max-h-64 space-y-1 overflow-y-auto pr-1">
                              {queue.map((song, index) => (
                                <Draggable key={`${song.id}-${index}`} draggableId={`${song.id}-${index}`} index={index}>
                                  {(dragProvided, snapshot) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={`flex min-h-14 items-center gap-2 rounded-2xl bg-secondary/65 p-2 shadow-sm transition-shadow ${snapshot.isDragging ? 'shadow-2xl shadow-primary/25 opacity-95' : ''}`}
                                    >
                                      <button type="button" {...dragProvided.dragHandleProps} className="min-h-10 min-w-8 rounded-xl flex items-center justify-center touch-none" aria-label="Перетягнути трек">
                                        <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
                                      </button>
                                      <div className="flex min-w-0 flex-1 items-center gap-3">
                                        <CoverArt song={song} className={`h-10 w-10 ${smallCoverRadius} shrink-0`} fallbackClassName="text-xs" />
                                        <button onClick={() => onQueuePlay?.(song)} className="min-w-0 flex-1 text-left">
                                          <p className="truncate text-sm font-bold text-foreground">{song.title}</p>
                                          <p className="truncate text-xs text-muted-foreground">{song.artist || '\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0438\u0439'}</p>
                                        </button>
                                      </div>
                                      <button onClick={() => onQueueRemove?.(song.id)} className="rounded-full p-2 hover:bg-card" aria-label="Прибрати з черги">
                                        <X className="w-4 h-4 text-muted-foreground" />
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Lyrics Tab */}
        {tab === 'lyrics' && (
          <div className="relative z-10 h-full min-h-0 overflow-hidden flex flex-col px-5 pt-[calc(82px+env(safe-area-inset-top,0px))] full-player-safe-bottom">
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <CoverArt song={currentSong} className={`w-10 h-10 ${smallCoverRadius} flex-shrink-0`} fallbackClassName="text-xs" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist || 'РќРµРІС–РґРѕРјРёР№'}</p>
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
            <LyricsView song={currentSong} currentTime={currentTime} duration={duration} isPlaying={isPlaying} onLyricsUpdated={onSongUpdated} />
          </div>
        )}

        {/* EQ Tab */}
        {tab === 'eq' && (
          <div className="relative z-10 h-full min-h-0 overflow-hidden flex flex-col px-5 pt-[calc(82px+env(safe-area-inset-top,0px))] full-player-safe-bottom">
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
              <CoverArt song={currentSong} className={`w-10 h-10 ${smallCoverRadius} flex-shrink-0`} fallbackClassName="text-xs" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist || 'РќРµРІС–РґРѕРјРёР№'}</p>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onPlayPause} className="p-2 rounded-full flex-shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}>
                {isPlaying
                  ? <Pause className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
                  : <Play className="w-4 h-4 text-primary-foreground fill-primary-foreground ml-0.5" />
                }
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EqPanel eq={eq || { sub: 0, bass: 0, low: 0, mid: 0, high: 0, treble: 0 }} onEqChange={onEqChange} analyser={analyser} isPlaying={isPlaying} />
            </div>
          </div>
        )}
      </motion.div>

    </>
  );
}
