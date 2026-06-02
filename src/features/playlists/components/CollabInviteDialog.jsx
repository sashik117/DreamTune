import { Check, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function CollabInviteDialog({ open, onOpenChange, friends = [], collaboratorIds = [], onInvite }) {
  const availableFriends = friends.filter(friend => !collaboratorIds.includes(friend.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Invite member
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {availableFriends.length ? availableFriends.map(friend => {
            const selected = collaboratorIds.includes(friend.id);
            return (
              <button
                key={friend.id}
                type="button"
                onClick={() => onInvite(friend)}
                disabled={selected}
                className={`w-full rounded-2xl px-3 py-3 text-left flex items-center gap-3 ${selected ? 'bg-primary/10 text-primary' : 'bg-secondary/70 hover:bg-secondary text-foreground'}`}
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span className="flex-1 min-w-0 truncate font-bold">{friend.nickname}</span>
                {selected && <Check className="w-4 h-4" />}
              </button>
            );
          }) : (
            <p className="text-sm text-muted-foreground">No friends available to invite. Friends already added are hidden here.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
