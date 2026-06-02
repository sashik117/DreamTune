import { useCallback, useEffect, useState } from 'react';
import { persistNativeSetting } from '../../theme/model/themePreferences';
import { clearCachedUser, DEFAULT_PROFILE_NICKNAME, writeCachedUser } from './sessionStorage';

export function useProfileSession() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('profile-avatar') || '');
  const [profileNickname, setProfileNickname] = useState(() => localStorage.getItem('profile-nickname') || DEFAULT_PROFILE_NICKNAME);

  useEffect(() => {
    if (currentUser?.id) writeCachedUser(currentUser);
  }, [currentUser]);

  const applyCurrentUser = useCallback((user) => {
    if (!user?.id) return;
    setCurrentUser(user);
    writeCachedUser(user);
    if (user.nickname) setProfileNickname(user.nickname);
    if (user.avatar_url) setProfileAvatar(user.avatar_url);
  }, []);

  const handleProfileNicknameChange = useCallback((nickname) => {
    setProfileNickname(nickname);
    setCurrentUser(prev => prev ? { ...prev, nickname } : prev);
  }, []);

  const handleProfileAvatarChange = useCallback((avatar) => {
    setProfileAvatar(avatar);
    setCurrentUser(prev => prev ? { ...prev, avatar_url: avatar } : prev);
  }, []);

  const clearProfileSession = useCallback(() => {
    clearCachedUser();
    localStorage.removeItem('profile-nickname');
    localStorage.removeItem('profile-avatar');
    persistNativeSetting('profile-nickname', '');
    persistNativeSetting('profile-avatar', '');
    setCurrentUser(null);
    setProfileNickname(DEFAULT_PROFILE_NICKNAME);
    setProfileAvatar('');
  }, []);

  return {
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
  };
}
