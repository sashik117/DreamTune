import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Music, AlertCircle, ExternalLink, CheckCircle2, PlayCircle } from 'lucide-react';
import { entities, media } from '@/api/SupabaseClient';
import { toast } from 'sonner';
import { repairMojibake } from '@/utils/text';

async function findYouTubeResults(query) {
  const data = await media.searchYouTube(query);
  return data.results?.length ? data.results : data.video_id ? [data] : [];
}

async function getAudioUrl(videoId) {
  const data = await media.downloadYouTube(videoId);
  return data.file_url;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function YouTubeDownload({ prefillQuery = '', onSongAdded, onClose }) {
  const [query, setQuery] = useState(prefillQuery);
  const [step, setStep] = useState('idle');
  const [results, setResults] = useState([]);
  const [result, setResult] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const busy = step === 'searching' || step === 'saving' || previewLoading;

  useEffect(() => {
    const nextQuery = repairMojibake(prefillQuery || '').trim();
    setQuery(nextQuery);
    if (nextQuery) runSearch(nextQuery);
  }, [prefillQuery]);

  useEffect(() => {
    if (!busy) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  async function runSearch(searchQuery) {
    const cleanQuery = repairMojibake(searchQuery).trim();
    if (!cleanQuery) return;
    setError('');
    setResult(null);
    setPreviewUrl('');
    setPreviewLoading(false);
    setStep('searching');

    try {
      const found = await findYouTubeResults(cleanQuery);
      if (!found.length) {
        setResults([]);
        setError('\u041f\u0456\u0441\u043d\u044e \u043d\u0435 \u0437\u043d\u0430\u0439\u0434\u0435\u043d\u043e. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0442\u043e\u0447\u043d\u0456\u0448\u0443 \u043d\u0430\u0437\u0432\u0443.');
        setStep('idle');
        return;
      }
      setResults(found);
      setStep('results');
    } catch (err) {
      console.error(err);
      setError('\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043f\u043e\u0448\u0443\u043a\u0443. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0449\u0435 \u0440\u0430\u0437.');
      setStep('idle');
    }
  }

  const selectResult = (item) => {
    const videoId = item.video_id?.trim();
    const thumbnail = item.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    setResult({ ...item, videoId, thumbnail });
    setEditTitle(repairMojibake(item.title || query));
    setEditArtist(repairMojibake(item.artist || item.uploader || ''));
    setPreviewUrl('');
    setPreviewLoading(false);
    setStep('found');
    setError('');
  };

  const handleSearch = async () => runSearch(query);

  const preparePreview = async () => {
    if (!result?.videoId || previewLoading || previewUrl) return previewUrl;
    setPreviewLoading(true);
    setError('');

    try {
      const fileUrl = await getAudioUrl(result.videoId);

      if (!fileUrl) {
        setError('\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0456\u0434\u0433\u043e\u0442\u0443\u0432\u0430\u0442\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u0437 YouTube.');
        return '';
      }
      setPreviewUrl(fileUrl);
      return fileUrl;
    } catch (err) {
      console.error(err);
      setError('\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442.');
      return '';
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAdd = async () => {
    setStep('saving');
    setError('');
    const videoId = result?.videoId;
    const title = repairMojibake(editTitle).trim();
    const artist = repairMojibake(editArtist).trim();

    try {
      const fileUrl = previewUrl || (videoId ? await getAudioUrl(videoId) : null);

      if (!fileUrl) {
        setError('\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438 \u0430\u0443\u0434\u0456\u043e. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u0430\u0431\u043e \u0434\u043e\u0434\u0430\u0439 \u0444\u0430\u0439\u043b \u0432\u0440\u0443\u0447\u043d\u0443.');
        setStep('found');
        return;
      }

      const song = await entities.Song.create({
        title,
        artist,
        cover_url: result.thumbnail,
        file_url: fileUrl,
        is_favorite: false,
      });

      fetchLyrics(artist, title, song.id);

      toast.success('\u041f\u0456\u0441\u043d\u044e \u0434\u043e\u0434\u0430\u043d\u043e!');
      onSongAdded(song);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f');
      setStep('found');
    }
  };

  async function fetchLyrics(artist, title, songId) {
    try {
      const data = await media.getLyrics({ artist, title });
      if (data.lyrics) await entities.Song.update(songId, { lyrics: data.lyrics });
    } catch {}
  }

  const openOnYouTube = () => {
    if (result?.videoId) window.open(`https://www.youtube.com/watch?v=${result.videoId}`, '_blank');
  };

  return (
    <div className="space-y-4">
      {busy && (
        <div className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-3 text-xs text-foreground flex gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>Не закривай сторінку і не виходь з додатка, поки йде пошук або завантаження з YouTube. Процес може перерватися.</p>
        </div>
      )}

      {(step === 'idle' || step === 'searching' || step === 'results') && (
        <>
          <p className="text-xs text-muted-foreground">
            {'\u0417\u043d\u0430\u0439\u0434\u0438 \u043f\u0456\u0441\u043d\u044e \u0437\u0430 \u043d\u0430\u0437\u0432\u043e\u044e \u0430\u0431\u043e \u0432\u0438\u043a\u043e\u043d\u0430\u0432\u0446\u0435\u043c, \u043f\u043e\u0442\u0456\u043c \u0432\u0438\u0431\u0435\u0440\u0438 \u043f\u043e\u0442\u0440\u0456\u0431\u043d\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442.'}
          </p>
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setError(''); }}
              placeholder={'\u041d\u0430\u043f\u0440\u0438\u043a\u043b\u0430\u0434: \u041e\u043a\u0435\u0430\u043d \u0415\u043b\u044c\u0437\u0438 - \u041e\u0431\u0456\u0439\u043c\u0438'}
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
              <p className="text-xs text-muted-foreground mb-1">{'\u0412\u0438\u0431\u0440\u0430\u043d\u043e'}</p>
              <p className="text-sm font-semibold truncate">{editTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{editArtist}</p>
              {result.videoId && (
                <button onClick={openOnYouTube} className="text-[11px] text-primary flex items-center gap-1 mt-1">
                  <ExternalLink className="w-3 h-3" /> {'\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u043d\u0430 YouTube'}
                </button>
              )}
            </div>
          </div>

          {result.videoId && (
            <div className="overflow-hidden rounded-2xl border border-border bg-background/60">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60">
                <PlayCircle className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-foreground">{'\u041f\u0440\u043e\u0441\u043b\u0443\u0445\u0430\u0439 \u043f\u0435\u0440\u0435\u0434 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f\u043c'}</p>
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
                    {previewLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{'\u0413\u043e\u0442\u0443\u044e \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445...'}</> : '\u041f\u0456\u0434\u0433\u043e\u0442\u0443\u0432\u0430\u0442\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{'\u041d\u0430\u0437\u0432\u0430 \u043f\u0456\u0441\u043d\u0456'}</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} onBlur={e => setEditTitle(repairMojibake(e.target.value))} className="bg-secondary border-border" disabled={step === 'saving'} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{'\u0412\u0438\u043a\u043e\u043d\u0430\u0432\u0435\u0446\u044c'}</Label>
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
              {'\u041d\u0430\u0437\u0430\u0434'}
            </Button>
            <Button onClick={handleAdd} disabled={step === 'saving' || !editTitle.trim()} className="flex-1 bg-primary hover:brightness-110">
              {step === 'saving' ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{'\u0414\u043e\u0434\u0430\u044e...'}</> : '\u0414\u043e\u0434\u0430\u0442\u0438'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
