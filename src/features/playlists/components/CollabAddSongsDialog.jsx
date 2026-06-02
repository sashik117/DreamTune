import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PlaylistSongCover from '@/features/playlists/components/PlaylistSongCover';

export default function CollabAddSongsDialog({ open, onOpenChange, songs = [], playlistSongIds = [], onToggleSong }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle>Add songs</DialogTitle></DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-1 pt-2 -mx-1 px-1">
          {songs.map(song => {
            const isIn = playlistSongIds.includes(song.id);
            return (
              <div
                key={song.id}
                onClick={() => onToggleSong(song)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isIn ? 'bg-primary/10' : 'hover:bg-secondary/60'}`}
              >
                <PlaylistSongCover song={song} className="w-10 h-10 rounded-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist || 'Unknown artist'}</p>
                </div>
                {isIn && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
