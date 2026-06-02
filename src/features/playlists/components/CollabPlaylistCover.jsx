import { Music } from 'lucide-react';

export default function CollabPlaylistCover({ playlist, coverSongs = [], className = 'w-12 h-12 rounded-2xl' }) {
  return (
    <div className={`${className} overflow-hidden bg-secondary flex-shrink-0 shadow-md flex items-center justify-center`}>
      {playlist.cover_url ? (
        <img
          src={playlist.cover_url}
          alt=""
          className="w-full h-full object-cover"
          style={{
            objectPosition: playlist.cover_position || '50% 50%',
            transform: `scale(${Number(playlist.cover_scale || 1)})`,
            transformOrigin: playlist.cover_position || '50% 50%',
          }}
        />
      ) : coverSongs.length >= 4 ? (
        <div className="grid grid-cols-2 w-full h-full">
          {coverSongs.map(song => <img key={song.id} src={song.cover_url} alt="" className="w-full h-full object-cover" />)}
        </div>
      ) : coverSongs.length ? (
        <img src={coverSongs[0].cover_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <Music className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );
}
