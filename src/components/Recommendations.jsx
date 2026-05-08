import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, Music, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { media } from '../api/SupabaseClient';

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyFor(track) {
  return `${norm(track.title)}::${norm(track.artist)}`;
}

function pickSeeds(songs) {
  const weighted = new Map();
  songs.forEach((song, index) => {
    const artist = String(song.artist || '').trim();
    if (!artist) return;
    const weight = (song.is_favorite ? 5 : 1) + Math.max(0, 3 - index * 0.08);
    weighted.set(artist, (weighted.get(artist) || 0) + weight);
  });
  return [...weighted.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([artist]) => artist);
}

async function getRecommendations(songs) {
  const existing = new Set(songs.map(keyFor));
  const seeds = pickSeeds(songs);
  const found = [];
  const seen = new Set(existing);

  for (const artist of seeds) {
    try {
      const data = await media.searchSpotifyTracks(`artist:${artist}`, 10);
      for (const track of data.tracks || []) {
        const key = keyFor(track);
        if (!track.title || seen.has(key)) continue;
        seen.add(key);
        found.push({
          title: track.title,
          artist: track.artist,
          youtube_query: track.youtube_query || `${track.title} ${track.artist}`.trim(),
          thumbnail: track.cover_url || '',
        });
        if (found.length >= 8) return found;
      }
    } catch {
      // One seed can fail; the next one may still give useful results.
    }
  }

  if (found.length < 4) {
    const fallbackSeeds = songs
      .filter(song => song.title && song.artist)
      .slice(0, 4)
      .map(song => `${song.artist} ${song.title}`);
    for (const seed of fallbackSeeds) {
      try {
        const data = await media.searchSpotifyTracks(seed, 6);
        for (const track of data.tracks || []) {
          const key = keyFor(track);
          if (!track.title || seen.has(key)) continue;
          seen.add(key);
          found.push({
            title: track.title,
            artist: track.artist,
            youtube_query: track.youtube_query || `${track.title} ${track.artist}`.trim(),
            thumbnail: track.cover_url || '',
          });
          if (found.length >= 8) return found;
        }
      } catch {}
    }
  }

  return found;
}

export default function Recommendations({ songs, onDownloadRecommendation }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const seedKey = useMemo(
    () => songs.map(song => `${song.id}:${song.is_favorite ? 1 : 0}`).join('|'),
    [songs]
  );

  useEffect(() => {
    let cancelled = false;
    if (songs.length < 2) {
      setRecs([]);
      return undefined;
    }

    setLoading(true);
    getRecommendations(songs)
      .then(result => {
        if (!cancelled) setRecs(result);
      })
      .catch((err) => {
        console.error('Recommendations error:', err);
        if (!cancelled) setRecs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [songs.length, seedKey, songs]);

  if (songs.length < 2) return null;

  return (
    <section className="mb-4 min-w-0 overflow-visible">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <h2 className="min-w-0 truncate text-base sm:text-lg font-black text-foreground">Схоже для тебе</h2>
          {loading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />}
        </div>
      </div>

      {loading && recs.length === 0 && (
        <div className="dream-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-24 xs:w-28 sm:w-32">
              <div className="aspect-square w-full rounded-2xl bg-secondary animate-pulse mb-2" />
              <div className="h-3 bg-secondary rounded animate-pulse mb-1 w-4/5" />
              <div className="h-3 bg-secondary rounded animate-pulse w-3/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && recs.length === 0 && (
        <div className="rounded-3xl border border-border bg-card/85 p-4 text-sm text-muted-foreground">
          Додай більше улюблених треків, і DreamTune підбере схожі пісні.
        </div>
      )}

      {recs.length > 0 && (
        <div className="dream-scroll-row flex gap-2.5 sm:gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {recs.map((rec, i) => (
            <motion.button
              key={`${rec.title}-${rec.artist}-${i}`}
              type="button"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.035 }}
              className="flex-shrink-0 w-24 xs:w-28 sm:w-32 text-left group snap-start"
              onClick={() => onDownloadRecommendation(rec)}
            >
              <div className="aspect-square w-full rounded-2xl overflow-hidden bg-secondary mb-2 relative shadow-lg shadow-primary/10">
                {rec.thumbnail ? (
                  <img src={rec.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
                    <Music className="w-7 h-7 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                    <Download className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              </div>
              <p className="text-sm font-bold text-foreground truncate">{rec.title}</p>
              <p className="text-xs text-muted-foreground truncate">{rec.artist}</p>
            </motion.button>
          ))}
        </div>
      )}
    </section>
  );
}
