import { useEffect, useState } from 'react';

const API_WAKE_EVENT = 'dreamtune-api-wake';

export default function ApiWakeLoader() {
  const [activeRequests, setActiveRequests] = useState(() => new Set());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleWake = (event) => {
      const { id, active } = event.detail || {};
      if (!id) return;
      if (active) setDismissed(false);
      setActiveRequests((current) => {
        const next = new Set(current);
        if (active) next.add(id);
        else next.delete(id);
        return next;
      });
    };

    window.addEventListener(API_WAKE_EVENT, handleWake);
    return () => window.removeEventListener(API_WAKE_EVENT, handleWake);
  }, []);

  useEffect(() => {
    if (!activeRequests.size) return undefined;
    const timer = window.setTimeout(() => setDismissed(true), 12000);
    return () => window.clearTimeout(timer);
  }, [activeRequests.size]);

  if (!activeRequests.size || dismissed) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[calc(12px+env(safe-area-inset-top,0px))] z-[10000] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-card/92 px-4 py-3 text-left shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
          <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">DreamTune is still loading data</p>
          <p className="truncate text-xs text-muted-foreground">You can keep using the app.</p>
        </div>
      </div>
    </div>
  );
}
