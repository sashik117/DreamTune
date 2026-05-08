import { useState, useMemo } from 'react';
import { Search, WifiOff, Wifi, ArrowUpDown } from 'lucide-react';
import { Input } from "@/components/ui/input";
import SongCard from '../components/SongCard';

const SORT_OPTIONS = [
  { value: 'title', label: 'Назва А-Я' },
  { value: 'artist', label: 'Виконавець' },
  { value: 'newest', label: 'Нові' },
];

export default function SearchPage({ songs, currentSongId, isPlaying, onPlay, onToggleFavorite, onDelete, cachedSongs }) {
  const [query, setQuery] = useState('');
  const [cacheFilter, setCacheFilter] = useState('all'); // all | cached | online
  const [sort, setSort] = useState('title');

  const filtered = useMemo(() => {
    let result = [...songs];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.artist?.toLowerCase().includes(q)
      );
    }

    if (cacheFilter === 'cached') result = result.filter(s => cachedSongs?.has(s.id));
    if (cacheFilter === 'online') result = result.filter(s => !cachedSongs?.has(s.id));

    if (sort === 'title') result.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'));
    if (sort === 'artist') result.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'uk'));
    if (sort === 'newest') result.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    return result;
  }, [songs, query, cacheFilter, sort, cachedSongs]);

  const showResults = query.trim() || cacheFilter !== 'all';

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-foreground mb-4">Пошук</h1>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Пісня, виконавець..."
          className="pl-10 bg-secondary border-border rounded-xl h-11"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setCacheFilter(cacheFilter === 'cached' ? 'all' : 'cached')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${cacheFilter === 'cached' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          <WifiOff className="w-3 h-3" /> Завантажені
        </button>
        <button
          onClick={() => setCacheFilter(cacheFilter === 'online' ? 'all' : 'online')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${cacheFilter === 'online' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          <Wifi className="w-3 h-3" /> Онлайн
        </button>
        <div className="flex items-center gap-1.5 ml-auto">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="text-xs bg-secondary text-foreground border-0 rounded-lg px-2 py-1.5 outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {showResults && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">Нічого не знайдено</p>
        </div>
      )}

      {!showResults && (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Шукай серед своїх пісень</p>
        </div>
      )}

      <div className="space-y-1">
        {showResults && filtered.map((song, i) => (
          <SongCard
            key={song.id}
            song={song}
            index={i}
            isActive={currentSongId === song.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            isCached={cachedSongs?.has(song.id)}
          />
        ))}
      </div>
    </div>
  );
}