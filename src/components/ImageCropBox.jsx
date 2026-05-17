import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const distanceBetween = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export default function ImageCropBox({
  preview,
  position = { x: 50, y: 50 },
  scale = 1,
  minScale = 1,
  maxScale = 2.8,
  onPositionChange,
  onScaleChange,
  onPick,
  emptyLabel = 'Add photo',
  className = '',
  imageClassName = '',
  marker = true,
  alt = '',
}) {
  const boxRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ startDistance: 0, startScale: 1 });

  const setPositionFromPoint = (clientX, clientY) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    onPositionChange?.({
      x: Math.round(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)),
      y: Math.round(clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)),
    });
  };

  const updatePinchStart = () => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) return;
    gestureRef.current = {
      startDistance: distanceBetween(points[0], points[1]) || 1,
      startScale: scale,
    };
  };

  const handlePointerDown = (event) => {
    if (!preview) {
      onPick?.();
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      setPositionFromPoint(event.clientX, event.clientY);
    } else if (pointersRef.current.size === 2) {
      updatePinchStart();
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    if (points.length >= 2) {
      const nextDistance = distanceBetween(points[0], points[1]) || 1;
      const ratio = nextDistance / (gestureRef.current.startDistance || nextDistance);
      onScaleChange?.(Number(clamp(gestureRef.current.startScale * ratio, minScale, maxScale).toFixed(2)));
      return;
    }
    setPositionFromPoint(event.clientX, event.clientY);
  };

  const handlePointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size >= 2) updatePinchStart();
  };

  const handleWheel = (event) => {
    if (!preview) return;
    event.preventDefault();
    const nextScale = scale + (event.deltaY < 0 ? 0.08 : -0.08);
    onScaleChange?.(Number(clamp(nextScale, minScale, maxScale).toFixed(2)));
  };

  return (
    <div
      ref={boxRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      onDoubleClick={onPick}
      className={`relative aspect-square overflow-hidden bg-secondary border-2 border-dashed border-border cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors flex items-center justify-center touch-none select-none ${className}`}
    >
      {preview ? (
        <>
          <img
            src={preview}
            alt={alt}
            draggable={false}
            className={`h-full w-full object-cover pointer-events-none ${imageClassName}`}
            style={{
              objectPosition: `${position.x}% ${position.y}%`,
              transform: `scale(${scale})`,
              transformOrigin: `${position.x}% ${position.y}%`,
            }}
          />
          {marker && (
            <div
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg shadow-primary/35 pointer-events-none"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImagePlus className="h-8 w-8" />
          <span className="text-xs font-bold text-center">{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}
