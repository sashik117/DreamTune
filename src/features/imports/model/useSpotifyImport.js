import { useEffect, useMemo, useRef, useState } from 'react';
import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from '@/utils/audioCache';
import { persistAudioFileUrl } from '@/utils/audioPersistence';
import { canUseNativeYouTube, startYouTubeDownloadQueue } from '@/utils/nativeYouTube';
import { toast } from 'sonner';
import {
  fetchSpotifyTracks,
  getAudioForTrack,
  normalizeSpotifyQuery,
  searchSpotifyTracks,
  trackIdentity,
} from './spotifyImportService';

const defaultPlaylistMeta = { total: 0, skipped: 0, limited: false };

export function useSpotifyImport({ existingSongs = [], onSongsAdded, onPlaylistAdded, onPlaylistUpdated }) {
  const queryInputRef = useRef(null);
  const [mode, setMode] = useState(() => localStorage.getItem('dreamtune-spotify-mode') || sessionStorage.getItem('dreamtune-spotify-mode') || 'playlist');
  const [query, setQuery] = useState(() => localStorage.getItem('dreamtune-spotify-query') || sessionStorage.getItem('dreamtune-spotify-query') || '');
  const [step, setStep] = useState('idle');
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [playlistName, setPlaylistName] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [importRows, setImportRows] = useState([]);
  const [playlistMeta, setPlaylistMeta] = useState(defaultPlaylistMeta);
  const [error, setError] = useState('');
  const busy = step === 'fetching' || step === 'searching' || step === 'importing';
  const cleanQuery = normalizeSpotifyQuery(query).trim();
  const hasQuery = Boolean(cleanQuery);
  const canSubmit = hasQuery && !busy;
  const existingTrackKeys = useMemo(() => new Set(
    (existingSongs || [])
      .map(trackIdentity)
      .filter(key => key !== '::')
  ), [existingSongs]);

  useEffect(() => {
    if (!busy) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const resetResults = () => {
    setTracks([]);
    setSelected(new Set());
    setPlaylistName('');
    setImportRows([]);
    setPlaylistMeta(defaultPlaylistMeta);
    setError('');
    setStep('idle');
  };

  const updateQuery = (value) => {
    const next = String(value || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    setQuery(next);
    sessionStorage.setItem('dreamtune-spotify-query', next);
    localStorage.setItem('dreamtune-spotify-query', next);
    setError('');
  };

  const syncInputQuery = (input = queryInputRef.current) => {
    if (!input) return cleanQuery;
    const next = normalizeSpotifyQuery(input.value);
    updateQuery(next);
    return next.trim();
  };

  const updateMode = (value) => {
    setMode(value);
    sessionStorage.setItem('dreamtune-spotify-mode', value);
    localStorage.setItem('dreamtune-spotify-mode', value);
    resetResults();
  };

  const toggleTrack = (index) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleFetchPlaylist = async (queryValue = cleanQuery) => {
    if (!queryValue) return;
    setError('');
    setStep('fetching');

    try {
      const { name, tracks: found, limited } = await fetchSpotifyTracks(queryValue);
      if (!found.length) {
        setError('Could not load tracks. Check that the playlist is public and the link is correct.');
        setStep('idle');
        return;
      }

      const freshTracks = found.filter(track => !existingTrackKeys.has(trackIdentity(track)));
      const skipped = found.length - freshTracks.length;
      if (!freshTracks.length) {
        setError(limited
          ? `These ${found.length} tracks are already in your library. Without Spotify API keys, the server can only see the first 100 tracks in this playlist.`
          : 'No new tracks found in this playlist: everything is already in your library.');
        setStep('idle');
        return;
      }

      setPlaylistName(name || 'Spotify playlist');
      setTracks(freshTracks);
      setPlaylistMeta({ total: found.length, skipped, limited: Boolean(limited) });
      setSelected(new Set(freshTracks.map((_, index) => index)));
      setStep('preview');
    } catch (err) {
      console.error(err);
      setError('Spotify failed. Try again or paste another link.');
      setStep('idle');
    }
  };

  const handleSearchTracks = async (queryValue = cleanQuery) => {
    if (!queryValue) return;
    setError('');
    setStep('searching');

    try {
      const found = await searchSpotifyTracks(queryValue);
      if (!found.length) {
        setError('Track not found. Try a more specific title or a Spotify track link.');
        setStep('idle');
        return;
      }

      setPlaylistName('Spotify tracks');
      setTracks(found);
      setPlaylistMeta({ total: found.length, skipped: 0, limited: false });
      setSelected(new Set());
      setStep('preview');
    } catch (err) {
      console.error(err);
      setError('Spotify search is temporarily unavailable. Try again.');
      setStep('idle');
    }
  };

  const handleSubmit = () => {
    const queryValue = syncInputQuery();
    if (!queryValue) {
      setError(mode === 'playlist'
        ? 'Paste a Spotify playlist link.'
        : 'Enter a track title or Spotify link.');
      return;
    }
    if (mode === 'playlist') handleFetchPlaylist(queryValue);
    else handleSearchTracks(queryValue);
  };

  const handleImport = async () => {
    const chosen = tracks.filter((_, index) => mode === 'playlist' || selected.has(index));
    if (!chosen.length) {
      toast.error('Select at least one track');
      return;
    }

    setStep('importing');
    const total = chosen.length;
    let done = 0;
    const added = [];
    let targetPlaylist = null;
    let playlistSongIds = [];
    if (mode === 'playlist') {
      targetPlaylist = await entities.Playlist.create({
        name: playlistName || 'Spotify playlist',
        song_ids: [],
        cover_url: chosen[0]?.cover_url || '',
        is_public: false,
      });
      onPlaylistAdded?.(targetPlaylist);
      toast.success('Spotify playlist created');
    }
    setImportRows(chosen.map((track, index) => ({
      id: `${track.title}-${track.artist}-${index}`,
      title: track.title,
      artist: track.artist,
      cover_url: track.cover_url,
      status: 'waiting',
      message: '',
    })));

    const updateRow = (index, patch) => {
      setImportRows(prev => prev.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
    };

    if (canUseNativeYouTube()) {
      const queueItems = chosen.map((track, index) => {
        const youtubeQuery = `${track.artist || ''} ${track.title || ''} audio`.trim();
        updateRow(index, { status: 'done', message: 'Added to Android background queue' });
        return {
          id: `${Date.now()}-${index}-${trackIdentity(track)}`,
          query: youtubeQuery,
          title: track.title,
          artist: track.artist,
          cover_url: track.cover_url || '',
          playlistId: targetPlaylist?.id || '',
          playlistName: targetPlaylist?.name || playlistName || 'Spotify playlist',
          source_url: track.source_url || '',
        };
      }).filter(item => item.query);
      done = queueItems.length;
      setProgress({ done, total, current: '' });

      if (!queueItems.length) {
        toast.error('Could not prepare any tracks for background download');
        setStep('done');
        return;
      }

      await startYouTubeDownloadQueue(queueItems);
      toast.success(`Background download started: ${queueItems.length} tracks`);
      setStep('done');
      return;
    }

    for (let index = 0; index < chosen.length; index++) {
      const track = chosen[index];
      setProgress({ done, total, current: `${track.artist || ''} - ${track.title || ''}` });
      updateRow(index, { status: 'loading', message: 'Searching YouTube audio...' });

      try {
        const audio = await getAudioForTrack(track);
        if (!audio?.fileUrl) {
          updateRow(index, { status: 'failed', message: 'Audio not found' });
          done++;
          continue;
        }
        updateRow(index, { status: 'loading', message: 'Saving to library...' });
        const offlineSourceUrl = audio.fileUrl;
        const stableFileUrl = await persistAudioFileUrl(offlineSourceUrl, track);

        const song = await entities.Song.create({
          title: track.title,
          artist: track.artist,
          cover_url: audio.spotifyCoverUrl || audio.coverUrl,
          file_url: stableFileUrl,
          is_favorite: false,
        });
        added.push(song);
        playlistSongIds.push(song.id);
        onSongsAdded?.([song]);
        updateRow(index, { status: 'loading', message: 'Saving offline copy...' });
        const offlineSaved = await downloadSong(song, () => {}, { sourceUrl: offlineSourceUrl });
        if (targetPlaylist) {
          const updatedPlaylist = await entities.Playlist.update(targetPlaylist.id, {
            song_ids: playlistSongIds,
            cover_url: targetPlaylist.cover_url || audio.spotifyCoverUrl || track.cover_url || audio.coverUrl || '',
          });
          targetPlaylist = { ...targetPlaylist, ...updatedPlaylist };
          onPlaylistUpdated?.(targetPlaylist);
        }
        updateRow(index, {
          status: 'done',
          message: offlineSaved
            ? 'Added offline'
            : 'Added, offline copy was not saved',
          cover_url: audio.spotifyCoverUrl || audio.coverUrl,
        });

        ;(async () => {
          try {
            const data = await media.getLyrics({ artist: track.artist, title: track.title });
            if (data.lyrics) await entities.Song.update(song.id, { lyrics: data.lyrics });
          } catch {}
        })();
      } catch (e) {
        console.warn('Track failed:', track.title, e);
        updateRow(index, { status: 'failed', message: 'Add failed' });
      }

      done++;
      setProgress({ done, total, current: '' });
    }

    toast.success(`Added ${added.length} of ${total} tracks`);
    setStep('done');
  };

  return {
    busy,
    canSubmit,
    error,
    handleImport,
    handleSubmit,
    hasQuery,
    importRows,
    mode,
    playlistMeta,
    playlistName,
    progress,
    query,
    queryInputRef,
    resetResults,
    selected,
    step,
    toggleTrack,
    tracks,
    updateMode,
    updateQuery,
  };
}
