import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Music, Disc3 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Albums({ songs }) {
  const albums = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      const artist = song.artist || 'Невідомий';
      // Use "album" field if present, otherwise group all songs per artist as one album
      const albumKey = song.album ? `${artist}__${song.album}` : `${artist}__`;
      if (!map[albumKey]) {
        map[albumKey] = {
          id: albumKey,
          name: song.album || artist,
          artist,
          cover: song.cover_url,
          songs: [],
        };
      }
      if (!map[albumKey].cover && song.cover_url) map[albumKey].cover = song.cover_url;
      map[albumKey].songs.push(song);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }, [songs]);

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-foreground mb-1">Альбоми</h1>
      <p className="text-sm text-muted-foreground mb-6">{albums.length} альбомів</p>

      {albums.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Disc3 className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Додай пісні, щоб альбоми з'явились тут</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-4"
        >
          {albums.map((album, i) => (
            <motion.div
              key={album.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                to={`/albums/${encodeURIComponent(album.id)}`}
                className="block group"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-secondary mb-2 relative shadow-sm group-hover:shadow-md transition-shadow">
                  {album.cover ? (
                    <img src={album.cover} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/60 rounded-full px-1.5 py-0.5 text-[10px] text-white font-medium">
                    {album.songs.length}
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{album.name}</p>
                <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}