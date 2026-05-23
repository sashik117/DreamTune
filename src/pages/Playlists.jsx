import { useState, useEffect, useRef } from 'react';
import { entities, storage } from '@/api/SupabaseClient';
import { Plus, ListMusic, Pencil, Trash2, ChevronRight, Globe2, Lock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ImageCropBox from '@/components/ImageCropBox';

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
  const savingRef = useRef(false);

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
    event.target.value = '';
  };

  const handleCreate = async () => {
    if (!name.trim() || savingRef.current) return;
    savingRef.current = true;
    setUploading(true);
    try {
      const cleanName = name.trim();
      let coverUrl = null;
      if (coverFile) coverUrl = await storage.uploadFile(coverFile, 'songs');

      if (editingId) {
        const update = { name: cleanName, is_public: isPublic, cover_position: `${coverPosition.x}% ${coverPosition.y}%`, cover_scale: coverScale };
        if (coverUrl) update.cover_url = coverUrl;
        const updated = await entities.Playlist.update(editingId, update);
        setPlaylists(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
        toast.success('Updated');
      } else {
        const playlist = await entities.Playlist.create({
          name: cleanName,
          song_ids: [],
          cover_url: coverUrl || '',
          cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
          cover_scale: coverScale,
          is_public: isPublic,
        });
        setPlaylists(prev => prev.some(item => item.id === playlist.id) ? prev : [playlist, ...prev]);
        toast.success('Playlist created');
      }

      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
    } finally {
      setUploading(false);
      savingRef.current = false;
    }
  };

  const handleDelete = async (playlist) => {
    try {
      await entities.Playlist.delete(playlist.id);
      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      toast.success('Deleted');
    } catch (err) {
      console.error(err);
      toast.error('Could not delete playlist');
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
            <h1 className="text-2xl font-black text-foreground">Playlists</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{playlists.length} playlists</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { resetForm(); setShowCreate(true); }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))' }}
            aria-label="New playlist"
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {playlists.length === 0 ? (
        <div className="text-center py-16">
          <ListMusic className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Create your first playlist</p>
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
                    <span className="truncate">{playlist.is_public ? 'Public' : 'Private'} · {playlist.song_ids?.length || 0} songs</span>
                  </p>
                </div>
              </Link>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-20 min-h-10 min-w-10 rounded-full hover:bg-secondary flex items-center justify-center"
                    aria-label="Playlist actions"
                  >
                    <MoreVertical className="w-5 h-5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[140] bg-card border-border rounded-2xl shadow-xl min-w-44" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); openEdit(playlist); }} className="rounded-xl">
                    <Pencil className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(playlist)} className="rounded-xl text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
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
            <DialogTitle>{editingId ? 'Edit playlist' : 'New playlist'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <ImageCropBox
              preview={coverPreview}
              position={coverPosition}
              scale={coverScale}
              onPositionChange={setCoverPosition}
              onScaleChange={setCoverScale}
              onPick={() => fileRef.current?.click()}
              emptyLabel="Add cover"
              className="mx-auto w-full max-w-[220px] rounded-3xl"
            />
            <input ref={fileRef} type="file" accept="image/*" onChange={handleCoverSelect} className="hidden" />
            {coverPreview && (
              <p className="text-center text-[11px] text-muted-foreground">Drag the photo or pinch to zoom</p>
            )}

            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Playlist name..."
              className="bg-secondary border-border"
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent?.isComposing && handleCreate()}
              autoFocus
            />

            <button
              type="button"
              onClick={() => setIsPublic(value => !value)}
              className={`w-full rounded-2xl border p-3 text-left flex items-center gap-3 ${isPublic ? 'border-primary bg-primary/10' : 'border-border bg-secondary/70'}`}
            >
              {isPublic ? <Globe2 className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
              <div>
                <p className="text-sm font-bold text-foreground">{isPublic ? 'Public' : 'Private'}</p>
                <p className="text-xs text-muted-foreground">
                  {isPublic ? 'Visible on your profile' : 'Hidden from your profile'}
                </p>
              </div>
            </button>

            <Button onClick={handleCreate} disabled={!name.trim() || uploading} className="w-full bg-primary hover:brightness-110">
              {uploading ? 'Saving...' : editingId ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
