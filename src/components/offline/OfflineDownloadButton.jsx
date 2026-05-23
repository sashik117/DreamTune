import { useState, useEffect } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { downloadSong, removeSongFromCache, isSongDownloaded } from '../../utils/audioCache';
import { toast } from 'sonner';

export default function OfflineDownloadButton({ song, size = 'sm' }) {
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    isSongDownloaded(song.id).then(value => active && setDownloaded(value));

    const handleCacheChange = (event) => {
      if (event.detail?.songId === song.id) setDownloaded(Boolean(event.detail.downloaded));
    };
    window.addEventListener('dreamtune-offline-cache-change', handleCacheChange);
    return () => {
      active = false;
      window.removeEventListener('dreamtune-offline-cache-change', handleCacheChange);
    };
  }, [song.id]);

  const handleDownload = async (event) => {
    event.stopPropagation();
    if (downloaded) {
      await removeSongFromCache(song.id, song.file_url);
      setDownloaded(false);
      toast.success('Removed from offline');
      return;
    }

    setDownloading(true);
    setProgress(0);
    const ok = await downloadSong(song, setProgress);
    setDownloading(false);
    if (ok) {
      setDownloaded(true);
      toast.success(`"${song.title}" saved offline`);
    } else {
      toast.error('Could not download');
    }
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  return (
    <motion.button
      whileTap={{ scale: 0.82 }}
      onClick={handleDownload}
      disabled={downloading}
      className={`${btnSize} flex items-center justify-center rounded-full transition-all flex-shrink-0
        ${downloaded ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'hover:bg-secondary text-muted-foreground'}`}
      title={downloaded ? 'Remove offline copy' : 'Save offline'}
      aria-label={downloaded ? 'Remove offline copy' : 'Save offline'}
    >
      <AnimatePresence mode="wait">
        {downloading ? (
          <motion.div key="loading" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="relative flex items-center justify-center">
            <svg className={`${iconSize} -rotate-90`} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 10}`}
                strokeDashoffset={`${2 * Math.PI * 10 * (1 - progress / 100)}`}
                className="transition-all duration-300"
              />
            </svg>
          </motion.div>
        ) : downloaded ? (
          <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <WifiOff className={iconSize} />
          </motion.div>
        ) : (
          <motion.div key="download" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <Download className={iconSize} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
