import { useState, useEffect, useRef } from 'react';
import { entities, storage } from '@/api/SupabaseClient';
import { Plus, ListMusic, Pencil, Trash2, ChevronRight, ImagePlus, Globe2, Lock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Playlists({ songs, playlists: livePlaylists = [] }) {
  const [playlists, setPlaylists] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [coverPreview, setCoverPreview] = useState(null);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [coverScale, setCoverScale] = useState(1);
  const [coverFile, setCoverFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const coverRef = useRef(null);

  useEffect(() => {
    setPlaylists(livePlaylists);
  }, [livePlaylists]);

  useEffect(() => {
    if (!livePlaylists.length) loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      const data = await entities.Playlist.list();
      setPlaylists(data);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setName('');
    setEditingId(null);
    setIsPublic(false);
    setCoverPreview(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverScale(1);
    setCoverFile(null);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const updateCoverPosition = (event) => {
    const rect = coverRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoverPosition({
      x: Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))),
      y: Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))),
    });
  };

  const handleCoverPointerDown = (event) => {
    if (!coverPreview) {
      fileRef.current?.click();
      return;
    }
    event.preventDefault();
    updateCoverPosition(event);
    const move = (moveEvent) => updateCoverPosition(moveEvent);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true });
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setUploading(true);
    try {
      let coverUrl = null;
      if (coverFile) coverUrl = await storage.uploadFile(coverFile, 'songs');

      if (editingId) {
        const update = { name: name.trim(), is_public: isPublic, cover_position: `${coverPosition.x}% ${coverPosition.y}%`, cover_scale: coverScale };
        if (coverUrl) update.cover_url = coverUrl;
        const updated = await entities.Playlist.update(editingId, update);
        setPlaylists(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
        toast.success('Змінено');
      } else {
        const playlist = await entities.Playlist.create({
          name: name.trim(),
          song_ids: [],
          cover_url: coverUrl || '',
          cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
          cover_scale: coverScale,
          is_public: isPublic,
        });
        setPlaylists(prev => [playlist, ...prev]);
        toast.success('Плейлист створено');
      }

      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error('Помилка збереження');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (playlist) => {
    try {
      await entities.Playlist.delete(playlist.id);
      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      toast.success('Видалено');
    } catch (err) {
      console.error(err);
      toast.error('Не вийшло видалити плейлист');
    }
  };

  const openEdit = (playlist) => {
    setEditingId(playlist.id);
    setName(playlist.name);
    setIsPublic(Boolean(playlist.is_public));
    setCoverPreview(playlist.cover_url || null);
    const [x = '50%', y = '50%'] = String(playlist.cover_position || '50% 50%').split(' ');
    setCoverPosition({ x: Number(x.replace('%', '')) || 50, y: Number(y.replace('%', '')) || 50 });
    setCoverScale(Number(playlist.cover_scale || 1));
    setCoverFile(null);
    setShowCreate(true);
  };

  const getPlaylistCover = (playlist) => {
    if (playlist.cover_url) return playlist.cover_url;
    if (!playlist.song_ids?.length) return null;
    return songs.find(s => s.id === playlist.song_ids[0])?.cover_url || null;
  };

  return (
    <div className="px-3 sm:px-4 pb-4">
      <div className="sticky top-0 z-50 pt-3 pb-3 mb-6 bg-background/92 backdrop-blur-xl border-b border-border/60">
        <div className="pl-16 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-foreground">Плейлисти</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{playlists.length} плейлистів</p>
          </div>
          <Button
            onClick={() => { resetForm(); setShowCreate(true); }}
            size="sm"
            className="bg-primary hover:brightness-110 text-primary-foreground rounded-xl gap-1.5"
          >
            <Plus className="w-4 h-4" /> Новий
          </Button>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-16">
          <ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Створи свій перший плейлист</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {playlists.map((playlist, i) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group flex min-h-[96px] items-center gap-2 rounded-2xl bg-card/90 border border-border p-3 shadow-md shadow-primary/5 hover:bg-secondary/60 transition-all"
            >
              <Link to={`/playlists/${playlist.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-secondary flex-shrink-0 shadow-md">
                  {getPlaylistCover(playlist) ? (
                    <img
                      src={getPlaylistCover(playlist)}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: playlist.cover_position || '50% 50%',
                        transform: `scale(${Number(playlist.cover_scale || 1)})`,
                        transformOrigin: playlist.cover_position || '50% 50%',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-black text-foreground truncate">{playlist.name}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground flex items-center gap-1.5 truncate">
                    {playlist.is_public ? <Globe2 className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{playlist.is_public ? 'Публічний' : 'Приватний'} · {playlist.song_ids?.length || 0} пісень</span>
                  </p>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="min-h-10 min-w-10 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Дії плейлиста">
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border rounded-2xl shadow-xl min-w-44">
                  <DropdownMenuItem onClick={() => openEdit(playlist)} className="rounded-xl">
                    <Pencil className="w-4 h-4 mr-2" /> Редагувати
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(playlist)} className="rounded-xl text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Видалити
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ChevronRight className="hidden sm:block w-5 h-5 text-muted-foreground flex-shrink-0" />
            </motion.div>
          ))}
        </motion.div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-sm w-[calc(100vw-2rem)] mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редагувати плейлист' : 'Новий плейлист'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div
              ref={coverRef}
              onPointerDown={handleCoverPointerDown}
              onDoubleClick={() => fileRef.current?.click()}
              className="w-full h-32 rounded-xl overflow-hidden bg-secondary border-2 border-dashed border-border cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors flex items-center justify-center touch-none relative"
            >
              {coverPreview ? (
                <>
                  <img
                    src={coverPreview}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      objectPosition: `${coverPosition.x}% ${coverPosition.y}%`,
                      transform: `scale(${coverScale})`,
                      transformOrigin: `${coverPosition.x}% ${coverPosition.y}%`,
                    }}
                  />
                  <div
                    className="absolute w-3 h-3 rounded-full border-2 border-white bg-primary shadow-lg shadow-primary/30 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${coverPosition.x}%`, top: `${coverPosition.y}%` }}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-xs">Додати обкладинку</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
            {coverPreview && (
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">{'\u041f\u0435\u0440\u0435\u0442\u044f\u0433\u043d\u0438 \u0444\u043e\u0442\u043e, \u0430\u0431\u043e \u0437\u043c\u0456\u043d\u0438 \u043c\u0430\u0441\u0448\u0442\u0430\u0431'}</p>
                <input
                  type="range"
                  min="1"
                  max="2.4"
                  step="0.05"
                  value={coverScale}
                  onChange={event => setCoverScale(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            )}

            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Назва плейлиста..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />

            <button
              type="button"
              onClick={() => setIsPublic(value => !value)}
              className={`w-full rounded-2xl border p-3 text-left flex items-center gap-3 ${isPublic ? 'border-primary bg-primary/10' : 'border-border bg-secondary/70'}`}
            >
              {isPublic ? <Globe2 className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-bold text-foreground">{isPublic ? 'Публічний' : 'Приватний'}</p>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? 'Буде показуватись у профілі' : 'Не показується у профілі'}
                </p>
              </div>
            </button>

            <Button onClick={handleCreate} disabled={!name.trim() || uploading} className="w-full bg-primary hover:brightness-110">
              {uploading ? 'Збереження...' : editingId ? 'Зберегти' : 'Створити'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
