const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const WS_URL = API_URL.replace(/^http/, 'ws');
const AUTH_TOKEN_KEY = 'dreamtune-auth-token';
let nativePreferencesPromise = null;

function isNativeApp() {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
}

function getNativePreferences() {
  if (!isNativeApp()) return null;
  if (!nativePreferencesPromise) {
    nativePreferencesPromise = import('@capacitor/preferences')
      .then((module) => module.Preferences)
      .catch(() => null);
  }
  return nativePreferencesPromise;
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthToken(token) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
  const preferences = getNativePreferences();
  if (preferences) {
    preferences.then((store) => {
      if (!store) return;
      if (token) store.set({ key: AUTH_TOKEN_KEY, value: token });
      else store.remove({ key: AUTH_TOKEN_KEY });
    });
  }
}

export async function hydrateAuthToken() {
  const preferences = getNativePreferences();
  if (!preferences || getAuthToken()) return getAuthToken();
  const store = await preferences;
  if (!store) return '';
  const { value } = await store.get({ key: AUTH_TOKEN_KEY });
  if (value) localStorage.setItem(AUTH_TOKEN_KEY, value);
  return value || '';
}

const REALTIME_EVENT = 'dreamtune-entity-change';

function emitLocalEntityChange(event) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: event }));
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(data?.error || data || 'API request failed');
  }

  return data;
}

function makeEntity(table) {
  return {
    async list(filters = {}) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) params.set(key, value);
      }
      const query = params.toString();
      return request(`/api/entities/${table}${query ? `?${query}` : ''}`);
    },

    async get(id) {
      return request(`/api/entities/${table}/${id}`);
    },

    async create(payload) {
      const row = await request(`/api/entities/${table}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      emitLocalEntityChange({ table, event: 'INSERT', new: row, source: 'local' });
      return row;
    },

    async update(id, payload) {
      const row = await request(`/api/entities/${table}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      emitLocalEntityChange({ table, event: 'UPDATE', new: row, source: 'local' });
      return row;
    },

    async delete(id) {
      const result = await request(`/api/entities/${table}/${id}`, { method: 'DELETE' });
      emitLocalEntityChange({ table, event: 'DELETE', old: { id: result?.id || id }, source: 'local' });
      return result;
    },
  };
}

function matchesRealtimeFilter(event, filter) {
  if (!filter) return true;
  const match = String(filter).match(/^(\w+)=eq\.(.+)$/);
  if (!match) return true;
  const [, key, value] = match;
  return String(event.new?.[key] ?? event.old?.[key] ?? '') === value;
}

function createRealtimeChannel() {
  const handlers = [];
  let socket = null;
  let closed = false;
  let reconnectTimer = null;
  let connectTimer = null;

  const dispatch = (event) => {
    for (const handler of handlers) {
      const opts = handler.options || {};
      if (opts.table && opts.table !== event.table) continue;
      if (opts.event && opts.event !== '*' && opts.event !== event.event) continue;
      if (!matchesRealtimeFilter(event, opts.filter)) continue;
      handler.callback(event);
    }
  };

  const connect = () => {
    if (closed || socket) return;
    socket = new WebSocket(`${WS_URL}/ws`);
    socket.onmessage = (message) => {
      try {
        dispatch(JSON.parse(message.data));
      } catch (error) {
        console.warn('Realtime message ignored:', error);
      }
    };
    socket.onclose = () => {
      socket = null;
      if (!closed) reconnectTimer = window.setTimeout(connect, 1000);
    };
    socket.onerror = () => {
      if (socket?.readyState === WebSocket.OPEN) socket.close();
    };
  };

  const scheduleConnect = () => {
    if (closed || socket || connectTimer) return;
    connectTimer = window.setTimeout(() => {
      connectTimer = null;
      connect();
    }, 50);
  };

  return {
    on(_type, options, callback) {
      handlers.push({ options, callback });
      return this;
    },

    subscribe() {
      if (socket) return this;
      closed = false;
      window.addEventListener(REALTIME_EVENT, this._localListener = (event) => dispatch(event.detail));
      scheduleConnect();
      return this;
    },

    close() {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (connectTimer) window.clearTimeout(connectTimer);
      reconnectTimer = null;
      connectTimer = null;
      if (this._localListener) window.removeEventListener(REALTIME_EVENT, this._localListener);
      if (socket?.readyState === WebSocket.CONNECTING) {
        const closingSocket = socket;
        closingSocket.onopen = () => closingSocket.close();
        closingSocket.onerror = null;
      } else {
        socket?.close();
      }
      socket = null;
    },
  };
}

export const supabase = {
  channel() {
    return createRealtimeChannel();
  },
  removeChannel(channel) {
    channel?.close?.();
  },
  auth: {
    async getUser() {
      try {
        const user = await request('/api/auth/me');
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
  },
};

export const auth = {
  async me() {
    return request('/api/auth/me');
  },
  async signIn({ login, password }) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    setAuthToken(data.token);
    return data.user;
  },
  async signUp({ email, nickname, password }) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, nickname, password }),
    });
  },
  async verifyEmailCode({ email, code }) {
    const data = await request('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
    setAuthToken(data.token);
    return data;
  },
  async signOut() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken('');
    }
  },
  onAuthStateChange(callback) {
    callback?.('SIGNED_IN', { user: null });
    return { data: { subscription: { unsubscribe() {} } } };
  },
};

export const storage = {
  async uploadFile(file, bucket = 'songs') {
    const form = new FormData();
    form.append('file', file);
    form.append('bucket', bucket);
    const data = await request('/api/upload', {
      method: 'POST',
      body: form,
    });
    return data.publicUrl;
  },
};

export const media = {
  async searchYouTube(query) {
    return request(`/api/youtube/search?q=${encodeURIComponent(query)}`);
  },
  async downloadYouTube(videoId) {
    return request('/api/youtube/download', {
      method: 'POST',
      body: JSON.stringify({ videoId }),
    });
  },
  async getSpotifyPlaylist(url) {
    return request(`/api/spotify/playlist?url=${encodeURIComponent(url)}`);
  },
  async searchSpotifyTracks(query, limit = 8) {
    return request(`/api/spotify/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`);
  },
  async getSpotifyCover(url) {
    return request(`/api/spotify/cover?url=${encodeURIComponent(url || '')}`);
  },
  async getGlobalChart(limit = 20) {
    return request(`/api/charts/global?limit=${encodeURIComponent(limit)}`);
  },
  async getSpotifyChart(limit = 20) {
    return request(`/api/charts/spotify?limit=${encodeURIComponent(limit)}`);
  },
  async getLyrics({ artist, title }) {
    return request(`/api/lyrics?artist=${encodeURIComponent(artist || '')}&title=${encodeURIComponent(title || '')}`);
  },
};

export const social = {
  async searchUsers(query) {
    return request(`/api/users/search?q=${encodeURIComponent(query || '')}`);
  },
  async getUserProfile(id) {
    return request(`/api/users/${encodeURIComponent(id)}/profile`);
  },
  async listFriends() {
    return request('/api/friends');
  },
  async listFriendRequests() {
    return request('/api/friends/requests');
  },
  async getFriendRequestCount() {
    return request('/api/friends/requests/count');
  },
  async requestFriend({ nickname, friend_id }) {
    return request('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ nickname, friend_id }),
    });
  },
  async acceptFriendRequest(id) {
    return request(`/api/friends/requests/${id}/accept`, { method: 'POST' });
  },
  async declineFriendRequest(id) {
    return request(`/api/friends/requests/${id}/decline`, { method: 'POST' });
  },
  async inviteToCollabPlaylist({ playlist_id, receiver_id }) {
    return request(`/api/collab-playlists/${encodeURIComponent(playlist_id)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ receiver_id }),
    });
  },
  async acceptCollabInvite(id) {
    return request(`/api/collab-invites/${encodeURIComponent(id)}/accept`, { method: 'POST' });
  },
  async declineCollabInvite(id) {
    return request(`/api/collab-invites/${encodeURIComponent(id)}/decline`, { method: 'POST' });
  },
  async listCollabPlaylistSongs(id) {
    return request(`/api/collab-playlists/${encodeURIComponent(id)}/songs`);
  },
  async removeFriend(id) {
    return request(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async shareSong({ song_id, receiver_id, message = '' }) {
    return request('/api/share/song', {
      method: 'POST',
      body: JSON.stringify({ song_id, receiver_id, message }),
    });
  },
};

export const admin = {
  async overview() {
    return request('/api/admin/overview');
  },
  async listUsers() {
    return request('/api/admin/users');
  },
  async updateUser(id, action) {
    return request(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  },
  async deleteUser(id) {
    return request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async listCollabPlaylists() {
    return request('/api/admin/collab-playlists');
  },
  async deleteCollabPlaylist(id) {
    return request(`/api/admin/collab-playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const ai = {
  async invoke() {
    return {};
  },
};

export const entities = {
  Song: makeEntity('songs'),
  Playlist: makeEntity('playlists'),
  ListenHistory: makeEntity('listen_history'),
  CollabPlaylist: makeEntity('collab_playlists'),
};
