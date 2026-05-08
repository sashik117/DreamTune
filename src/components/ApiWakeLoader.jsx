import { useEffect, useState } from 'react';

const API_WAKE_EVENT = 'dreamtune-api-wake';

export default function ApiWakeLoader() {
  const [activeRequests, setActiveRequests] = useState(() => new Set());

  useEffect(() => {
    const handleWake = (event) => {
      const { id, active } = event.detail || {};
      if (!id) return;
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

  if (!activeRequests.size) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/72 px-6 backdrop-blur-xl">
      <div className="w-full max-w-[320px] rounded-[28px] border border-white/12 bg-card/95 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-primary/20 p-2">
          <div className="h-full w-full animate-pulse rounded-xl bg-primary shadow-[0_0_28px_hsl(var(--primary)/0.65)]" />
        </div>
        <p className="text-base font-semibold text-foreground">DreamTune прокидається...</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Безкоштовний сервер може стартувати кілька секунд. Зараз усе підтягнеться.
        </p>
      </div>
    </div>
  );
}
