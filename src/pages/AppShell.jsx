import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { auth, getAuthToken, hydrateAuthToken, setAuthToken, social } from '@/api/SupabaseClient';
import useAudioPlayer from '../hooks/useAudioPlayer';
import MiniPlayer from '../components/player/MiniPlayer';
import FullPlayer from '../components/player/FullPlayer';
import BottomNav from '../components/BottomNav';
import UploadModal from '../components/UploadModal';
import EditSongModal from '../components/EditSongModal';
import FloatingParticles from '../components/FloatingParticles';
import OfflineBanner from '../components/offline/OfflineBanner';
import ProfileDrawer from '../components/ProfileDrawer';
import AppLoadingScreen from '@/features/app/components/AppLoadingScreen';
import ProfileEntryButton from '@/features/app/components/ProfileEntryButton';
import { useListenHistorySync } from '../features/listen-history/model/useListenHistorySync';
import { useLibraryLoader } from '../features/library/model/useLibraryLoader';
import { useLibraryState } from '../features/library/model/useLibraryState';
import { useLibraryRealtime } from '../features/library/model/useLibraryRealtime';
import { usePlaylistActions } from '../features/playlists/model/usePlaylistActions';
import { useNativeDownloadSync } from '../features/tracks/model/useNativeDownloadSync';
import { useTrackActions } from '../features/tracks/model/useTrackActions';
import { useProfileSession } from '../features/users/model/useProfileSession';
import { useSocialNotificationsRealtime } from '../features/users/model/useSocialNotificationsRealtime';
import { isNativePlatform } from '../features/theme/model/themePreferences';
import { useThemeSettings } from '../features/theme/model/useThemeSettings';

function withTimeout(promise, ms, message = 'Timeout') {
  let timeout = null;
  const timer = new Promise((_, reject) => {
    timeout = window.setTimeout(() => {
      const error = new Error(message);
      error.isTimeout = true;
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timer]).finally(() => {
    if (timeout) window.clearTimeout(timeout);
  });
}

export default function AppShell() {
  const isNativeApp = isNativePlatform();
  const [loading, setLoading]           = useState(true);
  const { songs, setSongs, playlists, setPlaylists, songsRef, playlistsRef } = useLibraryState({ loading });
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showUpload, setShowUpload]     = useState(false);
  const [editingSong, setEditingSong]   = useState(null);
  const [showProfileDrawer, setShowProfileDrawer] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('menu') === 'open' || params.get('sidebar') === 'open';
  });
  const {
    currentUser,
    setCurrentUser,
    profileAvatar,
    setProfileAvatar,
    profileNickname,
    setProfileNickname,
    applyCurrentUser,
    clearProfileSession,
    handleProfileAvatarChange,
    handleProfileNicknameChange,
  } = useProfileSession();
  const {
    themeMode,
    setThemeMode,
    themeAccent,
    setThemeAccent,
    themeBackground,
    setThemeBackground,
    themePhoto,
    setThemePhoto,
  } = useThemeSettings({
    isNativeApp,
    profileAvatar,
    profileNickname,
    onProfileAvatarChange: setProfileAvatar,
    onProfileNicknameChange: setProfileNickname,
  });
  const [collabDetailOpen, setCollabDetailOpen] = useState(false);
  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const { loadSongs, loadPlaylists, loadOfflineShell } = useLibraryLoader({
    isNativeApp,
    setSongs,
    setPlaylists,
    setLoading,
    applyCurrentUser,
    setCurrentUser,
  });

  const location = useLocation();
  const navigate = useNavigate();

  const player = useAudioPlayer(songs, showFullPlayer);
  const {
    handleToggleFavorite,
    handleDelete,
    handleDeleteMany,
    handleSongAdded,
    handleSongsAdded,
    handleSongUpdated,
  } = useTrackActions({
    currentUserId: currentUser?.id,
    setSongs,
    setPlaylists,
    setEditingSong,
  });
  const {
    handlePlaylistAdded,
    handlePlaylistUpdated,
    handleAddSongsToPlaylist,
  } = usePlaylistActions({
    playlists,
    setPlaylists,
  });
  useListenHistorySync({
    currentUserId: currentUser?.id,
    currentSong: player.currentSong,
    isPlaying: player.isPlaying,
  });
  useNativeDownloadSync({
    currentUserId: currentUser?.id,
    songsRef,
    playlistsRef,
    setSongs,
    handlePlaylistUpdated,
    handleSongsAdded,
  });
  useLibraryRealtime({
    currentUserId: currentUser?.id,
    setSongs,
    setPlaylists,
    setEditingSong,
  });

  useEffect(() => {
    let mounted = true;

    withTimeout(hydrateAuthToken(), 8000, 'Auth storage timeout')
      .then((token) => {
        if (!token) {
          if (!navigator.onLine) loadOfflineShell();
          else {
            navigate('/auth', { replace: true });
            setLoading(false);
          }
          return null;
        }
        return withTimeout(auth.me(), 12000, 'Auth check timeout');
      })
      .then(user => {
        if (!mounted || !user) return;
        applyCurrentUser(user);
        loadSongs();
        loadPlaylists();
        loadFriendRequestCount();
      }).catch(async (error) => {
        if (!mounted) return;
        const isAuthError = error?.status === 401 || error?.status === 403;
        if (isAuthError) {
          setAuthToken('');
          clearProfileSession();
          navigate('/auth', { replace: true });
          setLoading(false);
          return;
        }
        await loadOfflineShell();
      });
    return () => { mounted = false; };
  }, [applyCurrentUser, loadOfflineShell, navigate]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => {
      if (navigator.onLine && !getAuthToken()) {
        navigate('/auth', { replace: true });
        setLoading(false);
        return;
      }
      loadOfflineShell();
    }, 16000);
    return () => window.clearTimeout(timer);
  }, [loading, loadOfflineShell, navigate]);

  useEffect(() => {
    if (!loading) {
      setShowLoadingScreen(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowLoadingScreen(true), 700);
    return () => window.clearTimeout(timer);
  }, [loading]);

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

  const loadFriendRequestCount = useCallback(async () => {
    try {
      const data = await social.getFriendRequestCount();
      setFriendRequestCount(Number(data.count || 0));
    } catch {
      setFriendRequestCount(0);
    }
  }, []);

  useSocialNotificationsRealtime({
    currentUserId: currentUser?.id,
    onRefresh: loadFriendRequestCount,
  });

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

  const handleToggleFavoriteCurrent = useCallback((forcedFavorite) => {
    if (player.currentSong) handleToggleFavorite(player.currentSong, forcedFavorite);
  }, [player.currentSong, handleToggleFavorite]);

  if (loading) {
    return <AppLoadingScreen visible={showLoadingScreen} />;
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
    onProfileAvatarChange: handleProfileAvatarChange,
    onProfileNicknameChange: handleProfileNicknameChange,
    onSignOut: async () => {
      try {
        await auth.signOut();
      } catch {
        localStorage.removeItem('dreamtune-auth-token');
      }
      setSongs([]);
      setPlaylists([]);
      clearProfileSession();
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
      {!isNativeApp && <FloatingParticles />}
      <OfflineBanner />
      {!showFullPlayer && !hideProfileEntry && (
        <ProfileEntryButton
          profileAvatar={profileAvatar}
          friendRequestCount={friendRequestCount}
          onClick={openProfileDrawer}
        />
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
            onQueueRemove={player.removeFromQueue}
            onQueuePlay={player.playQueueSong}
            onQueueReorder={player.reorderQueue}
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
      />
      <UploadModal
        open={showUpload}
        existingSongs={songs}
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
