import { BarChart3 } from 'lucide-react';

const PERIOD_OPTIONS = [[7, 'Week'], [30, 'Month'], [180, 'Half year'], [365, 'Year']];

export default function ProfileStatsSection({ period, onPeriodChange, periodStats, topTrack }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIOD_OPTIONS.map(([days, label]) => (
          <button key={days} onClick={() => onPeriodChange(days)} className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap ${period === days ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ['Listens', periodStats.listens],
          ['Tracks played', periodStats.tracks],
          ['Artists heard', periodStats.artists],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl border border-border bg-card/95 p-5">
            <BarChart3 className="w-5 h-5 text-primary mb-3" />
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-black text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {periodStats.listens === 0 ? (
        <div className="rounded-3xl border border-border bg-card/95 p-5 text-center">
          <p className="text-base font-black text-foreground">No data for this period yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start listening so DreamTune can build your vibe.</p>
        </div>
      ) : topTrack && (
        <div className="rounded-3xl border border-border bg-card/95 p-5">
          <p className="text-sm text-muted-foreground">Most played</p>
          <p className="mt-1 text-xl font-black text-foreground truncate">{topTrack.title}</p>
          <p className="text-sm text-muted-foreground truncate">{topTrack.artist || 'Unknown artist'} / {topTrack.count} times</p>
        </div>
      )}
    </div>
  );
}
