import { useEffect, useRef, useState } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import FullPlayerHeader from '@/features/player/components/FullPlayerHeader';
import PlayerAuxTab from '@/features/player/components/PlayerAuxTab';
import PlayerMainTab from '@/features/player/components/PlayerMainTab';

export default function FullPlayer({
  currentSong, isPlaying, onPlayPause, onNext, onPrev,
  onToggleFavorite, onCollapse, progress, currentTime, duration,
  onSeek, volume, onVolumeChange, shuffle, onShuffleToggle, repeat, onRepeatToggle,
  analyser, onSongUpdated, eq, onEqChange,
  queue, onQueueRemove, onQueuePlay, onQueueReorder,
  sleepRemaining = 0, sleepDimming = false, onSleepTimerChange,
  coverShape = 'square', canFavorite = true, playlists = [], onAddSongsToPlaylist, onAddCurrentToQueue, onEditCurrent
}) {
  const isNativeApp = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
  const dragControls = useDragControls();
  const [tab, setTab] = useState('player');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [showInlineQueue, setShowInlineQueue] = useState(false);
  const queueScrollRef = useRef(null);
  const wasInlineQueueOpenRef = useRef(false);
  const currentQueueIndex = currentSong ? (queue?.findIndex(item => item.id === currentSong.id) ?? -1) : -1;
  const smallCoverRadius = coverShape === 'circle' ? 'rounded-full' : 'rounded-xl';

  useEffect(() => {
    const handler = (event) => {
      if (!duration) return;
      onSeek((event.detail.time / duration) * 100);
    };
    window.addEventListener('lyrics-seek', handler);
    return () => window.removeEventListener('lyrics-seek', handler);
  }, [duration, onSeek]);

  useEffect(() => {
    const wasOpen = wasInlineQueueOpenRef.current;
    wasInlineQueueOpenRef.current = showInlineQueue;
    if (!showInlineQueue || wasOpen || !currentSong) return undefined;
    const timer = window.setTimeout(() => {
      const container = queueScrollRef.current;
      const active = container?.querySelector?.('[data-current="true"]');
      if (!container || !active) return;
      const top = active.offsetTop - (container.clientHeight / 2) + (active.offsetHeight / 2);
      container.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [showInlineQueue, currentSong?.id]);

  if (!currentSong) return null;

  const closeMoreMenu = () => {
    setShowMoreMenu(false);
    setShowPlaylistPicker(false);
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!currentSong?.id || !onAddSongsToPlaylist) return;
    await onAddSongsToPlaylist([currentSong.id], playlistId);
    closeMoreMenu();
    toast.success('Added to playlist');
  };

  const handleShare = async () => {
    const text = `${currentSong.title}${currentSong.artist ? ` - ${currentSong.artist}` : ''}`;
    try {
      if (navigator.share) await navigator.share({ title: currentSong.title, text });
      else {
        await navigator.clipboard?.writeText(text);
        toast.success('Title copied');
      }
    } catch {
      toast.error('Could not share');
    } finally {
      closeMoreMenu();
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.9 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.34 }}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.y > 96 || info.velocity.y > 680) onCollapse();
      }}
      className={`fixed inset-0 z-[60] cozy-gradient-bg flex flex-col overflow-hidden ${sleepDimming ? 'sleep-dim' : ''}`}
      style={{
        '--player-cover-glow': currentSong.cover_url ? `url("${currentSong.cover_url}")` : 'none',
      }}
    >
      {currentSong.cover_url && !isNativeApp && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src={currentSong.cover_url}
            alt=""
            className="w-full h-full object-cover scale-110 blur-3xl transition-opacity duration-300"
            style={{ opacity: 'calc(0.14 + (var(--music-voice-intensity, 0) * 0.08))' }}
          />
        </div>
      )}

      <FullPlayerHeader
        dragControls={dragControls}
        tab={tab}
        onTabChange={setTab}
        onCollapse={onCollapse}
        showMoreMenu={showMoreMenu}
        onToggleMoreMenu={() => setShowMoreMenu(value => !value)}
        showPlaylistPicker={showPlaylistPicker}
        onTogglePlaylistPicker={() => setShowPlaylistPicker(value => !value)}
        playlists={playlists}
        onAddToPlaylist={handleAddToPlaylist}
        onAddCurrentToQueue={() => {
          onAddCurrentToQueue?.(currentSong);
          closeMoreMenu();
          toast.success('Added to queue');
        }}
        onEditCurrent={() => {
          onEditCurrent?.(currentSong);
          closeMoreMenu();
        }}
        onShare={handleShare}
        onOpenQueue={() => {
          setShowInlineQueue(value => !value);
          closeMoreMenu();
        }}
      />

      {tab === 'player' && (
        <PlayerMainTab
          currentSong={currentSong}
          isPlaying={isPlaying}
          progress={progress}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          shuffle={shuffle}
          repeat={repeat}
          analyser={analyser}
          coverShape={coverShape}
          canFavorite={canFavorite}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onPrev={onPrev}
          onSeek={onSeek}
          onVolumeChange={onVolumeChange}
          onShuffleToggle={onShuffleToggle}
          onRepeatToggle={onRepeatToggle}
          onToggleFavorite={onToggleFavorite}
          sleepRemaining={sleepRemaining}
          onSleepTimerChange={onSleepTimerChange}
          showSleepMenu={showSleepMenu}
          onToggleSleepMenu={() => setShowSleepMenu(value => !value)}
          onCloseSleepMenu={() => setShowSleepMenu(false)}
          showInlineQueue={showInlineQueue}
          onToggleQueue={() => setShowInlineQueue(value => !value)}
          onCloseQueue={() => setShowInlineQueue(false)}
          queue={queue}
          queueScrollRef={queueScrollRef}
          currentQueueIndex={currentQueueIndex}
          smallCoverRadius={smallCoverRadius}
          onQueuePlay={onQueuePlay}
          onQueueRemove={onQueueRemove}
          onQueueReorder={onQueueReorder}
        />
      )}

      {tab === 'lyrics' && (
        <PlayerAuxTab
          type="lyrics"
          currentSong={currentSong}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          smallCoverRadius={smallCoverRadius}
          onPlayPause={onPlayPause}
          onSongUpdated={onSongUpdated}
        />
      )}

      {tab === 'eq' && (
        <PlayerAuxTab
          type="eq"
          currentSong={currentSong}
          isPlaying={isPlaying}
          smallCoverRadius={smallCoverRadius}
          onPlayPause={onPlayPause}
          eq={eq}
          onEqChange={onEqChange}
          analyser={analyser}
        />
      )}
    </motion.div>
  );
}
