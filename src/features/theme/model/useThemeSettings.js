import { useEffect, useRef, useState } from 'react';
import { applyThemeToDocument, hydrateNativeSettings, isNativePlatform, persistSetting } from './themePreferences';

export function useThemeSettings({ isNativeApp = isNativePlatform(), profileAvatar = '', profileNickname = '', onProfileAvatarChange, onProfileNicknameChange } = {}) {
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('theme-mode') || 'dark');
  const [themeAccent, setThemeAccent] = useState(() => localStorage.getItem('theme-accent') || 'rose');
  const [themeBackground, setThemeBackground] = useState(() => localStorage.getItem('theme-background') || '');
  const [themePhoto, setThemePhoto] = useState(() => localStorage.getItem('theme-photo') || '');
  const nativeSettingsReadyRef = useRef(!isNativeApp);

  useEffect(() => {
    if (!isNativeApp) {
      nativeSettingsReadyRef.current = true;
      return undefined;
    }
    let cancelled = false;
    hydrateNativeSettings((key, value) => {
      if (cancelled) return;
      try { localStorage.setItem(key, value); } catch {}
      if (key === 'theme-mode') setThemeMode(value);
      if (key === 'theme-accent') setThemeAccent(value);
      if (key === 'theme-background') setThemeBackground(value);
      if (key === 'theme-photo') setThemePhoto(value);
      if (key === 'profile-avatar') onProfileAvatarChange?.(value);
      if (key === 'profile-nickname') onProfileNicknameChange?.(value);
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) nativeSettingsReadyRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [isNativeApp, onProfileAvatarChange, onProfileNicknameChange]);

  useEffect(() => {
    applyThemeToDocument({
      themeMode,
      themeAccent,
      themeBackground,
      themePhoto,
      profileAvatar,
      profileNickname,
      persist: (key, value) => persistSetting(key, value, { nativeReady: nativeSettingsReadyRef.current }),
      onThemeAccentChange: setThemeAccent,
      onThemeBackgroundChange: setThemeBackground,
    });
  }, [themeMode, themeAccent, themeBackground, themePhoto, profileAvatar, profileNickname]);

  return {
    themeMode,
    setThemeMode,
    themeAccent,
    setThemeAccent,
    themeBackground,
    setThemeBackground,
    themePhoto,
    setThemePhoto,
  };
}
