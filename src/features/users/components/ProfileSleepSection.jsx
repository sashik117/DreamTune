import { Clock3, TimerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatSleepRemaining } from '@/features/users/model/profileSections';

export default function ProfileSleepSection({
  sleepRemaining,
  customSleep,
  onCustomSleepChange,
  onSleepTimerChange,
  onStartCustomSleep,
}) {
  return (
    <section className="rounded-3xl border border-border bg-card/95 p-5 space-y-4">
      <Clock3 className="w-6 h-6 text-primary" />
      <div>
        <p className="text-sm text-muted-foreground">Remaining</p>
        <p className="text-3xl font-black text-foreground">{formatSleepRemaining(sleepRemaining)}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[15, 30, 60].map(minutes => (
          <Button key={minutes} variant="outline" onClick={() => onSleepTimerChange(minutes)} className="rounded-2xl border-border">{minutes} min</Button>
        ))}
        <Button variant="outline" onClick={() => onSleepTimerChange(0)} className="rounded-2xl border-border gap-2"><TimerOff className="w-4 h-4" /> Reset</Button>
      </div>
      <div className="flex gap-2">
        <Input value={customSleep} onChange={event => onCustomSleepChange(event.target.value)} inputMode="numeric" placeholder="Custom time in minutes" className="bg-secondary border-border rounded-2xl" />
        <Button onClick={onStartCustomSleep} className="rounded-2xl">Start</Button>
      </div>
    </section>
  );
}
