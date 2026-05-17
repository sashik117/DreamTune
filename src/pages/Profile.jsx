import { Link, useParams } from 'react-router-dom';
import { auth, entities, social, storage } from '@/api/SupabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Camera,
  ChevronDown,
  Check,
  Clock3,
  Globe2,
  Info,
  Languages,
  LifeBuoy,
  ListMusic,
  LogOut,
  Mail,
  Moon,
  Pencil,
  Search,
  Shield,
  Sparkles,
  Sun,
  TimerOff,
  Trash2,
  UserCircle,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import CoverArt from '../components/CoverArt';
import ImageCropBox from '../components/ImageCropBox';
import { cropImageToDataUrl, dataUrlToFile } from '../utils/imageCrop';
import { useTranslation } from 'react-i18next';
import i18n, { supportedLanguages } from '../i18n';

const ACCENTS = [
  { key: 'rose', name: '\u0420\u043e\u0436\u0435\u0432\u0430', primary: '326 82% 72%', accent: '188 76% 72%' },
  { key: 'violet', name: '\u0424\u0456\u043e\u043b\u0435\u0442\u043e\u0432\u0430', primary: '266 92% 76%', accent: '190 90% 72%' },
  { key: 'blue', name: '\u0421\u0438\u043d\u044f', primary: '210 95% 68%', accent: '176 78% 62%' },
  { key: 'ruby', name: '\u0420\u0443\u0431\u0456\u043d\u043e\u0432\u0430', primary: '350 86% 66%', accent: '28 92% 65%' },
  { key: 'mint', name: '\u041c\u02bc\u044f\u0442\u043d\u0430', primary: '168 74% 58%', accent: '285 78% 76%' },
  { key: 'peach', name: '\u041f\u0435\u0440\u0441\u0438\u043a', primary: '20 92% 70%', accent: '330 78% 74%' },
  { key: 'ice', name: '\u041b\u0456\u0434', primary: '185 84% 72%', accent: '220 90% 78%' },
  { key: 'gold', name: '\u0417\u043e\u043b\u043e\u0442\u043e', primary: '45 92% 58%', accent: '20 90% 68%' },
  { key: 'graphite', name: '\u0413\u0440\u0430\u0444\u0456\u0442', primary: '220 16% 72%', accent: '180 18% 68%' },
  { key: 'sage', name: '\u0428\u0430\u0432\u043b\u0456\u044f', primary: '142 42% 55%', accent: '178 48% 64%' },
  { key: 'velvet', name: '\u041e\u043a\u0441\u0430\u043c\u0438\u0442', primary: '336 74% 58%', accent: '18 78% 66%' },
  { key: 'burgundy', name: '\u0411\u043e\u0440\u0434\u043e', primary: '348 78% 50%', accent: '12 82% 64%' },
  { key: 'midnight', name: '\u041e\u043f\u0456\u0432\u043d\u0456\u0447\u043d\u0430', primary: '218 78% 66%', accent: '188 72% 62%' },
  { key: 'ember', name: '\u0416\u0430\u0440', primary: '16 95% 58%', accent: '45 96% 62%' },
  { key: 'neon', name: '\u041d\u0435\u043e\u043d', primary: '292 92% 64%', accent: '174 92% 54%' },
  { key: 'citrus', name: '\u0426\u0438\u0442\u0440\u0443\u0441', primary: '74 86% 52%', accent: '32 96% 58%' },
  { key: 'berry', name: '\u042f\u0433\u043e\u0434\u0430', primary: '335 82% 56%', accent: '268 84% 66%' },
];

const BACKGROUNDS = [
  { key: 'pastel-rose', name: '\u041f\u0443\u0434\u0440\u043e\u0432\u0430 \u0442\u0440\u043e\u044f\u043d\u0434\u0430', preview: 'radial-gradient(circle at 20% 0%,#e89bbc,transparent 36%),linear-gradient(145deg,#efd3df,#e4eef4)' },
  { key: 'pastel-sky', name: '\u041c\u043e\u043b\u043e\u0447\u043d\u0435 \u043d\u0435\u0431\u043e', preview: 'radial-gradient(circle at 80% 10%,#7cbedf,transparent 36%),linear-gradient(145deg,#d6eaf4,#f0e2ed)' },
  { key: 'pastel-mint', name: '\u0422\u0438\u0445\u0430 \u043c\u02bc\u044f\u0442\u0430', preview: 'radial-gradient(circle at 15% 0%,#85cdac,transparent 36%),linear-gradient(145deg,#d8eee3,#f1e5ed)' },
  { key: 'pastel-lilac', name: '\u041b\u0456\u043b\u043e\u0432\u0438\u0439 \u0442\u0443\u043c\u0430\u043d', preview: 'radial-gradient(circle at 80% 10%,#b19ee1,transparent 36%),linear-gradient(145deg,#e4d9f2,#e4edf4)' },
  { key: 'pastel-peach', name: '\u041d\u0456\u0436\u043d\u0438\u0439 \u043f\u0435\u0440\u0441\u0438\u043a', preview: 'radial-gradient(circle at 18% 0%,#e8ab89,transparent 36%),linear-gradient(145deg,#f1d9cd,#e8edf4)' },
  { key: 'light-blush', name: '\u0420\u0443\u043c\u02bc\u044f\u043d\u0435\u0446\u044c', preview: 'radial-gradient(circle at 20% 0%,#f4b7d5,transparent 36%),linear-gradient(145deg,#f9dfe9,#e9f3f6)' },
  { key: 'light-sky', name: '\u0421\u0432\u0456\u0442\u043b\u0435 \u043d\u0435\u0431\u043e', preview: 'radial-gradient(circle at 80% 10%,#97d5ef,transparent 36%),linear-gradient(145deg,#dcedf7,#f5e8f3)' },
  { key: 'light-mint', name: '\u0421\u0432\u0456\u0442\u043b\u0430 \u043c\u02bc\u044f\u0442\u0430', preview: 'radial-gradient(circle at 15% 0%,#9cdbb7,transparent 36%),linear-gradient(145deg,#dff2e7,#f5ecef)' },
  { key: 'light-lavender', name: '\u041b\u0430\u0432\u0430\u043d\u0434\u0430', preview: 'radial-gradient(circle at 80% 10%,#cabefd,transparent 36%),linear-gradient(145deg,#eee4f6,#e8f0f6)' },
  { key: 'plum', name: '\u0421\u043b\u0438\u0432\u0430', preview: 'radial-gradient(circle at 20% 0%,#7c3aed66,transparent 35%),linear-gradient(145deg,#090511,#1c1230)' },
  { key: 'rose', name: '\u0420\u043e\u0436\u0435\u0432\u0438\u0439 \u0434\u0438\u043c', preview: 'radial-gradient(circle at 20% 0%,#ec489966,transparent 35%),linear-gradient(145deg,#120711,#24101c)' },
  { key: 'ocean', name: '\u041e\u043a\u0435\u0430\u043d', preview: 'radial-gradient(circle at 80% 10%,#22d3ee66,transparent 35%),linear-gradient(145deg,#04121d,#0b2235)' },
  { key: 'forest', name: '\u041b\u0456\u0441', preview: 'radial-gradient(circle at 18% 0%,#34d39966,transparent 35%),linear-gradient(145deg,#04140e,#10251b)' },
  { key: 'sunset', name: '\u0417\u0430\u0445\u0456\u0434', preview: 'radial-gradient(circle at 18% 0%,#f9731666,transparent 35%),linear-gradient(145deg,#170a07,#2a1710)' },
  { key: 'velvet', name: '\u041e\u043a\u0441\u0430\u043c\u0438\u0442', preview: 'radial-gradient(circle at 18% 0%,#be185d66,transparent 35%),radial-gradient(circle at 84% 16%,#f9731660,transparent 35%),linear-gradient(145deg,#13070d,#25101a)' },
  { key: 'noir', name: '\u041d\u0443\u0430\u0440', preview: 'radial-gradient(circle at 78% 8%,#94a3b866,transparent 35%),radial-gradient(circle at 18% 20%,#64748b44,transparent 35%),linear-gradient(145deg,#05070b,#171923)' },
  { key: 'cyber', name: '\u041a\u0456\u0431\u0435\u0440\u043d\u0456\u0447', preview: 'radial-gradient(circle at 85% 8%,#22d3ee66,transparent 35%),radial-gradient(circle at 14% 18%,#a855f766,transparent 35%),linear-gradient(145deg,#030712,#0b1024)' },
  { key: 'wine', name: '\u0412\u0438\u043d\u043d\u0438\u0439', preview: 'radial-gradient(circle at 18% 0%,#e11d4866,transparent 35%),radial-gradient(circle at 82% 18%,#7f1d1d66,transparent 35%),linear-gradient(145deg,#140407,#2a0f14)' },
  { key: 'deepsea', name: '\u0413\u043b\u0438\u0431\u0438\u043d\u0430', preview: 'radial-gradient(circle at 84% 8%,#0ea5e966,transparent 35%),radial-gradient(circle at 12% 18%,#14b8a666,transparent 35%),linear-gradient(145deg,#021018,#08202d)' },
];

const ACCENT_BACKGROUNDS = {
  rose: 'pastel-rose',
  violet: 'pastel-lilac',
  blue: 'pastel-sky',
  ruby: 'pastel-peach',
  mint: 'pastel-mint',
  peach: 'pastel-peach',
  ice: 'light-sky',
  gold: 'pastel-peach',
  graphite: 'noir',
  sage: 'pastel-mint',
  velvet: 'velvet',
  burgundy: 'wine',
  midnight: 'midnight',
  ember: 'sunset',
  neon: 'cyber',
  citrus: 'pastel-mint',
  berry: 'pastel-lilac',
};

const TITLES = {
  profile: 'profile.title',
  friends: 'profile.friends',
  stats: 'profile.stats',
  theme: 'profile.theme',
  sleep: 'profile.sleep',
  language: 'profile.language',
  settings: 'profile.settings',
};

function formatRemaining(seconds) {
  if (!seconds) return 'Вимкнено';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function PlaylistCover({ playlist, songs }) {
  const coverSongs = (playlist.song_ids || []).map(id => songs.find(song => song.id === id)).filter(Boolean).slice(0, 4);
  if (playlist.cover_url) return <img src={playlist.cover_url} alt="" className="w-full h-full object-cover" />;
  if (coverSongs.length) {
    return (
      <div className="grid grid-cols-2 w-full h-full">
        {coverSongs.map(song => <CoverArt key={song.id} song={song} className="w-full h-full rounded-none" />)}
      </div>
    );
  }
  return <ListMusic className="w-6 h-6 text-muted-foreground" />;
}

export default function Profile({
  songs = [],
  playlists = [],
  themeMode,
  themeAccent,
  themeBackground,
  themePhoto,
  profileAvatar,
  profileNickname = 'DreamTune',
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
  const [friendQuery, setFriendQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [friendSearchDone, setFriendSearchDone] = useState(false);
  const [customSleep, setCustomSleep] = useState('');
  const [period, setPeriod] = useState(7);
  const [listenHistory, setListenHistory] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(profileNickname);
  const [localProfileNickname, setLocalProfileNickname] = useState(profileNickname || currentUser?.nickname || 'DreamTune');
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

  useEffect(() => {
    setLocalThemeMode(themeMode || 'dark');
    if (themeMode === 'custom') setShowBackgrounds(true);
  }, [themeMode]);

  useEffect(() => {
    setLocalProfileAvatar(profileAvatar || '');
  }, [profileAvatar]);

  useEffect(() => {
    const next = profileNickname || currentUser?.nickname || 'DreamTune';
    setLocalProfileNickname(next);
    if (!editingNickname) setNicknameDraft(next);
  }, [profileNickname, currentUser?.nickname, editingNickname]);

  const email = currentUser?.email || 'local@dreamtune.app';
  const publicPlaylists = playlists.filter(playlist => playlist.is_public);
  const favoriteCount = songs.filter(song => song.is_favorite).length;
  const artistCount = new Set(songs.map(song => song.artist).filter(Boolean)).size;
  const periodStats = useMemo(() => {
    const cutoff = Date.now() - period * 24 * 60 * 60 * 1000;
    const listens = listenHistory.filter(item => Number(item.listened_at || 0) >= cutoff);
    const listenedSongIds = new Set(listens.map(item => item.song_id).filter(Boolean));
    const listenedSongs = songs.filter(song => listenedSongIds.has(song.id));
    return {
      listens: listens.length,
      tracks: listenedSongIds.size,
      artists: new Set(listenedSongs.map(song => song.artist).filter(Boolean)).size,
      topTrack: listens.reduce((acc, item) => {
        const key = item.song_id || `${item.song_title}-${item.song_artist}`;
        acc[key] = acc[key] || { title: item.song_title || 'Невідомий трек', artist: item.song_artist || '', count: 0 };
        acc[key].count += 1;
        return acc;
      }, {}),
    };
  }, [listenHistory, songs, period]);

  const topTrack = useMemo(() => {
    const tracks = Object.values(periodStats.topTrack || {});
    return tracks.sort((a, b) => b.count - a.count)[0] || null;
  }, [periodStats.topTrack]);

  useEffect(() => {
    if (section !== 'stats') return;
    entities.ListenHistory.list()
      .then(setListenHistory)
      .catch(() => setListenHistory([]));
  }, [section]);

  const saveNickname = async () => {
    const next = nicknameDraft.trim().replace(/^@/, '');
    if (next.length < 2) return toast.error('Нікнейм має бути довший');
    setLocalProfileNickname(next);
    onProfileNicknameChange?.(next);
    setNicknameDraft(next);
    setEditingNickname(false);
    try {
      await auth.updateProfile?.({ nickname: next });
      toast.success('Нікнейм оновлено');
    } catch {
      toast.success('Нікнейм оновлено на цьому пристрої');
    }
  };

  useEffect(() => {
    if (section !== 'friends') return;
    loadFriends();
  }, [section]);

  useEffect(() => {
    if (section !== 'friends') return;
    const query = friendQuery.trim();
    if (query.length < 2) {
      setUserResults([]);
      setFriendSearchDone(false);
      return;
    }
    const timer = window.setTimeout(() => {
      social.searchUsers(query)
        .then(results => {
          setUserResults(results.filter(user => user.relationship !== 'friend'));
          setFriendSearchDone(true);
        })
        .catch(() => {
          setUserResults([]);
          setFriendSearchDone(true);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [friendQuery, section]);

  const loadFriends = async () => {
    try {
      const [friendList, requestList] = await Promise.all([
        social.listFriends(),
        social.listFriendRequests(),
      ]);
      setFriends(friendList);
      setFriendRequests(requestList);
      if (requestList.length) onFriendRequestsViewed?.();
    } catch (error) {
      console.error(error);
    }
  };

  const addFriend = async () => {
    const nickname = friendQuery.trim().replace(/^@/, '');
    if (!nickname) return;
    if (friends.some(friend => friend.nickname.toLowerCase() === nickname.toLowerCase())) {
      setFriendQuery('');
      setUserResults([]);
      setFriendSearchDone(false);
      return;
    }
    try {
      const result = await social.requestFriend({ nickname });
      setFriendQuery('');
      if (result.accepted || result.already_friends) {
        toast.success(`@${nickname} додано в друзі`);
        loadFriends();
        onFriendRequestCountRefresh?.();
      } else {
        toast.success(`Запит для @${nickname} надіслано`);
      }
    } catch (error) {
      toast.error(error.message === 'User not found' ? 'Користувача не знайдено' : error.message || 'Не вийшло надіслати запит');
    }
  };

  const acceptFriend = async (requestId) => {
    try {
      await social.acceptFriendRequest(requestId);
      toast.success('Запит прийнято');
      loadFriends();
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Не вийшло прийняти запит');
    }
  };

  const declineFriend = async (requestId) => {
    try {
      await social.declineFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(request => request.id !== requestId));
      toast.success('Запит відхилено');
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Не вийшло відхилити запит');
    }
  };

  const acceptCollabInvite = async (requestId) => {
    try {
      await social.acceptCollabInvite(requestId);
      toast.success('Запрошення в плейлист прийнято');
      loadFriends();
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Не вийшло прийняти запрошення');
    }
  };

  const declineCollabInvite = async (requestId) => {
    try {
      await social.declineCollabInvite(requestId);
      setFriendRequests(prev => prev.filter(request => request.id !== requestId));
      toast.success('Запрошення відхилено');
      onFriendRequestCountRefresh?.();
    } catch (error) {
      toast.error(error.message || 'Не вийшло відхилити запрошення');
    }
  };

  const removeFriend = async (friend) => {
    if (!friend?.id) return;
    const ok = window.confirm(`Видалити @${friend.nickname} з друзів?`);
    if (!ok) return;
    try {
      await social.removeFriend(friend.id);
      setFriends(prev => prev.filter(item => item.id !== friend.id));
      setUserResults(prev => prev.map(item => item.id === friend.id ? { ...item, relationship: 'none' } : item));
      toast.success('Друга видалено');
    } catch (error) {
      toast.error(error.message || 'Не вийшло видалити друга');
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
      toast.error('Не вийшло відкрити фото');
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
      toast.success('Аватарку оновлено');
    } catch (error) {
      console.error(error);
      toast.error('Не вийшло зберегти фото');
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
      toast.success('\u0424\u043e\u043d \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043e');
    } catch (error) {
      console.error(error);
      toast.error('\u041d\u0435 \u0432\u0438\u0439\u0448\u043b\u043e \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438 \u0444\u043e\u0442\u043e');
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
    if (localThemeMode === 'custom' && themeBackground !== 'photo') {
      onThemeBackgroundChange?.(ACCENT_BACKGROUNDS[accent] || 'pastel-lilac');
    }
  };

  const setCustomSleepTimer = () => {
    const minutes = Number(customSleep);
    if (!Number.isFinite(minutes) || minutes <= 0) return toast.error('Введи час у хвилинах');
    onSleepTimerChange(minutes);
    toast.success(`Таймер сну: ${minutes} хв`);
  };

  const chooseLanguage = (nextLanguage) => {
    setLanguage(nextLanguage);
    i18n.changeLanguage(nextLanguage);
    toast.success(t('language.updated'));
  };

  const deleteLocalProfile = () => {
    localStorage.removeItem('profile-avatar');
    localStorage.removeItem('profile-nickname');
    localStorage.removeItem('dreamtune-friends');
    setLocalProfileAvatar('');
    onProfileAvatarChange?.('');
    onProfileNicknameChange?.('DreamTune');
    setFriends([]);
    setConfirmDelete(false);
    toast.success('Профіль очищено');
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

  const SettingCard = ({ id, icon: Icon, title, description, children, danger = false }) => (
    <section className={`rounded-3xl border ${danger ? 'border-destructive/40' : 'border-border'} bg-card/95 overflow-hidden`}>
      <button type="button" onClick={() => toggleSetting(id)} className="w-full p-4 text-left flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${danger ? 'text-destructive' : 'text-primary'} shrink-0`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-foreground truncate">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <ChevronDown className={`w-4 h-4 mt-1 text-muted-foreground transition-transform ${settingOpen(id) ? 'rotate-180' : ''}`} />
      </button>
      {settingOpen(id) && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );

  return (
    <div className="px-4 pb-4 space-y-5">
      <div className="sticky top-0 z-50 pt-3 pb-3 bg-background/92 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-xs font-bold text-muted-foreground">{t('app.name')}</p>
            <h1 className="text-2xl font-black text-foreground">{t(TITLES[section] || 'profile.title')}</h1>
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
                <p className="text-sm text-muted-foreground">{songs.length} пісень · {favoriteCount} улюблених · {artistCount} артистів</p>
                <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-bold text-foreground">
                  <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              </div>
            </div>
          </motion.section>

          <section className="rounded-3xl border border-border bg-card/95 p-4">
            <h2 className="text-base font-black text-foreground mb-3">Публічні плейлисти</h2>
            <div className="space-y-2">
              {publicPlaylists.length ? publicPlaylists.map(playlist => (
                <Link key={playlist.id} to={`/playlists/${playlist.id}`} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                    <PlaylistCover playlist={playlist} songs={songs} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">{playlist.song_ids?.length || 0} пісень</p>
                  </div>
                  <Globe2 className="w-4 h-4 text-muted-foreground" />
                </Link>
              )) : <p className="text-sm text-muted-foreground">Публічних плейлистів ще немає.</p>}
            </div>
          </section>
        </>
      )}

      <Dialog open={avatarEditorOpen} onOpenChange={setAvatarEditorOpen}>
        <DialogContent className="bg-card border-border rounded-3xl w-[calc(100vw-2rem)] max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>Аватарка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <ImageCropBox
              preview={avatarDraft}
              position={avatarPosition}
              scale={avatarScale}
              onPositionChange={setAvatarPosition}
              onScaleChange={setAvatarScale}
              onPick={() => avatarInputRef.current?.click()}
              emptyLabel="Додати фото"
              className="mx-auto w-full max-w-[220px] rounded-full"
              marker={false}
            />
            {avatarDraft && <p className="text-center text-[11px] text-muted-foreground">Перетягни фото або розведи пальці для масштабу</p>}
            <Button type="button" variant="outline" onClick={() => avatarInputRef.current?.click()} className="w-full rounded-2xl border-border">
              <Camera className="w-4 h-4 mr-2" /> Вибрати фото
            </Button>
            <Button onClick={saveAvatar} disabled={savingAvatar || !avatarDraft} className="w-full rounded-2xl">
              {savingAvatar ? 'Збереження...' : 'Зберегти'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {section === 'friends' && (
        <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={friendQuery} onChange={e => setFriendQuery(e.target.value)} placeholder="Нікнейм друга..." className="pl-10 bg-secondary border-border rounded-2xl" onKeyDown={e => e.key === 'Enter' && addFriend()} />
          </div>
          <Button onClick={addFriend} className="w-full rounded-2xl">Додати друга</Button>
          {userResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Знайдені користувачі</p>
              {userResults.map(user => (
                <div key={user.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden shrink-0">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <UserCircle className="w-6 h-6 text-white" />}
                  </div>
                  <Link to={`/profile/user/${user.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.relationship === 'friend' ? 'В друзях' : user.relationship === 'pending' ? 'Запит надіслано' : 'Можна додати'}</p>
                  </Link>
                  {user.relationship === 'friend' ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">Друг</span>
                  ) : user.relationship === 'pending' ? (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">Очікує</span>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          await social.requestFriend({ friend_id: user.id });
                          setUserResults(prev => prev.map(item => item.id === user.id ? { ...item, relationship: 'pending' } : item));
                          toast.success(`Запит для @${user.nickname} надіслано`);
                        } catch (error) {
                          toast.error(error.message || 'Не вийшло надіслати запит');
                        }
                      }}
                    >
                      Додати
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {friendSearchDone && friendQuery.trim().length >= 2 && userResults.length === 0 && (
            <div className="rounded-2xl bg-secondary/70 p-3 text-sm font-bold text-muted-foreground">
              Користувача не знайдено
            </div>
          )}
          {friendRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Запити</p>
              {friendRequests.map(request => {
                const isCollab = request.request_type === 'collab_playlist';
                return (
                  <div key={`${request.request_type || 'friend'}-${request.id}`} className="flex items-center gap-3 rounded-2xl bg-primary/10 p-3">
                    <div className="relative shrink-0">
                      <Users className="w-5 h-5 text-primary" />
                      <span className="absolute -right-2 -top-2 h-4 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white ring-2 ring-card">
                        1
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">@{request.sender_nickname}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {isCollab ? `Запрошує в плейлист "${request.playlist_name}"` : 'Хоче додатися в друзі'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => isCollab ? declineCollabInvite(request.id) : declineFriend(request.id)} className="rounded-xl border-border">
                        Ні
                      </Button>
                      <Button size="sm" onClick={() => isCollab ? acceptCollabInvite(request.id) : acceptFriend(request.id)} className="rounded-xl">
                        Прийняти
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-2">
            {friends.length ? friends.map(friend => (
              <div key={friend.id} className="flex items-center gap-3 rounded-2xl bg-secondary/70 p-3">
                <Users className="w-5 h-5 text-primary" />
                <Link to={`/profile/user/${friend.id}`} className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">@{friend.nickname}</p>
                  <p className="text-xs text-muted-foreground">Можна додавати в спільні плейлисти</p>
                </Link>
                <Button asChild size="sm" variant="outline" className="rounded-xl border-border">
                  <Link to={`/profile/user/${friend.id}`}>
                  Профіль
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl border-border text-destructive hover:text-destructive" onClick={() => removeFriend(friend)}>
                  Видалити
                </Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">Додай друзів за нікнеймом, щоб потім створювати з ними спільні плейлисти.</p>}
          </div>
        </section>
      )}

      {section === 'stats' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[[7, 'Тиждень'], [30, 'Місяць'], [180, 'Півроку'], [365, 'Рік']].map(([days, label]) => (
              <button key={days} onClick={() => setPeriod(days)} className={`px-4 py-2 rounded-2xl text-sm font-bold whitespace-nowrap ${period === days ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-secondary text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ['Прослуховувань', periodStats.listens],
              ['Треків слухала', periodStats.tracks],
              ['Артистів звучало', periodStats.artists],
            ].map(([label, value]) => (
              <div key={label} className="rounded-3xl border border-border bg-card/95 p-5">
                <BarChart3 className="w-5 h-5 text-primary mb-3" />
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-3xl font-black text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {periodStats.listens === 0 ? (
            <div className="rounded-3xl border border-border bg-card/95 p-5 text-center">
              <p className="text-base font-black text-foreground">Даних за цей період ще немає</p>
              <p className="mt-1 text-sm text-muted-foreground">Починай слухати, щоб ми зібрали твій вайб!</p>
            </div>
          ) : topTrack && (
            <div className="rounded-3xl border border-border bg-card/95 p-5">
              <p className="text-sm text-muted-foreground">Найчастіше звучав</p>
              <p className="mt-1 text-xl font-black text-foreground truncate">{topTrack.title}</p>
              <p className="text-sm text-muted-foreground truncate">{topTrack.artist || 'Невідомий'} · {topTrack.count} разів</p>
            </div>
          )}
        </div>
      )}

      {section === 'theme' && (
        <div className="space-y-5">
          <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
            <h2 className="text-base font-black text-foreground">Режим</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['light', 'Світла', Sun],
                ['dark', 'Темна', Moon],
                ['custom', 'Своя', Sparkles],
              ].map(([mode, label, Icon]) => (
                <button key={mode} onClick={() => chooseMode(mode)} className={`rounded-2xl border p-3 text-sm font-black transition ${localThemeMode === mode ? 'border-primary bg-primary/15 text-primary ring-2 ring-primary/25' : 'border-border bg-secondary text-foreground'}`}>
                  <Icon className="w-5 h-5 mx-auto mb-1" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {localThemeMode === 'custom' && (
            <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
              <button onClick={() => setShowBackgrounds(value => !value)} className="w-full rounded-2xl bg-secondary text-foreground px-4 py-3 text-sm font-bold text-left">
                {showBackgrounds ? 'Сховати фони' : 'Відкрити фони'}
              </button>
              {showBackgrounds && (
                <div className="space-y-3">
                  <div className="rounded-3xl border border-primary/25 bg-primary/10 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-secondary flex items-center justify-center">
                        {themePhoto ? <img src={themePhoto} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-primary" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-foreground">{'\u0421\u0432\u043e\u0454 \u0444\u043e\u0442\u043e \u043d\u0430 \u0444\u043e\u043d'}</p>
                        <p className="text-xs text-muted-foreground">{'\u041f\u043e\u0441\u0442\u0430\u0432 \u0431\u0443\u0434\u044c-\u044f\u043a\u0443 \u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0443 \u044f\u043a \u0444\u043e\u043d \u0434\u043e\u0434\u0430\u0442\u043a\u0443.'}</p>
                      </div>
                      <Button type="button" size="sm" onClick={() => bgInputRef.current?.click()} className="rounded-2xl">{'\u0412\u0438\u0431\u0440\u0430\u0442\u0438'}</Button>
                    </div>
                    <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleThemePhotoSelect} />
                    {themePhoto && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { onThemePhotoChange?.(''); if (themeBackground === 'photo') onThemeBackgroundChange?.('pastel-lilac'); }} className="mt-2 rounded-2xl text-muted-foreground">
                        {'\u041f\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0444\u043e\u0442\u043e'}
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BACKGROUNDS.map(bg => (
                    <button key={bg.key} onClick={() => onThemeBackgroundChange(bg.key)} className={`rounded-2xl border p-2 text-left transition ${themeBackground === bg.key ? 'border-primary bg-primary/10 ring-2 ring-primary/25' : 'border-border bg-secondary/70'}`}>
                      <div className="h-16 rounded-xl mb-2" style={{ background: bg.preview }} />
                      <p className="text-sm font-bold text-foreground">{bg.name}</p>
                    </button>
                  ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="rounded-3xl border border-border bg-card/95 p-4 space-y-3">
            <button onClick={() => setShowPalettes(value => !value)} className="w-full rounded-2xl bg-secondary text-foreground px-4 py-3 text-sm font-bold text-left">
              {showPalettes ? 'Сховати палітру' : 'Відкрити палітру'}
            </button>
            {showPalettes && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ACCENTS.map(theme => (
                  <button key={theme.key} onClick={() => chooseAccent(theme.key)} className={`rounded-2xl border p-2 text-left transition ${themeAccent === theme.key ? 'border-primary bg-primary/10 ring-2 ring-primary/25' : 'border-border bg-secondary/70'}`}>
                    <div className="h-14 rounded-xl mb-2" style={{ background: `linear-gradient(135deg, hsl(${theme.primary}), hsl(${theme.accent}))` }} />
                    <p className="text-sm font-bold text-foreground">{theme.name}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {section === 'sleep' && (
        <section className="rounded-3xl border border-border bg-card/95 p-5 space-y-4">
          <Clock3 className="w-6 h-6 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Залишилось</p>
            <p className="text-3xl font-black text-foreground">{formatRemaining(sleepRemaining)}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[15, 30, 60].map(minutes => (
              <Button key={minutes} variant="outline" onClick={() => onSleepTimerChange(minutes)} className="rounded-2xl border-border">{minutes} хв</Button>
            ))}
            <Button variant="outline" onClick={() => onSleepTimerChange(0)} className="rounded-2xl border-border gap-2"><TimerOff className="w-4 h-4" /> Скинути</Button>
          </div>
          <div className="flex gap-2">
            <Input value={customSleep} onChange={e => setCustomSleep(e.target.value)} inputMode="numeric" placeholder="Свій час у хвилинах" className="bg-secondary border-border rounded-2xl" />
            <Button onClick={setCustomSleepTimer} className="rounded-2xl">Старт</Button>
          </div>
        </section>
      )}


      {section === 'language' && (
        <section className="rounded-3xl border border-border bg-card/95 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Languages className="w-6 h-6 text-primary mt-0.5" />
            <div>
              <h2 className="text-base font-black text-foreground">{t('language.title')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('language.description')}</p>
              <p className="text-xs text-muted-foreground mt-2">{t('language.auto')}</p>
            </div>
          </div>
          <div className="grid gap-2">
            {supportedLanguages.map(({ code, nameKey, nativeName }) => (
              <button
                key={code}
                type="button"
                onClick={() => chooseLanguage(code)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${language === code ? 'border-primary bg-primary/15 ring-2 ring-primary/20' : 'border-border bg-secondary/70 hover:bg-secondary'}`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${language === code ? 'border-primary bg-primary' : 'border-muted-foreground/50'}`}>
                  {language === code && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-foreground">{t(nameKey)}</p>
                  <p className="text-xs text-muted-foreground">{nativeName}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {section === 'settings' && (
        <div className="space-y-3">
          <SettingCard
            id="privacy"
            icon={Shield}
            title="Приватність"
            description="Публічність плейлистів змінюється в режимі редагування кожного окремого плейлиста."
          >
            <p className="rounded-2xl bg-secondary/70 p-3 text-sm text-muted-foreground">
              Публічні плейлисти видно у профілі. Приватні лишаються тільки для тебе.
            </p>
          </SettingCard>

          <SettingCard
            id="support"
            icon={LifeBuoy}
            title="Підтримка"
            description="Напиши нам, якщо щось не працює або потрібна допомога."
          >
            <button
              type="button"
              onClick={openSupport}
              className="w-full rounded-2xl bg-secondary/70 p-3 text-left text-sm font-bold text-foreground hover:bg-secondary"
            >
              dreamtuneteam@gmail.com
              <span className="block text-xs font-medium text-muted-foreground">Тема листа підставиться автоматично.</span>
            </button>
          </SettingCard>

          <SettingCard
            id="about"
            icon={Info}
            title="Про програму"
            description="DreamTune зберігає твою музику, плейлисти й налаштування локально."
          >
            <div className="rounded-2xl bg-secondary/70 p-3 text-sm text-muted-foreground space-y-2">
              <p>DreamTune — це твій особистий музичний простір для треків, плейлистів, тем і спільного слухання.</p>
              <p>Додаток створений так, щоб музика, обкладинки й налаштування були під рукою без зайвого шуму.</p>
            </div>
          </SettingCard>

          <SettingCard
            id="account"
            icon={AlertTriangle}
            title="Акаунт"
            description="Вийди з профілю або видали акаунт, якщо більше не хочеш зберігати дані."
            danger
          >
            <div className="space-y-2">
              <Button variant="outline" className="w-full rounded-2xl border-border justify-start" onClick={async () => {
                await onSignOut?.();
                toast.success('Вийшли з профілю');
              }}>
                <LogOut className="w-4 h-4 mr-2" /> Вийти з профілю
              </Button>
              {confirmDelete ? (
                <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-3 space-y-3">
                  <p className="text-sm font-bold text-foreground">Ви впевнені? Це видалить усі ваші дані назавжди.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-2xl border-border" onClick={() => setConfirmDelete(false)}>Скасувати</Button>
                    <Button variant="destructive" className="flex-1 rounded-2xl gap-2" onClick={deleteLocalProfile}>
                      <Trash2 className="w-4 h-4" /> Видалити
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" className="w-full rounded-2xl justify-start" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Видалити акаунт
                </Button>
              )}
            </div>
          </SettingCard>
        </div>
      )}
    </div>
  );
}
