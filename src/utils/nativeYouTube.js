import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeYouTube = registerPlugin('NativeYouTube');

export function canUseNativeYouTube() {
  return Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';
}

export function isNativeAudioUrl(url) {
  return String(url || '').startsWith('file:') || String(url || '').includes('/_capacitor_file_');
}

export async function downloadYouTubeOnDevice(videoId) {
  if (!canUseNativeYouTube()) return null;
  const data = await NativeYouTube.download({ videoId });
  if (!data?.file_url) return null;

  return {
    ...data,
    native_file_url: data.file_url,
    file_url: Capacitor.convertFileSrc(data.file_url),
  };
}
