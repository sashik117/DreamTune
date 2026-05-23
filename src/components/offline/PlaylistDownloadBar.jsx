import { useState, useEffect } from 'react';
import { Download, WifiOff, RefreshCw, Loader2, CloudOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { downloadSong, isSongDownloaded, removeSongFromCache } from '../../utils/audioCache';
import { toast } from 'sonner';

export default function PlaylistDownloadBar({ songs }) {
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const results = await Promise.all(songs.map(song => isSongDownloaded(song.id)));
      if (!active) return;
      setDownloadedIds(new Set(songs.filter((_, index) => results[index]).map(song => song.id)));
    };
    check();

    const handleCacheChange = () => check();
    window.addEventListener('dreamtune-offline-cache-change', handleCacheChange);
    return () => {
      active = false;
      window.removeEventListener('dreamtune-offline-cache-change', handleCacheChange);
    };
  }, [songs]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const allDownloaded = songs.length > 0 && downloadedIds.size === songs.length;
  const someDownloaded = downloadedIds.size > 0;

  const downloadAll = async () => {
    if (!isOnline) {
      toast.error('No network connection');
      return;
    }

    setDownloading(true);
    const toDownload = songs.filter(song => !downloadedIds.has(song.id));
    let done = downloadedIds.size;

    for (const song of toDownload) {
      await downloadSong(song, () => {});
      done += 1;
      setProgress(Math.round((done / songs.length) * 100));
      setDownloadedIds(prev => new Set([...prev, song.id]));
    }

    setDownloading(false);
    toast.success('Playlist saved offline');
  };

  const removeAll = async () => {
    for (const song of songs) {
      if (downloadedIds.has(song.id)) await removeSongFromCache(song.id, song.file_url);
    }
    setDownloadedIds(new Set());
    toast.success('Offline copies removed');
  };

  if (songs.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/80 border border-border/60 backdrop-blur-sm mb-4 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {allDownloaded ? (
            <WifiOff className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : !isOnline ? (
            <CloudOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <Download className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <span className="text-xs font-semibold text-foreground truncate">
            {allDownloaded ? 'Available offline' : someDownloaded ? `${downloadedIds.size}/${songs.length} saved` : 'Save offline'}
          </span>
        </div>
        {downloading && (
          <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {!isOnline && !allDownloaded && (
        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">Offline</span>
      )}

      {isOnline && !allDownloaded && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={downloadAll}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
        >
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          {downloading ? `${progress}%` : 'Download'}
        </motion.button>
      )}

      {allDownloaded && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={removeAll}
          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-full hover:bg-destructive/10"
        >
          Remove
        </motion.button>
      )}

      {isOnline && someDownloaded && !allDownloaded && !downloading && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={downloadAll}
          className="p-1.5 hover:bg-secondary rounded-full transition-colors"
          title="Sync the rest"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.button>
      )}
    </div>
  );
}
