import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { entities, storage } from '@/api/SupabaseClient';
import { resolvePlayableAudioUrl } from '@/utils/audioUrls';
import { toast } from 'sonner';
import { buildFallbackWaveform, formatEditTime, parseCoverPosition, shiftSyncedLyrics } from '@/features/tracks/model/editSongHelpers';
import EditSongCoverEditor from '@/features/tracks/components/EditSongCoverEditor';
import EditSongTrimEditor from '@/features/tracks/components/EditSongTrimEditor';

export default function EditSongModal({ song, open, onOpenChange, onSongUpdated }) {
  const [title, setTitle] = useState(song?.title || '');
  const [artist, setArtist] = useState(song?.artist || '');
  const [coverPreview, setCoverPreview] = useState(song?.cover_url || '');
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [coverScale, setCoverScale] = useState(Number(song?.cover_scale || 1));
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [audioDuration, setAudioDuration] = useState(song?.duration || 0);
  const [trimRange, setTrimRange] = useState([Number(song?.trim_start || 0), Number(song?.trim_end || song?.duration || 0)]);
  const [waveform, setWaveform] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const previewAudioRef = useRef(null);
  const previewStopRef = useRef(null);
  const fileRef = useRef(null);
  const waveformRef = useRef(null);
  const coverPointerRef = useRef(null);
  const coverPointersRef = useRef(new Map());
  const coverGestureRef = useRef({ startDistance: 1, startScale: 1 });
  const lastTrimHandleRef = useRef('start');

  const formatTime = formatEditTime;

  useEffect(() => {
    if (!open || !song) return;
    setTitle(song.title || '');
    setArtist(song.artist || '');
    setCoverPreview(song.cover_url || '');
    setCoverFile(null);
    setCoverPosition(parseCoverPosition(song.cover_position));
    setCoverScale(Number(song.cover_scale || 1));
    setAudioDuration(song.duration || 0);
    setTrimRange([Number(song.trim_start || 0), Number(song.trim_end || song.duration || 0)]);
    setWaveform([]);
  }, [open, song?.id]);

  const ensureAudioMetadata = async () => {
    const playableUrl = resolvePlayableAudioUrl(song?.file_url);
    if (!playableUrl) return 0;
    if (!previewAudioRef.current) previewAudioRef.current = new Audio(playableUrl);
    const audio = previewAudioRef.current;
    if (audio.src !== playableUrl) audio.src = playableUrl;
    if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
    return new Promise(resolve => {
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration || 0), { once: true });
      audio.load();
    });
  };

  const loadWaveform = async () => {
    const playableUrl = resolvePlayableAudioUrl(song?.file_url);
    if (!playableUrl) return setWaveform(buildFallbackWaveform());
    try {
      const response = await fetch(playableUrl);
      const buffer = await response.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      const channel = decoded.getChannelData(0);
      const bars = 72;
      const block = Math.max(1, Math.floor(channel.length / bars));
      const peaks = Array.from({ length: bars }, (_, i) => {
        let sum = 0;
        const start = i * block;
        for (let j = 0; j < block; j++) sum += Math.abs(channel[start + j] || 0);
        return sum / block;
      });
      const max = Math.max(...peaks, 0.01);
      setWaveform(peaks.map(v => Math.max(0.12, Math.min(1, v / max))));
      setAudioDuration(decoded.duration || audioDuration);
      setTrimRange(prev => [prev[0], prev[1] || decoded.duration || prev[1]]);
      await ctx.close?.();
    } catch {
      setWaveform(buildFallbackWaveform());
    }
  };

  useEffect(() => {
    if (open) {
      ensureAudioMetadata().then(duration => {
        if (duration) {
          setAudioDuration(duration);
          setTrimRange(prev => [prev[0], prev[1] || duration]);
        }
      });
      loadWaveform();
    }
  }, [open, song?.file_url]);

  useEffect(() => () => {
    previewAudioRef.current?.pause();
    if (previewStopRef.current) previewAudioRef.current?.removeEventListener('timeupdate', previewStopRef.current);
  }, []);

  useEffect(() => {
    if (!draggingHandle) return;
    const move = (event) => updateTrimFromPointer(event, draggingHandle);
    const up = () => setDraggingHandle(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [draggingHandle, trimRange, audioDuration]);

  const updateTrimFromPointer = (event, handle) => {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect || !audioDuration) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = ratio * audioDuration;
    setTrimRange(([start, end]) => {
      if (handle === 'start') return [Math.min(time, Math.max(0, end - 1)), end];
      return [start, Math.max(time, start + 1)];
    });
  };

  const handleTrimPointerDown = (event, handle) => {
    event.preventDefault();
    event.stopPropagation();
    lastTrimHandleRef.current = handle;
    setDraggingHandle(handle);
    updateTrimFromPointer(event, handle);
  };

  const handleWavePointerDown = (event) => {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect || !audioDuration) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = ratio * audioDuration;
    const [start, end] = trimRange;
    const handle = Math.abs(time - start) <= Math.abs(time - end) ? 'start' : 'end';
    handleTrimPointerDown(event, handle);
  };

  const previewTrim = async () => {
    const duration = audioDuration || await ensureAudioMetadata();
    if (!duration) return;
    const [start, end] = trimRange;
    const playableUrl = resolvePlayableAudioUrl(song?.file_url);
    if (!playableUrl) return;
    if (!previewAudioRef.current) previewAudioRef.current = new Audio(playableUrl);
    const audio = previewAudioRef.current;
    if (audio.src !== playableUrl) audio.src = playableUrl;

    if (previewing) {
      audio.pause();
      setPreviewing(false);
      return;
    }

    if (previewStopRef.current) audio.removeEventListener('timeupdate', previewStopRef.current);
    audio.pause();
    const previewStart = lastTrimHandleRef.current === 'end'
      ? Math.max(start, Math.min(end - 1, end - 8))
      : start;
    audio.currentTime = previewStart;
    window.dispatchEvent(new CustomEvent('dreamtune-preview-play'));
    const pauseForMain = () => {
      audio.pause();
      setPreviewing(false);
    };
    window.addEventListener('dreamtune-main-play', pauseForMain, { once: true });
    await audio.play();
    setPreviewing(true);
    const stop = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        audio.currentTime = previewStart;
        setPreviewing(false);
        audio.removeEventListener('timeupdate', stop);
        previewStopRef.current = null;
      }
    };
    previewStopRef.current = stop;
    audio.addEventListener('timeupdate', stop);
  };

  const resetTrim = () => {
    previewAudioRef.current?.pause();
    setPreviewing(false);
    setTrimRange([0, audioDuration || song?.duration || 0]);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const updateCoverPosition = (clientX, clientY) => {
    const rect = coverPointerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoverPosition({
      x: Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))),
      y: Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))),
    });
  };

  const getCoverDistance = () => {
    const points = Array.from(coverPointersRef.current.values());
    if (points.length < 2) return 1;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1;
  };

  const handleCoverPointerDown = (event) => {
    if (!coverPreview) {
      fileRef.current?.click();
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    coverPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (coverPointersRef.current.size >= 2) {
      coverGestureRef.current = { startDistance: getCoverDistance(), startScale: coverScale };
      return;
    }
    updateCoverPosition(event.clientX, event.clientY);
  };

  const handleCoverPointerMove = (event) => {
    if (!coverPointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    coverPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (coverPointersRef.current.size >= 2) {
      const ratio = getCoverDistance() / (coverGestureRef.current.startDistance || 1);
      setCoverScale(Number(Math.max(1, Math.min(2.8, coverGestureRef.current.startScale * ratio)).toFixed(2)));
      return;
    }
    updateCoverPosition(event.clientX, event.clientY);
  };

  const handleCoverPointerEnd = (event) => {
    coverPointersRef.current.delete(event.pointerId);
    if (coverPointersRef.current.size >= 2) {
      coverGestureRef.current = { startDistance: getCoverDistance(), startScale: coverScale };
    }
  };

  const handleSave = async () => {
    if (!song) return;
    previewAudioRef.current?.pause();
    setPreviewing(false);
    setSaving(true);
    try {
      const [start, end] = trimRange;
      const previousStart = Number(song.trim_start || 0);
      const nextEnd = end || audioDuration || Number(song.duration || 0) || 0;
      const nextDuration = Math.max(0, nextEnd - start);
      const lyrics = shiftSyncedLyrics(song.lyrics || '', start - previousStart, nextDuration);
      const update = {
        title: title.trim(),
        artist: artist.trim(),
        trim_start: start > 0 ? start : null,
        trim_end: end && audioDuration && end < audioDuration - 0.25 ? end : null,
        cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
        cover_scale: coverScale,
      };
      if (lyrics !== (song.lyrics || '')) update.lyrics = lyrics;

      if (coverFile) update.cover_url = await storage.uploadFile(coverFile, 'songs');
      const updated = await entities.Song.update(song.id, update);
      toast.success('Saved');
      onSongUpdated({ ...song, ...updated });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!song) return null;
  const bars = waveform.length ? waveform : buildFallbackWaveform();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.25rem)] max-w-md mx-auto max-h-[calc(100dvh-1.25rem)] overflow-hidden flex flex-col p-0">
        <DialogHeader>
          <DialogTitle className="px-5 pt-5">Edit song</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-5 pb-5 pt-2 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-[112px,1fr] gap-4 items-start">
            <EditSongCoverEditor
              coverPreview={coverPreview}
              coverPosition={coverPosition}
              coverScale={coverScale}
              coverPointerRef={coverPointerRef}
              fileRef={fileRef}
              onCoverSelect={handleCoverSelect}
              onCoverPointerDown={handleCoverPointerDown}
              onCoverPointerMove={handleCoverPointerMove}
              onCoverPointerEnd={handleCoverPointerEnd}
              onCoverScaleChange={setCoverScale}
            />

            <div className="space-y-3 min-w-0">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Song title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Artist</Label>
                <Input value={artist} onChange={e => setArtist(e.target.value)} className="bg-secondary border-border" />
              </div>
            </div>
          </div>

          <EditSongTrimEditor
            trimRange={trimRange}
            audioDuration={audioDuration}
            bars={bars}
            previewing={previewing}
            waveformRef={waveformRef}
            formatTime={formatTime}
            onWavePointerDown={handleWavePointerDown}
            onTrimPointerDown={handleTrimPointerDown}
            onPreviewTrim={previewTrim}
            onResetTrim={resetTrim}
          />

          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full bg-primary hover:brightness-110">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
