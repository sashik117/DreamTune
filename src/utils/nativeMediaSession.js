import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeMediaSession = registerPlugin('NativeMediaSession');

export function canUseNativeMediaSession() {
  return Capacitor.isNativePlatform?.() && Capacitor.getPlatform?.() === 'android';
}

export async function updateNativeMediaSession(payload) {
  if (!canUseNativeMediaSession()) return;
  try {
    await NativeMediaSession.update(payload);
  } catch (error) {
    console.warn('Native media session update failed:', error);
  }
}

export async function clearNativeMediaSession() {
  if (!canUseNativeMediaSession()) return;
  try {
    await NativeMediaSession.clear();
  } catch (error) {
    console.warn('Native media session clear failed:', error);
  }
}

export function addNativeMediaActionListener(callback) {
  if (!canUseNativeMediaSession()) return null;
  return NativeMediaSession.addListener('mediaAction', callback);
}
