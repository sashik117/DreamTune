import { Link } from 'react-router-dom';
import { Globe2, ListMusic } from 'lucide-react';
import CoverArt from '@/components/CoverArt';

function PlaylistCover({ playlist, songs }) {
  const coverSongs = (playlist.song_ids || []).map(id => songs.find(song => song.id === id)).filter(Boolean).slice(0, 4);
  if (playlist.cover_url) return <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />;
  if (coverSongs.length) {
    return (
      <div className="grid grid-cols-2 w-full h-full">
        {coverSongs.map(song => <CoverArt key={song.id} song={song} className="w-full h-full rounded-none" />)}
      </div>
    );
  }
  return <ListMusic className="w-6 h-6 text-muted-foreground" />;
}

export default function ProfilePublicPlaylists({ playlists, songs }) {
  return (
    <section className="rounded-3xl border border-border bg-card/95 p-4">
      <h2 className="text-base font-black text-foreground mb-3">Public playlists</h2>
      <div className="space-y-2">
        {playlists.length ? playlists.map(playlist => (
          <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
            <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
              <PlaylistCover playlist={playlist} songs={songs} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{playlist.name}</p>
              <p className="text-xs text-muted-foreground">{playlist.song_ids?.length || 0} songs</p>
            </div>
            <Globe2 className="w-4 h-4 text-muted-foreground" />
          </Link>
        )) : <p className="text-sm text-muted-foreground">No public playlists yet.</p>}
      </div>
    </section>
  );
}
