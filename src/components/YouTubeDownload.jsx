import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Music, AlertCircle, ExternalLink, CheckCircle2, PlayCircle } from 'lucide-react';
import { repairMojibake } from '@/utils/text';
import { useYouTubeDownload } from '@/features/imports/model/useYouTubeDownload';
import { formatDuration } from '@/features/imports/model/youtubeImportService';

export default function YouTubeDownload({ prefillQuery = '', onSongAdded, onClose }) {
  const {
    busy,
    editArtist,
    editTitle,
    error,
    handleAdd,
    handleSearch,
    openOnYouTube,
    preparePreview,
    previewLoading,
    previewUrl,
    query,
    result,
    results,
    selectResult,
    setEditArtist,
    setEditTitle,
    setError,
    setQuery,
    setResult,
    setStep,
    step,
  } = useYouTubeDownload({ prefillQuery, onSongAdded, onClose });

  return (
    <div className="space-y-4">
      {busy && (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-3 text-xs text-foreground flex gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>Keep this screen open while DreamTune searches or downloads from YouTube. Leaving the app can interrupt the process.</p>
        </div>
      )}

      {(step === 'idle' || step === 'searching' || step === 'results') && (
        <>
          <p className="text-xs text-muted-foreground">
            Find a song by title or artist, then choose the right result.
          </p>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setError(''); }}
              placeholder="Example: The Weeknd - Blinding Lights"
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!query.trim() || step === 'searching'} size="icon" className="shrink-0">
              {step === 'searching' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}

          {step === 'results' && (
            <div className="space-y-2 max-h-[42dvh] overflow-y-auto pr-1">
              {results.map(item => (
                <button
                  key={item.video_id}
                  type="button"
                  onClick={() => selectResult(item)}
                  className="w-full flex gap-3 p-2 rounded-2xl bg-secondary/70 hover:bg-secondary border border-border/60 text-left transition"
                >
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-16 h-12 rounded-xl object-cover shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-16 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{repairMojibake(item.title || '')}</p>
                    <p className="text-xs text-muted-foreground truncate">{repairMojibake(item.artist || item.uploader || 'YouTube')}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDuration(item.duration)}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-primary mt-1 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {(step === 'found' || step === 'saving') && result && (
        <>
          <div className="flex gap-3 p-3 bg-secondary rounded-xl">
            {result.thumbnail ? (
              <img src={result.thumbnail} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Music className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Selected</p>
              <p className="text-sm font-semibold truncate">{editTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{editArtist}</p>
              {result.videoId && (
                <button type="button" onClick={openOnYouTube} className="text-[11px] text-primary flex items-center gap-1 mt-1">
                  <ExternalLink className="w-3 h-3" /> Open on YouTube
                </button>
              )}
            </div>
          </div>

          {result.videoId && (
            <div className="overflow-hidden rounded-2xl border border-border bg-background/60">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                <PlayCircle className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">Preview before adding</p>
              </div>
              <div className="p-3 space-y-3">
                {previewUrl ? (
                  <audio
                    src={previewUrl}
                    controls
                    className="w-full"
                    onPlay={(event) => {
                      window.dispatchEvent(new CustomEvent('dreamtune-preview-play'));
                      const audio = event.currentTarget;
                      const stop = () => audio.pause();
                      window.addEventListener('dreamtune-main-play', stop, { once: true });
                    }}
                  />
                ) : (
                  <Button type="button" variant="outline" onClick={preparePreview} disabled={previewLoading} className="w-full rounded-2xl border-border">
                    {previewLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Preparing preview...</> : 'Prepare preview'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Song title</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={e => setEditTitle(repairMojibake(e.target.value))} className="bg-secondary border-border" disabled={step === 'saving'} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Artist</Label>
              <Input value={editArtist} onChange={e => setEditArtist(e.target.value)} onBlur={e => setEditArtist(repairMojibake(e.target.value))} className="bg-secondary border-border" disabled={step === 'saving'} />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{error}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setStep('results'); setResult(null); setError(''); }} className="flex-1 border-border" disabled={step === 'saving'}>
              Back
            </Button>
            <Button onClick={handleAdd} disabled={step === 'saving' || !editTitle.trim()} className="flex-1 bg-primary hover:brightness-110">
              {step === 'saving' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : 'Add'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
