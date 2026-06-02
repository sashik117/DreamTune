import { isNativeFileUrl, resolvePlayableAudioUrl } from './audioUrls';

const DB_NAME = 'MusicPlayerCache';
const STORE_NAME = 'audioFiles';
const META_STORE = 'cachedMeta';
const DB_VERSION = 3;
const DEFAULT_AUDIO_CACHE_LIMIT_BYTES = 768 * 1024 * 1024;

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
  if (isNativeFileUrl(url)) return resolvePlayableAudioUrl(url);
  const db = await openDB();
  const keys = Array.from(new Set([url, resolvePlayableAudioUrl(url)].filter(Boolean)));
  for (const key of keys) {
    const cached = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (cached?.blob) return URL.createObjectURL(cached.blob);
  }
  const metas = await getAllMetaRows(db);
  const matchingMeta = metas.find(row => {
    const rowKeys = [
      row.file_url,
      resolvePlayableAudioUrl(row.file_url),
      row.offline_file_url,
      resolvePlayableAudioUrl(row.offline_file_url),
      row.source_file_url,
      resolvePlayableAudioUrl(row.source_file_url),
    ].filter(Boolean);
    return rowKeys.some(key => keys.includes(key));
  });
  const offlineUrl = matchingMeta?.offline_file_url || matchingMeta?.source_file_url || '';
  if (isNativeFileUrl(offlineUrl)) return resolvePlayableAudioUrl(offlineUrl);
  return null;
}

export async function cacheAudio(url) {
  const playableUrl = resolvePlayableAudioUrl(url);
  if (!playableUrl) return url || '';
  if (isNativeFileUrl(url) || isNativeFileUrl(playableUrl)) return playableUrl || url;
  try {
    const response = await fetch(playableUrl);
    if (!response.ok) return playableUrl || url;
    const blob = await response.blob();
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const keys = Array.from(new Set([url, playableUrl].filter(Boolean)));
    const savedAt = Date.now();
    keys.forEach(key => store.put({ url: key, blob, size: blob.size || 0, savedAt }));
    return URL.createObjectURL(blob);
  } catch {
    return playableUrl || url;
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

function getAllMetaRows(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function getAllAudioRows(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function metaAudioKeys(row) {
  return [
    row.file_url,
    resolvePlayableAudioUrl(row.file_url),
    row.source_file_url,
    resolvePlayableAudioUrl(row.source_file_url),
    row.offline_file_url,
    resolvePlayableAudioUrl(row.offline_file_url),
  ].filter(Boolean);
}

function metaHasOfflineAudio(row, audioKeys) {
  if (isNativeFileUrl(row.offline_file_url)) return true;
  return metaAudioKeys(row).some(key => audioKeys.has(key));
}

export async function saveOfflineSongMeta(song, coverBlob, options = {}) {
  const db = await openDB();
  let safeCoverBlob = coverBlob;
  let previousMeta = null;
  const coverUrl = String(song.cover_url || '');
  const coverIsTemporary = coverUrl.startsWith('blob:') || coverUrl.startsWith('data:');

  previousMeta = await new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(song.id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });

  if (safeCoverBlob === undefined) {
    if (coverIsTemporary) {
      safeCoverBlob = previousMeta?.cover_blob || null;
    } else {
      safeCoverBlob = await cacheCoverBlob(song.cover_url);
    }
  }

  const stableCoverUrl = coverIsTemporary
    ? (previousMeta?.cover_url && !String(previousMeta.cover_url).startsWith('blob:') && !String(previousMeta.cover_url).startsWith('data:')
      ? previousMeta.cover_url
      : '')
    : song.cover_url;
  const offlineFileUrl = options.offlineFileUrl || song.offline_file_url || previousMeta?.offline_file_url || (isNativeFileUrl(song.file_url) ? song.file_url : '');
  const sourceFileUrl = options.sourceFileUrl || song.source_file_url || previousMeta?.source_file_url || '';

  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({
    songId: song.id,
    id: song.id,
    title: song.title,
    artist: song.artist,
    cover_url: stableCoverUrl,
    cover_blob: safeCoverBlob,
    file_url: song.file_url,
    offline_file_url: offlineFileUrl,
    source_file_url: sourceFileUrl,
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
  const keys = Array.from(new Set([url, resolvePlayableAudioUrl(url)].filter(Boolean)));
  for (const key of keys) {
    const cached = await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count(key);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => resolve(false);
    });
    if (cached) return true;
  }
  return false;
}

// Download a song explicitly (with progress callback)
export async function downloadSong(song, onProgress, options = {}) {
  const sourceUrl = options.sourceUrl || song.file_url;
  const playableUrl = resolvePlayableAudioUrl(sourceUrl);
  const canonicalUrl = song.file_url || sourceUrl;
  const playableCanonicalUrl = resolvePlayableAudioUrl(canonicalUrl);
  const nativeSourceUrl = [sourceUrl, playableUrl, options.offlineFileUrl]
    .find(value => isNativeFileUrl(value)) || '';

  if (nativeSourceUrl) {
    try {
      const coverBlob = await cacheCoverBlob(song.cover_url);
      await saveOfflineSongMeta(
        { ...song, file_url: canonicalUrl },
        coverBlob,
        { offlineFileUrl: nativeSourceUrl, sourceFileUrl: sourceUrl }
      );
      if (onProgress) onProgress(100);
      return true;
    } catch {
      return false;
    }
  }

  if (!playableUrl) return false;

  try {
    const response = await fetch(playableUrl);
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
    const audioStore = tx.objectStore(STORE_NAME);
    const keys = Array.from(new Set([
      canonicalUrl,
      playableCanonicalUrl,
      sourceUrl,
      playableUrl,
    ].filter(Boolean)));
    const savedAt = Date.now();
    keys.forEach(key => audioStore.put({ url: key, blob, size: blob.size || 0, savedAt }));
    tx.objectStore(META_STORE).put({
      songId: song.id,
      id: song.id,
      title: song.title,
      artist: song.artist,
      cover_url: song.cover_url,
      cover_blob: coverBlob,
      file_url: canonicalUrl,
      offline_file_url: '',
      source_file_url: sourceUrl,
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
    if (isNativeFileUrl(sourceUrl) || isNativeFileUrl(playableUrl) || isNativeFileUrl(canonicalUrl)) {
      try {
        const coverBlob = await cacheCoverBlob(song.cover_url);
        await saveOfflineSongMeta({ ...song, file_url: canonicalUrl }, coverBlob, { offlineFileUrl: sourceUrl, sourceFileUrl: sourceUrl });
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
  const keys = Array.from(new Set([fileUrl, resolvePlayableAudioUrl(fileUrl)].filter(Boolean)));
  keys.forEach(key => tx.objectStore(STORE_NAME).delete(key));
  tx.objectStore(META_STORE).delete(songId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dreamtune-offline-cache-change', { detail: { songId, downloaded: false } }));
  }
}

// Get all downloaded songs meta
export async function getDownloadedSongsMeta() {
  const db = await openDB();
  const audioRows = await getAllAudioRows(db);
  const audioKeys = new Set(audioRows.map(row => row.url).filter(Boolean));
  return new Promise((resolve) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).map(row => ({
      ...row,
      id: row.id || row.songId,
      cover_url: row.cover_blob ? URL.createObjectURL(row.cover_blob) : row.cover_url,
      native_cover_url: row.cover_url || '',
      offline_file_url: row.offline_file_url || '',
      is_offline: metaHasOfflineAudio(row, audioKeys),
    })));
    req.onerror = () => resolve([]);
  });
}

export async function cleanupAudioCache(options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_AUDIO_CACHE_LIMIT_BYTES);
  const db = await openDB();
  const metas = await getAllMetaRows(db);
  const nativeDuplicateKeys = new Set();

  for (const row of metas) {
    if (!isNativeFileUrl(row.offline_file_url)) continue;
    [
      row.file_url,
      resolvePlayableAudioUrl(row.file_url),
      row.source_file_url,
      resolvePlayableAudioUrl(row.source_file_url),
      row.offline_file_url,
      resolvePlayableAudioUrl(row.offline_file_url),
    ].filter(Boolean).forEach(key => nativeDuplicateKeys.add(key));
  }

  const entries = await new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });

  let totalBytes = entries.reduce((sum, entry) => sum + Number(entry.size || entry.blob?.size || 0), 0);
  const keysToDelete = new Set();

  for (const entry of entries) {
    if (nativeDuplicateKeys.has(entry.url)) {
      keysToDelete.add(entry.url);
      totalBytes -= Number(entry.size || entry.blob?.size || 0);
    }
  }

  if (totalBytes > maxBytes) {
    const removable = entries
      .filter(entry => !keysToDelete.has(entry.url))
      .sort((a, b) => Number(a.savedAt || 0) - Number(b.savedAt || 0));

    for (const entry of removable) {
      if (totalBytes <= maxBytes) break;
      keysToDelete.add(entry.url);
      totalBytes -= Number(entry.size || entry.blob?.size || 0);
    }
  }

  if (keysToDelete.size) {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    keysToDelete.forEach(key => store.delete(key));
  }

  return { deleted: keysToDelete.size, remainingBytes: Math.max(0, totalBytes) };
}

export async function getDownloadedSongIds() {
  const db = await openDB();
  const [metas, audioRows] = await Promise.all([getAllMetaRows(db), getAllAudioRows(db)]);
  const audioKeys = new Set(audioRows.map(row => row.url).filter(Boolean));
  return new Set(
    metas
      .filter(row => metaHasOfflineAudio(row, audioKeys))
      .map(row => row.id || row.songId)
      .filter(Boolean)
  );
}

// Check if a specific song is downloaded
export async function isSongDownloaded(songId) {
  const db = await openDB();
  const [metas, audioRows] = await Promise.all([getAllMetaRows(db), getAllAudioRows(db)]);
  const audioKeys = new Set(audioRows.map(row => row.url).filter(Boolean));
  return metas.some(row => (row.id || row.songId) === songId && metaHasOfflineAudio(row, audioKeys));
}
