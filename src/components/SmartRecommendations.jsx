import { useState, useEffect } from 'react';
import { Sparkles, Music, Loader2, Download, RefreshCw, Zap, Coffee, Sun, Moon, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const MOODS = [
  { key: 'all',        label: 'Для тебе', icon: Sparkles, color: 'from-pink-400/20 to-rose-400/20' },
  { key: 'energetic',  label: 'Енергія',  icon: Zap,      color: 'from-orange-400/20 to-yellow-400/20' },
  { key: 'chill',      label: 'Чіл',      icon: Coffee,   color: 'from-blue-400/20 to-cyan-400/20' },
  { key: 'happy',      label: 'Настрій',  icon: Sun,      color: 'from-yellow-400/20 to-lime-400/20' },
  { key: 'melancholic',label: 'Лірика',   icon: Moon,     color: 'from-purple-400/20 to-indigo-400/20' },
  { key: 'focus',      label: 'Фокус',    icon: Brain,    color: 'from-teal-400/20 to-emerald-400/20' },
];

const MOOD_PROMPTS = {
  all:         'similar style/genre to the library',
  energetic:   'high-energy, upbeat, fast tempo, workout music',
  chill:       'relaxing, lo-fi, slow tempo, ambient, chill vibes',
  happy:       'happy, uplifting, feel-good, positive vibes',
  melancholic: 'emotional, melancholic, slow, introspective lyrics',
  focus:       'focus music, instrumental, study beats, concentration',
};

async function fetchRecsFromAI({ songs, mood, history }) {
  const artists  = [...new Set(songs.map(s => s.artist).filter(Boolean))].slice(0, 8);
  const titles   = songs.map(s => s.title).slice(0, 12);
  const topPlayed = history?.slice(0, 10).map(h => h.song_title).filter(Boolean).join(', ') || '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: 'Respond ONLY with valid JSON. No markdown, no explanation.',
      messages: [{
        role: 'user',
        content: `Music recommendation engine.
User's library:
Artists: ${artists.join(', ')}
Songs: ${titles.join(', ')}
${topPlayed ? `Most played recently: ${topPlayed}` : ''}

Mood/vibe: "${MOOD_PROMPTS[mood]}"

Rules:
- Do NOT suggest songs already in the library
- For thumbnail use https://img.youtube.com/vi/VIDEOID/hqdefault.jpg if you know the YouTube video ID, else empty string

Return JSON: { "recommendations": [{ "title": "", "artist": "", "youtube_query": "", "thumbnail": "" }] } — exactly 6 items.`
      }]
    })
  });

  const raw = await res.json();
  const text = raw.content?.[0]?.text ?? '{}';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return parsed.recommendations ?? [];
  } catch {
    return [];
  }
}

export default function SmartRecommendations({ songs, onDownloadRecommendation, history }) {
  const [recs, setRecs] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeMood, setActiveMood] = useState('all');

  const currentRecs = recs[activeMood] || [];

  const fetchRecs = async (mood, force = false) => {
    if (recs[mood] && !force) return; // cached
    setLoading(true);
    try {
      const result = await fetchRecsFromAI({ songs, mood, history });
      setRecs(prev => ({ ...prev, [mood]: result }));
    } catch (err) {
      console.error('SmartRecs error:', err);
      toast.error('Не вдалось завантажити рекомендації');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (songs.length >= 2) fetchRecs(activeMood);
  }, [songs.length]);

  const handleMoodChange = (mood) => {
    setActiveMood(mood);
    if (songs.length >= 2) fetchRecs(mood);
  };

  const handleRefresh = () => {
    setRecs(prev => { const n = { ...prev }; delete n[activeMood]; return n; });
    fetchRecs(activeMood, true);
  };

  if (songs.length < 2) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-foreground">ШІ-рекомендації</h2>
          {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
        </div>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleRefresh}
          disabled={loading}
          className="p-1.5 hover:bg-secondary rounded-full transition-colors disabled:opacity-40"
        >
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.button>
      </div>

      {/* Mood tabs */}
      <div className="dream-scroll-row flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-hide">
        {MOODS.map((mood) => {
          const MoodIcon = mood.icon;
          return (
            <motion.button
              key={mood.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleMoodChange(mood.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${activeMood === mood.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-card/80 text-muted-foreground border-border/60 hover:border-primary/40'
                }`}
            >
              <MoodIcon className="w-3 h-3" />
              {mood.label}
            </motion.button>
          );
        })}
      </div>

      {/* Rec cards */}
      {loading && currentRecs.length === 0 ? (
        <div className="dream-scroll-row flex gap-3 overflow-x-auto pb-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32">
              <div className="w-32 h-32 rounded-2xl bg-secondary animate-pulse mb-2" />
              <div className="h-3 bg-secondary rounded animate-pulse mb-1 w-4/5" />
              <div className="h-3 bg-secondary rounded animate-pulse w-3/5" />
            </div>
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMood}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="dream-scroll-row flex gap-3 overflow-x-auto pb-2"
          >
            {currentRecs.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.06, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 w-32 cursor-pointer group"
                onClick={() => onDownloadRecommendation(rec)}
              >
                <div className="w-32 h-32 rounded-2xl overflow-hidden bg-secondary mb-2 relative shadow-md border border-white/20">
                  {rec.thumbnail ? (
                    <img src={rec.thumbnail} alt="" className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/20">
                      <Music className="w-8 h-8 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
                    >
                      <Download className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-xs font-semibold text-foreground truncate leading-tight">{rec.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{rec.artist}</p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}
