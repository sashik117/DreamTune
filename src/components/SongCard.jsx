import { useState } from 'react';
import { Play, Pause, MoreVertical, Trash2, WifiOff, Pencil, ListEnd, ListStart, ListPlus, CheckSquare, Square } from 'lucide-react';
import CoverArt from './CoverArt';
import FavoriteButton from './FavoriteButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { toast } from 'sonner';

export default function SongCard({
  song,
  isActive,
  isPlaying,
  onPlay,
  onToggleFavorite,
  onDelete,
  index,
  isCached,
  onEdit,
  onAddToQueue,
  onPlayNext,
  staggerIndex,
  playlists = [],
  onAddSongsToPlaylist,
  hidePlaylistActions = false,
  selectionMode = false,
  selected = false,
  onSelectToggle,
  canFavorite = true,
}) {
  const [swiped, setSwiped] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-80, 0, 80], [0.5, 1, 0.5]);
  const hintOpacityUp = useTransform(y, [-80, -30, 0], [1, 0.6, 0]);
  const hintOpacityDown = useTransform(y, [0, 30, 80], [0, 0.6, 1]);

  const handleDragEnd = (_, info) => {
    if (selectionMode) return;
    const threshold = 55;
    if (info.offset.y < -threshold) {
      if (navigator.vibrate) navigator.vibrate(30);
      setSwiped(true);
      setTimeout(() => {
        setSwiped(false);
        y.set(0);
        onPlayNext?.(song);
        toast.success('Грати наступною');
      }, 350);
    } else if (info.offset.y > threshold) {
      if (navigator.vibrate) navigator.vibrate(30);
      setSwiped(true);
      setTimeout(() => {
        setSwiped(false);
        y.set(0);
        onAddToQueue?.(song);
        toast.success('Додано в чергу');
      }, 350);
    } else {
      y.set(0);
    }
  };

  const addToPlaylist = async (playlist) => {
    await onAddSongsToPlaylist?.([song.id], playlist.id);
    toast.success(`Додано в "${playlist.name}"`);
  };

  const handleCardClick = () => {
    if (selectionMode) onSelectToggle?.(song.id);
    else onPlay(song);
  };

  return (
    <motion.div
      className="relative"
      initial={staggerIndex !== undefined ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={staggerIndex !== undefined ? { delay: staggerIndex * 0.025, duration: 0.28, ease: [0.25, 1, 0.5, 1] } : {}}
    >
      {!selectionMode && (
        <>
          <motion.div style={{ opacity: hintOpacityUp }}
            className="absolute inset-0 rounded-2xl bg-primary/10 flex items-center justify-center gap-2 pointer-events-none z-0">
            <ListStart className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Грати наступною</span>
          </motion.div>
          <motion.div style={{ opacity: hintOpacityDown }}
            className="absolute inset-0 rounded-2xl bg-accent/15 flex items-center justify-center gap-2 pointer-events-none z-0">
            <ListEnd className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-accent">В кінець черги</span>
          </motion.div>
        </>
      )}

      <motion.div
        drag={selectionMode ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.28}
        style={{ y, opacity }}
        onDragEnd={handleDragEnd}
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
        animate={swiped ? { opacity: 0, scale: 0.88 } : { opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className={`group relative z-10 flex items-center gap-3 px-3 sm:px-4 py-3 rounded-2xl cursor-pointer transition-shadow border
          ${selected
            ? 'bg-primary/15 border-primary/60 shadow-md shadow-primary/15'
            : isActive
              ? 'bg-primary/10 border-primary/30 shadow-md shadow-primary/10'
              : 'bg-card/95 border-border hover:bg-card hover:shadow-lg hover:shadow-primary/10'
          }`}
        onClick={handleCardClick}
      >
        {selectionMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); onSelectToggle?.(song.id); }}
            className="w-7 flex items-center justify-center flex-shrink-0 text-primary"
          >
            {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-7 text-center flex-shrink-0">
            <span className={`text-sm group-hover:hidden ${isActive ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
              {index + 1}
            </span>
            <div className="hidden group-hover:flex items-center justify-center">
              {isActive && isPlaying
                ? <Pause className="w-4 h-4 text-primary" />
                : <Play className="w-4 h-4 text-primary" />
              }
            </div>
          </div>
        )}

        <CoverArt song={song} className="w-11 h-11 rounded-xl flex-shrink-0 shadow-sm" fallbackClassName="text-xs">
          {isCached && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-card flex items-center justify-center">
              <WifiOff className="w-1.5 h-1.5 text-white" />
            </div>
          )}
          {isActive && isPlaying && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-xl">
              <div className="flex gap-0.5 items-end h-4">
                {[60, 100, 45, 80].map((h, j) => (
                  <div key={j} className="w-0.5 bg-white rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${j * 120}ms` }} />
                ))}
              </div>
            </div>
          )}
        </CoverArt>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{song.artist || 'Невідомий'}</p>
        </div>

        <div className="flex items-center gap-0.5 opacity-100" onClick={e => e.stopPropagation()}>
          {canFavorite && onToggleFavorite && (
            <FavoriteButton active={Boolean(song.is_favorite)} onClick={(_, nextFavorite) => onToggleFavorite(song, nextFavorite)} />
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <motion.button
                type="button"
                whileTap={{ scale: 0.82 }}
                onPointerDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                className="relative z-20 p-2 hover:bg-muted rounded-full transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[140] bg-card border-border rounded-2xl shadow-xl min-w-52">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(song)} className="rounded-xl">
                  <Pencil className="w-4 h-4 mr-2" /> Редагувати
                </DropdownMenuItem>
              )}
              {!hidePlaylistActions && playlists.length > 0 && onAddSongsToPlaylist && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="rounded-xl">
                    <ListPlus className="w-4 h-4 mr-2" /> Додати в плейлист
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="bg-card border-border rounded-2xl shadow-xl min-w-48">
                    {playlists.map(playlist => (
                      <DropdownMenuItem key={playlist.id} onClick={() => addToPlaylist(playlist)} className="rounded-xl">
                        {playlist.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {onPlayNext && (
                <DropdownMenuItem onClick={() => { onPlayNext(song); toast.success('Грати наступною'); }} className="rounded-xl">
                  <ListStart className="w-4 h-4 mr-2" /> Грати наступною
                </DropdownMenuItem>
              )}
              {onAddToQueue && (
                <DropdownMenuItem onClick={() => { onAddToQueue(song); toast.success('Додано в чергу'); }} className="rounded-xl">
                  <ListEnd className="w-4 h-4 mr-2" /> В кінець черги
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDelete(song)} className="text-destructive focus:text-destructive rounded-xl">
                <Trash2 className="w-4 h-4 mr-2" /> Видалити
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </motion.div>
  );
}
