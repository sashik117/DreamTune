import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, Music, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import Recommendations from '../components/Recommendations';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import YouTubeDownload from '../components/YouTubeDownload';
import SongCard from '../components/SongCard';
import CoverArt from '../components/CoverArt';
import { media } from '../api/SupabaseClient';

function useHorizontalOverflow(items) {
  const ref = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const check = () => setHasOverflow(node.scrollWidth > node.clientWidth + 4);
    check();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    observer?.observe(node);
    window.addEventListener('resize', check);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [items]);

  return [ref, hasOverflow];
}

export default function Home({
  songs,
  recentSongs,
  playlists,
  onPlay,
  currentSongId,
  isPlaying,
  onSongAdded,
  onToggleFavorite,
  onDelete,
  onEdit,
  onAddToQueue,
  onPlayNext,
  onAddSongsToPlaylist,
}) {
  const isNativeApp = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
  const [recDownload, setRecDownload] = useState(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllGlobal, setShowAllGlobal] = useState(false);
  const [showAllSpotify, setShowAllSpotify] = useState(false);
  const [globalChart, setGlobalChart] = useState([]);
  const [spotifyChart, setSpotifyChart] = useState([]);
  const [chartError, setChartError] = useState('');
  const [spotifyChartError, setSpotifyChartError] = useState('');
  const [favoriteOverlay, setFavoriteOverlay] = useState({});

  const allRecent = useMemo(
    () => [...songs].sort((a, b) => Number(new Date(b.created_at || b.created_date || 0)) - Number(new Date(a.created_at || a.created_date || 0))),
    [songs]
  );
  const favoriteSongs = useMemo(
    () => songs
      .map(song => favoriteOverlay[song.id] ? { ...song, ...favoriteOverlay[song.id] } : song)
      .filter(song => song.is_favorite)
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk')),
    [songs, favoriteOverlay]
  );
  const [favoritesRef] = useHorizontalOverflow(favoriteSongs);
  const [recentRef] = useHorizontalOverflow(recentSongs);
  const globalRef = useRef(null);
  const spotifyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    media.getGlobalChart(20)
      .then(data => {
        if (!cancelled) setGlobalChart(data.tracks || []);
      })
      .catch(() => {
        if (!cancelled) setChartError('The chart is temporarily unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleFavoriteChange = (event) => {
      const song = event.detail?.song;
      if (!song?.id) return;
      setFavoriteOverlay(prev => ({ ...prev, [song.id]: song }));
    };
    window.addEventListener('dreamtune-favorite-change', handleFavoriteChange);
    return () => window.removeEventListener('dreamtune-favorite-change', handleFavoriteChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    media.getSpotifyChart(20)
      .then(data => {
        if (!cancelled) setSpotifyChart(data.tracks || []);
      })
      .catch(() => {
        if (!cancelled) setSpotifyChartError('Spotify Top 20 is temporarily unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const renderShelfCard = (song, i) => (
    <motion.button
      key={song.id}
      type="button"
      initial={isNativeApp ? false : { opacity: 0, x: 14 }}
      animate={isNativeApp ? undefined : { opacity: 1, x: 0 }}
      transition={isNativeApp ? undefined : { delay: i * 0.035 }}
      onClick={() => onPlay(song)}
      className="flex-shrink-0 w-24 xs:w-28 sm:w-32 text-left group snap-start"
    >
      <CoverArt song={song} className="aspect-square w-full rounded-2xl shadow-lg shadow-primary/10" fallbackClassName="text-xs">
        {currentSongId === song.id && isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
            <div className="flex gap-1 items-end h-6">
              {[60, 100, 40, 80].map((h, j) => (
                <div key={j} className="w-1 bg-primary rounded-full animate-pulse" style={{ height: `${h}%`, animationDelay: `${j * 150}ms` }} />
              ))}
            </div>
          </div>
        )}
      </CoverArt>
      <p className="text-sm font-bold text-foreground truncate mt-2">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.artist || 'Unknown artist'}</p>
    </motion.button>
  );

  const renderSongDialog = (title, open, setOpen, list) => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-xl mx-auto max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-2">
          {list.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              index={i}
              isActive={currentSongId === song.id}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              onEdit={onEdit}
              onAddToQueue={onAddToQueue}
              onPlayNext={onPlayNext}
              playlists={playlists}
              onAddSongsToPlaylist={onAddSongsToPlaylist}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  const openDownload = (track) => {
    setRecDownload({ title: track.title, youtube_query: track.youtube_query || `${track.title} ${track.artist}` });
  };

  const scrollRow = (ref, direction) => {
    const row = ref?.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(180, row.clientWidth * 0.72), behavior: 'smooth' });
  };

  const renderMiniSeeAll = (onClick, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center rounded-full bg-primary/12 px-1.5 text-[11px] font-black text-primary underline-offset-4 transition hover:bg-primary/18 hover:underline active:scale-95 disabled:pointer-events-none disabled:opacity-30 sm:h-8 sm:px-2.5 sm:text-xs"
    >
      See all
    </button>
  );

  const renderRowControls = (rowRef, onSeeAll, disabled = false) => (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => scrollRow(rowRef, -1)}
        className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/75 text-foreground shadow-sm backdrop-blur-md active:scale-95"
        aria-label="Scroll left">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => scrollRow(rowRef, 1)}
        className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/75 text-foreground shadow-sm backdrop-blur-md active:scale-95"
        aria-label="Scroll right">
        <ChevronRight className="w-4 h-4" />
      </button>
      {renderMiniSeeAll(onSeeAll, disabled)}
    </div>
  );

  const handleHorizontalWheel = (event) => {
    const target = event.currentTarget;
    if (!target || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    target.scrollBy({ left: event.deltaY * 0.55, behavior: 'smooth' });
  };

  const renderChartDialog = (title, open, setOpen, tracks) => (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-xl mx-auto max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {tracks.map(track => (
            <button
              key={`dialog-${title}-${track.rank}-${track.title}-${track.artist}`}
              type="button"
              onClick={() => {
                setOpen(false);
                openDownload(track);
              }}
              className="w-full flex items-center gap-3 rounded-2xl bg-secondary/70 hover:bg-secondary p-3 text-left transition"
            >
              <span className="w-7 text-center text-xs font-black text-primary shrink-0">{track.rank}</span>
              <div className="w-12 h-12 rounded-xl bg-card overflow-hidden shrink-0 flex items-center justify-center">
                {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
              </div>
              <span className="text-[11px] font-bold text-primary/85 shrink-0">Add</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderSectionHeader = ({ title, icon: Icon, controls, heart = false }) => (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {heart ? <Heart className="w-5 h-5 text-primary fill-primary shrink-0" /> : Icon ? <Icon className="w-5 h-5 text-primary shrink-0" /> : null}
        <h2 className="text-base sm:text-lg font-black text-foreground min-w-0 truncate">{title}</h2>
      </div>
      {controls}
    </div>
  );

  const renderChartShelf = ({ title, tracks, error, sourceLabel, icon: Icon = TrendingUp, onSeeAll, rowRef }) => (
    <section className="mb-4 min-w-0 overflow-visible">
      {renderSectionHeader({ title, icon: Icon, controls: renderRowControls(rowRef, onSeeAll, tracks.length === 0) })}
      {tracks.length > 0 ? (
        <div ref={rowRef} onWheel={handleHorizontalWheel} className="dream-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {tracks.map(track => (
            <motion.div
              key={`${sourceLabel}-${track.rank}-${track.title}-${track.artist}`}
              whileTap={{ scale: 0.97 }}
              className="flex-shrink-0 w-44 sm:w-52 rounded-3xl border border-border bg-card/90 p-3 text-left shadow-lg shadow-primary/10 snap-start"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-secondary shrink-0">
                  {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-6 h-6 text-muted-foreground m-4" />}
                  <span className="absolute left-1.5 top-1.5 min-w-5 h-5 px-1 rounded-full bg-background/85 text-[10px] font-black text-foreground flex items-center justify-center">
                    {track.rank}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground truncate">{track.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      openDownload(track);
                    }}
                    className="mt-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-black text-primary"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-border bg-card/85 p-4 text-sm text-muted-foreground">
          {error || 'Loading chart...'}
        </div>
      )}
    </section>
  );

  return (
    <div className="px-3 sm:px-4 pb-4">
      <motion.div
        initial={isNativeApp ? false : { opacity: 0, y: -14 }}
        animate={isNativeApp ? undefined : { opacity: 1, y: 0 }}
        className="sticky top-0 z-50 pt-3 pb-3 mb-6 bg-background/92 backdrop-blur-xl border-b border-border/60"
      >
        <div className="pl-16">
          <p className="text-sm text-muted-foreground font-bold">DreamTune</p>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">What are we listening to today?</h1>
        </div>
      </motion.div>

      {favoriteSongs.length > 0 && (
        <section className="mb-4 min-w-0 overflow-visible">
          {renderSectionHeader({ title: 'Favorites', heart: true, controls: renderRowControls(favoritesRef, () => setShowAllFavorites(true)) })}
          <div ref={favoritesRef} onWheel={handleHorizontalWheel} className="dream-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-hidden pb-1">
            {favoriteSongs.map(renderShelfCard)}
          </div>
        </section>
      )}

      {recentSongs.length > 0 && (
        <section className="mb-4 min-w-0 overflow-visible">
          {renderSectionHeader({ title: 'Recently added', controls: renderRowControls(recentRef, () => setShowAllRecent(true)) })}
          <div ref={recentRef} onWheel={handleHorizontalWheel} className="dream-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-hidden pb-1">
            {recentSongs.map(renderShelfCard)}
          </div>
        </section>
      )}

      {renderChartShelf({ title: 'Global Top', tracks: globalChart, error: chartError || 'Loading global chart...', sourceLabel: 'live', icon: TrendingUp, onSeeAll: () => setShowAllGlobal(true), rowRef: globalRef })}
      {renderChartShelf({ title: 'Spotify Top 20', tracks: spotifyChart, error: spotifyChartError || 'Loading Spotify Top 20...', sourceLabel: 'Spotify', icon: Music, onSeeAll: () => setShowAllSpotify(true), rowRef: spotifyRef })}

      <Recommendations songs={songs} onDownloadRecommendation={setRecDownload} />

      {songs.length === 0 && (
        <motion.div initial={isNativeApp ? false : { opacity: 0 }} animate={isNativeApp ? undefined : { opacity: 1 }} transition={isNativeApp ? undefined : { delay: 0.4 }} className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Music className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Nothing here yet</h3>
          <p className="text-sm text-muted-foreground">Tap the add button below to add your first song</p>
        </motion.div>
      )}

      {renderSongDialog('Favorite tracks', showAllFavorites, setShowAllFavorites, favoriteSongs)}
      {renderSongDialog('All tracks by date added', showAllRecent, setShowAllRecent, allRecent)}

      {renderChartDialog('Global Top', showAllGlobal, setShowAllGlobal, globalChart)}
      {renderChartDialog('Spotify Top 20', showAllSpotify, setShowAllSpotify, spotifyChart)}
      <Dialog open={!!recDownload} onOpenChange={() => setRecDownload(null)}>
        <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Download: {recDownload?.title}</DialogTitle>
          </DialogHeader>
          {recDownload && (
            <YouTubeDownload
              prefillQuery={recDownload.youtube_query}
              onSongAdded={(s) => { onSongAdded(s); setRecDownload(null); }}
              onClose={() => setRecDownload(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
