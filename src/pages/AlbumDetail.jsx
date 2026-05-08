import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Music } from 'lucide-react';
import SongCard from '../components/SongCard';
import { motion } from 'framer-motion';

export default function AlbumDetail({ songs, currentSongId, isPlaying, onPlay, onToggleFavorite, onDelete, cachedSongs }) {
  const { id } = useParams();
  const albumId = decodeURIComponent(id);

  const album = useMemo(() => {
    const albumSongs = songs.filter(song => {
      const artist = song.artist || 'Невідомий';
      const key = song.album ? `${artist}__${song.album}` : `${artist}__`;
      return key === albumId;
    });
    if (!albumSongs.length) return null;
    const artist = albumSongs[0].artist || 'Невідомий';
    const name = albumSongs[0].album || artist;
    const cover = albumSongs.find(s => s.cover_url)?.cover_url || null;
    return { name, artist, cover, songs: albumSongs };
  }, [songs, albumId]);

  if (!album) return (
    <div className="px-4 pt-6 text-center text-muted-foreground">Альбом не знайдено</div>
  );

  return (
    <div className="px-4 pt-6 pb-4">
      <Link to="/albums" className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> Альбоми
      </Link>

      {/* Album header */}
      <div className="flex gap-4 mb-6">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-secondary flex-shrink-0 shadow">
          {album.cover ? (
            <img src={album.cover} alt={album.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{album.name}</h1>
          <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
          <p className="text-xs text-muted-foreground mt-1">{album.songs.length} пісень</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-0.5">
        {album.songs.map((song, i) => (
          <SongCard
            key={song.id}
            song={song}
            index={i}
            isActive={currentSongId === song.id}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            isCached={cachedSongs?.has(song.id)}
          />
        ))}
      </motion.div>
    </div>
  );
}