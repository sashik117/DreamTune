export default function StatusPill({ children, tone = 'neutral' }) {
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
