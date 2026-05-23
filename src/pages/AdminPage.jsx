import { useEffect, useMemo, useState } from 'react';
import { admin } from '@/api/SupabaseClient';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Ban,
  Crown,
  ListMusic,
  MailCheck,
  MailWarning,
  MoreVertical,
  Music,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

const statCards = [
  { key: 'users', label: 'Users', hint: 'active accounts', Icon: Users },
  { key: 'tracks', label: 'Tracks', hint: 'in DreamTune database', Icon: Music },
  { key: 'active_today', label: 'Active today', hint: 'listened today', Icon: Activity },
  { key: 'collab_playlists', label: 'Shared', hint: 'friend playlists', Icon: ListMusic },
];

function formatDate(value) {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function StatusPill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-secondary text-foreground border-border',
    good: 'bg-emerald-500/14 text-emerald-200 border-emerald-400/25',
    warn: 'bg-amber-500/14 text-amber-200 border-amber-400/25',
    danger: 'bg-red-500/14 text-red-200 border-red-400/25',
    admin: 'bg-primary/16 text-primary border-primary/30',
  };

  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-black ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('users');

  const loadAdmin = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const [stats, userRows, playlistRows] = await Promise.all([
        admin.overview(),
        admin.listUsers(),
        admin.listCollabPlaylists(),
      ]);
      setOverview(stats);
      setUsers(userRows);
      setPlaylists(playlistRows);
      setForbidden(false);
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('forbidden')) setForbidden(true);
      else toast.error('Could not load admin panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => (
      String(user.nickname || '').toLowerCase().includes(value)
      || String(user.email || '').toLowerCase().includes(value)
      || String(user.role || '').toLowerCase().includes(value)
    ));
  }, [query, users]);

  const filteredPlaylists = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return playlists;
    return playlists.filter((playlist) => (
      String(playlist.name || '').toLowerCase().includes(value)
      || String(playlist.owner_nickname || playlist.owner_email || '').toLowerCase().includes(value)
    ));
  }, [query, playlists]);

  const blockedCount = users.filter((user) => user.blocked_at).length;
  const unverifiedCount = users.filter((user) => !user.email_verified && !user.is_verified).length;

  const updateUser = async (id, action) => {
    try {
      const next = await admin.updateUser(id, action);
      setUsers((prev) => prev.map((user) => (user.id === id ? next : user)));
      toast.success(action === 'block' ? 'User blocked' : action === 'unblock' ? 'User unblocked' : 'Role updated');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not update user');
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete account "${user.nickname || user.email}"? This will permanently remove all their data.`)) return;
    try {
      await admin.deleteUser(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast.success('Account deleted');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not delete account');
    }
  };

  const deletePlaylist = async (playlist) => {
    if (!window.confirm(`Delete collaborative playlist "${playlist.name}"?`)) return;
    try {
      await admin.deleteCollabPlaylist(playlist.id);
      setPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
      toast.success('Playlist deleted');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not delete playlist');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-primary/25 border-t-primary animate-spin" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-[24px] bg-destructive/15 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-black text-foreground">403</h1>
        <p className="mt-2 text-sm font-bold text-muted-foreground">
          This page is available only to the DreamTune administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-50 -mx-4 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">DreamTune Control</p>
            <h1 className="truncate text-2xl font-black text-foreground sm:text-3xl">Admin panel</h1>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-11 w-11 rounded-2xl bg-secondary/70"
            onClick={() => loadAdmin({ quiet: true })}
            disabled={refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(({ key, label, hint, Icon }) => (
          <div key={key} className="rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/14 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-3xl font-black text-foreground">{overview?.[key] || 0}</p>
            </div>
            <p className="truncate text-sm font-black text-foreground">{label}</p>
            <p className="truncate text-xs font-bold text-muted-foreground">{hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-border/60 bg-card/80 p-4">
          <p className="text-xs font-bold text-muted-foreground">Unverified email</p>
          <p className="mt-1 text-2xl font-black text-foreground">{unverifiedCount}</p>
        </div>
        <div className="rounded-[22px] border border-border/60 bg-card/80 p-4">
          <p className="text-xs font-bold text-muted-foreground">Blocked</p>
          <p className="mt-1 text-2xl font-black text-foreground">{blockedCount}</p>
        </div>
        <div className="rounded-[22px] border border-border/60 bg-card/80 p-4">
          <p className="text-xs font-bold text-muted-foreground">Total accounts</p>
          <p className="mt-1 text-2xl font-black text-foreground">{users.length}</p>
        </div>
      </section>

      <div className="mt-5 rounded-[28px] border border-border/70 bg-card/92 p-3 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex rounded-2xl bg-secondary/70 p-1">
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`h-10 rounded-xl px-4 text-sm font-black transition ${tab === 'users' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground'}`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setTab('playlists')}
              className={`h-10 rounded-xl px-4 text-sm font-black transition ${tab === 'playlists' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground'}`}
            >
              Collaborative playlists
            </button>
          </div>
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 md:w-80">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'users' ? 'Search by nickname or email' : 'Search playlist'}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </label>
        </div>

        {tab === 'users' ? (
          <div className="mt-4 overflow-hidden rounded-[22px] border border-border/60">
            <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(170px,1fr)_170px] gap-3 border-b border-border/60 bg-secondary/55 px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground lg:grid">
              <span>User</span>
              <span>Status</span>
              <span>Date</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-border/60">
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin';
                const isBlocked = Boolean(user.blocked_at);
                const isVerified = Boolean(user.email_verified || user.is_verified);

                return (
                  <article key={user.id} className="grid gap-3 bg-card/70 p-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(170px,1fr)_minmax(170px,1fr)_170px] lg:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-gradient-to-br from-primary/80 to-accent/70 text-base font-black text-primary-foreground">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          String(user.nickname || user.email || '?').slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-foreground">{user.nickname || 'No nickname'}</p>
                        <p className="truncate text-xs font-bold text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusPill tone={isAdmin ? 'admin' : 'neutral'}>
                        {isAdmin ? <Crown className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {isAdmin ? 'Admin' : 'User'}
                      </StatusPill>
                      <StatusPill tone={isBlocked ? 'danger' : 'good'}>
                        {isBlocked ? 'Blocked' : 'Active'}
                      </StatusPill>
                      <StatusPill tone={isVerified ? 'good' : 'warn'}>
                        {isVerified ? <MailCheck className="h-3.5 w-3.5" /> : <MailWarning className="h-3.5 w-3.5" />}
                        {isVerified ? 'Email ok' : 'Not verified'}
                      </StatusPill>
                    </div>

                    <div className="text-xs font-bold text-muted-foreground">
                      <p>Created: {formatDate(user.created_at)}</p>
                      {user.updated_at && <p>Updated: {formatDate(user.updated_at)}</p>}
                    </div>

                    <div className="flex items-center justify-start gap-2 lg:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-10 rounded-2xl bg-secondary/70 px-3"
                        onClick={() => updateUser(user.id, isBlocked ? 'unblock' : 'block')}
                      >
                        {isBlocked ? <RefreshCw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-10 rounded-2xl bg-secondary/70 px-3"
                        onClick={() => updateUser(user.id, isAdmin ? 'make_user' : 'make_admin')}
                      >
                        <Crown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-10 rounded-2xl bg-destructive/12 px-3 text-destructive hover:bg-destructive/18"
                        onClick={() => deleteUser(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}
              {!filteredUsers.length && (
                <div className="p-8 text-center text-sm font-bold text-muted-foreground">
                  No users match this search.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlaylists.map((playlist) => (
              <article key={playlist.id} className="rounded-[24px] border border-border/60 bg-secondary/45 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-gradient-to-br from-primary/70 to-accent/60 text-primary-foreground">
                    {playlist.cover_url ? (
                      <img src={playlist.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ListMusic className="h-7 w-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-foreground">{playlist.name || 'Untitled'}</p>
                    <p className="truncate text-xs font-bold text-muted-foreground">
                      {playlist.owner_nickname || playlist.owner_email || 'Owner'} · {(playlist.song_ids || []).length} songs
                    </p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">Created: {formatDate(playlist.created_at)}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 shrink-0 rounded-2xl bg-destructive/12 text-destructive hover:bg-destructive/18"
                    onClick={() => deletePlaylist(playlist)}
                    aria-label="Delete playlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            ))}
            {!filteredPlaylists.length && (
              <div className="rounded-[24px] border border-dashed border-border/70 p-8 text-center text-sm font-bold text-muted-foreground md:col-span-2 xl:col-span-3">
                No collaborative playlists match this search.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
        <MoreVertical className="h-4 w-4" />
        Actions run immediately and sync with the database.
      </div>
    </div>
  );
}
