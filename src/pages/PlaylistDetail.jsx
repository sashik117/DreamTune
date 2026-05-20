import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { entities, storage } from '@/api/SupabaseClient';
import { ArrowLeft, Plus, Music, Check, Shuffle, Play, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SongCard from '../components/SongCard';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import ImageCropBox from '@/components/ImageCropBox';
import { formatPlaylistDuration, getPlaylistSeconds } from '@/utils/duration';

export default function PlaylistDetail({
  songs,
  playlists,
  currentSongId,
  isPlaying,
  onToggleFavorite,
  onDelete,
  onEdit,
  onAddToQueue,
  onPlayNext,
  onPlayPlaylist,
}) {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [coverScale, setCoverScale] = useState(1);
  const [savingCover, setSavingCover] = useState(false);
  const coverInputRef = useRef(null);

  useEffect(() => { loadPlaylist(); }, [id]);

  useEffect(() => {
    const livePlaylist = playlists?.find(item => item.id === id);
    if (livePlaylist) setPlaylist(livePlaylist);
  }, [playlists, id]);

  const loadPlaylist = async () => {
    try {
      const pl = await entities.Playlist.get(id);
      setPlaylist(pl);
    } catch (err) {
      console.error('Failed to load playlist:', err);
    }
  };

  const playlistSongs = playlist
    ? (playlist.song_ids || []).map(songId => songs.find(song => song.id === songId)).filter(Boolean)
    : [];

  const playlistCoverSongs = playlistSongs.filter(song => song.cover_url).slice(0, 4);
  const playlistDuration = formatPlaylistDuration(getPlaylistSeconds(playlistSongs));

  const pluralSong = (count) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'пісня';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пісні';
    return 'пісень';
  };

  const renderPlaylistCover = () => (
    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-secondary shrink-0 shadow-lg shadow-primary/10 flex items-center justify-center">
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
          {playlistCoverSongs.map(song => (
            <img key={song.id} src={song.cover_url} alt="" className="w-full h-full object-cover" />
          ))}
        </div>
      ) : playlistCoverSongs.length ? (
        <img src={playlistCoverSongs[0].cover_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <Music className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
  );

  const handleAddSong = async (song) => {
    const currentIds = playlist.song_ids || [];
    const newIds = currentIds.includes(song.id)
      ? currentIds.filter(item => item !== song.id)
      : [...currentIds, song.id];
    try {
      await entities.Playlist.update(playlist.id, { song_ids: newIds });
      setPlaylist(prev => ({ ...prev, song_ids: newIds }));
    } catch (err) {
      console.error(err);
      toast.error('Помилка оновлення');
    }
  };

  const handleRemoveSong = async (song) => {
    if (!playlist || !song?.id) return;
    const newIds = (playlist.song_ids || []).filter(item => item !== song.id);
    try {
      await entities.Playlist.update(playlist.id, { song_ids: newIds });
      setPlaylist(prev => ({ ...prev, song_ids: newIds }));
      toast.success('Пісню прибрано з плейлиста');
    } catch (err) {
      console.error(err);
      toast.error('Не вийшло прибрати пісню');
    }
  };

  const handlePlayPlaylist = (shouldShuffle) => {
    if (!playlistSongs.length) return;
    onPlayPlaylist?.(playlistSongs, { shuffle: shouldShuffle });
    toast.success(shouldShuffle ? `Плейлист "${playlist.name}" перемішано` : `Грає "${playlist.name}"`);
  };

  const handlePlayFromPlaylist = (song) => {
    onPlayPlaylist?.(playlistSongs, { startSongId: song.id });
  };

  const openCoverEditor = () => {
    if (!playlist) return;
    setCoverPreview(playlist.cover_url || '');
    const [x = '50%', y = '50%'] = String(playlist.cover_position || '50% 50%').split(' ');
    setCoverPosition({ x: Number(x.replace('%', '')) || 50, y: Number(y.replace('%', '')) || 50 });
    setCoverScale(Number(playlist.cover_scale || 1));
    setCoverFile(null);
    setShowCoverEditor(true);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const saveCover = async () => {
    if (!playlist) return;
    setSavingCover(true);
    try {
      let coverUrl = coverPreview || '';
      if (coverFile) coverUrl = await storage.uploadFile(coverFile, 'songs');
      const updated = await entities.Playlist.update(playlist.id, {
        cover_url: coverUrl,
        cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
        cover_scale: coverScale,
      });
      setPlaylist(prev => ({ ...prev, ...updated }));
      setShowCoverEditor(false);
      toast.success('Обкладинку оновлено');
    } catch (error) {
      console.error(error);
      toast.error('Не вийшло оновити обкладинку');
    } finally {
      setSavingCover(false);
    }
  };

  const renderSongCover = (song) => (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
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

  if (!playlist) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-w-0 overflow-x-hidden px-3 sm:px-4 pb-4">
      <div className="sticky top-0 z-[80] pt-3 pb-3 mb-4 bg-background/96 backdrop-blur-xl border-b border-border/60">
        <div className="space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/playlists" className="h-10 w-10 flex items-center justify-center hover:bg-secondary rounded-full transition-colors shrink-0" aria-label="Назад">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </Link>
            <button
              type="button"
              onClick={openCoverEditor}
              className="shrink-0 rounded-3xl p-1 cursor-pointer hover:bg-primary/10"
              aria-label="Обкладинка плейлиста"
            >
              {renderPlaylistCover()}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Плейлист</p>
              <h1 className="min-w-0 truncate text-xl sm:text-2xl font-black text-foreground">{playlist.name || 'Плейлист'}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {playlistSongs.length} {pluralSong(playlistSongs.length)} • {playlistDuration} • {playlist.is_public ? 'Публічний' : 'Приватний'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handlePlayPlaylist(true)}
              disabled={!playlistSongs.length}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary disabled:opacity-40"
              aria-label="Перемішати"
            >
              <Shuffle className="w-4 h-4" />
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

      {playlistSongs.length === 0 ? (
        <div className="text-center py-16">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Додай пісні до плейлиста</p>
        </div>
      ) : (
        <>
          <Button onClick={() => handlePlayPlaylist(false)} className="w-full mb-3 gap-2 rounded-2xl bg-primary hover:brightness-110">
            <Play className="w-4 h-4 fill-current" /> Грати плейлист
          </Button>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
            {playlistSongs.map((song, i) => (
              <SongCard
                key={song.id}
                song={song}
                index={i}
                isActive={currentSongId === song.id}
                isPlaying={isPlaying}
                onPlay={handlePlayFromPlaylist}
                onToggleFavorite={onToggleFavorite}
                onDelete={onDelete}
                onRemoveFromPlaylist={handleRemoveSong}
                onEdit={onEdit}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                hidePlaylistActions
              />
            ))}
          </motion.div>
        </>
      )}

      <Dialog open={showAddSongs} onOpenChange={setShowAddSongs}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[80dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Додати пісні</DialogTitle></DialogHeader>
          <div className="space-y-1 pt-2">
            {songs.map(song => {
              const isIn = (playlist.song_ids || []).includes(song.id);
              return (
                <div key={song.id} onClick={() => handleAddSong(song)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isIn ? 'bg-primary/10' : 'hover:bg-secondary/60'}`}>
                  {renderSongCover(song)}
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

      <Dialog open={showCoverEditor} onOpenChange={setShowCoverEditor}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Обкладинка плейлиста</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <ImageCropBox
              preview={coverPreview}
              position={coverPosition}
              scale={coverScale}
              onPositionChange={setCoverPosition}
              onScaleChange={setCoverScale}
              onPick={() => coverInputRef.current?.click()}
              emptyLabel="Додати фото"
              className="mx-auto w-full max-w-[240px] rounded-3xl"
            />
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
            <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()} className="w-full rounded-2xl border-border">
              <ImagePlus className="w-4 h-4 mr-2" /> Вибрати фото
            </Button>
            {coverPreview && <p className="text-center text-[11px] text-muted-foreground">Перетягни фото або розведи пальці для масштабу</p>}
            <Button onClick={saveCover} disabled={savingCover} className="w-full rounded-2xl">
              {savingCover ? 'Зберігаю...' : 'Зберегти'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
