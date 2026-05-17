import { Capacitor } from '@capacitor/core';

export function isNativeFileUrl(url) {
  const value = String(url || '');
  return value.startsWith('file:') || value.includes('/_capacitor_file_');
}

export function resolvePlayableAudioUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';

  if (value.startsWith('file:')) {
    try {
      return Capacitor.convertFileSrc(value);
    } catch {
      return value;
    }
  }

  const marker = '/_capacitor_file_';
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0 && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${value.slice(markerIndex)}`;
  }

  return value;
}
