export const PLAYER_TABS = [
  { key: 'player', label: 'Player' },
  { key: 'lyrics', label: 'Lyrics' },
  { key: 'eq', label: 'EQ' },
];

export function formatPlayerTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatSleepRemaining(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function repeatToastMessage(value) {
  if (!value) return 'Repeat is off';
  const suffix = value === 1 ? 'time' : 'times';
  return `Repeat enabled: ${value} ${suffix}`;
}
