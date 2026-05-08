import { Music } from 'lucide-react';
import { getGeneratedCover } from '@/utils/coverArt';

export default function CoverArt({ song, className = '', imageClassName = '', fallbackClassName = '', children }) {
  const generated = getGeneratedCover(song);

  return (
    <div className={`relative overflow-hidden bg-secondary ${className}`}>
      {song?.cover_url ? (
        <img
          src={song.cover_url}
          alt=""
          className={`w-full h-full object-cover ${imageClassName}`}
          style={{
            objectPosition: song.cover_position || '50% 50%',
            transform: `scale(${Number(song.cover_scale || 1)})`,
            transformOrigin: song.cover_position || '50% 50%',
          }}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center ${fallbackClassName}`} style={generated.style}>
          <div className="absolute -right-3 -top-3 w-1/2 h-1/2 rounded-full bg-white/25 blur-sm" />
          <div className="absolute left-2 bottom-2 w-1/3 h-1/3 rounded-[35%] rotate-12 bg-white/18" />
          <span className="relative z-10 text-white/90 font-extrabold tracking-normal drop-shadow-sm">
            {generated.initials || <Music className="w-1/2 h-1/2" />}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
