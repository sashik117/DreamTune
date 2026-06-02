import { RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminHeader({ refreshing, onRefresh }) {
  return (
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
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </header>
  );
}
