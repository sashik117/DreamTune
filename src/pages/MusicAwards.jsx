import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Music, Heart, Mic2, Star, Share2, RefreshCw, ChevronLeft } from 'lucide-react';
import { entities } from '@/api/SupabaseClient';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';

const MONTH_NAMES = ['Січня','Лютого','Березня','Квітня','Травня','Червня','Липня','Серпня','Вересня','Жовтня','Листопада','Грудня'];

function StatCard({ icon: Icon, value, label, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 18 }}
      className={`${color} rounded-3xl p-4 flex flex-col items-center gap-1.5 text-center`}
    >
      <Icon className="w-5 h-5 opacity-80" />
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="text-xs font-semibold opacity-70 leading-tight">{label}</p>
    </motion.div>
  );
}

export default function MusicAwards({ songs }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef(null);

  const now       = new Date();
  const monthName = MONTH_NAMES[now.getMonth()];

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Fetch all listen history (Supabase entity list, ordered by listened_at desc)
      const history = await entities.ListenHistory.list();

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const thisMonth    = history.filter(h => h.listened_at >= startOfMonth);

      // Top artist
      const artistCounts = {};
      thisMonth.forEach(h => {
        if (h.song_artist) artistCounts[h.song_artist] = (artistCounts[h.song_artist] || 0) + 1;
      });
      const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0];

      // Top song
      const songCounts = {};
      thisMonth.forEach(h => {
        if (h.song_id) songCounts[h.song_id] = (songCounts[h.song_id] || 0) + 1;
      });
      const topSongEntry = Object.entries(songCounts).sort((a, b) => b[1] - a[1])[0];
      const topSong      = songs.find(s => s.id === topSongEntry?.[0]);

      setStats({
        total:       thisMonth.length,
        uniqueSongs: new Set(thisMonth.map(h => h.song_id)).size,
        topArtist:   topArtist ? { name: topArtist[0], count: topArtist[1] } : null,
        topSong:     topSong ? { ...topSong, count: topSongEntry[1] } : null,
        favorites:   songs.filter(s => s.is_favorite).length,
        allTime:     history.length,
      });

      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#f472b6','#c084fc','#818cf8','#34d399','#fbbf24'],
        });
      }, 600);
    } catch (err) {
      console.error('MusicAwards loadStats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `music-awards-${monthName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      if (navigator.share) {
        navigator.share({
          title: `🎶 Мій саундтрек ${monthName}`,
          text:  `Прослухав ${stats?.total} пісень цього місяця!`,
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 pt-6 pb-8">
      {/* Header */}
      <div className="w-full flex items-center gap-3 mb-6">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-bold text-foreground">Нагороди місяця</h1>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <AnimatePresence>
          {/* Award Card */}
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-full max-w-sm relative overflow-hidden rounded-[2rem] shadow-2xl"
            style={{ background: 'linear-gradient(135deg, hsl(330 70% 55%) 0%, hsl(270 60% 55%) 40%, hsl(200 70% 50%) 100%)' }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

            <div className="relative z-10 p-6 text-white">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 16 }}
                className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"
              >
                <Trophy className="w-8 h-8 text-yellow-300" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-center mb-6"
              >
                <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-1">Твій саундтрек</p>
                <h2 className="text-3xl font-extrabold leading-tight">{monthName}</h2>
              </motion.div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <StatCard icon={Music}  value={stats.total}       label="Прослухувань"       color="bg-white/15" delay={0.5} />
                <StatCard icon={Star}   value={stats.uniqueSongs} label="Унікальних пісень"  color="bg-white/15" delay={0.6} />
                <StatCard icon={Heart}  value={stats.favorites}   label="В улюблених"        color="bg-white/15" delay={0.7} />
                <StatCard icon={Music}  value={stats.allTime}     label="Всього прослухано"  color="bg-white/15" delay={0.8} />
              </div>

              {stats.topArtist && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 }}
                  className="bg-white/15 rounded-2xl p-4 mb-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-400/30 flex items-center justify-center flex-shrink-0">
                    <Mic2 className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-semibold">Топ артист</p>
                    <p className="text-white font-bold text-sm leading-tight">{stats.topArtist.name}</p>
                    <p className="text-white/50 text-xs">{stats.topArtist.count} прослуховувань</p>
                  </div>
                </motion.div>
              )}

              {stats.topSong && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.0 }}
                  className="bg-white/15 rounded-2xl p-3 flex items-center gap-3"
                >
                  {stats.topSong.cover_url ? (
                    <img src={stats.topSong.cover_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white/60 text-xs font-semibold">Хіт місяця</p>
                    <p className="text-white font-bold text-sm truncate">{stats.topSong.title}</p>
                    <p className="text-white/50 text-xs truncate">{stats.topSong.artist}</p>
                  </div>
                  <span className="text-white/50 text-xs flex-shrink-0">×{stats.topSong.count}</span>
                </motion.div>
              )}

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                className="text-center text-white/50 text-xs mt-4"
              >
                🎵 DreamTune
              </motion.p>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="flex gap-3 mt-6 w-full max-w-sm"
          >
            <Button onClick={handleShare} className="flex-1 gap-2 bg-primary hover:brightness-110 rounded-2xl h-11">
              <Share2 className="w-4 h-4" /> Поділитися
            </Button>
            <Button variant="outline" onClick={loadStats} className="gap-2 rounded-2xl h-11 border-border px-4">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}