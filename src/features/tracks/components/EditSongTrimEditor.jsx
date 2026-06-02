import { Pause, Play, RotateCcw, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EditSongTrimEditor({
  trimRange,
  audioDuration,
  bars,
  previewing,
  waveformRef,
  formatTime,
  onWavePointerDown,
  onTrimPointerDown,
  onPreviewTrim,
  onResetTrim,
}) {
  const startPercent = audioDuration ? (trimRange[0] / audioDuration) * 100 : 0;
  const endPercent = audioDuration ? ((trimRange[1] || audioDuration) / audioDuration) * 100 : 100;

  return (
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
        onPointerDown={onWavePointerDown}
        className="relative h-16 rounded-2xl border border-primary/30 bg-background/80 overflow-hidden px-3 py-2 shadow-lg shadow-primary/10 touch-none"
      >
        <div className="absolute inset-y-0 left-0 bg-background/70 backdrop-blur-[1px] pointer-events-none" style={{ width: `${startPercent}%` }} />
        <div className="absolute inset-y-0 right-0 bg-background/70 backdrop-blur-[1px] pointer-events-none" style={{ width: `${Math.max(0, 100 - endPercent)}%` }} />
        <div className="relative z-10 h-full flex items-center gap-[2px]">
          {bars.map((height, index) => (
            <div key={index} className="flex-1 rounded-full bg-gradient-to-t from-primary/75 to-accent/90" style={{ height: `${Math.max(8, height * 62)}%` }} />
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
            onPointerDown={(event) => onTrimPointerDown(event, handle)}
            className="absolute top-1/2 z-30 h-14 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-lg shadow-primary/35 border-2 border-white/80 cursor-ew-resize"
            style={{ left: `${percent}%` }}
            aria-label={handle === 'start' ? 'Trim start' : 'Trim end'}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onPreviewTrim} className="flex-1 gap-1.5 border-border">
          {previewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {previewing ? 'Pause' : 'Preview'}
        </Button>
        <Button type="button" variant="outline" onClick={onResetTrim} className="gap-1.5 border-border px-3">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
