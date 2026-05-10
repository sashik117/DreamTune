import { useState, useEffect } from 'react';
import { supabase, entities, auth } from '@/api/SupabaseClient';
import { Users, Plus, Trash2, Music, Crown, MoreVertical, Pencil, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import CollabPlaylistDetail from './CollabPlaylistDetail';

export default function CollabPlaylists({
  songs,
  playlists: allPlaylists,
  onPlayPlaylist,
  onAddSongsToPlaylist,
  onPlay,
  currentSongId,
  isPlaying,
  onToggleFavorite,
  onEdit,
  onAddToQueue,
  onPlayNext,
}) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [openDetail, setOpenDetail] = useState(null);

  useEffect(() => {
    loadData();
    auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dreamtune:collab-detail', { detail: { open: Boolean(openDetail) } }));
    return () => {
      window.dispatchEvent(new CustomEvent('dreamtune:collab-detail', { detail: { open: false } }));
    };
  }, [openDetail]);

  useEffect(() => {
    const channel = supabase
      .channel('collab_playlists_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_playlists' }, (payload) => {
        if (payload.new?.owner_id !== currentUser?.id && !(payload.new?.collaborator_ids || []).includes(currentUser?.id) && payload.new?.access_level !== 'public') return;
        setPlaylists(prev => prev.some(item => item.id === payload.new.id) ? prev.map(item => item.id === payload.new.id ? payload.new : item) : [payload.new, ...prev]);
        toast(`Створено спільний плейлист "${payload.new.name}"`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'collab_playlists' }, (payload) => {
        const hasAccess = payload.new?.owner_id === currentUser?.id || (payload.new?.collaborator_ids || []).includes(currentUser?.id) || payload.new?.access_level === 'public';
        if (!hasAccess) {
          setPlaylists(prev => prev.filter(p => p.id !== payload.new?.id));
          return;
        }
        setPlaylists(prev => prev.some(p => p.id === payload.new.id) ? prev.map(p => p.id === payload.new.id ? payload.new : p) : [payload.new, ...prev]);
        if (payload.new.last_edited_by && payload.new.last_edited_by !== currentUser?.email) {
          toast(`${payload.new.last_edited_by} оновив "${payload.new.name}"`);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'collab_playlists' }, (payload) => {
        setPlaylists(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const loadData = async () => {
    try {
      const data = await entities.CollabPlaylist.list();
      const unique = Array.from(new Map((data || []).map(item => [item.id, item])).values());
      setPlaylists(unique);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await entities.CollabPlaylist.create({
        name: newName.trim(),
        song_ids: [],
        collaborator_ids: [],
      });
      setNewName('');
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error('Помилка створення');
    }
  };

  const handleDelete = async (pl) => {
    try {
      await entities.CollabPlaylist.delete(pl.id);
      toast.success('Плейлист видалено');
    } catch (err) {
      console.error(err);
    }
  };

  const getCoversFromIds = (ids) =>
    (ids || [])
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean)
      .filter(s => s.cover_url)
      .slice(0, 4)
      .map(s => s.cover_url);

  if (openDetail) {
    return (
      <CollabPlaylistDetail
        playlist={openDetail}
        songs={songs}
        onPlayPlaylist={onPlayPlaylist}
        playlists={allPlaylists}
        onAddSongsToPlaylist={onAddSongsToPlaylist}
        onPlay={onPlay}
        currentSongId={currentSongId}
        isPlaying={isPlaying}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        currentUser={currentUser}
        onBack={() => setOpenDetail(null)}
        onUpdated={(updated) => setPlaylists(prev => prev.map(p => p.id === updated.id ? updated : p))}
        onDeleted={(deletedId) => {
          setPlaylists(prev => prev.filter(p => p.id !== deletedId));
          setOpenDetail(null);
        }}
      />
    );
  }

  return (
    <div className="px-3 sm:px-4 pb-4">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 pt-3 pb-3 mb-5 bg-background/92 backdrop-blur-xl border-b border-border/60"
      >
        <div className="pl-16 flex items-center gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-muted-foreground">DreamTune</p>
            <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2 truncate">
              <Users className="w-5 h-5 text-primary shrink-0" /> {'\u0421\u043f\u0456\u043b\u044c\u043d\u0456'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{playlists.length} {'\u043f\u043b\u0435\u0439\u043b\u0438\u0441\u0442\u0456\u0432'}</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowCreate(true)}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            aria-label="Create collab playlist"
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />)}
        </div>
      ) : playlists.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Users className="w-10 h-10 text-primary/50" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Створи перший спільний плейлист</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {playlists.map((pl, i) => {
              const covers = getCoversFromIds(pl.song_ids);
              const songCount = (pl.song_ids || []).length;
              const collabCount = (pl.collaborator_ids || []).length || (pl.collaborator_emails || []).length;
              const isOwner = pl.owner_id === currentUser?.id || pl.owner_email === currentUser?.email;

              return (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.015, y: -1 }}
                  onClick={() => setOpenDetail(pl)}
                  className="flex min-h-[96px] items-center gap-2 rounded-2xl bg-card/90 border border-border/60 p-3 cursor-pointer shadow-md shadow-primary/5 hover:shadow-lg hover:shadow-primary/10 transition-shadow"
                >
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-secondary flex-shrink-0 relative shadow-md">
                    {pl.cover_url ? (
                      <img src={pl.cover_url} alt="" className="w-full h-full object-cover" style={{ objectPosition: pl.cover_position || '50% 50%', transform: `scale(${Number(pl.cover_scale || 1)})`, transformOrigin: pl.cover_position || '50% 50%' }} />
                    ) : covers.length >= 4 ? (
                      <div className="grid grid-cols-2 gap-0 w-full h-full">
                        {covers.slice(0, 4).map((url, ci) => (
                          <img key={ci} src={url} alt="" className="w-full h-full object-cover" />
                        ))}
                      </div>
                    ) : covers.length > 0 ? (
                      <img src={covers[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/15 to-accent/20">
                        <Music className="w-6 h-6 text-primary/50" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {isOwner && <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                      <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="text-base font-black text-foreground truncate">{pl.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{songCount} пісень · {collabCount + 1} учасників</p>
                    {pl.last_edited_by && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{pl.last_edited_by}</p>
                    )}
                  </div>

                  {isOwner && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="relative z-20 min-h-10 min-w-10 rounded-full hover:bg-secondary flex items-center justify-center"
                          aria-label="Дії спільного плейлиста"
                        >
                          <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[140] bg-card border-border rounded-2xl shadow-xl min-w-52" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setOpenDetail(pl)} className="rounded-xl">
                          <Pencil className="w-4 h-4 mr-2" /> Перейменувати
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setOpenDetail(pl)} className="rounded-xl">
                          <ImagePlus className="w-4 h-4 mr-2" /> Додати фото
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(pl)} className="rounded-xl text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Видалити
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Новий спільний плейлист
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Назва плейлиста..."
              className="bg-secondary border-border rounded-xl"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button onClick={handleCreate} disabled={!newName.trim()} className="w-full rounded-xl">
              Створити
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
