export const CACHED_USER_KEY = 'dreamtune-current-user-v1';
export const DEFAULT_PROFILE_NICKNAME = 'Guest';

export function readCachedUser() {
  try {
    return JSON.parse(localStorage.getItem(CACHED_USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function writeCachedUser(user) {
  try {
    if (user?.id) localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearCachedUser() {
  try {
    localStorage.removeItem(CACHED_USER_KEY);
  } catch {}
}
