import { useState, useEffect } from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [justCameOnline, setJustCameOnline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustCameOnline(true);
      setDismissed(false);
      setTimeout(() => setJustCameOnline(false), 4000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const show = (!isOnline || justCameOnline) && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className={`fixed top-3 left-3 right-3 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-2xl shadow-lg border text-sm font-semibold
            ${isOnline
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
              : 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400'
            }`}
        >
          {isOnline
            ? <Wifi className="w-4 h-4 flex-shrink-0" />
            : <WifiOff className="w-4 h-4 flex-shrink-0" />
          }
          <span className="flex-1">
            {isOnline ? 'З\'єднання відновлено 🎉' : 'Немає мережі — доступно офлайн ☁️'}
          </span>
          <button onClick={() => setDismissed(true)} className="p-0.5 hover:opacity-60 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}