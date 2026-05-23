import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Share2, X, Music, Mic2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { entities } from '@/api/SupabaseClient';
import CoverArt from './CoverArt';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getAutoReportWindow(now = new Date()) {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const isLastEvening = now.getDate() === lastDay && now.getHours() >= 20;
  const isFirstDay = now.getDate() === 1;
  if (!isLastEvening && !isFirstDay) return null;
  const reportMonth = isFirstDay ? now.getMonth() - 1 : now.getMonth();
  const year = reportMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = (reportMonth + 12) % 12;
  return getMonthWindow(year, month);
}

function getMonthWindow(year, month) {
  return {
    year,
    month,
    start: new Date(year, month, 1).getTime(),
    end: new Date(year, month + 1, 1).getTime(),
    key: `${year}-${month}`,
  };
}

function currentMonthWindow() {
  const now = new Date();
  return getMonthWindow(now.getFullYear(), now.getMonth());
}

async function buildStats(songs, windowInfo) {
  const history = await entities.ListenHistory.list();
  const monthHistory = history.filter(item => item.listened_at >= windowInfo.start && item.listened_at < windowInfo.end);
  const songCounts = {};
  const artistCounts = {};
  monthHistory.forEach(item => {
    if (item.song_id) songCounts[item.song_id] = (songCounts[item.song_id] || 0) + 1;
    if (item.song_artist) artistCounts[item.song_artist] = (artistCounts[item.song_artist] || 0) + 1;
  });

  const topTracks = Object.entries(songCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ ...(songs.find(song => song.id === id) || { id, title: 'Track', artist: '' }), count }));

  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const minutes = Math.round(monthHistory.reduce((sum, item) => {
    const song = songs.find(s => s.id === item.song_id);
    return sum + (song?.duration || 180) / 60;
  }, 0));

  return { ...windowInfo, topTracks, topArtists, minutes, plays: monthHistory.length };
}

export default function MonthlySoundtrackModal({ songs, forceOpen = false, onForceOpenChange }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const windowInfo = getAutoReportWindow();
    if (!windowInfo) return;
    const seenKey = `dreamtune-monthly-${windowInfo.key}`;
    if (localStorage.getItem(seenKey)) return;
    buildStats(songs, windowInfo).then(nextStats => {
      if (!nextStats.plays) return;
      setStats(nextStats);
      setOpen(true);
      localStorage.setItem(seenKey, '1');
    }).catch(() => {});
  }, [songs]);

  useEffect(() => {
    if (!forceOpen) return;
    buildStats(songs, currentMonthWindow()).then(nextStats => {
      setStats(nextStats);
      setPage(0);
      setOpen(true);
    }).catch(() => {});
  }, [forceOpen, songs]);

  const pages = useMemo(() => {
    if (!stats) return [];
    const monthName = MONTHS[stats.month];
    return [
      { type: 'intro', title: `Your ${monthName} soundtrack`, subtitle: `DreamTune counted ${stats.minutes} minutes of music this month.` },
      { type: 'tracks', title: 'Top 3 tracks', items: stats.topTracks },
      { type: 'artists', title: 'Favorite artists', items: stats.topArtists },
    ];
  }, [stats]);

  const current = pages[page];
  const close = () => {
    setOpen(false);
    onForceOpenChange?.(false);
  };
  const share = async () => {
    const text = `${current?.title || 'DreamTune'}: ${stats?.minutes || 0} minutes of music this month`;
    if (navigator.share) await navigator.share({ title: 'DreamTune', text });
  };

  if (!stats || !current) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) onForceOpenChange?.(false); }}>
      <DialogContent className="w-screen h-screen max-w-none rounded-none border-0 p-0 bg-background overflow-hidden">
        <div className="relative h-full cozy-gradient-bg flex flex-col px-5 py-6">
          <button onClick={close} className="absolute top-5 right-5 z-20 p-2 rounded-full bg-card border border-border">
            <X className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex gap-1 mb-8">
            {pages.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= page ? 'bg-primary' : 'bg-border'}`} />)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full"
            >
              {current.type === 'intro' && (
                <div className="text-center">
                  <div className="w-44 h-44 mx-auto rounded-[2rem] bg-gradient-to-br from-primary to-accent shadow-2xl shadow-primary/30 flex items-center justify-center mb-8">
                    <Music className="w-20 h-20 text-white" />
                  </div>
                  <h2 className="text-4xl font-extrabold text-foreground leading-tight">{current.title}</h2>
                  <p className="text-muted-foreground mt-4 text-lg">{current.subtitle}</p>
                </div>
              )}

              {current.type === 'tracks' && (
                <div>
                  <h2 className="text-3xl font-extrabold mb-6 text-foreground">{current.title}</h2>
                  <div className="space-y-3">
                    {(current.items.length ? current.items : [{ title: 'No listens yet', artist: '', count: 0 }]).map((song, index) => (
                      <div key={song.id || index} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                        <span className="text-xl font-black text-primary w-7">{index + 1}</span>
                        <CoverArt song={song} className="w-12 h-12 rounded-xl" fallbackClassName="text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate text-foreground">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">x{song.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {current.type === 'artists' && (
                <div>
                  <h2 className="text-3xl font-extrabold mb-8 text-foreground">{current.title}</h2>
                  <div className="flex justify-center gap-4">
                    {(current.items.length ? current.items : [{ name: 'Still collecting stats', count: 0 }]).map((artist) => (
                      <div key={artist.name} className="text-center max-w-[112px]">
                        <div className="w-20 h-20 mx-auto rounded-full bg-card border border-border flex items-center justify-center shadow-lg mb-3">
                          <Mic2 className="w-8 h-8 text-primary" />
                        </div>
                        <p className="text-sm font-bold truncate text-foreground">{artist.name}</p>
                        <p className="text-xs text-muted-foreground">{artist.count} times</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-3 max-w-md mx-auto w-full">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-2xl border-border">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {page < pages.length - 1 ? (
              <Button onClick={() => setPage(p => p + 1)} className="flex-1 rounded-2xl gap-2">
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button onClick={share} className="flex-1 rounded-2xl gap-2"><Share2 className="w-4 h-4" />Share</Button>
                <Button variant="outline" onClick={close} className="rounded-2xl border-border">Close</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
