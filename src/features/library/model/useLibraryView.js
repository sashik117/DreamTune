import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { normalizeSearchText } from '@/utils/text';

export const SORT_OPTIONS = [
  { value: 'title', label: 'Title A-Z' },
  { value: 'artist', label: 'Artist' },
  { value: 'newest', label: 'Newest' },
];

const UNKNOWN_ARTIST = 'Unknown artist';

export function useLibraryView({ songs = [], onAddSongsToPlaylist, onDeleteMany }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('title');
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
        const artistCompare = (a.artist || UNKNOWN_ARTIST).localeCompare(b.artist || UNKNOWN_ARTIST, 'uk');
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
      const key = song.artist || UNKNOWN_ARTIST;
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

  return {
    addSelectedToPlaylist,
    allVisibleSelected,
    clearSelection,
    deleteSelected,
    grouped,
    groupsToRender,
    query,
    selectAllVisible,
    selectedCount,
    selectedIds,
    selectionMode,
    setQuery,
    setSort,
    sort,
    toggleSelected,
    toggleSelectionMode,
    visibleSongs,
  };
}
