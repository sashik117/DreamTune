const DB_NAME = 'MusicPlayerCache';
const STORE_NAME = 'audioFiles';
const META_STORE = 'cachedMeta';
const DB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'songId' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedAudio(url) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(url);
    req.onsuccess = () => {
      if (req.result) resolve(URL.createObjectURL(req.result.blob));
      else resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

export async function cacheAudio(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ url, blob });
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

async function cacheCoverBlob(url) {
  if (!url || String(url).startsWith('blob:') || String(url).startsWith('data:')) return null;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

function isNativeFileUrl(url) {
  return String(url || '').startsWith('file:') || String(url || '').includes('/_capacitor_file_');
}

async function saveOfflineSongMeta(song, coverBlob = null) {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({
    songId: song.id,
    id: song.id,
    title: song.title,
    artist: song.artist,
    cover_url: song.cover_url,
    cover_blob: coverBlob,
    file_url: song.file_url,
    duration: song.duration,
    trim_start: song.trim_start || 0,
    trim_end: song.trim_end || 0,
    lyrics: song.lyrics,
    downloadedAt: Date.now(),
    is_offline: true,
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dreamtune-offline-cache-change', { detail: { songId: song.id, downloaded: true } }));
  }
}

export async function isAudioCached(url) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count(url);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => resolve(false);
  });
}

// Download a song explicitly (with progress callback)
export async function downloadSong(song, onProgress) {
  try {
    const response = await fetch(song.file_url);
    if (!response.ok) throw new Error('fetch failed');
    const total = Number(response.headers.get('Content-Length') || 0);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && total) onProgress(Math.round((received / total) * 100));
    }
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const coverBlob = await cacheCoverBlob(song.cover_url);
    const db = await openDB();
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    tx.objectStore(STORE_NAME).put({ url: song.file_url, blob });
    tx.objectStore(META_STORE).put({
      songId: song.id,
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      cover_blob: coverBlob,
      file_url: song.file_url,
      duration: song.duration,
      trim_start: song.trim_start || 0,
      trim_end: song.trim_end || 0,
      lyrics: song.lyrics,
      downloadedAt: Date.now(),
      is_offline: true,
    });
    if (onProgress) onProgress(100);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dreamtune-offline-cache-change', { detail: { songId: song.id, downloaded: true } }));
    }
    return true;
  } catch {
    if (isNativeFileUrl(song.file_url)) {
      try {
        const coverBlob = await cacheCoverBlob(song.cover_url);
        await saveOfflineSongMeta(song, coverBlob);
        if (onProgress) onProgress(100);
        return true;
      } catch {}
    }
    return false;
  }
}

// Remove a song from cache
export async function removeSongFromCache(songId, fileUrl) {
  const db = await openDB();
  const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
  tx.objectStore(STORE_NAME).delete(fileUrl);
  tx.objectStore(META_STORE).delete(songId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dreamtune-offline-cache-change', { detail: { songId, downloaded: false } }));
  }
}

// Get all downloaded songs meta
export async function getDownloadedSongsMeta() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).map(row => ({
      ...row,
      id: row.id || row.songId,
      cover_url: row.cover_blob ? URL.createObjectURL(row.cover_blob) : row.cover_url,
      is_offline: true,
    })));
    req.onerror = () => resolve([]);
  });
}

// Check if a specific song is downloaded
export async function isSongDownloaded(songId) {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).count(songId);
    req.onsuccess = () => resolve(req.result > 0);
    req.onerror = () => resolve(false);
  });
}
