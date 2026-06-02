import { Music } from 'lucide-react';

export default function PlaylistSongCover({ song, className = 'w-10 h-10 rounded-xl' }) {
  return (
    <div className={`${className} overflow-hidden bg-secondary flex-shrink-0`}>
      {song.cover_url ? (
        <img
          src={song.cover_url}
          alt=""
          className="w-full h-full object-cover"
          style={{
            objectPosition: song.cover_position || '50% 50%',
            transform: `scale(${Number(song.cover_scale || 1)})`,
            transformOrigin: song.cover_position || '50% 50%',
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Music className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
