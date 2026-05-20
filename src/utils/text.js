const MOJIBAKE_RE = /(?:Ã.|Â.|Ð.|Ñ.|Р.|С.|вЂ.|пїЅ|�)/;

export function repairMojibake(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!MOJIBAKE_RE.test(text)) return text;

  const candidates = new Set([text]);

  try {
    const latinBytes = Uint8Array.from(text, char => char.charCodeAt(0) & 0xff);
    candidates.add(new TextDecoder('utf-8', { fatal: false }).decode(latinBytes));
  } catch {}

  try {
    candidates.add(decodeURIComponent(escape(text)));
  } catch {}

  return [...candidates]
    .filter(Boolean)
    .sort((a, b) => scoreText(b) - scoreText(a))[0] || text;
}

export function normalizeSearchText(value) {
  if (value === undefined || value === null) return '';
  return String(repairMojibake(String(value)))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ёєэ]/g, 'е')
    .replace(/[іїйы]/g, 'и')
    .replace(/ґ/g, 'г')
    .replace(/[’'`"«»„“”]/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreText(text) {
  const replacement = (text.match(/[�]/g) || []).length * 20;
  const mojibake = (text.match(/(?:Ã|Â|Ð|Ñ|Р |РЎ|вЂ|пїЅ)/g) || []).length * 8;
  const cyrillic = (text.match(/[А-Яа-яІіЇїЄєҐґ]/g) || []).length * 3;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const useful = (text.match(/[0-9'’`.,!?():\-& ]/g) || []).length * 0.2;
  return cyrillic + latin + useful - mojibake - replacement;
}
