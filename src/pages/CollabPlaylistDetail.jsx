import { useState, useEffect, useRef } from 'react';
import { supabase, entities, storage, social } from '@/api/SupabaseClient';
import { ArrowLeft, Plus, Music, UserPlus, Check, Crown, X, Shuffle, Play, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import PlaylistDownloadBar from '../components/offline/PlaylistDownloadBar';
import SongCard from '../components/SongCard';
import { cacheAudio } from '../utils/audioCache';

export default function CollabPlaylistDetail({
  playlist: initialPlaylist,
  songs,
  currentUser,
  currentSongId,
  isPlaying,
  onToggleFavorite,
  onEdit,
  onAddToQueue,
  onPlayNext,
  onBack,
  onUpdated,
  onPlayPlaylist,
}) {
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [friends, setFriends] = useState([]);
  const [sharedSongs, setSharedSongs] = useState([]);
  const [coverPreview, setCoverPreview] = useState(initialPlaylist.cover_url || '');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPosition, setCoverPosition] = useState(() => {
    const [x = '50%', y = '50%'] = String(initialPlaylist.cover_position || '50% 50%').split(' ');
    return { x: Number(x.replace('%', '')) || 50, y: Number(y.replace('%', '')) || 50 };
  });
  const [coverScale, setCoverScale] = useState(Number(initialPlaylist.cover_scale || 1));
  const [savingCover, setSavingCover] = useState(false);
  const coverInputRef = useRef(null);
  const coverBoxRef = useRef(null);
  const previousSongIdsRef = useRef((initialPlaylist.song_ids || []).map(String));

  const playlistSongs = (playlist.song_ids || [])
    .map(id => sharedSongs.find(s => s.id === id) || songs.find(s => s.id === id))
    .filter(Boolean);

  const isOwner = playlist.owner_id === currentUser?.id || playlist.owner_email === currentUser?.email;

  const playlistCoverSongs = playlistSongs.filter(song => song.cover_url).slice(0, 4);
  const memberCount = ((playlist.collaborator_ids || []).length || (playlist.collaborator_emails || []).length) + 1;

  const pluralSong = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'пісня';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пісні';
    return 'пісень';
  };

  const pluralMember = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'учасник';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'учасники';
    return 'учасників';
  };

  useEffect(() => {
    const channel = supabase
      .channel(`collab_playlist_${playlist.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'collab_playlists', filter: `id=eq.${playlist.id}` },
        (payload) => {
          const updated = payload.new;
          const previousIds = previousSongIdsRef.current;
          const nextIds = (updated.song_ids || []).map(String);
          const addedIds = nextIds.filter(id => !previousIds.includes(id));
          const removedIds = previousIds.filter(id => !nextIds.includes(id));
          previousSongIdsRef.current = nextIds;
          setPlaylist(updated);
          onUpdated(updated);
          if (updated.last_edited_by && updated.last_edited_by !== currentUser?.email) {
            if (addedIds.length) {
              toast.success(`${updated.last_edited_by} додав трек у плейлист`);
            } else if (removedIds.length) {
              toast(`${updated.last_edited_by} прибрав трек із плейлиста`);
            } else {
              toast(`${updated.last_edited_by} оновив плейлист`);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [playlist.id, currentUser, onUpdated]);

  useEffect(() => {
    social.listCollabPlaylistSongs(playlist.id)
      .then(setSharedSongs)
      .catch(() => setSharedSongs([]));
  }, [playlist.id, (playlist.song_ids || []).join(',')]);

  useEffect(() => {
    if (!showInvite) return;
    social.listFriends().then(setFriends).catch(() => setFriends([]));
  }, [showInvite]);

  const update = async (changes) => {
    const patch = {
      ...changes,
      last_edited_by: currentUser?.email || null,
      last_edited_at: Date.now(),
    };
    const updated = await entities.CollabPlaylist.update(playlist.id, patch);
    previousSongIdsRef.current = (updated.song_ids || playlist.song_ids || []).map(String);
    setPlaylist(prev => ({ ...prev, ...updated }));
    onUpdated({ ...playlist, ...updated });
  };

  const handleAddSong = async (song) => {
    const ids = playlist.song_ids || [];
    const newIds = ids.includes(song.id) ? ids.filter(id => id !== song.id) : [...ids, song.id];
    await update({ song_ids: newIds });
  };

  const handleRemoveSong = async (songId) => {
    const newIds = (playlist.song_ids || []).filter(id => id !== songId);
    await update({ song_ids: newIds });
    toast.success('Пісню видалено');
  };

  const handleInvite = async (friend) => {
    if (!friend?.id) return;
    await social.inviteToCollabPlaylist({ playlist_id: playlist.id, receiver_id: friend.id });
    setShowInvite(false);
    toast.success(`Запит для ${friend.nickname} надіслано`);
  };

  const handleRemoveCollaborator = async (idOrEmail) => {
    const ids = (playlist.collaborator_ids || []).filter(item => item !== idOrEmail);
    const emails = (playlist.collaborator_emails || []).filter(item => item !== idOrEmail);
    await update({ collaborator_ids: ids, collaborator_emails: emails });
  };

  const warmPlaylistAudio = (targetSongs) => {
    const uncached = targetSongs.filter(song => song?.file_url);
    if (!uncached.length) return;
    uncached.forEach(song => {
      cacheAudio(song.file_url).catch(() => {});
    });
  };

  const handlePlayPlaylist = (shouldShuffle) => {
    const playable = playlistSongs.filter(song => song?.file_url);
    if (!playable.length) return toast.error('У плейлисті немає доступних аудіо');
    onPlayPlaylist?.(playable, { shuffle: shouldShuffle });
    warmPlaylistAudio(playable);
    if (shouldShuffle) toast.success('Плейлист перемішано');
  };

  const handlePlayFromPlaylist = (song) => {
    const playable = playlistSongs.filter(item => item?.file_url);
    if (!playable.length) return toast.error('У плейлисті немає доступних аудіо');
    onPlayPlaylist?.(playable, { startSongId: song.id });
    warmPlaylistAudio(playable);
  };

  const renderPlaylistCover = (className = 'w-12 h-12 rounded-2xl') => (
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
      ) : playlistCoverSongs.length >= 4 ? (
        <div className="grid grid-cols-2 w-full h-full">
          {playlistCoverSongs.map(song => <img key={song.id} src={song.cover_url} alt="" className="w-full h-full object-cover" />)}
        </div>
      ) : playlistCoverSongs.length ? (
        <img src={playlistCoverSongs[0].cover_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <Music className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );

  const handleCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const updateCoverPosition = (event) => {
    const rect = coverBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoverPosition({
      x: Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))),
      y: Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))),
    });
  };

  const handleCoverPointerDown = (event) => {
    if (!coverPreview) {
      coverInputRef.current?.click();
      return;
    }
    event.preventDefault();
    updateCoverPosition(event);
    const move = (moveEvent) => updateCoverPosition(moveEvent);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  };

  const openCoverEditor = () => {
    setCoverPreview(playlist.cover_url || '');
    const [x = '50%', y = '50%'] = String(playlist.cover_position || '50% 50%').split(' ');
    setCoverPosition({ x: Number(x.replace('%', '')) || 50, y: Number(y.replace('%', '')) || 50 });
    setCoverScale(Number(playlist.cover_scale || 1));
    setCoverFile(null);
    setShowCoverEditor(true);
  };

  const saveCover = async () => {
    setSavingCover(true);
    try {
      let coverUrl = coverPreview || '';
      if (coverFile) coverUrl = await storage.uploadFile(coverFile, 'songs');
      await update({
        cover_url: coverUrl,
        cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
        cover_scale: coverScale,
      });
      setShowCoverEditor(false);
      toast.success('\u041e\u0431\u043a\u043b\u0430\u0434\u0438\u043d\u043a\u0443 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043e');
    } catch (error) {
      console.error(error);
      toast.error('\u041d\u0435 \u0432\u0438\u0439\u0448\u043b\u043e \u043e\u043d\u043e\u0432\u0438\u0442\u0438 \u043e\u0431\u043a\u043b\u0430\u0434\u0438\u043d\u043a\u0443');
    } finally {
      setSavingCover(false);
    }
  };

  const renderSongCover = (song, sizeClass = 'w-10 h-10 rounded-xl') => (
    <div className={`${sizeClass} overflow-hidden bg-secondary flex-shrink-0`}>
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

  return (
    <div className="min-w-0 overflow-x-hidden px-3 sm:px-4 pb-4">
      <div className="sticky top-0 z-[80] pt-3 pb-3 mb-4 bg-background/96 backdrop-blur-xl border-b border-border/60">
        <div className="space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center hover:bg-secondary rounded-full transition-colors shrink-0"
              aria-label="Назад"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <button
              type="button"
              onClick={isOwner ? openCoverEditor : undefined}
              className={`shrink-0 rounded-3xl p-1 ${isOwner ? 'cursor-pointer hover:bg-primary/10' : ''}`}
              aria-label="Обкладинка плейлиста"
            >
              {renderPlaylistCover('w-14 h-14 rounded-2xl shadow-lg shadow-primary/10')}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Спільний плейлист</p>
              <div className="flex items-center gap-1.5 min-w-0">
                {isOwner && <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                <h1 className="min-w-0 truncate text-xl sm:text-2xl font-black text-foreground">{playlist.name || 'Спільний плейлист'}</h1>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {playlistSongs.length} {pluralSong(playlistSongs.length)} • {memberCount} {pluralMember(memberCount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handlePlayPlaylist(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary disabled:opacity-40"
              disabled={!playlistSongs.length}
              aria-label="Перемішати"
            >
              <Shuffle className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowInvite(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary"
              aria-label="Додати учасника"
            >
              <UserPlus className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddSongs(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary"
              aria-label="Додати пісні"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {((playlist.collaborator_ids || []).length > 0 || (playlist.collaborator_emails || []).length > 0) && (
        <div className="dream-scroll-row flex gap-2 mb-3 overflow-x-auto pb-1">
          {[
            { id: playlist.owner_id, label: playlist.owner_email || currentUser?.nickname || 'Власник' },
            ...(playlist.collaborator_ids || []).map(id => {
              const friend = friends.find(item => item.id === id);
              return { id, label: friend?.nickname || (playlist.collaborator_emails || [])[0] || 'Співавтор' };
            }),
            ...(!(playlist.collaborator_ids || []).length ? (playlist.collaborator_emails || []).map(email => ({ id: email, label: email })) : []),
          ].filter(item => item.id || item.label).map((member, i) => (
            <div key={member.id || member.label} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/80 border border-border/60 text-xs">
              {i === 0 && <Crown className="w-2.5 h-2.5 text-yellow-500" />}
              <span className="text-foreground max-w-[100px] truncate">{String(member.label).split('@')[0]}</span>
              {isOwner && i > 0 && (
                <button onClick={() => handleRemoveCollaborator(member.id || member.label)} className="ml-0.5 hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <PlaylistDownloadBar songs={playlistSongs} />

      {playlistSongs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Додай пісні</p>
        </motion.div>
      ) : (
        <>
          <Button onClick={() => handlePlayPlaylist(false)} className="w-full mb-3 gap-2 rounded-2xl bg-primary hover:brightness-110">
            <Play className="w-4 h-4 fill-current" /> Грати плейлист
          </Button>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout className="space-y-1">
            <AnimatePresence initial={false}>
              {playlistSongs.map((song, i) => (
                <motion.div
                  key={song.id}
                  layout
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
                >
                  <SongCard
                    song={song}
                    index={i}
                    isActive={currentSongId === song.id}
                    isPlaying={isPlaying}
                    onPlay={handlePlayFromPlaylist}
                    onToggleFavorite={onToggleFavorite}
                    onDelete={(item) => handleRemoveSong(item.id)}
                    onEdit={onEdit}
                    onAddToQueue={onAddToQueue}
                    onPlayNext={onPlayNext}
                    canFavorite={!song.user_id || song.user_id === currentUser?.id}
                    hidePlaylistActions
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <Dialog open={showAddSongs} onOpenChange={setShowAddSongs}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>Додати пісні</DialogTitle></DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-1 pt-2 -mx-1 px-1">
            {songs.map(song => {
              const isIn = (playlist.song_ids || []).includes(song.id);
              return (
                <div
                  key={song.id}
                  onClick={() => handleAddSong(song)}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isIn ? 'bg-primary/10' : 'hover:bg-secondary/60'}`}
                >
                  {renderSongCover(song, 'w-10 h-10 rounded-lg')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist || 'Невідомий'}</p>
                  </div>
                  {isIn && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" /> Запросити учасника
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {friends.filter(friend => !(playlist.collaborator_ids || []).includes(friend.id)).length ? friends.filter(friend => !(playlist.collaborator_ids || []).includes(friend.id)).map(friend => {
              const selected = (playlist.collaborator_ids || []).includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => handleInvite(friend)}
                  disabled={selected}
                  className={`w-full rounded-2xl px-3 py-3 text-left flex items-center gap-3 ${selected ? 'bg-primary/10 text-primary' : 'bg-secondary/70 hover:bg-secondary text-foreground'}`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span className="flex-1 min-w-0 truncate font-bold">{friend.nickname}</span>
                  {selected && <Check className="w-4 h-4" />}
                </button>
              );
            }) : (
              <p className="text-sm text-muted-foreground">Немає друзів для запрошення. Якщо всі уже додані, вони тут не показуються.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCoverEditor} onOpenChange={setShowCoverEditor}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{'\u041e\u0431\u043a\u043b\u0430\u0434\u0438\u043d\u043a\u0430 \u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u0430'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div
              ref={coverBoxRef}
              onPointerDown={handleCoverPointerDown}
              className="relative h-40 w-full cursor-grab touch-none overflow-hidden rounded-3xl border-2 border-dashed border-border bg-secondary flex items-center justify-center"
            >
              {coverPreview ? (
                <>
                  <img
                    src={coverPreview}
                    alt=""
                    className="h-full w-full object-cover pointer-events-none"
                    style={{
                      objectPosition: `${coverPosition.x}% ${coverPosition.y}%`,
                      transform: `scale(${coverScale})`,
                      transformOrigin: `${coverPosition.x}% ${coverPosition.y}%`,
                    }}
                  />
                  <div className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg" style={{ left: `${coverPosition.x}%`, top: `${coverPosition.y}%` }} />
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImagePlus className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-xs font-bold">{'\u0414\u043e\u0434\u0430\u0442\u0438 \u0444\u043e\u0442\u043e'}</p>
                </div>
              )}
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
            <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()} className="w-full rounded-2xl border-border">
              <ImagePlus className="w-4 h-4 mr-2" /> {'\u0412\u0438\u0431\u0440\u0430\u0442\u0438 \u0444\u043e\u0442\u043e'}
            </Button>
            {coverPreview && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">{'\u041f\u0435\u0440\u0435\u0442\u044f\u0433\u043d\u0438 \u0444\u043e\u0442\u043e \u0456 \u0437\u043c\u0456\u043d\u0438 \u043c\u0430\u0441\u0448\u0442\u0430\u0431'}</p>
                <input type="range" min="1" max="2.4" step="0.05" value={coverScale} onChange={event => setCoverScale(Number(event.target.value))} className="w-full accent-primary" />
              </div>
            )}
            <Button onClick={saveCover} disabled={savingCover} className="w-full rounded-2xl">
              {savingCover ? '\u0417\u0431\u0435\u0440\u0456\u0433\u0430\u044e...' : '\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
