import { Activity, ListMusic, Music, Users } from 'lucide-react';

const statCards = [
  { key: 'users', label: 'Users', hint: 'active accounts', Icon: Users },
  { key: 'tracks', label: 'Tracks', hint: 'in DreamTune database', Icon: Music },
  { key: 'active_today', label: 'Active today', hint: 'listened today', Icon: Activity },
  { key: 'collab_playlists', label: 'Shared', hint: 'friend playlists', Icon: ListMusic },
];

export default function AdminStats({ overview, unverifiedCount, blockedCount, totalAccounts }) {
  return (
    <>
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
          <p className="mt-1 text-2xl font-black text-foreground">{totalAccounts}</p>
        </div>
      </section>
    </>
  );
}
