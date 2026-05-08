import { useEffect, useRef, useState, useMemo } from 'react';
import { Pencil, Loader2, Sparkles, Check, X, Music } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { entities, media } from '@/api/SupabaseClient';
import { toast } from 'sonner';

function parseLrc(text) {
  if (!text) return null;
  const parsed = [];
  const timeRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  text.split('\n').forEach(line => {
    const times = [];
    let match;
    timeRe.lastIndex = 0;
    while ((match = timeRe.exec(line)) !== null) {
      const m = Number(match[1]);
      const s = Number(match[2]);
      const ms = Number((match[3] || '0').padEnd(3, '0'));
      times.push(m * 60 + s + ms / 1000);
    }
    const lyric = line.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    times.forEach(time => { if (lyric) parsed.push({ time, text: lyric }); });
  });
  parsed.sort((a, b) => a.time - b.time);
  return parsed.length > 2 ? parsed : null;
}

function buildTimedPlainLyrics(text, duration) {
  const lines = (text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const safeDuration = Math.max(30, Number(duration || 0));
  const startPad = Math.min(10, safeDuration * 0.08);
  const endPad = Math.min(8, safeDuration * 0.06);
  const usable = Math.max(1, safeDuration - startPad - endPad);
  const weights = lines.map((line, index) => {
    const words = line.split(/\s+/).filter(Boolean).length;
    const chars = line.replace(/\s/g, '').length;
    const stanzaBreak = index > 0 && text.split('\n').indexOf(line) > 0 ? 0.12 : 0;
    const phrasePause = /[.!?…]$/.test(line) ? 0.35 : /[,;:]$/.test(line) ? 0.18 : 0;
    return Math.max(0.8, words * 0.55 + chars * 0.045 + phrasePause + stanzaBreak);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = startPad;
  return lines.map((line, index) => {
    const time = cursor;
    cursor += usable * (weights[index] / total);
    return { text: line, time };
  });
}

export default function LyricsView({ song, currentTime, duration = 0, isPlaying, onLyricsUpdated }) {
  const containerRef = useRef(null);
  const activeRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(song?.lyrics || '');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    setText(song?.lyrics || '');
    setEditing(false);
    setFetchError('');
  }, [song?.id, song?.lyrics]);

  const lrcLines = useMemo(() => parseLrc(song?.lyrics), [song?.lyrics, song?.id]);
  const timedPlainLines = useMemo(
    () => (!lrcLines && song?.lyrics ? buildTimedPlainLyrics(song.lyrics, duration) : null),
    [lrcLines, song?.lyrics, duration]
  );
  const displayLines = lrcLines || timedPlainLines;

  const activeIdx = useMemo(() => {
    if (!displayLines || !currentTime) return 0;
    let idx = 0;
    for (let i = 0; i < displayLines.length; i++) {
      if (displayLines[i].time <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [displayLines, currentTime]);

  useEffect(() => {
    if (!displayLines || editing) return;
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;

    const nextTop = active.offsetTop - (container.clientHeight / 2) + (active.clientHeight / 2);
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    container.scrollTo({
      top: Math.min(maxTop, Math.max(0, nextTop)),
      behavior: 'smooth',
    });
  }, [activeIdx, displayLines, editing]);

  const handleFetchLyrics = async () => {
    setFetching(true);
    setFetchError('');
    try {
      const data = await media.getLyrics({ artist: song.artist, title: song.title });
      if (data.lyrics) {
        setText(data.lyrics);
        await entities.Song.update(song.id, { lyrics: data.lyrics });
        onLyricsUpdated({ ...song, lyrics: data.lyrics });
        toast.success(data.synced ? 'Синхронний текст знайдено' : 'Текст знайдено');
      } else {
        throw new Error('Текст не знайдено');
      }
    } catch {
      setFetchError('Текст не знайдено. Можеш додати його вручну.');
      setEditing(true);
      setText(song.lyrics || '');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await entities.Song.update(song.id, { lyrics: text });
      onLyricsUpdated({ ...song, lyrics: text });
      setEditing(false);
      toast.success('Текст збережено');
    } finally {
      setSaving(false);
    }
  };

  const handleLineClick = (time) => {
    window.dispatchEvent(new CustomEvent('lyrics-seek', { detail: { time } }));
  };

  if (!song) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
          {lrcLines ? 'Синхро' : song.lyrics ? 'Текст по часу' : 'Текст'}
        </span>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button size="sm" variant="ghost" onClick={handleFetchLyrics} disabled={fetching}
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
                {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {fetching ? 'Шукаю...' : 'Знайти'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}
                className="h-7 px-2 text-muted-foreground hover:text-foreground">
                <Pencil className="w-3 h-3" />
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button size="sm" variant="ghost"
                onClick={() => { setEditing(false); setText(song.lyrics || ''); }}
                className="h-7 px-2 text-muted-foreground">
                <X className="w-3 h-3" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !text.trim()}
                className="h-7 px-2 text-xs bg-primary hover:brightness-110">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="flex-1 min-h-[260px] bg-secondary/50 rounded-xl p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary border border-border"
          placeholder={`Встав текст пісні. Для ідеальної синхри можна LRC:\n[00:15.20] перший рядок\n[00:18.50] другий рядок`}
        />
      ) : (
        <div ref={containerRef} className="flex-1 overflow-y-auto px-1">
          {displayLines ? (
            <div className="py-6 space-y-1">
              {displayLines.map((line, i) => {
                const isActive = i === activeIdx;
                const isPast = i < activeIdx;
                return (
                  <div
                    key={`${line.time}-${i}`}
                    ref={isActive ? activeRef : null}
                    onClick={() => handleLineClick(line.time)}
                    className={`px-2 py-2 rounded-xl cursor-pointer transition-all duration-300 text-center leading-snug break-words
                      ${isActive
                        ? 'lyric-line-active text-base bg-primary/10'
                        : isPast
                          ? 'text-muted-foreground/55 text-sm'
                          : 'text-muted-foreground/80 text-sm hover:text-foreground'
                      }`}
                  >
                    {line.text}
                  </div>
                );
              })}
              <div className="h-24" />
            </div>
          ) : (
            <div className="text-center py-8">
              <Music className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">{fetchError || 'Текст не додано'}</p>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={handleFetchLyrics} disabled={fetching}
                  className="border-border gap-1.5 text-xs">
                  {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {fetching ? 'Шукаю...' : 'Знайти текст'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}
                  className="border-border gap-1.5 text-xs">
                  <Pencil className="w-3 h-3" /> Додати вручну
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
