const PALETTES = [
  ['#f0abfc', '#93c5fd', '#fde68a'],
  ['#c4b5fd', '#67e8f9', '#fda4af'],
  ['#f9a8d4', '#a7f3d0', '#bfdbfe'],
  ['#fdba74', '#ddd6fe', '#86efac'],
  ['#fca5a5', '#bae6fd', '#fde68a'],
  ['#a5b4fc', '#f0abfc', '#fef3c7'],
];

function hashText(text = '') {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function getGeneratedCover(song = {}) {
  const seed = `${song.title || ''}-${song.artist || ''}`;
  const hash = hashText(seed);
  const colors = PALETTES[hash % PALETTES.length];
  const angle = 120 + (hash % 80);
  const initials = (song.title || song.artist || 'DT')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return {
    initials,
    colors,
    style: {
      background:
        `radial-gradient(circle at 28% 24%, ${colors[2]} 0 14%, transparent 35%), ` +
        `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]} 56%, ${colors[2]})`,
    },
  };
}
