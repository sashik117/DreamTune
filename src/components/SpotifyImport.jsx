import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, Music2, Search, ShieldAlert, XCircle } from 'lucide-react';
import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from '@/utils/audioCache';
import { persistAudioFileUrl } from '@/utils/audioPersistence';
import { canUseNativeYouTube, downloadYouTubeOnDevice, startYouTubeDownloadQueue } from '@/utils/nativeYouTube';
import { toast } from 'sonner';

async function fetchSpotifyTracks(playlistUrl) {
  return media.getSpotifyPlaylist(playlistUrl);
}

async function searchSpotifyTracks(query) {
  const data = await media.searchSpotifyTracks(query, 12);
  return data.tracks || [];
}

function normalizeSpotifyQuery(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeTrackText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(official|audio|video|lyrics?|remaster(?:ed)?|hd|4k)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trackIdentity(track) {
  return `${normalizeTrackText(track?.artist)}::${normalizeTrackText(track?.title)}`;
}

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function searchYouTubeDirect(query) {
  const bases = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi-libre.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.syncpundit.io'];
  for (const base of bases) {
    try {
      const data = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const found = items.map(item => {
        const id = String(item.url || '').match(/[?&]v=([\w-]{11})/)?.[1];
        return id ? { video_id: id, title: item.title, thumbnail: item.thumbnail } : null;
      }).filter(Boolean).slice(0, 8);
      if (found.length) return found;
    } catch {}
  }
  const invidious = ['https://inv.thepixora.com', 'https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be'];
  for (const base of invidious) {
    try {
      const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const found = (Array.isArray(data) ? data : []).filter(item => item?.type === 'video' && item.videoId).map(item => ({
        video_id: item.videoId,
        title: item.title,
        thumbnail: item.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
      })).slice(0, 8);
      if (found.length) return found;
    } catch {}
  }
  try {
    const data = await fetchJson(`https://yt.lemnoslife.com/search?part=snippet&q=${encodeURIComponent(query)}&type=video`);
    const found = (data.items || []).map(item => {
      const id = item?.id?.videoId || item?.videoId;
      return id ? {
        video_id: id,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
      } : null;
    }).filter(Boolean).slice(0, 8);
    if (found.length) return found;
  } catch {}
  return [];
}

async function resolveDirectAudioUrl(videoId) {
  const bases = ['https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks', 'https://pipedapi-libre.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://pipedapi.syncpundit.io'];
  for (const base of bases) {
    try {
      const data = await fetchJson(`${base}/streams/${videoId}`, 10000);
      const audio = (data.audioStreams || []).filter(item => item?.url).sort((a, b) => Number(b.bitrate || b.quality || 0) - Number(a.bitrate || a.quality || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }
  const invidious = ['https://inv.thepixora.com', 'https://yt.chocolatemoo53.com', 'https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://yewtu.be'];
  for (const base of invidious) {
    try {
      const data = await fetchJson(`${base}/api/v1/videos/${videoId}`, 10000);
      const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
      const audio = formats.filter(item => item?.url && String(item.type || item.mimeType || '').toLowerCase().includes('audio')).sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }
  return '';
}

async function findYouTubeCandidatesForTrack(track) {
  const baseQuery = `${track.artist || ''} ${track.title || ''}`.trim();
  const queries = Array.from(new Set([
    `${baseQuery} audio`,
    `${baseQuery} official audio`,
    `${baseQuery} lyrics`,
    track.youtube_query || baseQuery,
  ].filter(Boolean)));

  const candidates = [];
  for (const query of queries) {
    try {
      const meta = await media.searchYouTube(query);
      const results = meta.results?.length ? meta.results : [meta];
      for (const result of results) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    } catch (error) {
      console.warn('YouTube search failed:', query, error);
      const directResults = await searchYouTubeDirect(query);
      for (const result of directResults) {
        if (result?.video_id && !candidates.some(item => item.video_id === result.video_id)) {
          candidates.push(result);
        }
      }
    }
    if (candidates.length >= 6) break;
  }
  return candidates;
}

async function getAudioForTrack(track) {
  const candidates = await findYouTubeCandidatesForTrack(track);
  let audio = null;
  let result = null;
  for (const [index, candidate] of candidates.slice(0, 4).entries()) {
    if (index < 3) {
      try {
        const native = await downloadYouTubeOnDevice(candidate.video_id);
        if (native?.native_file_url || native?.file_url) {
          audio = { file_url: native.native_file_url || native.file_url, cover_url: native.cover_url || candidate.thumbnail, native: true };
          result = candidate;
          break;
        }
      } catch (error) {
        console.warn('Native YouTube candidate failed:', candidate.title || candidate.video_id, error);
      }
    }
    try {
      audio = await media.downloadYouTube(candidate.video_id);
      result = candidate;
      break;
    } catch (error) {
      console.warn('YouTube candidate failed:', candidate.title || candidate.video_id, error);
      const directUrl = await resolveDirectAudioUrl(candidate.video_id);
      if (directUrl) {
        audio = { file_url: directUrl, cover_url: candidate.thumbnail };
        result = candidate;
        break;
      }
    }
  }
  if (!audio?.file_url && track.preview_url) {
    audio = { file_url: track.preview_url, cover_url: track.cover_url };
    result = { video_id: '', thumbnail: track.cover_url };
  }
  if (!audio?.file_url) return null;
  let spotifyCoverUrl = track.cover_url || '';
  if (!spotifyCoverUrl && track.source_url) {
    try {
      const cover = await media.getSpotifyCover(track.source_url);
      spotifyCoverUrl = cover.cover_url || '';
    } catch {}
  }
  const fallbackCoverUrl = audio.cover_url || result.thumbnail || `https://img.youtube.com/vi/${result.video_id}/hqdefault.jpg`;
  return {
    fileUrl: audio.file_url,
    videoId: result?.video_id || '',
    coverUrl: spotifyCoverUrl || fallbackCoverUrl,
    spotifyCoverUrl,
    fallbackCoverUrl,
  };
}

function BusyWarning() {
  return (
    <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-3 text-xs text-foreground flex gap-2">
      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p>
        Keep this screen open while the process runs. Navigating away or refreshing can interrupt the download.
      </p>
    </div>
  );
}

export default function SpotifyImport({ existingSongs = [], onSongsAdded, onPlaylistAdded, onPlaylistUpdated, onClose }) {
  const queryInputRef = useRef(null);
  const [mode, setMode] = useState(() => localStorage.getItem('dreamtune-spotify-mode') || sessionStorage.getItem('dreamtune-spotify-mode') || 'playlist');
  const [query, setQuery] = useState(() => localStorage.getItem('dreamtune-spotify-query') || sessionStorage.getItem('dreamtune-spotify-query') || '');
  const [step, setStep] = useState('idle');
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [playlistName, setPlaylistName] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [importRows, setImportRows] = useState([]);
  const [playlistMeta, setPlaylistMeta] = useState({ total: 0, skipped: 0, limited: false });
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
    setPlaylistMeta({ total: 0, skipped: 0, limited: false });
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
        const query = `${track.artist || ''} ${track.title || ''} audio`.trim();
        updateRow(index, { status: 'done', message: 'Added to Android background queue' });
        return {
          id: `${Date.now()}-${index}-${trackIdentity(track)}`,
          query,
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
      setProgress({ done, total, current: `${track.artist || ''} — ${track.title || ''}` });
      updateRow(index, { status: 'loading', message: 'Searching YouTube audio...' });

      try {
        const audio = await getAudioForTrack(track);
        if (!audio?.fileUrl) {
          updateRow(index, { status: 'failed', message: 'Audio not found' });
          done++;
          continue;
        }
        updateRow(index, { status: 'loading', message: 'Saving to library...' });
        const stableFileUrl = await persistAudioFileUrl(audio.fileUrl, track);

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
        const offlineSaved = await downloadSong(song, () => {});
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

  return (
    <div className="space-y-4">
      {busy && <BusyWarning />}

      {(step === 'idle' || step === 'fetching' || step === 'searching') && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['playlist', 'Playlist'],
              ['track', 'Track'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => updateMode(key)}
                className={`rounded-2xl px-3 py-2 text-sm font-black transition ${mode === key ? 'bg-primary/15 text-primary ring-2 ring-primary/20' : 'bg-secondary text-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {mode === 'playlist'
              ? 'Paste a public Spotify playlist link. If Spotify API access is available, DreamTune will pull as many tracks as possible across pages.'
              : 'Enter a track title, artist, or Spotify track link. Then choose the right result.'}
          </p>

          <Input
            ref={queryInputRef}
            value={query}
            onChange={e => updateQuery(e.target.value)}
            placeholder={mode === 'playlist' ? 'https://open.spotify.com/playlist/...' : 'Billie Eilish Birds of a Feather'}
            className="bg-secondary border-border"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}

          <Button onClick={handleSubmit} disabled={!canSubmit} className={`w-full bg-primary hover:brightness-110 ${hasQuery ? 'shadow-lg shadow-primary/25 opacity-100' : 'opacity-70'}`}>
            {busy ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{mode === 'playlist' ? 'Loading tracks...' : 'Searching track...'}</>
            ) : (
              <>{mode === 'playlist' ? <Music2 className="w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />}{mode === 'playlist' ? 'Find playlist' : 'Find track'}</>
            )}
          </Button>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            <p className="text-sm font-medium text-foreground truncate">{playlistName}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === 'playlist'
              ? `${tracks.length} new of ${playlistMeta.total || tracks.length} tracks. ${playlistMeta.skipped ? `${playlistMeta.skipped} already in your library.` : 'All new tracks will be imported.'}`
              : `${selected.size} of ${tracks.length} tracks selected.`}
          </p>
          {mode === 'playlist' && playlistMeta.limited && (
            <p className="text-[11px] leading-relaxed text-amber-500">
              Without Spotify API keys, Spotify only exposes the first 100 tracks. If those are already added, the server cannot see the next tracks without keys.
            </p>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
            {tracks.map((track, index) => {
              const checked = mode === 'playlist' || selected.has(index);
              return (
                <button
                  key={`${track.title}-${track.artist}-${index}`}
                  type="button"
                  disabled={mode === 'playlist'}
                  onClick={() => toggleTrack(index)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition ${checked ? 'bg-primary/12' : 'hover:bg-secondary/50'}`}
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                    {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground truncate">{track.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  {checked && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={resetResults} className="flex-1 border-border">
              Back
            </Button>
            <Button onClick={handleImport} className="flex-1 bg-primary hover:brightness-110">
              Import
            </Button>
          </div>
        </>
      )}

      {(step === 'importing' || step === 'done') && (
        <div className="py-4 space-y-4">
          {step === 'importing' ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate max-w-[70%]">
                {progress.current || (step === 'done' ? 'Import complete' : 'Adding songs...')}
              </span>
              <span>{progress.done} / {progress.total}</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1 rounded-2xl border border-border p-2">
            {importRows.map(row => (
              <div key={row.id} className="flex items-center gap-3 rounded-xl bg-secondary/55 p-2">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-card flex items-center justify-center shrink-0">
                  {row.cover_url ? <img src={row.cover_url} alt="" className="w-full h-full object-cover" /> : <Music2 className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-foreground truncate">{row.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{row.message || row.artist}</p>
                </div>
                {row.status === 'loading' && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
                {row.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                {row.status === 'failed' && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
              </div>
            ))}
          </div>
          {step === 'done' && (
            <Button onClick={onClose} className="w-full rounded-2xl bg-primary hover:brightness-110">
              Done
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
