import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Search, Music, AlertCircle, ExternalLink, CheckCircle2, PlayCircle } from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from '@/utils/audioCache';
import { persistAudioFileUrl } from '@/utils/audioPersistence';
import { downloadYouTubeOnDevice, isNativeAudioUrl } from '@/utils/nativeYouTube';
import { toast } from 'sonner';
import { repairMojibake } from '@/utils/text';

async function findYouTubeResults(query) {
  try {
    const data = await media.searchYouTube(query);
    const serverResults = data.results?.length ? data.results : data.video_id ? [data] : [];
    if (serverResults.length) return serverResults;
  } catch (error) {
    console.warn('Server YouTube search failed, trying direct fallback:', error.message || error);
  }
  return searchYouTubeDirect(query);
}

function getVideoId(item) {
  return String(
    item?.video_id ||
    item?.videoId ||
    String(item?.url || item?.link || '').match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] ||
    ''
  ).trim();
}

async function openExternalUrl(url) {
  if (!url) return;
  if (Capacitor.isNativePlatform?.()) {
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function getAudioUrl(videoId, { native = true } = {}) {
  if (native) {
    try {
      const nativeAudio = await downloadYouTubeOnDevice(videoId);
      if (nativeAudio?.native_file_url || nativeAudio?.file_url) return nativeAudio.native_file_url || nativeAudio.file_url;
    } catch (error) {
      console.warn('Native YouTube download failed, trying server:', error.message || error);
    }
  }
  try {
    const data = await media.downloadYouTube(videoId);
    if (data.file_url) return data.file_url;
  } catch (error) {
    console.warn('Server YouTube download failed, trying direct stream fallback:', error.message || error);
  }
  return resolveDirectAudioUrl(videoId);
}

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function searchYouTubeDirect(query) {
  const pipedInstances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi-libre.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.syncpundit.io',
  ];
  for (const base of pipedInstances) {
    try {
      const data = await fetchJson(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const results = items
        .map(item => {
          const id = String(item.url || '').match(/[?&]v=([\w-]{11})/)?.[1];
          if (!id) return null;
          return {
            title: repairMojibake(item.title || query),
            artist: repairMojibake(item.uploaderName || item.uploader || 'YouTube'),
            uploader: repairMojibake(item.uploaderName || item.uploader || 'YouTube'),
            video_id: id,
            thumbnail: item.thumbnail || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
            duration: item.duration || null,
          };
        })
        .filter(Boolean)
        .slice(0, 8);
      if (results.length) return results;
    } catch {}
  }

  const invidiousInstances = [
    'https://inv.thepixora.com',
    'https://yt.chocolatemoo53.com',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
  ];
  for (const base of invidiousInstances) {
    try {
      const data = await fetchJson(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const results = (Array.isArray(data) ? data : [])
        .filter(item => item?.type === 'video' && item?.videoId)
        .map(item => {
          const thumb =
            item.videoThumbnails?.find?.(image => image?.quality === 'medium')?.url ||
            item.videoThumbnails?.[0]?.url ||
            `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
          return {
            title: repairMojibake(item.title || query),
            artist: repairMojibake(item.author || 'YouTube'),
            uploader: repairMojibake(item.author || 'YouTube'),
            video_id: item.videoId,
            thumbnail: thumb.startsWith('//') ? `https:${thumb}` : thumb,
            duration: item.lengthSeconds || null,
          };
        })
        .slice(0, 8);
      if (results.length) return results;
    } catch {}
  }
  try {
    const data = await fetchJson(`https://yt.lemnoslife.com/search?part=snippet&q=${encodeURIComponent(query)}&type=video`);
    const results = (data.items || [])
      .map(item => {
        const id = item?.id?.videoId || item?.videoId;
        if (!id) return null;
        return {
          title: repairMojibake(item.snippet?.title || query),
          artist: repairMojibake(item.snippet?.channelTitle || 'YouTube'),
          uploader: repairMojibake(item.snippet?.channelTitle || 'YouTube'),
          video_id: id,
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          duration: null,
        };
      })
      .filter(Boolean)
      .slice(0, 8);
    if (results.length) return results;
  } catch {}
  return [];
}

async function resolveDirectAudioUrl(videoId) {
  const pipedInstances = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi-libre.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.syncpundit.io',
  ];
  for (const base of pipedInstances) {
    try {
      const data = await fetchJson(`${base}/streams/${videoId}`, 10000);
      const audio = (data.audioStreams || [])
        .filter(item => item?.url)
        .sort((a, b) => Number(b.bitrate || b.quality || 0) - Number(a.bitrate || a.quality || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }

  const invidiousInstances = [
    'https://inv.thepixora.com',
    'https://yt.chocolatemoo53.com',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://yewtu.be',
  ];
  for (const base of invidiousInstances) {
    try {
      const data = await fetchJson(`${base}/api/v1/videos/${videoId}`, 10000);
      const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
      const audio = formats
        .filter(item => item?.url && String(item.type || item.mimeType || '').toLowerCase().includes('audio'))
        .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (audio?.url) return audio.url;
    } catch {}
  }
  return '';
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function normalizeCoverText(value) {
  return repairMojibake(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\b(official|video|audio|lyrics?|visualizer|remaster(?:ed)?|hd|4k)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findSpotifyCover(title, artist, fallbackCover = '') {
  const cleanTitle = repairMojibake(title || '').trim();
  const cleanArtist = repairMojibake(artist || '').trim();
  const queries = Array.from(new Set([
    `${cleanArtist} ${cleanTitle}`.trim(),
    cleanTitle,
  ].filter(Boolean)));
  const titleTokens = new Set(normalizeCoverText(cleanTitle).split(' ').filter(token => token.length > 2));

  for (const query of queries) {
    try {
      const data = await media.searchSpotifyTracks(query, 8);
      const best = (data.tracks || [])
        .filter(track => track?.cover_url)
        .map(track => {
          const haystack = normalizeCoverText(`${track.artist || ''} ${track.title || ''}`);
          let score = 0;
          for (const token of titleTokens) if (haystack.includes(token)) score += 1;
          if (cleanArtist && haystack.includes(normalizeCoverText(cleanArtist))) score += 2;
          return { track, score };
        })
        .sort((a, b) => b.score - a.score)[0]?.track;
      if (best?.cover_url) return best.cover_url;
    } catch (error) {
      console.warn('Spotify cover lookup failed:', error.message || error);
    }
  }

  return fallbackCover;
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
      setError(err?.message || '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043f\u043e\u0448\u0443\u043a\u0443. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0449\u0435 \u0440\u0430\u0437.');
      setStep('idle');
    }
  }

  const selectResult = (item) => {
    const videoId = getVideoId(item);
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
      const fileUrl = await getAudioUrl(result.videoId, { native: false });

      if (!fileUrl) {
        setError('\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u043f\u0456\u0434\u0433\u043e\u0442\u0443\u0432\u0430\u0442\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u0437 YouTube.');
        return '';
      }
      setPreviewUrl(fileUrl);
      return fileUrl;
    } catch (err) {
      console.error(err);
      setError(err?.message || '\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438 \u043f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043b\u0443\u0445. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442.');
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
      let fileUrl = previewUrl;
      if (videoId && !isNativeAudioUrl(previewUrl)) {
        fileUrl = await getAudioUrl(videoId, { native: true });
      }

      if (!fileUrl) {
        setError('\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438 \u0430\u0443\u0434\u0456\u043e. \u0421\u043f\u0440\u043e\u0431\u0443\u0439 \u0456\u043d\u0448\u0438\u0439 \u0432\u0430\u0440\u0456\u0430\u043d\u0442 \u0430\u0431\u043e \u0434\u043e\u0434\u0430\u0439 \u0444\u0430\u0439\u043b \u0432\u0440\u0443\u0447\u043d\u0443.');
        setStep('found');
        return;
      }

      const coverUrl = await findSpotifyCover(title, artist, result.thumbnail);
      fileUrl = await persistAudioFileUrl(fileUrl, { title, artist });
      const song = await entities.Song.create({
        title,
        artist,
        cover_url: coverUrl || result.thumbnail,
        file_url: fileUrl,
        is_favorite: false,
      });

      fetchLyrics(artist, title, song.id);
      const offlineSaved = await downloadSong(song, () => {});

      toast.success(offlineSaved
        ? '\u041f\u0456\u0441\u043d\u044e \u0434\u043e\u0434\u0430\u043d\u043e \u0456 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e \u043e\u0444\u043b\u0430\u0439\u043d!'
        : '\u041f\u0456\u0441\u043d\u044e \u0434\u043e\u0434\u0430\u043d\u043e, \u0430\u043b\u0435 \u043e\u0444\u043b\u0430\u0439\u043d-\u043a\u043e\u043f\u0456\u044e \u043d\u0435 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e.');
      onSongAdded(song);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.message || '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u0434\u043e\u0434\u0430\u0432\u0430\u043d\u043d\u044f');
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
    const videoId = getVideoId(result);
    if (videoId) openExternalUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
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
                <button type="button" onClick={openOnYouTube} className="text-[11px] text-primary flex items-center gap-1 mt-1">
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
