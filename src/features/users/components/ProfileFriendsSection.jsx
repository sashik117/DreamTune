import { Link } from 'react-router-dom';
import { Search, UserCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfileFriendsSection({
  friendQuery,
  setFriendQuery,
  addFriend,
  userResults,
  friendSearchDone,
  friendRequests,
  friends,
  requestFriendById,
  declineCollabInvite,
  declineFriend,
  acceptCollabInvite,
  acceptFriend,
  removeFriend,
  onRequestError,
}) {
  return (
    <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={friendQuery} onChange={event => setFriendQuery(event.target.value)} placeholder="Friend nickname..." className="pl-10 bg-secondary border-border rounded-2xl" onKeyDown={event => event.key === 'Enter' && addFriend()} />
      </div>
      <Button onClick={addFriend} className="w-full rounded-2xl">Add friend</Button>

      {userResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Found users</p>
          {userResults.map(user => (
            <div key={user.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shrink-0">
                {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-6 h-6 text-white" />}
              </div>
              <Link to={`/profile/user/${user.id}`} className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{user.nickname}</p>
                <p className="text-xs text-muted-foreground truncate">{user.relationship === 'friend' ? 'Friends' : user.relationship === 'pending' ? 'Request sent' : 'Can be added'}</p>
              </Link>
              {user.relationship === 'friend' ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">Friend</span>
              ) : user.relationship === 'pending' ? (
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">Pending</span>
              ) : (
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={async () => {
                    try {
                      await requestFriendById(user);
                    } catch (error) {
                      onRequestError(error);
                    }
                  }}
                >
                  Add
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {friendSearchDone && friendQuery.trim().length >= 2 && userResults.length === 0 && (
        <div className="rounded-2xl bg-secondary/70 p-3 text-sm font-bold text-muted-foreground">
          User not found
        </div>
      )}

      {friendRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Requests</p>
          {friendRequests.map(request => {
            const isCollab = request.request_type === 'collab_playlist';
            return (
              <div key={`${request.request_type || 'friend'}-${request.id}`} className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3">
                <div className="relative shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                  <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white ring-2 ring-card">
                    1
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">@{request.sender_nickname}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {isCollab ? `Invites you to "${request.playlist_name}"` : 'Wants to add you as a friend'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => isCollab ? declineCollabInvite(request.id) : declineFriend(request.id)} className="rounded-xl border-border">
                    No
                  </Button>
                  <Button size="sm" onClick={() => isCollab ? acceptCollabInvite(request.id) : acceptFriend(request.id)} className="rounded-xl">
                    Accept
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {friends.length ? friends.map(friend => (
          <div key={friend.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
            <Users className="w-5 h-5 text-primary" />
            <Link to={`/profile/user/${friend.id}`} className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">@{friend.nickname}</p>
              <p className="text-xs text-muted-foreground">Available for collaborative playlists</p>
            </Link>
            <Button asChild size="sm" variant="outline" className="rounded-xl border-border">
              <Link to={`/profile/user/${friend.id}`}>Profile</Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl border-border text-destructive hover:text-destructive" onClick={() => removeFriend(friend)}>
              Remove
            </Button>
          </div>
        )) : <p className="text-sm text-muted-foreground">Add friends by nickname to create collaborative playlists with them later.</p>}
      </div>
    </section>
  );
}
