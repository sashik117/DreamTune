export const PERSISTED_SETTING_KEYS = [
  'theme-mode',
  'theme-accent',
  'theme-background',
  'theme-photo',
  'profile-avatar',
  'profile-nickname',
];

const customLightBackgrounds = new Set([
  'light-blush',
  'light-sky',
  'light-mint',
  'light-lavender',
  'pastel-rose',
  'pastel-sky',
  'pastel-mint',
  'pastel-lilac',
  'pastel-peach',
]);

const removedBackgrounds = new Set(['aurora', 'nebula']);
const validAccents = new Set([
  'rose',
  'violet',
  'blue',
  'ruby',
  'mint',
  'peach',
  'ice',
  'gold',
  'graphite',
  'sage',
  'velvet',
  'burgundy',
  'midnight',
  'ember',
  'neon',
  'citrus',
  'berry',
]);

let nativePreferencesPromise = null;

export function isNativePlatform() {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
}

export function getNativePreferencesStore() {
  if (!isNativePlatform()) return null;
  if (!nativePreferencesPromise) {
    nativePreferencesPromise = import('@capacitor/preferences')
      .then((module) => module.Preferences)
      .catch(() => null);
  }
  return nativePreferencesPromise;
}

export function persistNativeSetting(key, value) {
  const preferences = getNativePreferencesStore();
  if (!preferences) return;
  preferences.then((store) => {
    if (!store) return;
    if (value === undefined || value === null || value === '') store.remove({ key });
    else store.set({ key, value: String(value) });
  }).catch(() => {});
}

export async function hydrateNativeSettings(applyValue) {
  const preferences = getNativePreferencesStore();
  if (!preferences) return;
  const store = await preferences.catch(() => null);
  if (!store) return;
  const entries = await Promise.all(PERSISTED_SETTING_KEYS.map(async (key) => {
    const { value } = await store.get({ key });
    return [key, value];
  }));
  entries.forEach(([key, value]) => {
    if (value) applyValue(key, value);
  });
}

export function persistSetting(key, value, { nativeReady = true } = {}) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save ${key} locally:`, error);
  }
  if (nativeReady) persistNativeSetting(key, value);
}

export function applyThemeToDocument({
  themeMode,
  themeAccent,
  themeBackground,
  themePhoto,
  profileAvatar,
  profileNickname,
  persist,
  onThemeAccentChange,
  onThemeBackgroundChange,
}) {
  const root = document.documentElement;
  const activeThemeBackground = removedBackgrounds.has(themeBackground) ? 'plum' : themeBackground;
  const activeThemeAccent = validAccents.has(themeAccent) ? themeAccent : 'rose';
  if (activeThemeBackground !== themeBackground) onThemeBackgroundChange?.(activeThemeBackground);
  if (activeThemeAccent !== themeAccent) onThemeAccentChange?.(activeThemeAccent);

  const usesLightSurface = themeMode === 'light' || (themeMode === 'custom' && customLightBackgrounds.has(activeThemeBackground));
  root.classList.toggle('dark', !usesLightSurface);
  root.dataset.themeSurface = usesLightSurface ? 'light' : 'dark';
  root.dataset.themeMode = themeMode;
  root.dataset.themeAccent = activeThemeAccent;
  root.dataset.themeBackground = activeThemeBackground || 'default';
  root.dataset.coverShape = 'square';
  root.style.setProperty('--user-bg-image', themePhoto ? `url("${themePhoto}")` : 'none');

  persist('theme-mode', themeMode);
  persist('theme-accent', activeThemeAccent);
  persist('theme-background', activeThemeBackground);
  persist('theme-photo', themePhoto);
  persist('profile-avatar', profileAvatar);
  persist('profile-nickname', profileNickname);
  try { localStorage.removeItem('cover-shape'); } catch {}
  document.body.dataset.coverShape = 'square';
}
