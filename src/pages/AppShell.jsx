import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { auth, entities, hydrateAuthToken, supabase, social } from '@/api/SupabaseClient';
import useAudioPlayer from '../hooks/useAudioPlayer';
import MiniPlayer from '../components/player/MiniPlayer';
import FullPlayer from '../components/player/FullPlayer';
import BottomNav from '../components/BottomNav';
import UploadModal from '../components/UploadModal';
import EditSongModal from '../components/EditSongModal';
import FloatingParticles from '../components/FloatingParticles';
import OfflineBanner from '../components/offline/OfflineBanner';
import ProfileDrawer from '../components/ProfileDrawer';
import { UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDownloadedSongsMeta } from '../utils/audioCache';

export default function AppShell() {
  const [songs, setSongs]               = useState([]);
  const [playlists, setPlaylists]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [editingSong, setEditingSong]   = useState(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('menu') === 'open' || params.get('sidebar') === 'open';
  });
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('theme-mode') || 'dark');
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('theme-accent') || 'rose');
  const [themeBackground, setThemeBackground] = useState(() => localStorage.getItem('theme-background') || '');
  const [themePhoto, setThemePhoto] = useState(() => localStorage.getItem('theme-photo') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('profile-avatar') || '');
  const [profileNickname, setProfileNickname] = useState(() => localStorage.getItem('profile-nickname') || 'DreamTune');
  const [currentUser, setCurrentUser] = useState(null);
  const [collabDetailOpen, setCollabDetailOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const root = document.documentElement;
    const customLightBackgrounds = new Set(['light-blush', 'light-sky', 'light-mint', 'light-lavender', 'pastel-rose', 'pastel-sky', 'pastel-mint', 'pastel-lilac', 'pastel-peach']);
    const removedBackgrounds = new Set(['aurora', 'nebula']);
    const validAccents = new Set(['rose', 'violet', 'blue', 'ruby', 'mint', 'peach', 'ice', 'gold', 'graphite', 'sage', 'velvet', 'burgundy', 'midnight', 'ember', 'neon', 'citrus', 'berry']);
    const activeThemeBackground = removedBackgrounds.has(themeBackground) ? 'plum' : themeBackground;
    const activeThemeAccent = validAccents.has(themeAccent) ? themeAccent : 'rose';
    if (activeThemeBackground !== themeBackground) setThemeBackground(activeThemeBackground);
    if (activeThemeAccent !== themeAccent) setThemeAccent(activeThemeAccent);
    const usesLightSurface = themeMode === 'light' || (themeMode === 'custom' && customLightBackgrounds.has(activeThemeBackground));
    root.classList.toggle('dark', !usesLightSurface);
    root.dataset.themeSurface = usesLightSurface ? 'light' : 'dark';
    root.dataset.themeMode = themeMode;
    root.dataset.themeAccent = activeThemeAccent;
    root.dataset.themeBackground = activeThemeBackground || 'default';
    root.dataset.coverShape = 'square';
    root.style.setProperty('--user-bg-image', themePhoto ? `url("${themePhoto}")` : 'none');
    localStorage.setItem('theme-mode', themeMode);
    localStorage.setItem('theme-accent', activeThemeAccent);
    localStorage.setItem('theme-background', activeThemeBackground);
    localStorage.setItem('theme-photo', themePhoto);
    localStorage.setItem('profile-avatar', profileAvatar);
    localStorage.setItem('profile-nickname', profileNickname);
    localStorage.removeItem('cover-shape');
    document.body.dataset.coverShape = 'square';
  }, [themeMode, themeAccent, themeBackground, themePhoto, profileAvatar, profileNickname]);

  const player = useAudioPlayer(songs, showFullPlayer);

  useEffect(() => {
    hydrateAuthToken()
      .then(() => auth.me())
      .then(user => {
        setCurrentUser(user);
        if (user?.nickname) setProfileNickname(user.nickname);
        loadSongs();
        loadPlaylists();
        loadFriendRequestCount();
      }).catch(async () => {
        if (!navigator.onLine) {
          const offlineSongs = await getDownloadedSongsMeta();
          setSongs(offlineSongs);
          setPlaylists([]);
          setLoading(false);
          return;
        }
        navigate('/auth', { replace: true });
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('songs_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.user_id && row.user_id !== currentUser.id) return;
        if (payload.event === 'INSERT' && payload.new) {
          setSongs(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new, ...prev]);
        }
        if (payload.event === 'UPDATE' && payload.new) {
          setSongs(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
        }
        if (payload.event === 'DELETE' && payload.old) {
          setSongs(prev => prev.filter(s => s.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('playlists_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.user_id && row.user_id !== currentUser.id) return;
        if (payload.event === 'INSERT' && payload.new) {
          setPlaylists(prev => prev.some(pl => pl.id === payload.new.id) ? prev : [payload.new, ...prev]);
        }
        if (payload.event === 'UPDATE' && payload.new) {
          setPlaylists(prev => prev.map(pl => pl.id === payload.new.id ? payload.new : pl));
        }
        if (payload.event === 'DELETE' && payload.old) {
          setPlaylists(prev => prev.filter(pl => pl.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('social_notifications_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.receiver_id === currentUser.id || row?.sender_id === currentUser.id) loadFriendRequestCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_playlist_invites' }, (payload) => {
        const row = payload.new || payload.old;
        if (row?.receiver_id === currentUser.id || row?.sender_id === currentUser.id) loadFriendRequestCount();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [currentUser?.id]);

  useEffect(() => {
    setShowFullPlayer(false);
    if (location.pathname === '/profile/friends') setFriendRequestCount(0);
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShowProfileDrawer(params.get('menu') === 'open' || params.get('sidebar') === 'open');
  }, [location.search]);

  const openProfileDrawer = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('menu') === 'open') {
      setShowProfileDrawer(true);
      return;
    }
    params.delete('sidebar');
    params.set('menu', 'open');
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
      hash: location.hash,
    }, { replace: false });
    setShowProfileDrawer(true);
  }, [location.hash, location.pathname, location.search, navigate]);

  const handleProfileDrawerOpenChange = useCallback((open) => {
    if (open) {
      openProfileDrawer();
      return;
    }
    setShowProfileDrawer(false);
    const params = new URLSearchParams(location.search);
    if (!params.has('menu') && !params.has('sidebar')) return;
    params.delete('menu');
    params.delete('sidebar');
    const nextSearch = params.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
      hash: location.hash,
    }, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, openProfileDrawer]);

  const handleDrawerNavigate = useCallback(() => {
    setShowProfileDrawer(false);
  }, []);

  const loadFriendRequestCount = async () => {
    try {
      const data = await social.getFriendRequestCount();
      setFriendRequestCount(Number(data.count || 0));
    } catch {
      setFriendRequestCount(0);
    }
  };

  useEffect(() => {
    const handleCollabDetail = (event) => {
      setCollabDetailOpen(Boolean(event.detail?.open));
    };
    window.addEventListener('dreamtune:collab-detail', handleCollabDetail);
    return () => window.removeEventListener('dreamtune:collab-detail', handleCollabDetail);
  }, []);

  useEffect(() => {
    if (collabDetailOpen) handleProfileDrawerOpenChange(false);
  }, [collabDetailOpen, handleProfileDrawerOpenChange]);

  const loadSongs = async () => {
    try {
      const data = await entities.Song.list();
      setSongs(data);
    } catch (err) {
      console.error('Failed to load songs:', err);
      if (!navigator.onLine) {
        const offlineSongs = await getDownloadedSongsMeta();
        setSongs(offlineSongs);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      const data = await entities.Playlist.list();
      setPlaylists(data);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  };

  // Track listen history
  const trackHistory = useCallback(async (song) => {
    if (!song) return;
    entities.ListenHistory.create({
      song_id:    song.id,
      song_title: song.title,
      song_artist: song.artist || '',
      listened_at: Date.now(),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (player.currentSong && player.isPlaying) {
      trackHistory(player.currentSong);
    }
  }, [player.currentSong?.id]);

  const handleToggleFavorite = useCallback(async (song, forcedFavorite) => {
    if (song?.user_id && currentUser?.id && song.user_id !== currentUser.id) return;
    const nextFavorite = typeof forcedFavorite === 'boolean' ? forcedFavorite : !song.is_favorite;
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_favorite: nextFavorite } : s));
    try {
      await entities.Song.update(song.id, { is_favorite: nextFavorite });
    } catch (err) {
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_favorite: song.is_favorite } : s));
      throw err;
    }
  }, [currentUser?.id]);

  const handleDelete = useCallback(async (song) => {
    setSongs(prev => prev.filter(s => s.id !== song.id));
    setPlaylists(prev => prev.map(pl => ({
      ...pl,
      song_ids: (pl.song_ids || []).filter(id => id !== song.id),
    })));
    await entities.Song.delete(song.id);
  }, []);

  const handleDeleteMany = useCallback(async (songIds) => {
    setSongs(prev => prev.filter(song => !songIds.includes(song.id)));
    setPlaylists(prev => prev.map(pl => ({
      ...pl,
      song_ids: (pl.song_ids || []).filter(id => !songIds.includes(id)),
    })));
    await Promise.all(songIds.map(id => entities.Song.delete(id)));
  }, []);

  const handleSongAdded = useCallback((newSong) => {
    setSongs(prev => prev.some(s => s.id === newSong.id) ? prev : [newSong, ...prev]);
  }, []);

  const handleSongsAdded = useCallback((newSongs) => {
    setSongs(prev => {
      const existing = new Set(prev.map(s => s.id));
      return [...newSongs.filter(s => !existing.has(s.id)), ...prev];
    });
  }, []);

  const handlePlaylistAdded = useCallback((playlist) => {
    setPlaylists(prev => prev.some(pl => pl.id === playlist.id) ? prev : [playlist, ...prev]);
  }, []);

  const handlePlaylistUpdated = useCallback((playlist) => {
    setPlaylists(prev => prev.map(pl => pl.id === playlist.id ? { ...pl, ...playlist } : pl));
  }, []);

  const handleSongUpdated = useCallback((updatedSong) => {
    setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
  }, []);

  const handleAddSongsToPlaylist = useCallback(async (songIds, playlistId) => {
    const playlist = playlists.find(pl => pl.id === playlistId);
    if (!playlist) return null;
    const merged = Array.from(new Set([...(playlist.song_ids || []), ...songIds]));
    const updated = await entities.Playlist.update(playlistId, { song_ids: merged });
    setPlaylists(prev => prev.map(pl => pl.id === playlistId ? { ...pl, ...updated } : pl));
    return updated;
  }, [playlists]);

  const handleToggleFavoriteCurrent = useCallback((forcedFavorite) => {
    if (player.currentSong) handleToggleFavorite(player.currentSong, forcedFavorite);
  }, [player.currentSong, handleToggleFavorite]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const hasPlayer = !!player.currentSong;
  const canFavoriteCurrentSong = Boolean(player.currentSong && (!player.currentSong.user_id || player.currentSong.user_id === currentUser?.id));
  const hideProfileEntry = /^\/playlists\/[^/]+/.test(location.pathname) || location.pathname === '/profile' || /^\/profile\/.+/.test(location.pathname) || collabDetailOpen;

  const outletContext = {
    songs,
    playlists,
    recentSongs: songs.slice(0, 8),
    currentSongId: player.currentSong?.id,
    isPlaying: player.isPlaying,
    cachedSongs: player.cachedSongs,
    onPlay: player.playSong,
    onToggleFavorite: handleToggleFavorite,
    onDelete: handleDelete,
    onDeleteMany: handleDeleteMany,
    onSongAdded: handleSongAdded,
    onShowUpload: () => setShowUpload(true),
    onEdit: (song) => setEditingSong(song),
    onAddToQueue: player.addToQueue,
    onPlayNext: player.playNextInQueue,
    onPlayPlaylist: player.playPlaylist,
    onAddSongsToPlaylist: handleAddSongsToPlaylist,
    themeMode,
    themeAccent,
    themeBackground,
    themePhoto,
    profileAvatar,
    profileNickname,
    currentUser,
    onThemeModeChange: setThemeMode,
    onThemeAccentChange: setThemeAccent,
    onThemeBackgroundChange: setThemeBackground,
    onThemePhotoChange: setThemePhoto,
    onProfileAvatarChange: setProfileAvatar,
    onProfileNicknameChange: setProfileNickname,
    onSignOut: async () => {
      try {
        await auth.signOut();
      } catch {
        localStorage.removeItem('dreamtune-auth-token');
      }
      setSongs([]);
      setPlaylists([]);
      setCurrentUser(null);
      localStorage.removeItem('profile-nickname');
      navigate('/auth', { replace: true });
    },
    sleepRemaining: player.sleepRemaining,
    onSleepTimerChange: player.setSleepTimer,
    friendRequestCount,
    onFriendRequestsViewed: () => setFriendRequestCount(0),
    onFriendRequestCountRefresh: loadFriendRequestCount,
  };

  return (
    <div className="app-shell cozy-gradient-bg max-w-screen-lg mx-auto relative">
      <div className="app-background-layer" aria-hidden="true" />
      <FloatingParticles />
      <OfflineBanner />
      {!showFullPlayer && !hideProfileEntry && (
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={openProfileDrawer}
          className="fixed top-[calc(12px+env(safe-area-inset-top,0px))] left-4 z-[70] w-11 h-11 rounded-full"
          aria-label="Open profile"
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/25 border border-white/20 overflow-hidden">
            {profileAvatar ? <img src={profileAvatar} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-7 h-7 text-white" />}
          </span>
          {friendRequestCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 z-[2] min-w-5 h-5 rounded-full bg-red-500 px-1 text-[10px] font-black leading-5 text-white shadow-lg shadow-red-500/40 ring-2 ring-background">
              {friendRequestCount > 9 ? '9+' : friendRequestCount}
            </span>
          )}
        </motion.button>
      )}

      <main className={`app-scroll ${hasPlayer ? 'has-mini-player' : ''}`}>
        <AnimatePresence mode="wait">
          <Outlet key={location.pathname} context={outletContext} />
        </AnimatePresence>
      </main>

      <div className={hasPlayer ? '' : 'hidden'}>
        <MiniPlayer
          currentSong={player.currentSong}
          isPlaying={player.isPlaying}
          onPlayPause={player.togglePlayPause}
          onNext={player.playNext}
          onPrev={player.playPrev}
          onToggleFavorite={handleToggleFavoriteCurrent}
          onExpand={() => setShowFullPlayer(true)}
          progress={player.progress}
          canFavorite={canFavoriteCurrentSong}
        />
      </div>

      <AnimatePresence>
        {showFullPlayer && (
          <FullPlayer
            currentSong={player.currentSong}
            isPlaying={player.isPlaying}
            onPlayPause={player.togglePlayPause}
            onNext={player.playNext}
            onPrev={player.playPrev}
            onToggleFavorite={handleToggleFavoriteCurrent}
            onCollapse={() => setShowFullPlayer(false)}
            progress={player.progress}
            currentTime={player.currentTime}
            duration={player.duration}
            onSeek={player.seek}
            volume={player.volume}
            onVolumeChange={player.setVolume}
            shuffle={player.shuffle}
            onShuffleToggle={player.setShuffle}
            repeat={player.repeat}
            onRepeatToggle={player.setRepeat}
            analyser={player.analyser}
            onSongUpdated={handleSongUpdated}
            eq={player.eq}
            onEqChange={player.setEq}
            queue={player.queue}
            onQueueReorder={player.reorderQueue}
            onQueueRemove={player.removeFromQueue}
            onQueuePlay={player.playSong}
            bassLevel={player.bassLevel}
            voiceLevel={player.voiceLevel}
            sleepRemaining={player.sleepRemaining}
            sleepDimming={player.sleepDimming}
            onSleepTimerChange={player.setSleepTimer}
            playlists={playlists}
            onAddSongsToPlaylist={handleAddSongsToPlaylist}
            onAddCurrentToQueue={player.addToQueue}
            onEditCurrent={(song) => setEditingSong(song)}
            canFavorite={canFavoriteCurrentSong}
          />
        )}
      </AnimatePresence>

      <BottomNav onAddClick={() => setShowUpload(true)} notificationCount={friendRequestCount} />
      <ProfileDrawer
        open={showProfileDrawer}
        onOpenChange={handleProfileDrawerOpenChange}
        onNavigate={handleDrawerNavigate}
        songs={songs}
        playlists={playlists}
        profileAvatar={profileAvatar}
        profileNickname={profileNickname}
        notificationCount={friendRequestCount}
        themeMode={themeMode}
        themeAccent={themeAccent}
        themeBackground={themeBackground}
        onThemeModeChange={setThemeMode}
        onThemeAccentChange={setThemeAccent}
        onThemeBackgroundChange={setThemeBackground}
        onSignOut={outletContext.onSignOut}
        sleepRemaining={player.sleepRemaining}
        onSleepTimerChange={player.setSleepTimer}
      />
      <UploadModal
        open={showUpload}
        onOpenChange={setShowUpload}
        onSongAdded={handleSongAdded}
        onSongsAdded={handleSongsAdded}
        onPlaylistAdded={handlePlaylistAdded}
        onPlaylistUpdated={handlePlaylistUpdated}
      />

      {editingSong && (
        <EditSongModal
          song={editingSong}
          open={!!editingSong}
          onOpenChange={(open) => { if (!open) setEditingSong(null); }}
          onSongUpdated={handleSongUpdated}
        />
      )}
    </div>
  );
}
