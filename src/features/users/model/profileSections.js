export const PROFILE_SECTION_TITLES = {
  profile: 'profile.title',
  friends: 'profile.friends',
  stats: 'profile.stats',
  theme: 'profile.theme',
  sleep: 'profile.sleep',
  language: 'profile.language',
  settings: 'profile.settings',
};

export function formatSleepRemaining(seconds) {
  if (!seconds) return 'Off';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
