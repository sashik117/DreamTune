import { useRef } from 'react';
import { Users, Plus, Trash2, Music, Crown, MoreVertical, Pencil, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import CollabPlaylistDetail from './CollabPlaylistDetail';
import ImageCropBox from '@/components/ImageCropBox';
import { useCollabPlaylistsPage } from '@/features/playlists/model/useCollabPlaylistsPage';

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
  const coverInputRef = useRef(null);
  const {
    coverPosition,
    coverPreview,
    coverScale,
    currentUser,
    editingPlaylist,
    handleCoverSelect,
    handleCreate,
    handleDelete,
    handleDetailDeleted,
    handleDetailUpdated,
    loading,
    newName,
    openCreateDialog,
    openDetail,
    openEditDialog,
    playlists,
    saving,
    setCoverPosition,
    setCoverScale,
    setNewName,
    setOpenDetail,
    setShowCreate,
    showCreate,
  } = useCollabPlaylistsPage();

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
        onUpdated={handleDetailUpdated}
        onDeleted={handleDetailDeleted}
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
              <Users className="w-5 h-5 text-primary shrink-0" /> Shared
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{playlists.length} playlists</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={openCreateDialog}
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
          <p className="text-muted-foreground text-sm font-medium">Create your first collaborative playlist</p>
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
                    <p className="text-xs text-muted-foreground">{songCount} songs · {collabCount + 1} members</p>
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
                          aria-label="Collaborative playlist actions"
                        >
                          <MoreVertical className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[140] bg-card border-border rounded-2xl shadow-xl min-w-52" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); openEditDialog(pl); }} className="rounded-xl">
                          <Pencil className="w-4 h-4 mr-2" /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); openEditDialog(pl); }} className="rounded-xl">
                          <ImagePlus className="w-4 h-4 mr-2" /> Add photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(pl)} className="rounded-xl text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
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

      <Dialog open={showCreate} onOpenChange={(value) => { setShowCreate(value); if (!value) resetForm(); }}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> {editingPlaylist ? 'Edit collaborative playlist' : 'New collaborative playlist'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <ImageCropBox
              preview={coverPreview}
              position={coverPosition}
              scale={coverScale}
              onPositionChange={setCoverPosition}
              onScaleChange={setCoverScale}
              onPick={() => coverInputRef.current?.click()}
              emptyLabel="Add photo"
              className="mx-auto w-full max-w-[220px] rounded-3xl"
            />
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
            {coverPreview && <p className="text-center text-[11px] text-muted-foreground">Drag the photo or pinch to zoom</p>}
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Playlist name..."
              className="bg-secondary border-border rounded-xl"
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent?.isComposing && handleCreate()}
              autoFocus
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || saving} className="w-full rounded-xl">
              {saving ? 'Saving...' : editingPlaylist ? 'Save' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
