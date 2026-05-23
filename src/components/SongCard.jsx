import { Play, Pause, MoreVertical, Trash2, WifiOff, Pencil, ListEnd, ListStart, ListPlus, ListMinus, CheckSquare, Square } from 'lucide-react';
import CoverArt from './CoverArt';
import FavoriteButton from './FavoriteButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
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
  onRemoveFromPlaylist,
  staggerIndex,
  playlists = [],
  onAddSongsToPlaylist,
  hidePlaylistActions = false,
  selectionMode = false,
  selected = false,
  onSelectToggle,
  canFavorite = true,
}) {
  const addToPlaylist = async (playlist) => {
    await onAddSongsToPlaylist?.([song.id], playlist.id);
    toast.success(`Added to "${playlist.name}"`);
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
      <motion.div
        whileHover={{ scale: 1.01, y: -1 }}
        whileTap={{ scale: 0.98 }}
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
                  <div
                    key={j}
                    className="w-0.5 bg-white rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${j * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </CoverArt>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>{song.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{song.artist || 'Unknown artist'}</p>
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
            <DropdownMenuContent align="end" collisionPadding={12} className="z-[140] bg-card border-border rounded-2xl shadow-xl min-w-52 max-w-[calc(100vw-1.5rem)]">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(song)} className="rounded-xl">
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {!hidePlaylistActions && playlists.length > 0 && onAddSongsToPlaylist && (
                <div className="py-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-black text-muted-foreground">
                    <ListPlus className="w-4 h-4" /> Add to playlist
                  </div>
                  <div className="max-h-[42dvh] overflow-y-auto overscroll-contain pr-1">
                    {playlists.map(playlist => (
                      <DropdownMenuItem key={playlist.id} onClick={() => addToPlaylist(playlist)} className="rounded-xl">
                        <span className="truncate">{playlist.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </div>
              )}
              {onPlayNext && (
                <DropdownMenuItem onClick={() => { onPlayNext(song); toast.success('Will play next'); }} className="rounded-xl">
                  <ListStart className="w-4 h-4 mr-2" /> Play next
                </DropdownMenuItem>
              )}
              {onAddToQueue && (
                <DropdownMenuItem onClick={() => { onAddToQueue(song); toast.success('Added to queue'); }} className="rounded-xl">
                  <ListEnd className="w-4 h-4 mr-2" /> Add to queue
                </DropdownMenuItem>
              )}
              {onRemoveFromPlaylist && (
                <DropdownMenuItem onClick={() => onRemoveFromPlaylist(song)} className="rounded-xl">
                  <ListMinus className="w-4 h-4 mr-2" /> Remove from playlist
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={() => onDelete(song)} className="text-destructive focus:text-destructive rounded-xl">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    </motion.div>
  );
}
