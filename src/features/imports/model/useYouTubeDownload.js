import { useCallback, useEffect, useState } from 'react';
import { entities, media } from '@/api/SupabaseClient';
import { downloadSong } from '@/utils/audioCache';
import { persistAudioFileUrl } from '@/utils/audioPersistence';
import { isNativeAudioUrl } from '@/utils/nativeYouTube';
import { repairMojibake } from '@/utils/text';
import { toast } from 'sonner';
import {
  findSpotifyCover,
  findYouTubeResults,
  getAudioUrl,
  getPreviewAudioUrl,
  getVideoId,
  getYouTubeThumbnail,
  normalizeYouTubeResult,
  openExternalUrl,
} from './youtubeImportService';

export function useYouTubeDownload({ prefillQuery = '', onSongAdded, onClose }) {
  const [query, setQuery] = useState(prefillQuery);
  const [step, setStep] = useState('idle');
  const [results, setResults] = useState([]);
  const [result, setResult] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewEmbedFallback, setPreviewEmbedFallback] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFallbackTried, setPreviewFallbackTried] = useState(false);
  const busy = step === 'searching' || step === 'saving' || previewLoading;

  const runSearch = useCallback(async (searchQuery) => {
    const cleanQuery = repairMojibake(searchQuery).trim();
    if (!cleanQuery) return;
    setError('');
    setResult(null);
    setPreviewUrl('');
    setPreviewEmbedFallback(false);
    setPreviewLoading(false);
    setPreviewFallbackTried(false);
    setStep('searching');

    try {
      const found = await findYouTubeResults(cleanQuery);
      if (!found.length) {
        setResults([]);
        setError('Song not found. Try a more specific title.');
        setStep('idle');
        return;
      }
      setResults(found.map(normalizeYouTubeResult));
      setStep('results');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Search failed. Try again.');
      setStep('idle');
    }
  }, []);

  useEffect(() => {
    const nextQuery = repairMojibake(prefillQuery || '').trim();
    setQuery(nextQuery);
    if (nextQuery) runSearch(nextQuery);
  }, [prefillQuery, runSearch]);

  useEffect(() => {
    if (!busy) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const selectResult = useCallback((item) => {
    const videoId = getVideoId(item);
    const youtubeThumbnail = getYouTubeThumbnail(item, videoId);
    setResult({
      ...item,
      videoId,
      youtube_thumbnail_url: youtubeThumbnail,
      thumbnail: youtubeThumbnail,
    });
    setEditTitle(repairMojibake(item.title || query));
    setEditArtist(repairMojibake(item.artist || item.uploader || ''));
    setPreviewUrl('');
    setPreviewEmbedFallback(false);
    setPreviewLoading(false);
    setPreviewFallbackTried(false);
    setStep('found');
    setError('');
  }, [query]);

  const handleSearch = useCallback(async () => runSearch(query), [query, runSearch]);

  const preparePreview = useCallback(async ({ forceServer = false } = {}) => {
    if (!result?.videoId || previewLoading) return previewUrl;
    if (previewUrl && !forceServer) return previewUrl;
    if (forceServer && previewFallbackTried) {
      setError('Could not play this preview. Try another YouTube result.');
      return '';
    }
    setPreviewLoading(true);
    setPreviewEmbedFallback(false);
    setError('');

    try {
      const fileUrl = await getPreviewAudioUrl(result.videoId, { forceServer });

      if (!fileUrl) {
        setError('Could not prepare the preview. Try another YouTube result.');
        return '';
      }
      if (forceServer) setPreviewFallbackTried(true);
      setPreviewUrl(fileUrl);
      return fileUrl;
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Could not start the preview. Try another result.');
      return '';
    } finally {
      setPreviewLoading(false);
    }
  }, [previewFallbackTried, previewLoading, previewUrl, result?.videoId]);

  const handlePreviewError = useCallback(() => {
    if (!result?.videoId || previewLoading || previewFallbackTried) {
      setPreviewUrl('');
      setPreviewEmbedFallback(Boolean(result?.videoId));
      setError('');
      return;
    }
    setPreviewUrl('');
    setPreviewEmbedFallback(true);
    setPreviewFallbackTried(true);
    setError('');
  }, [previewFallbackTried, previewLoading, result?.videoId]);

  const fetchLyrics = useCallback(async (artist, title, songId) => {
    try {
      const data = await media.getLyrics({ artist, title });
      if (data.lyrics) await entities.Song.update(songId, { lyrics: data.lyrics });
    } catch {}
  }, []);

  const handleAdd = useCallback(async () => {
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
        setError('Could not download audio. Try another result or add a file manually.');
        setStep('found');
        return;
      }

      const youtubeCoverUrl = getYouTubeThumbnail(result, videoId);
      const spotifyCoverUrl = await findSpotifyCover(title, artist);
      const coverUrl = spotifyCoverUrl || youtubeCoverUrl;
      const offlineSourceUrl = fileUrl;
      fileUrl = await persistAudioFileUrl(fileUrl, { title, artist });
      const song = await entities.Song.create({
        title,
        artist,
        cover_url: coverUrl,
        file_url: fileUrl,
        is_favorite: false,
      });

      fetchLyrics(artist, title, song.id);
      const offlineSaved = await downloadSong(song, () => {}, { sourceUrl: offlineSourceUrl });

      toast.success(offlineSaved
        ? 'Song added and saved offline!'
        : 'Song added, but the offline copy was not saved.');
      onSongAdded?.(song);
      onClose?.();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Could not add song');
      toast.error('Could not add song');
      setStep('found');
    }
  }, [editArtist, editTitle, fetchLyrics, onClose, onSongAdded, previewUrl, result]);

  const openOnYouTube = useCallback(() => {
    const videoId = getVideoId(result);
    if (videoId) openExternalUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`);
  }, [result]);

  return {
    busy,
    editArtist,
    editTitle,
    error,
    handleAdd,
    handleSearch,
    openOnYouTube,
    preparePreview,
    handlePreviewError,
    previewLoading,
    previewEmbedFallback,
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
  };
}
