import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageCropBox from '@/components/ImageCropBox';

export default function PlaylistCoverEditorDialog({
  open,
  onOpenChange,
  coverPreview,
  coverPosition,
  coverScale,
  coverInputRef,
  savingCover,
  onPositionChange,
  onScaleChange,
  onCoverSelect,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Playlist cover</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <ImageCropBox
            preview={coverPreview}
            position={coverPosition}
            scale={coverScale}
            onPositionChange={onPositionChange}
            onScaleChange={onScaleChange}
            onPick={() => coverInputRef.current?.click()}
            emptyLabel="Add photo"
            className="mx-auto w-full max-w-[240px] rounded-3xl"
          />
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={onCoverSelect} />
          <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()} className="w-full rounded-2xl border-border">
            <ImagePlus className="w-4 h-4 mr-2" /> Choose photo
          </Button>
          {coverPreview && <p className="text-center text-[11px] text-muted-foreground">Drag the photo or pinch to zoom</p>}
          <Button onClick={onSave} disabled={savingCover} className="w-full rounded-2xl">
            {savingCover ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
