export function formatEditTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatLrcTime(seconds) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const hundredths = Math.floor((safe - Math.floor(safe)) * 100);
  return `[${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}]`;
}

export function shiftSyncedLyrics(lyrics, offsetDelta, nextDuration) {
  if (!lyrics || Math.abs(offsetDelta) < 0.01) return lyrics;
  const timeRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  let hasTimedLines = false;

  const shifted = lyrics.split('\n').map(line => {
    const matches = [...line.matchAll(timeRe)];
    if (!matches.length) return line;
    hasTimedLines = true;

    const lyric = line.replace(timeRe, '').trim();
    const nextTimes = matches
      .map(match => {
        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        const ms = Number((match[3] || '0').padEnd(3, '0'));
        return minutes * 60 + seconds + ms / 1000 - offsetDelta;
      })
      .filter(time => time >= -0.05 && (!nextDuration || time <= nextDuration + 2))
      .map(time => formatLrcTime(time));

    if (!nextTimes.length) return '';
    return `${nextTimes.join('')}${lyric}`;
  }).filter(Boolean).join('\n');

  return hasTimedLines ? shifted : lyrics;
}

export function parseCoverPosition(value) {
  const [x = '50%', y = '50%'] = String(value || '50% 50%').split(' ');
  const px = Number(x.replace('%', ''));
  const py = Number(y.replace('%', ''));
  return {
    x: Number.isFinite(px) ? px : 50,
    y: Number.isFinite(py) ? py : 50,
  };
}

export function buildFallbackWaveform() {
  return Array.from({ length: 72 }, (_, i) =>
    Math.max(0.16, Math.min(1, 0.52 + Math.sin(i * 0.29) * 0.35 + Math.sin(i * 0.91) * 0.22))
  );
}
