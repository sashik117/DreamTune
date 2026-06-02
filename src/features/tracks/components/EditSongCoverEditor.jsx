import { ImagePlus } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function EditSongCoverEditor({
  coverPreview,
  coverPosition,
  coverScale,
  coverPointerRef,
  fileRef,
  onCoverSelect,
  onCoverPointerDown,
  onCoverPointerMove,
  onCoverPointerEnd,
  onCoverScaleChange,
}) {
  return (
    <div>
      <div
        ref={coverPointerRef}
        onPointerDown={onCoverPointerDown}
        onPointerMove={onCoverPointerMove}
        onPointerUp={onCoverPointerEnd}
        onPointerCancel={onCoverPointerEnd}
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
      <input ref={fileRef} type="file" accept="image/*" onChange={onCoverSelect} className="hidden" />
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
            onChange={event => onCoverScaleChange(Number(event.target.value))}
            className="w-full accent-primary"
          />
        </div>
      )}
    </div>
  );
}
