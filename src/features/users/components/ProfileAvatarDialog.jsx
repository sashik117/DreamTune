import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageCropBox from '@/components/ImageCropBox';

export default function ProfileAvatarDialog({
  open,
  onOpenChange,
  avatarDraft,
  avatarPosition,
  avatarScale,
  avatarInputRef,
  savingAvatar,
  onPositionChange,
  onScaleChange,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <ImageCropBox
            preview={avatarDraft}
            position={avatarPosition}
            scale={avatarScale}
            onPositionChange={onPositionChange}
            onScaleChange={onScaleChange}
            onPick={() => avatarInputRef.current?.click()}
            emptyLabel="Add photo"
            className="mx-auto w-full max-w-[220px] rounded-full"
            marker={false}
          />
          {avatarDraft && <p className="text-center text-[11px] text-muted-foreground">Drag the photo or pinch to zoom</p>}
          <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} className="w-full rounded-2xl border-border">
            <Camera className="w-4 h-4 mr-2" /> Choose photo
          </Button>
          <Button onClick={onSave} disabled={savingAvatar || !avatarDraft} className="w-full rounded-2xl">
            {savingAvatar ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
