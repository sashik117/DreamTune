import SongCard from '../components/SongCard';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Favorites({ songs, currentSongId, isPlaying, onPlay, onToggleFavorite, onDelete, cachedSongs, onEdit, onAddToQueue, onPlayNext }) {
  const favoriteSongs = songs.filter(s => s.is_favorite);

  return (
    <div className="px-4 pt-5 sm:pt-6 pb-4">
      <div className="pl-14 mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Улюблені</h1>
        <p className="text-sm text-muted-foreground">{favoriteSongs.length} пісень</p>
      </div>

      {favoriteSongs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Натисни серце на пісні, щоб додати її в улюблені</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          {favoriteSongs.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              index={i}
              staggerIndex={i}
              isActive={currentSongId === song.id}
              isPlaying={isPlaying}
              onPlay={onPlay}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              isCached={cachedSongs?.has(song.id)}
              onEdit={onEdit}
              onAddToQueue={onAddToQueue}
              onPlayNext={onPlayNext}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
