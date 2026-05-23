import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, Save, Scissors, Play, Pause, RotateCcw } from 'lucide-react';
import { entities, storage } from '@/api/SupabaseClient';
import { resolvePlayableAudioUrl } from '@/utils/audioUrls';
import { toast } from 'sonner';

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

  const formatTime = (seconds) => {
    if (!seconds || Number.isNaN(seconds)) return '0:00';
    return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatLrcTime = (seconds) => {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const wholeSeconds = Math.floor(safe % 60);
    const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
    return `[${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
  };

  const shiftSyncedLyrics = (lyrics, offsetDelta, nextDuration) => {
    if (!lyrics || Math.abs(offsetDelta) < 0.01) return lyrics;
    const timeRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    let hasTimedLines = false;

    const shifted = lyrics.split('\n').map(line => {
      const matches = [...line.matchAll(timeRe)];
      if (!matches.length) return line;
      hasTimedLines = true;

      const lyric = line.replace(timeRe, '').trim();
      const nextTimes = matches
        .map(match => {
          const minutes = Number(match[1]);
          const seconds = Number(match[2]);
          const ms = Number((match[3] || '0').padEnd(3, '0'));
          return minutes * 60 + seconds + ms / 1000 - offsetDelta;
        })
        .filter(time => time >= -0.05 && (!nextDuration || time <= nextDuration + 2))
        .map(time => formatLrcTime(time));

      if (!nextTimes.length) return '';
      return `${nextTimes.join('')}${lyric}`;
    }).filter(Boolean).join('\n');

    return hasTimedLines ? shifted : lyrics;
  };

  const parseCoverPosition = (value) => {
    const [x = '50%', y = '50%'] = String(value || '50% 50%').split(' ');
    const px = Number(x.replace('%', ''));
    const py = Number(y.replace('%', ''));
    return {
      x: Number.isFinite(px) ? px : 50,
      y: Number.isFinite(py) ? py : 50,
    };
  };

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

  const buildFallbackWaveform = () =>
    Array.from({ length: 72 }, (_, i) => Math.max(0.16, Math.min(1, 0.52 + Math.sin(i * 0.29) * 0.35 + Math.sin(i * 0.91) * 0.22)));

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
  const startPercent = audioDuration ? (trimRange[0] / audioDuration) * 100 : 0;
  const endPercent = audioDuration ? ((trimRange[1] || audioDuration) / audioDuration) * 100 : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-1.25rem)] max-w-md mx-auto max-h-[calc(100dvh-1.25rem)] overflow-hidden flex flex-col p-0">
        <DialogHeader>
          <DialogTitle className="px-5 pt-5">Edit song</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-5 pb-5 pt-2 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-[112px,1fr] gap-4 items-start">
            <div>
              <div
                ref={coverPointerRef}
                onPointerDown={handleCoverPointerDown}
                onPointerMove={handleCoverPointerMove}
                onPointerUp={handleCoverPointerEnd}
                onPointerCancel={handleCoverPointerEnd}
                onDoubleClick={() => fileRef.current?.click()}
                className="w-28 h-28 rounded-2xl overflow-hidden bg-secondary border-2 border-dashed border-border cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors flex items-center justify-center relative touch-none"
              >
                {coverPreview ? (
                  <>
                    <img
                      src={coverPreview}
                      alt=""
                      className="w-full h-full object-cover pointer-events-none"
                      style={{
                        objectPosition: `${coverPosition.x}% ${coverPosition.y}%`,
                        transform: `scale(${coverScale})`,
                        transformOrigin: `${coverPosition.x}% ${coverPosition.y}%`,
                      }}
                    />
                    <div
                      className="absolute w-3 h-3 rounded-full border-2 border-white bg-primary shadow-lg shadow-primary/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ left: `${coverPosition.x}%`, top: `${coverPosition.y}%` }}
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImagePlus className="w-7 h-7" />
                    <span className="text-[10px]">Cover</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
              {coverPreview && <p className="mt-2 text-[10px] text-muted-foreground">Drag the point across the photo</p>}
              {coverPreview && (
                <div className="hidden">
                  <Label className="text-[10px] text-muted-foreground">Scale</Label>
                  <input
                    type="range"
                    min="1"
                    max="2.4"
                    step="0.05"
                    value={coverScale}
                    onChange={event => setCoverScale(Number(event.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              )}
            </div>

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

          <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-3 shadow-inner shadow-primary/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Trim track</p>
                <p className="text-[11px] text-muted-foreground">Hold an edge and move it along the waveform</p>
              </div>
              <Scissors className="w-4 h-4 text-primary flex-shrink-0" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(trimRange[0])}</span>
              <span>{formatTime(trimRange[1] || audioDuration)}</span>
            </div>
            <div
              ref={waveformRef}
              onPointerDown={handleWavePointerDown}
              className="relative h-16 rounded-2xl border border-primary/30 bg-background/80 overflow-hidden px-3 py-2 shadow-lg shadow-primary/10 touch-none"
            >
              <div className="absolute inset-y-0 left-0 bg-background/70 backdrop-blur-[1px] pointer-events-none" style={{ width: `${startPercent}%` }} />
              <div className="absolute inset-y-0 right-0 bg-background/70 backdrop-blur-[1px] pointer-events-none" style={{ width: `${Math.max(0, 100 - endPercent)}%` }} />
              <div className="relative z-10 h-full flex items-center gap-[2px]">
                {bars.map((height, i) => (
                  <div key={i} className="flex-1 rounded-full bg-gradient-to-t from-primary/75 to-accent/90" style={{ height: `${Math.max(8, height * 62)}%` }} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-2 rounded-xl bg-primary/10 border-y border-primary/25" style={{ left: `${startPercent}%`, right: `${Math.max(0, 100 - endPercent)}%` }} />
              {[
                ['start', startPercent],
                ['end', endPercent],
              ].map(([handle, percent]) => (
                <button
                  key={handle}
                  type="button"
                  onPointerDown={(event) => handleTrimPointerDown(event, handle)}
                  className="absolute top-1/2 z-30 h-14 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-lg shadow-primary/35 border-2 border-white/80 cursor-ew-resize"
                  style={{ left: `${percent}%` }}
                  aria-label={handle === 'start' ? 'Trim start' : 'Trim end'}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={previewTrim} className="flex-1 gap-1.5 border-border">
                {previewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {previewing ? 'Pause' : 'Preview'}
              </Button>
              <Button type="button" variant="outline" onClick={resetTrim} className="gap-1.5 border-border px-3">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full bg-primary hover:brightness-110">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
