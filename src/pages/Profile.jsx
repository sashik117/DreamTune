import { useParams } from 'react-router-dom';
import { auth, entities, storage } from '@/api/SupabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  Mail,
  Pencil,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cropImageToDataUrl, dataUrlToFile } from '../utils/imageCrop';
import { useTranslation } from 'react-i18next';
import i18n, { supportedLanguages } from '../i18n';
import { readPendingHistory } from '@/features/listen-history/model/pendingListenHistory';
import { ACCENTS, BACKGROUNDS } from '@/features/theme/model/themeCatalog';
import { PROFILE_SECTION_TITLES } from '@/features/users/model/profileSections';
import { buildPeriodStats, getProfileCounts, getTopTrack } from '@/features/users/model/profileStats';
import { useProfileFriends } from '@/features/users/model/useProfileFriends';
import ProfileAvatarDialog from '@/features/users/components/ProfileAvatarDialog';
import ProfileFriendsSection from '@/features/users/components/ProfileFriendsSection';
import ProfileLanguageSection from '@/features/users/components/ProfileLanguageSection';
import ProfilePublicPlaylists from '@/features/users/components/ProfilePublicPlaylists';
import ProfileSettingsSection from '@/features/users/components/ProfileSettingsSection';
import ProfileSleepSection from '@/features/users/components/ProfileSleepSection';
import ProfileStatsSection from '@/features/users/components/ProfileStatsSection';
import ProfileThemeSection from '@/features/users/components/ProfileThemeSection';

export default function Profile({
  songs = [],
  playlists = [],
  themeMode,
  themeAccent,
  themeBackground,
  themePhoto,
  profileAvatar,
  profileNickname = 'Guest',
  currentUser,
  onThemeModeChange,
  onThemeAccentChange,
  onThemeBackgroundChange,
  onThemePhotoChange,
  onProfileAvatarChange,
  onProfileNicknameChange,
  onSignOut,
  sleepRemaining,
  onSleepTimerChange,
  onFriendRequestsViewed,
  onFriendRequestCountRefresh,
}) {
  const { section = 'profile' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showBackgrounds, setShowBackgrounds] = useState(themeMode === 'custom');
  const [showPalettes, setShowPalettes] = useState(false);
  const [localThemeMode, setLocalThemeMode] = useState(themeMode || 'dark');
  const [openSetting, setOpenSetting] = useState(null);
  const [customSleep, setCustomSleep] = useState('');
  const [period, setPeriod] = useState(7);
  const [listenHistory, setListenHistory] = useState([]);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(profileNickname);
  const [localProfileNickname, setLocalProfileNickname] = useState(profileNickname || currentUser?.nickname || 'Guest');
  const [localProfileAvatar, setLocalProfileAvatar] = useState(profileAvatar || '');
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState(profileAvatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPosition, setAvatarPosition] = useState({ x: 50, y: 50 });
  const [avatarScale, setAvatarScale] = useState(1);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [language, setLanguage] = useState(() => i18n.resolvedLanguage || localStorage.getItem('dreamtune-language') || 'en');
  const avatarInputRef = useRef(null);
  const bgInputRef = useRef(null);
  const {
    acceptCollabInvite,
    acceptFriend,
    addFriend,
    clearFriends,
    declineCollabInvite,
    declineFriend,
    friendQuery,
    friendRequests,
    friendSearchDone,
    friends,
    removeFriend,
    requestFriendById,
    setFriendQuery,
    userResults,
  } = useProfileFriends({
    active: section === 'friends',
    onFriendRequestsViewed,
    onFriendRequestCountRefresh,
  });

  useEffect(() => {
    setLocalThemeMode(themeMode || 'dark');
    if (themeMode === 'custom') setShowBackgrounds(true);
  }, [themeMode]);

  useEffect(() => {
    setLocalProfileAvatar(profileAvatar || '');
  }, [profileAvatar]);

  useEffect(() => {
    const next = profileNickname || currentUser?.nickname || 'Guest';
    setLocalProfileNickname(next);
    if (!editingNickname) setNicknameDraft(next);
  }, [profileNickname, currentUser?.nickname, editingNickname]);

  const email = currentUser?.email || 'local@dreamtune.app';
  const { publicPlaylists, favoriteCount, artistCount } = useMemo(
    () => getProfileCounts(songs, playlists),
    [songs, playlists]
  );
  const periodStats = useMemo(
    () => buildPeriodStats(listenHistory, songs, period),
    [listenHistory, songs, period]
  );
  const topTrack = useMemo(() => getTopTrack(periodStats), [periodStats]);

  useEffect(() => {
    if (section !== 'stats') return;
    entities.ListenHistory.list()
      .then(rows => setListenHistory([...(rows || []), ...readPendingHistory()]))
      .catch(() => setListenHistory(readPendingHistory()));
  }, [section]);

  const saveNickname = async () => {
    const next = nicknameDraft.trim().replace(/^@/, '');
    if (next.length < 2) return toast.error('Nickname must be longer');
    setLocalProfileNickname(next);
    onProfileNicknameChange?.(next);
    setNicknameDraft(next);
    setEditingNickname(false);
    try {
      await auth.updateProfile?.({ nickname: next });
      toast.success('Nickname updated');
    } catch {
      toast.success('Nickname updated on this device');
    }
  };


  const imageFileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const originalDataUrl = reader.result;
      const img = new Image();
      img.onerror = () => resolve(originalDataUrl);
      img.onload = () => {
        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.74));
        } catch {
          resolve(originalDataUrl);
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });

  const openAvatarEditor = () => {
    setAvatarDraft(localProfileAvatar || '');
    setAvatarFile(null);
    setAvatarPosition({ x: 50, y: 50 });
    setAvatarScale(1);
    setAvatarEditorOpen(true);
  };

  const handleAvatarSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const previewUrl = await imageFileToDataUrl(file);
      setAvatarFile(file);
      setAvatarDraft(previewUrl);
    } catch (error) {
      console.error(error);
      toast.error('Could not open photo');
    } finally {
      event.target.value = '';
    }
  };

  const saveAvatar = async () => {
    if (!avatarDraft) return avatarInputRef.current?.click();
    setSavingAvatar(true);
    try {
      const cropped = await cropImageToDataUrl(avatarDraft, avatarPosition, avatarScale);
      setLocalProfileAvatar(cropped);
      onProfileAvatarChange?.(cropped);
      try {
        const uploadFile = await dataUrlToFile(cropped, avatarFile?.name || 'avatar.jpg');
        const publicUrl = await storage.uploadFile(uploadFile, 'avatars');
        setLocalProfileAvatar(publicUrl);
        onProfileAvatarChange?.(publicUrl);
        await auth.updateProfile?.({ avatar_url: publicUrl });
      } catch {
        await auth.updateProfile?.({ avatar_url: cropped }).catch(() => {});
      }
      setAvatarEditorOpen(false);
      toast.success('Avatar updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not save photo');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleThemePhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const previewUrl = await imageFileToDataUrl(file);
      onThemeModeChange?.('custom');
      onThemePhotoChange?.(previewUrl);
      onThemeBackgroundChange?.('photo');
      setLocalThemeMode('custom');
      setShowBackgrounds(true);
      storage.uploadFile(file, 'backgrounds')
        .then(url => onThemePhotoChange?.(url))
        .catch(() => {});
      toast.success('Background updated');
    } catch (error) {
      console.error(error);
      toast.error('Could not upload photo');
    } finally {
      event.target.value = '';
    }
  };

  const chooseMode = (mode) => {
    setLocalThemeMode(mode);
    onThemeModeChange(mode);
    if (mode === 'light') {
      onThemeBackgroundChange('pastel-rose');
      setShowBackgrounds(false);
    }
    if (mode === 'dark') {
      onThemeBackgroundChange('plum');
      setShowBackgrounds(false);
    }
    if (mode === 'custom') {
      if (!themeBackground || ['aurora', 'nebula'].includes(themeBackground)) onThemeBackgroundChange('pastel-lilac');
      setShowBackgrounds(true);
    }
  };

  const chooseAccent = (accent) => {
    onThemeAccentChange?.(accent);
  };

  const setCustomSleepTimer = () => {
    const minutes = Number(customSleep);
    if (!Number.isFinite(minutes) || minutes <= 0) return toast.error('Enter time in minutes');
    onSleepTimerChange(minutes);
    toast.success(`Sleep timer: ${minutes} min`);
  };

  const chooseLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    localStorage.setItem('dreamtune-language', nextLanguage);
    i18n.changeLanguage(nextLanguage);
    toast.success(t('language.updated'));
  };

  const deleteLocalProfile = () => {
    localStorage.removeItem('profile-avatar');
    localStorage.removeItem('profile-nickname');
    localStorage.removeItem('dreamtune-friends');
    setLocalProfileAvatar('');
    onProfileAvatarChange?.('');
    onProfileNicknameChange?.('Guest');
    clearFriends();
    setConfirmDelete(false);
    toast.success('Profile cleared');
  };

  const openSupport = () => {
    const subject = encodeURIComponent(`DreamTune Support - ${profileNickname || currentUser?.nickname || 'User'}`);
    const url = `mailto:dreamtuneteam@gmail.com?subject=${subject}`;
    if (window.Capacitor?.isNativePlatform?.()) {
      import('@capacitor/browser')
        .then(({ Browser }) => Browser.open({ url }))
        .catch(() => { window.location.href = url; });
      return;
    }
    window.location.href = url;
  };

  const settingOpen = (key) => openSetting === key;
  const toggleSetting = (key) => setOpenSetting(value => (value === key ? null : key));

  return (
    <div className="px-4 pb-4 space-y-5">
      <div className="sticky top-0 z-50 pt-3 pb-3 bg-background/92 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-xs font-bold text-muted-foreground">{t('app.name')}</p>
            <h1 className="text-2xl font-black text-foreground">{t(PROFILE_SECTION_TITLES[section] || 'profile.title')}</h1>
          </div>
        </div>
      </div>

      {section === 'profile' && (
        <>
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-card/95 p-5 shadow-lg shadow-primary/10">
            <div className="flex items-center gap-5">
              <button type="button" onClick={openAvatarEditor} className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 overflow-hidden shrink-0">
                {localProfileAvatar ? <img src={localProfileAvatar} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-11 h-11 text-white" />}
                <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5 text-primary" />
                </span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              <div className="min-w-0 flex-1">
                {editingNickname ? (
                  <div className="flex gap-2">
                    <Input value={nicknameDraft} onChange={e => setNicknameDraft(e.target.value)} className="h-10 bg-secondary border-border rounded-2xl font-bold" autoFocus />
                    <Button size="icon" onClick={saveNickname} className="rounded-2xl shrink-0"><Check className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-foreground truncate">{localProfileNickname}</h2>
                    <Button size="icon" variant="ghost" onClick={() => { setNicknameDraft(localProfileNickname); setEditingNickname(true); }} className="rounded-full shrink-0">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{songs.length} songs · {favoriteCount} favorites · {artistCount} artists</p>
                <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-bold text-foreground">
                  <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              </div>
            </div>
          </motion.section>

          <ProfilePublicPlaylists playlists={publicPlaylists} songs={songs} />
        </>
      )}

      <ProfileAvatarDialog
        open={avatarEditorOpen}
        onOpenChange={setAvatarEditorOpen}
        avatarDraft={avatarDraft}
        avatarPosition={avatarPosition}
        avatarScale={avatarScale}
        avatarInputRef={avatarInputRef}
        savingAvatar={savingAvatar}
        onPositionChange={setAvatarPosition}
        onScaleChange={setAvatarScale}
        onSave={saveAvatar}
      />

      {section === 'friends' && (
        <ProfileFriendsSection
          friendQuery={friendQuery}
          setFriendQuery={setFriendQuery}
          addFriend={addFriend}
          userResults={userResults}
          friendSearchDone={friendSearchDone}
          friendRequests={friendRequests}
          friends={friends}
          requestFriendById={requestFriendById}
          declineCollabInvite={declineCollabInvite}
          declineFriend={declineFriend}
          acceptCollabInvite={acceptCollabInvite}
          acceptFriend={acceptFriend}
          removeFriend={removeFriend}
          onRequestError={error => toast.error(error.message || 'Could not send request')}
        />
      )}

      {section === 'stats' && (
        <ProfileStatsSection
          period={period}
          onPeriodChange={setPeriod}
          periodStats={periodStats}
          topTrack={topTrack}
        />
      )}

      {section === 'theme' && (
        <ProfileThemeSection
          localThemeMode={localThemeMode}
          themeAccent={themeAccent}
          themeBackground={themeBackground}
          themePhoto={themePhoto}
          showBackgrounds={showBackgrounds}
          showPalettes={showPalettes}
          bgInputRef={bgInputRef}
          backgrounds={BACKGROUNDS}
          accents={ACCENTS}
          onChooseMode={chooseMode}
          onChooseAccent={chooseAccent}
          onThemeBackgroundChange={onThemeBackgroundChange}
          onThemePhotoChange={onThemePhotoChange}
          onThemePhotoSelect={handleThemePhotoSelect}
          onToggleBackgrounds={() => setShowBackgrounds(value => !value)}
          onTogglePalettes={() => setShowPalettes(value => !value)}
        />
      )}

      {section === 'sleep' && (
        <ProfileSleepSection
          sleepRemaining={sleepRemaining}
          customSleep={customSleep}
          onCustomSleepChange={setCustomSleep}
          onSleepTimerChange={onSleepTimerChange}
          onStartCustomSleep={setCustomSleepTimer}
        />
      )}


      {section === 'language' && (
        <ProfileLanguageSection
          language={language}
          languages={supportedLanguages}
          t={t}
          onChooseLanguage={chooseLanguage}
        />
      )}
      {section === 'settings' && (
        <ProfileSettingsSection
          confirmDelete={confirmDelete}
          settingOpen={settingOpen}
          toggleSetting={toggleSetting}
          onOpenSupport={openSupport}
          currentUser={currentUser}
          onSignIn={() => navigate('/auth', { replace: false })}
          onSignOut={async () => {
            await onSignOut?.();
            toast.success('Signed out');
          }}
          onDeleteProfile={deleteLocalProfile}
          onCancelDelete={() => setConfirmDelete(false)}
          onAskDelete={() => setConfirmDelete(true)}
        />
      )}
    </div>
  );
}
