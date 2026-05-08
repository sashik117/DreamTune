import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Globe2, ListMusic, UserCircle, Users } from 'lucide-react';
import { social } from '@/api/SupabaseClient';
import CoverArt from '../components/CoverArt';

function PlaylistCover({ playlist, songs }) {
  if (playlist.cover_url) {
    return (
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
    );
  }

  const coverSongs = (playlist.song_ids || [])
    .map(id => songs.find(song => song.id === id))
    .filter(Boolean)
    .slice(0, 4);

  if (coverSongs.length >= 4) {
    return (
      <div className="grid grid-cols-2 w-full h-full">
        {coverSongs.map(song => <CoverArt key={song.id} song={song} className="w-full h-full rounded-none" />)}
      </div>
    );
  }

  if (coverSongs.length) return <CoverArt song={coverSongs[0]} className="w-full h-full rounded-none" />;
  return <ListMusic className="w-6 h-6 text-muted-foreground" />;
}

export default function FriendProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    social.getUserProfile(userId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="px-3 sm:px-4 pb-4">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> РќР°Р·Р°Рґ
        </button>
        <div className="mt-10 rounded-3xl border border-border bg-card/95 p-6 text-center">
          <p className="font-bold text-foreground">РџСЂРѕС„С–Р»СЊ РЅРµ Р·РЅР°Р№РґРµРЅРѕ</p>
        </div>
      </div>
    );
  }

  const joined = data.user.created_at ? new Date(data.user.created_at).toLocaleDateString('uk-UA') : '';

  return (
    <div className="px-3 sm:px-4 pb-4">
      <div className="sticky top-0 z-50 pt-3 pb-3 mb-4 bg-background/92 backdrop-blur-xl border-b border-border/60">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary" aria-label="Назад">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <section className="rounded-3xl border border-border bg-card/95 p-4 shadow-lg shadow-primary/5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            {data.user.avatar_url ? <img src={data.user.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserCircle className="h-12 w-12 text-white" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black text-foreground">{data.user.nickname}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> Р— РЅР°РјРё Р· {joined}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {data.relationship === 'friend' ? 'Р’ РґСЂСѓР·СЏС…' : data.relationship === 'self' ? 'Р¦Рµ С‚РІС–Р№ РїСЂРѕС„С–Р»СЊ' : 'РџСѓР±Р»С–С‡РЅРёР№ РїСЂРѕС„С–Р»СЊ'}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-border bg-card/95 p-4">
        <h2 className="mb-3 text-base font-black text-foreground">РџСѓР±Р»С–С‡РЅС– РїР»РµР№Р»РёСЃС‚Рё</h2>
        <div className="space-y-2">
          {data.playlists?.length ? data.playlists.map(playlist => (
            <div key={playlist.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary flex items-center justify-center">
                <PlaylistCover playlist={playlist} songs={data.songs || []} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{playlist.name}</p>
                <p className="text-xs text-muted-foreground">{playlist.song_ids?.length || 0} РїС–СЃРµРЅСЊ</p>
              </div>
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">РџСѓР±Р»С–С‡РЅРёС… РїР»РµР№Р»РёСЃС‚С–РІ С‰Рµ РЅРµРјР°С”.</p>
          )}
        </div>
      </section>
    </div>
  );
}
