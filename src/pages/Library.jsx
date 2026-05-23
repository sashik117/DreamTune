import { useMemo, useState } from 'react';
import SongCard from '../components/SongCard';
import { Music, User, Search, ArrowUpDown, CheckSquare, Trash2, ListPlus, X, Shuffle, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { normalizeSearchText } from '@/utils/text';

const SORT_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'newest', label: 'Newest' },
];

const unknownArtist = 'Unknown artist';

export default function Library({
  songs,
  playlists = [],
  currentSongId,
  isPlaying,
  onPlay,
  onToggleFavorite,
  onDelete,
  onDeleteMany,
  cachedSongs,
  onEdit,
  onAddToQueue,
  onPlayNext,
  onAddSongsToPlaylist,
  onPlayPlaylist,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('artist');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const visibleSongs = useMemo(() => {
    let result = [...songs];
    const q = normalizeSearchText(query);

    if (q) {
      const terms = q.split(' ').filter(Boolean);
      result = result.filter(song =>
        terms.every(term => {
          const haystack = normalizeSearchText(`${song.title || ''} ${song.artist || ''}`);
          return haystack.includes(term);
        })
      );
    }

    if (sort === 'title') result.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'));
    if (sort === 'artist') {
      result.sort((a, b) => {
        const artistCompare = (a.artist || unknownArtist).localeCompare(b.artist || unknownArtist, 'uk');
        return artistCompare || (a.title || '').localeCompare(b.title || '', 'uk');
      });
    }
    if (sort === 'newest') {
      result.sort((a, b) =>
        Number(new Date(b.created_at || b.created_date || b.downloadedAt || 0)) -
        Number(new Date(a.created_at || a.created_date || a.downloadedAt || 0))
      );
    }

    return result;
  }, [songs, query, sort]);

  const grouped = useMemo(() => {
    const map = {};
    visibleSongs.forEach(song => {
      const key = song.artist || unknownArtist;
      if (!map[key]) map[key] = [];
      map[key].push(song);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'uk'));
  }, [visibleSongs]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = visibleSongs.length > 0 && selectedIds.length === visibleSongs.length;
  const groupsToRender = sort === 'artist' ? grouped : [['', visibleSongs]];

  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds([]);
      setSelectionMode(false);
      return;
    }
    setSelectionMode(true);
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const selectAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleSongs.map(song => song.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
  };

  const addSelectedToPlaylist = async (playlist) => {
    if (!selectedIds.length) return;
    try {
      await onAddSongsToPlaylist?.(selectedIds, playlist.id);
      toast.success(`${selectedCount} songs added to "${playlist.name}"`);
      clearSelection();
    } catch (err) {
      console.error(err);
      toast.error('Could not add to playlist');
    }
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    try {
      const deleted = await onDeleteMany?.(selectedIds);
      if (deleted === false) return;
      toast.success(`${selectedCount} songs deleted`);
      clearSelection();
    } catch (err) {
      console.error(err);
      toast.error('Could not delete selected songs');
    }
  };

  let flatIndex = 0;

  return (
    <div className="px-3 sm:px-4 pb-4">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 pt-3 pb-3 mb-5 bg-background/92 backdrop-blur-xl border-b border-border/60"
      >
        <div className="pl-16 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-foreground mb-0.5 truncate">Library</h1>
            <p className="text-sm text-muted-foreground truncate">{songs.length} songs · {grouped.length} artists</p>
          </div>
          <Button variant="outline" size="icon" onClick={toggleSelectionMode} className="rounded-2xl border-border shrink-0" aria-label={selectionMode ? 'Done' : 'Select'}>
            {selectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            onClick={() => {
              onPlayPlaylist?.(visibleSongs, { shuffle: true });
              toast.success('Library shuffled');
            }}
            disabled={!visibleSongs.length}
            className="rounded-2xl shrink-0"
            aria-label="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Song, artist..."
            className="pl-10 bg-secondary border-border rounded-xl h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
            <select
              value={sort}
              onChange={event => setSort(event.target.value)}
              className="text-xs bg-secondary text-foreground border border-border rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectionMode && (
        <div
          className="fixed left-3 right-3 z-[75] rounded-3xl border border-border bg-card/95 backdrop-blur-xl p-2 shadow-2xl shadow-primary/15"
          style={{ bottom: currentSongId ? 'calc(var(--bottom-nav-height) + var(--mini-player-height) + var(--safe-bottom) + 10px)' : 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 10px)' }}
        >
          <div className="flex items-center justify-around gap-1">
            <span className="min-w-12 text-center text-xs font-black text-foreground">{selectedCount}</span>
            <Button size="icon" variant="outline" onClick={selectAllVisible} className="rounded-2xl border-border" aria-label={allVisibleSelected ? 'Clear all' : 'Select all'}>
              {allVisibleSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" disabled={!selectedCount} className="rounded-2xl" aria-label="Add to playlist">
                  <ListPlus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border rounded-2xl shadow-xl min-w-48">
                {playlists.length ? playlists.map(playlist => (
                  <DropdownMenuItem key={playlist.id} onClick={() => addSelectedToPlaylist(playlist)} className="rounded-xl">
                    {playlist.name}
                  </DropdownMenuItem>
                )) : (
                  <div className="px-3 py-2 text-xs font-bold text-muted-foreground">Create a playlist first</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="outline"
              disabled={!selectedCount}
              onClick={deleteSelected}
              className="rounded-2xl border-border text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={clearSelection} className="rounded-2xl" aria-label="Close selection">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {visibleSongs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Music className="w-10 h-10 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            {songs.length ? 'Nothing found' : 'Add songs to make them appear here'}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-5">
          {groupsToRender.map(([artist, artistSongs], groupIndex) => {
            const startIndex = flatIndex;
            flatIndex += artistSongs.length;
            return (
              <motion.div
                key={sort === 'artist' ? artist : sort}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.025, duration: 0.24 }}
                className="rounded-3xl border border-border bg-card/95 backdrop-blur-sm p-2 sm:p-3 shadow-sm"
              >
                {sort === 'artist' && (
                  <div className="flex items-center gap-2.5 mb-2.5 px-1">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--accent)/0.25))' }}
                    >
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground truncate">{artist}</span>
                    <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {artistSongs.length}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  {artistSongs.map((song, index) => (
                    <SongCard
                      key={song.id}
                      song={song}
                      index={index}
                      staggerIndex={startIndex + index}
                      isActive={currentSongId === song.id}
                      isPlaying={isPlaying}
                      onPlay={onPlay}
                      onToggleFavorite={onToggleFavorite}
                      onDelete={onDelete}
                      isCached={cachedSongs?.has(song.id) || song.is_offline}
                      onEdit={onEdit}
                      onAddToQueue={onAddToQueue}
                      onPlayNext={onPlayNext}
                      playlists={playlists}
                      onAddSongsToPlaylist={onAddSongsToPlaylist}
                      selectionMode={selectionMode}
                      selected={selectedIds.includes(song.id)}
                      onSelectToggle={toggleSelected}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
