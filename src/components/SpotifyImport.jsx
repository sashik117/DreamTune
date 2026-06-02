import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2, Music2, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useSpotifyImport } from '@/features/imports/model/useSpotifyImport';

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
  const {
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
  } = useSpotifyImport({ existingSongs, onSongsAdded, onPlaylistAdded, onPlaylistUpdated });

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
