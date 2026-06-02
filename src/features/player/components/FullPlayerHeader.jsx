import { ChevronDown, ListMusic, ListPlus, MoreVertical, Plus, Scissors, Share2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { PLAYER_TABS as TABS } from '@/features/player/model/playerUi';

export default function FullPlayerHeader({
  dragControls,
  tab,
  onTabChange,
  onCollapse,
  showMoreMenu,
  onToggleMoreMenu,
  showPlaylistPicker,
  onTogglePlaylistPicker,
  playlists = [],
  onAddToPlaylist,
  onAddCurrentToQueue,
  onEditCurrent,
  onShare,
  onOpenQueue,
}) {
  return (
    <div
      className="app-chrome-surface fixed left-0 right-0 top-0 z-[90] flex items-center justify-between px-5 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-2 border-b border-border/40 touch-none cursor-grab active:cursor-grabbing"
      onPointerDown={(event) => {
        const interactive = event.target.closest?.('button,a,input,[role="button"]');
        if (!interactive || interactive.dataset.playerDragHandle === 'true') dragControls.start(event);
      }}
    >
      <motion.button data-player-drag-handle="true" whileTap={{ scale: 0.88 }} onClick={onCollapse} className="p-2 -ml-2 bg-card/90 border border-border/70 shadow-lg shadow-primary/10 hover:bg-secondary rounded-full transition-colors">
        <ChevronDown className="w-6 h-6 text-foreground" />
      </motion.button>

      <div className="flex bg-card/95 backdrop-blur-xl rounded-full p-1 gap-1 border border-border/80 shadow-lg shadow-primary/10">
        {TABS.map(item => (
          <motion.button
            key={item.key}
            whileTap={{ scale: 0.94 }}
            onClick={() => onTabChange(item.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${tab === item.key ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'bg-secondary/70 text-foreground hover:bg-secondary'}`}
          >
            {item.label}
          </motion.button>
        ))}
      </div>

      <div className="relative">
        <motion.button whileTap={{ scale: 0.88 }} onClick={onToggleMoreMenu} className="p-2 -mr-2 bg-card/90 border border-border/70 shadow-lg shadow-primary/10 hover:bg-secondary rounded-full transition-colors" aria-label="More actions">
          <MoreVertical className="w-5 h-5 text-foreground" />
        </motion.button>
        <AnimatePresence>
          {showMoreMenu && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="absolute right-0 top-12 w-64 rounded-3xl border border-border bg-card p-2 shadow-2xl shadow-black/30"
            >
              <button onClick={onTogglePlaylistPicker} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                <Plus className="w-4 h-4 text-primary" /> Add to playlist
              </button>
              {showPlaylistPicker && (
                <div className="mx-1 mb-1 max-h-44 overflow-y-auto rounded-2xl bg-secondary p-1">
                  {playlists.length ? playlists.map(playlist => (
                    <button key={playlist.id} onClick={() => onAddToPlaylist(playlist.id)} className="block w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-foreground hover:bg-card">
                      {playlist.name}
                    </button>
                  )) : <p className="px-3 py-2 text-xs text-muted-foreground">No playlists yet</p>}
                </div>
              )}
              <button onClick={onAddCurrentToQueue} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                <ListPlus className="w-4 h-4 text-primary" /> Add to queue
              </button>
              <button onClick={onEditCurrent} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                <Scissors className="w-4 h-4 text-primary" /> Edit
              </button>
              <button onClick={onShare} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                <Share2 className="w-4 h-4 text-primary" /> Share
              </button>
              <button onClick={onOpenQueue} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-foreground hover:bg-secondary">
                <ListMusic className="w-4 h-4 text-primary" /> Queue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
