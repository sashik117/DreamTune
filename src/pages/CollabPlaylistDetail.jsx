import { useState, useEffect, useRef } from 'react';
import { supabase, entities, storage, social } from '@/api/SupabaseClient';
import { ArrowLeft, Plus, Music, UserPlus, Crown, X, Shuffle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import SongCard from '../components/SongCard';
import { cacheAudio } from '../utils/audioCache';
import { formatPlaylistDuration, getPlaylistSeconds, resolvePlaylistSeconds } from '@/utils/duration';
import {
  getCollabMemberCount,
  getPlaylistDurationKey,
  isCollabPlaylistOwner,
  parsePlaylistCoverPosition,
  pluralMember,
  pluralSong,
  resolveCollabPlaylistSongs,
} from '@/features/playlists/model/collabPlaylistView';
import CollabPlaylistCover from '@/features/playlists/components/CollabPlaylistCover';
import PlaylistCoverEditorDialog from '@/features/playlists/components/PlaylistCoverEditorDialog';

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
  const [coverPosition, setCoverPosition] = useState(() => parsePlaylistCoverPosition(initialPlaylist.cover_position));
  const [coverScale, setCoverScale] = useState(Number(initialPlaylist.cover_scale || 1));
  const [savingCover, setSavingCover] = useState(false);
  const [playlistDurationSeconds, setPlaylistDurationSeconds] = useState(0);
  const coverInputRef = useRef(null);
  const previousSongIdsRef = useRef((initialPlaylist.song_ids || []).map(String));

  const playlistSongs = resolveCollabPlaylistSongs(playlist, sharedSongs, songs);
  const isOwner = isCollabPlaylistOwner(playlist, currentUser);

  const playlistCoverSongs = playlistSongs.filter(song => song.cover_url).slice(0, 4);
  const memberCount = getCollabMemberCount(playlist);
  const playlistDurationKey = getPlaylistDurationKey(playlistSongs);
  const playlistDuration = formatPlaylistDuration(playlistDurationSeconds);

  useEffect(() => {
    let cancelled = false;
    const knownSeconds = getPlaylistSeconds(playlistSongs);
    setPlaylistDurationSeconds(knownSeconds);
    if (!playlistSongs.length) return () => { cancelled = true; };

    resolvePlaylistSeconds(playlistSongs, (seconds) => {
      if (!cancelled) setPlaylistDurationSeconds(seconds);
    }).then((seconds) => {
      if (!cancelled) setPlaylistDurationSeconds(seconds);
    });

    return () => { cancelled = true; };
  }, [playlistDurationKey]);

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
              toast.success(`${updated.last_edited_by} added a track to the playlist`);
            } else if (removedIds.length) {
              toast(`${updated.last_edited_by} removed a track from the playlist`);
            } else {
              toast(`${updated.last_edited_by} updated the playlist`);
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
    toast.success('Song removed from playlist');
  };

  const handleInvite = async (friend) => {
    if (!friend?.id) return;
    await social.inviteToCollabPlaylist({ playlist_id: playlist.id, receiver_id: friend.id });
    setShowInvite(false);
    toast.success(`Invite sent to ${friend.nickname}`);
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
    if (!playable.length) return toast.error('This playlist has no playable audio');
    onPlayPlaylist?.(playable, { shuffle: shouldShuffle });
    warmPlaylistAudio(playable);
    if (shouldShuffle) toast.success('Playlist shuffled');
  };

  const handlePlayFromPlaylist = (song) => {
    const playable = playlistSongs.filter(item => item?.file_url);
    if (!playable.length) return toast.error('This playlist has no playable audio');
    onPlayPlaylist?.(playable, { startSongId: song.id });
    warmPlaylistAudio(playable);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const openCoverEditor = () => {
    setCoverPreview(playlist.cover_url || '');
    setCoverPosition(parsePlaylistCoverPosition(playlist.cover_position));
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
      toast.success('Cover updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not update cover');
    } finally {
      setSavingCover(false);
    }
  };

  return (
    <div className="min-w-0 overflow-x-hidden px-3 sm:px-4 pb-4">
      <div className="sticky top-0 z-[80] pt-3 pb-3 mb-4 bg-background/96 backdrop-blur-xl border-b border-border/60">
        <div className="space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center hover:bg-secondary rounded-full transition-colors shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </motion.button>
            <button
              type="button"
              onClick={isOwner ? openCoverEditor : undefined}
              className={`shrink-0 rounded-3xl p-1 ${isOwner ? 'cursor-pointer hover:bg-primary/10' : ''}`}
              aria-label="Playlist cover"
            >
              <CollabPlaylistCover playlist={playlist} coverSongs={playlistCoverSongs} className="w-14 h-14 rounded-2xl shadow-lg shadow-primary/10" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Collaborative playlist</p>
              <div className="flex items-center gap-1.5 min-w-0">
                {isOwner && <Crown className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                <h1 className="min-w-0 truncate text-xl sm:text-2xl font-black text-foreground">{playlist.name || 'Collaborative playlist'}</h1>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {playlistSongs.length} {pluralSong(playlistSongs.length)} • {playlistDuration} • {memberCount} {pluralMember(memberCount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handlePlayPlaylist(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary disabled:opacity-40"
              disabled={!playlistSongs.length}
              aria-label="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowInvite(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary"
              aria-label="Add member"
            >
              <UserPlus className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowAddSongs(true)}
              className="min-h-11 flex items-center justify-center rounded-2xl bg-secondary/80 text-primary transition-colors hover:bg-secondary"
              aria-label="Add songs"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {((playlist.collaborator_ids || []).length > 0 || (playlist.collaborator_emails || []).length > 0) && (
        <div className="dream-scroll-row flex gap-2 mb-3 overflow-x-auto pb-1">
          {[
            { id: playlist.owner_id, label: playlist.owner_email || currentUser?.nickname || 'Owner' },
            ...(playlist.collaborator_ids || []).map(id => {
              const friend = friends.find(item => item.id === id);
              return { id, label: friend?.nickname || (playlist.collaborator_emails || [])[0] || 'Collaborator' };
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

      {playlistSongs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Add songs</p>
        </motion.div>
      ) : (
        <>
          <Button onClick={() => handlePlayPlaylist(false)} className="w-full mb-3 gap-2 rounded-2xl bg-primary hover:brightness-110">
            <Play className="w-4 h-4 fill-current" /> Play playlist
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
                    onRemoveFromPlaylist={(item) => handleRemoveSong(item.id)}
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
      <CollabAddSongsDialog
        open={showAddSongs}
        onOpenChange={setShowAddSongs}
        songs={songs}
        playlistSongIds={playlist.song_ids || []}
        onToggleSong={handleAddSong}
      />

      <CollabInviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        friends={friends}
        collaboratorIds={playlist.collaborator_ids || []}
        onInvite={handleInvite}
      />

      <PlaylistCoverEditorDialog
        open={showCoverEditor}
        onOpenChange={setShowCoverEditor}
        coverPreview={coverPreview}
        coverPosition={coverPosition}
        coverScale={coverScale}
        coverInputRef={coverInputRef}
        savingCover={savingCover}
        onPositionChange={setCoverPosition}
        onScaleChange={setCoverScale}
        onCoverSelect={handleCoverSelect}
        onSave={saveCover}
      />
</div>
  );
}
