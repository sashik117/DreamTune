import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import multer from 'multer';
import pg from 'pg';
import crypto from 'node:crypto';
import youtubedl from 'youtube-dl-exec';
import spotifyUrlInfo from 'spotify-url-info';
import { WebSocketServer } from 'ws';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env'), override: true });
const uploadRoot = path.join(rootDir, 'public', 'uploads');
const mediaRoot = path.join(rootDir, 'public', 'media');

const PORT = Number(process.env.PORT || process.env.API_PORT || 4000);
const PUBLIC_BASE_URL = process.env.PUBLIC_API_URL || `http://localhost:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://dreamtune:dreamtune@localhost:5432/dreamtune';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'dreamtuneteam@gmail.com';
const SMTP_USER = process.env.SMTP_USER || SUPPORT_EMAIL;
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const CLOUDINARY_ENABLED = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (CLOUDINARY_ENABLED && !process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const tableConfig = {
  songs: {
    columns: ['title', 'artist', 'cover_url', 'cover_position', 'cover_scale', 'file_url', 'duration', 'is_favorite', 'lyrics', 'trim_start', 'trim_end'],
    arrays: new Set(),
    required: ['title', 'file_url'],
  },
  playlists: {
    columns: ['name', 'song_ids', 'cover_url', 'cover_position', 'cover_scale', 'is_public'],
    arrays: new Set(['song_ids']),
    required: ['name'],
  },
  listen_history: {
    columns: ['song_id', 'song_title', 'song_artist', 'listened_at', 'mood'],
    arrays: new Set(),
    required: ['song_id'],
  },
  collab_playlists: {
    columns: ['name', 'song_ids', 'cover_url', 'cover_position', 'cover_scale', 'access_level', 'owner_id', 'owner_email', 'collaborator_ids', 'collaborator_emails', 'last_edited_by', 'last_edited_at'],
    arrays: new Set(['song_ids', 'collaborator_ids', 'collaborator_emails']),
    required: ['name'],
  },
};

const privateTables = new Set(['songs', 'playlists', 'listen_history']);

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const upload = multer({ dest: path.join(rootDir, '.tmp_uploads') });
const spotify = spotifyUrlInfo(fetch);
const mailer = SMTP_PASS
  ? nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  : null;

async function removeTempFile(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {}
}

async function uploadToCloudinary(filePath, folder, originalName = '') {
  const ext = path.extname(originalName || filePath).replace('.', '').toLowerCase();
  const isAudio = /^(mp3|m4a|aac|wav|ogg|webm|flac)$/i.test(ext);
  const isImage = /^(jpg|jpeg|png|gif|webp|avif)$/i.test(ext);
  const result = await cloudinary.uploader.upload(filePath, {
    folder: `dreamtune/${folder}`,
    resource_type: isAudio ? 'video' : 'auto',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
  });
  if (isImage && result.public_id) {
    return cloudinary.url(result.public_id, {
      secure: true,
      resource_type: 'image',
      fetch_format: 'auto',
      quality: 'auto',
    });
  }
  return result.secure_url;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadRoot));
app.use('/media', express.static(mediaRoot));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'DreamTune API',
    time: new Date().toISOString(),
  });
});

async function ensureSchema() {
  const schema = await fs.readFile(path.join(rootDir, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
}

function assertTable(table) {
  const config = tableConfig[table];
  if (!config) {
    const err = new Error('Unknown entity');
    err.status = 404;
    throw err;
  }
  return config;
}

function repairMojibake(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!/(?:\u00c3.|\u00c2.|\u00d0.|\u00d1.|\u0420.|\u0421.|\u0432\u0402.|\u043f\u0457\u0405|\ufffd)/.test(text)) return text;

  const candidates = new Set([text]);
  try {
    candidates.add(Buffer.from(text, 'latin1').toString('utf8'));
  } catch {}

  return [...candidates]
    .filter(Boolean)
    .sort((a, b) => scoreText(b) - scoreText(a))[0] || text;
}

function cleanSearchText(value) {
  return repairMojibake(String(value || ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLyricsText(value) {
  return cleanSearchText(value)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*(official|video|audio|lyrics?|lyric video|visualizer|remaster(?:ed)?|live|hd|4k|karaoke)[^)]*\)/gi, ' ')
    .replace(/\([^)]*(feat\.?|ft\.?|with)\s+[^)]*\)/gi, ' ')
    .replace(/\b(official\s*)?(music\s*)?video\b/gi, ' ')
    .replace(/\b(official\s*)?audio\b/gi, ' ')
    .replace(/\blyrics?\b/gi, ' ')
    .replace(/\bvisualizer\b/gi, ' ')
    .replace(/\bremaster(?:ed)?\b/gi, ' ')
    .replace(/\bHD\b|\b4K\b/gi, ' ')
    .replace(/\s+-\s+YouTube$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—]+|[\s\-–—]+$/g, '')
    .trim();
}

function buildLyricsQueries(artist, title) {
  const cleanArtist = cleanLyricsText(artist);
  const cleanTitle = cleanLyricsText(title)
    .replace(/\s+(feat\.?|ft\.?|with)\s+.+$/i, '')
    .replace(/\s*[-–—]\s*(official|audio|video|lyrics?).*$/i, '')
    .trim();
  const titleWithoutArtist = cleanArtist
    ? cleanLyricsText(cleanTitle.replace(new RegExp(`^${cleanArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]\\s*`, 'i'), ''))
    : cleanTitle;

  const variants = [
    { artist: cleanArtist, title: titleWithoutArtist || cleanTitle },
    { artist: cleanArtist, title: cleanTitle },
  ];

  const seen = new Set();
  return variants.filter(item => {
    const key = `${item.artist}::${item.title}`.toLowerCase();
    if (!item.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchSpotifyOembedCover(sourceUrl) {
  if (!sourceUrl) return '';
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(sourceUrl)}`);
    if (!response.ok) return '';
    const data = await response.json();
    return data.thumbnail_url || '';
  } catch {
    return '';
  }
}

async function fillSpotifyCovers(tracks) {
  return Promise.all((tracks || []).map(async (track) => ({
    ...track,
    cover_url: track.cover_url || await fetchSpotifyOembedCover(track.source_url),
  })));
}

function scoreText(text) {
  const replacement = (text.match(/[\ufffd]/g) || []).length * 20;
  const mojibake = (text.match(/(?:\u00c3|\u00c2|\u00d0|\u00d1|\u0420\u00a0|\u0420\u040e|\u0432\u0402|\u043f\u0457\u0405)/g) || []).length * 8;
  const cyrillic = (text.match(/[\u0410-\u042f\u0430-\u044f\u0406\u0456\u0407\u0457\u0404\u0454\u0490\u0491]/g) || []).length * 3;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const useful = (text.match(/[0-9'?.,!?():\-& ]/g) || []).length * 0.2;
  return cyrillic + latin + useful - mojibake - replacement;
}

function normalizePayload(table, payload = {}, partial = false) {
  const config = assertTable(table);
  for (const key of config.required) {
    if (!partial && (payload[key] === undefined || payload[key] === null || payload[key] === '')) {
      const err = new Error(`${key} is required`);
      err.status = 400;
      throw err;
    }
  }
  const cleaned = {};
  for (const key of config.columns) {
    if (payload[key] !== undefined) {
      cleaned[key] = config.arrays.has(key) ? (Array.isArray(payload[key]) ? payload[key] : []) : payload[key];
    }
  }
  return cleaned;
}

function rowToClient(row) {
  return row;
}

function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

async function queryOne(res, text, params) {
  const { rows } = await pool.query(text, params);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  return res.json(rowToClient(rows[0]));
}

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const nextHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(nextHash, 'hex'));
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    avatar_url: row.avatar_url || '',
    email_verified: row.email_verified,
    is_verified: row.is_verified ?? row.email_verified,
    role: row.role || 'user',
    blocked_at: row.blocked_at,
    created_at: row.created_at,
  };
}

async function sendVerificationEmail({ email, nickname, code }) {
  const subject = 'DreamTune email verification';
  const text = [
    `Привіт, ${nickname || 'DreamTune user'}!`,
    '',
    `Твій код підтвердження: ${code}`,
    '',
    'Якщо це була не ти, просто проігноруй цей лист.',
    '',
    'DreamTune Team',
  ].join('\n');

  if (!mailer) {
    console.info(`DreamTune email verification code for ${email}: ${code}`);
    return false;
  }

  await mailer.sendMail({
    from: `"DreamTune Team" <${SUPPORT_EMAIL}>`,
    to: email,
    subject,
    text,
  });
  return true;
}

async function getSessionUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT users.*
     FROM user_sessions
     JOIN users ON users.id = user_sessions.user_id
     WHERE user_sessions.token = $1
       AND user_sessions.expires_at > now()
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function requireSessionUser(req) {
  const user = await getSessionUser(req);
  if (!user) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  if (user.blocked_at) {
    const err = new Error('Account is blocked');
    err.status = 403;
    throw err;
  }
  return user;
}

function requireVerifiedUser(user) {
  if (!user?.email_verified && !user?.is_verified) {
    const err = new Error('Email is not verified');
    err.status = 403;
    throw err;
  }
}

async function requireAdmin(req) {
  const user = await requireSessionUser(req);
  if (user.role !== 'admin') {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return user;
}

async function areFriends(userId, friendId) {
  if (!userId || !friendId || userId === friendId) return false;
  const { rows } = await pool.query(
    `SELECT 1
     FROM friendships
     WHERE user_id = $1 AND friend_id = $2
     LIMIT 1`,
    [userId, friendId]
  );
  return Boolean(rows[0]);
}

async function assertCollabAccess(id, user, mode = 'edit') {
  const { rows } = await pool.query('SELECT * FROM collab_playlists WHERE id = $1 LIMIT 1', [id]);
  const playlist = rows[0];
  if (!playlist) return null;
  const collaborators = (playlist.collaborator_ids || []).map(String);
  const isOwner = playlist.owner_id && String(playlist.owner_id) === String(user.id);
  const isCollaborator = collaborators.includes(String(user.id));
  const canView = isOwner || isCollaborator || playlist.access_level === 'public';
  const canEdit = isOwner || isCollaborator;
  const allowed = mode === 'view' ? canView : mode === 'delete' ? isOwner : canEdit;
  if (!allowed) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return playlist;
}

async function normalizeCollaborators(user, collaboratorIds = []) {
  const unique = Array.from(new Set((Array.isArray(collaboratorIds) ? collaboratorIds : []).filter(Boolean).map(String)))
    .filter(id => id !== String(user.id));
  const allowed = [];
  for (const id of unique) {
    if (await areFriends(user.id, id)) allowed.push(id);
  }
  return allowed;
}

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.blocked_at) return res.status(403).json({ error: 'Account is blocked' });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = repairMojibake(String(req.body.email || '').trim().toLowerCase());
    const nickname = repairMojibake(String(req.body.nickname || '').trim().replace(/^@/, ''));
    const password = String(req.body.password || '');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Valid email is required' });
    if (!nickname || nickname.length < 3) return res.status(400).json({ error: 'Nickname must be at least 3 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const { rows } = await pool.query(
      `INSERT INTO users (email, nickname, password_hash, verification_token)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, nickname, hashPassword(password), verificationCode]
    );
    await sendVerificationEmail({ email, nickname, code: verificationCode });
    res.status(201).json({
      user: publicUser(rows[0]),
      verification_code: mailer ? undefined : verificationCode,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email or nickname already exists' });
    next(err);
  }
});

app.get('/api/auth/verify-email', async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ error: 'Token is required' });
    const { rows } = await pool.query(
      `UPDATE users SET email_verified = true, is_verified = true, verification_token = null WHERE verification_token = $1 RETURNING *`,
      [token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Verification token not found' });
    res.json({ ok: true, user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/verify-code', async (req, res, next) => {
  try {
    const email = repairMojibake(String(req.body.email || '').trim().toLowerCase());
    const code = String(req.body.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    const { rows } = await pool.query(
      `UPDATE users
       SET email_verified = true, is_verified = true, verification_token = null
       WHERE lower(email) = $1 AND verification_token = $2
       RETURNING *`,
      [email, code]
    );
    if (!rows[0]) return res.status(400).json({ error: 'Invalid verification code' });
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [rows[0].id, token]
    );
    res.json({ token, user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const login = repairMojibake(String(req.body.login || req.body.email || '').trim().toLowerCase());
    const password = String(req.body.password || '');
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE lower(email) = $1 OR lower(nickname) = $1 LIMIT 1`,
      [login]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid login or password' });
    if (!user.email_verified) return res.status(403).json({ error: 'Email is not verified' });
    if (user.blocked_at) return res.status(403).json({ error: 'Account is blocked' });
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [user.id, token]
    );
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token) await pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/overview', async (req, res, next) => {
  try {
    await requireAdmin(req);
    const [users, tracks, activeToday, collabPlaylists] = await Promise.all([
      pool.query('SELECT count(*)::int AS count FROM users WHERE blocked_at IS NULL'),
      pool.query('SELECT count(*)::int AS count FROM songs'),
      pool.query(
        `SELECT count(DISTINCT user_id)::int AS count
         FROM listen_history
         WHERE created_at >= now() - interval '1 day'`
      ),
      pool.query('SELECT count(*)::int AS count FROM collab_playlists'),
    ]);
    res.json({
      users: users.rows[0]?.count || 0,
      tracks: tracks.rows[0]?.count || 0,
      active_today: activeToday.rows[0]?.count || 0,
      collab_playlists: collabPlaylists.rows[0]?.count || 0,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/users', async (req, res, next) => {
  try {
    await requireAdmin(req);
    const { rows } = await pool.query(
      `SELECT id, email, nickname, avatar_url, email_verified, is_verified, role, blocked_at, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    res.json(rows.map(rowToClient));
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req);
    const action = String(req.body.action || '');
    if (!['block', 'unblock', 'make_admin', 'make_user'].includes(action)) {
      return res.status(400).json({ error: 'Unknown admin action' });
    }
    if (String(admin.id) === String(req.params.id) && (action === 'block' || action === 'make_user')) {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }
    const patch = {
      block: 'blocked_at = now()',
      unblock: 'blocked_at = null',
      make_admin: "role = 'admin'",
      make_user: "role = 'user'",
    }[action];
    const { rows } = await pool.query(
      `UPDATE users SET ${patch} WHERE id = $1 RETURNING id, email, nickname, avatar_url, email_verified, is_verified, role, blocked_at, created_at, updated_at`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    broadcast({ table: 'users', event: 'UPDATE', new: rowToClient(rows[0]) });
    res.json(rowToClient(rows[0]));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req);
    if (String(admin.id) === String(req.params.id)) return res.status(400).json({ error: 'You cannot delete yourself' });
    const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    broadcast({ table: 'users', event: 'DELETE', old: rows[0] });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/collab-playlists', async (req, res, next) => {
  try {
    await requireAdmin(req);
    const { rows } = await pool.query(
      `SELECT collab_playlists.*, users.nickname AS owner_nickname
       FROM collab_playlists
       LEFT JOIN users ON users.id = collab_playlists.owner_id
       ORDER BY collab_playlists.created_at DESC`
    );
    res.json(rows.map(rowToClient));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/collab-playlists/:id', async (req, res, next) => {
  try {
    await requireAdmin(req);
    const { rows } = await pool.query('DELETE FROM collab_playlists WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Playlist not found' });
    broadcast({ table: 'collab_playlists', event: 'DELETE', old: rowToClient(rows[0]) });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    next(err);
  }
});

app.get('/api/users/:id/profile', async (req, res, next) => {
  try {
    const currentUser = await requireSessionUser(req);
    const { rows } = await pool.query(
      `SELECT id, email, nickname, avatar_url, email_verified, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const playlists = await pool.query(
      `SELECT *
       FROM playlists
       WHERE user_id = $1 AND is_public = true
       ORDER BY created_at DESC`,
      [user.id]
    );
    const songIds = Array.from(new Set(playlists.rows.flatMap(row => row.song_ids || []).map(String)));
    const songs = songIds.length
      ? await pool.query(
        `SELECT id, title, artist, cover_url, cover_position, cover_scale, duration, created_at
         FROM songs
         WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [user.id, songIds]
      )
      : { rows: [] };
    const friend = await areFriends(currentUser.id, user.id);
    res.json({
      user: publicUser(user),
      relationship: user.id === currentUser.id ? 'self' : friend ? 'friend' : 'none',
      playlists: playlists.rows.map(rowToClient),
      songs: songs.rows.map(rowToClient),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/users/search', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const q = repairMojibake(String(req.query.q || '').trim().replace(/^@/, ''));
    if (q.length < 2) return res.json([]);
    const { rows } = await pool.query(
      `SELECT
         users.id,
         users.email,
         users.nickname,
         users.avatar_url,
         users.email_verified,
         users.created_at,
         EXISTS (
           SELECT 1 FROM friendships
           WHERE friendships.user_id = $2 AND friendships.friend_id = users.id
         ) AS is_friend,
         EXISTS (
           SELECT 1 FROM friend_requests
           WHERE friend_requests.sender_id = $2 AND friend_requests.receiver_id = users.id AND friend_requests.status = 'pending'
         ) AS request_sent
       FROM users
       WHERE users.id <> $2 AND users.nickname ILIKE $1
       ORDER BY nickname ASC
       LIMIT 20`,
      [`%${q}%`, user.id]
    );
    res.json(rows.map(row => ({
      ...publicUser(row),
      relationship: row.is_friend ? 'friend' : row.request_sent ? 'pending' : 'none',
    })));
  } catch (err) {
    next(err);
  }
});

app.get('/api/friends', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `SELECT users.id, users.email, users.nickname, users.avatar_url, users.email_verified, users.created_at
       FROM friendships
       JOIN users ON users.id = friendships.friend_id
       WHERE friendships.user_id = $1
       ORDER BY users.nickname ASC`,
      [user.id]
    );
    res.json(rows.map(publicUser));
  } catch (err) {
    next(err);
  }
});

app.get('/api/friends/requests', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `SELECT friend_requests.*, users.nickname AS sender_nickname, users.email AS sender_email, users.avatar_url AS sender_avatar_url
       FROM friend_requests
       JOIN users ON users.id = friend_requests.sender_id
       WHERE friend_requests.receiver_id = $1 AND friend_requests.status = 'pending'
       ORDER BY friend_requests.created_at DESC`,
      [user.id]
    );
    const collabInvites = await pool.query(
      `SELECT
         collab_playlist_invites.*,
         users.nickname AS sender_nickname,
         users.email AS sender_email,
         users.avatar_url AS sender_avatar_url,
         collab_playlists.name AS playlist_name
       FROM collab_playlist_invites
       JOIN users ON users.id = collab_playlist_invites.sender_id
       JOIN collab_playlists ON collab_playlists.id = collab_playlist_invites.playlist_id
       WHERE collab_playlist_invites.receiver_id = $1
         AND collab_playlist_invites.status = 'pending'
       ORDER BY collab_playlist_invites.created_at DESC`,
      [user.id]
    );
    await pool.query(
      `UPDATE friend_requests
       SET seen_at = COALESCE(seen_at, now())
       WHERE receiver_id = $1 AND status = 'pending'`,
      [user.id]
    );
    await pool.query(
      `UPDATE collab_playlist_invites
       SET seen_at = COALESCE(seen_at, now())
       WHERE receiver_id = $1 AND status = 'pending'`,
      [user.id]
    );
    res.json([
      ...rows.map(row => ({ ...row, request_type: 'friend' })),
      ...collabInvites.rows.map(row => ({ ...row, request_type: 'collab_playlist' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  } catch (err) {
    next(err);
  }
});

app.get('/api/friends/requests/count', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `SELECT
         (
           SELECT count(*)::int
           FROM friend_requests
           WHERE receiver_id = $1 AND status = 'pending' AND seen_at IS NULL
         )
         +
         (
           SELECT count(*)::int
           FROM collab_playlist_invites
           WHERE receiver_id = $1 AND status = 'pending' AND seen_at IS NULL
         ) AS count`,
      [user.id]
    );
    res.json({ count: rows[0]?.count || 0 });
  } catch (err) {
    next(err);
  }
});

app.post('/api/friends/request', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const nickname = repairMojibake(String(req.body.nickname || '').trim().replace(/^@/, ''));
    const friendId = String(req.body.friend_id || '').trim();
    const { rows } = friendId
      ? await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [friendId])
      : await pool.query('SELECT * FROM users WHERE lower(nickname) = lower($1) LIMIT 1', [nickname]);
    const receiver = rows[0];
    if (!receiver) return res.status(404).json({ error: 'User not found' });
    if (receiver.id === user.id) return res.status(400).json({ error: 'You cannot add yourself' });
    if (await areFriends(user.id, receiver.id)) return res.json({ ok: true, already_friends: true, user: publicUser(receiver) });

    const existingReverse = await pool.query(
      `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
       LIMIT 1`,
      [receiver.id, user.id]
    );
    if (existingReverse.rows[0]) {
      await pool.query(
        `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [user.id, receiver.id]
      );
      const accepted = await pool.query('UPDATE friend_requests SET status = $1 WHERE id = $2 RETURNING *', ['accepted', existingReverse.rows[0].id]);
      if (accepted.rows[0]) broadcast({ table: 'friend_requests', event: 'UPDATE', new: rowToClient(accepted.rows[0]) });
      return res.json({ ok: true, accepted: true, user: publicUser(receiver) });
    }

    const request = await pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id)
       VALUES ($1, $2)
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = now()
       RETURNING *`,
      [user.id, receiver.id]
    );
    broadcast({ table: 'friend_requests', event: 'INSERT', new: rowToClient(request.rows[0]) });
    res.status(201).json(request.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/friends/requests/:id/accept', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `UPDATE friend_requests
       SET status = 'accepted'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const request = rows[0];
    if (!request) return res.status(404).json({ error: 'Friend request not found' });
    await pool.query(
      `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
       ON CONFLICT DO NOTHING`,
      [request.sender_id, request.receiver_id]
    );
    broadcast({ table: 'friend_requests', event: 'UPDATE', new: rowToClient(request) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/friends/requests/:id/decline', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `UPDATE friend_requests
       SET status = 'declined'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const request = rows[0];
    if (!request) return res.status(404).json({ error: 'Friend request not found' });
    broadcast({ table: 'friend_requests', event: 'UPDATE', new: rowToClient(request) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/collab-playlists/:id/invite', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const playlist = await assertCollabAccess(req.params.id, user, 'view');
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    if (String(playlist.owner_id) !== String(user.id)) return res.status(403).json({ error: 'Only owner can invite collaborators' });

    const receiverId = String(req.body.receiver_id || '').trim();
    if (!receiverId) return res.status(400).json({ error: 'receiver_id is required' });
    if (receiverId === String(user.id)) return res.status(400).json({ error: 'You cannot invite yourself' });
    if (!await areFriends(user.id, receiverId)) return res.status(403).json({ error: 'Only friends can be invited' });
    if ((playlist.collaborator_ids || []).map(String).includes(receiverId)) {
      return res.json({ ok: true, already_collaborator: true });
    }

    const { rows } = await pool.query(
      `INSERT INTO collab_playlist_invites (playlist_id, sender_id, receiver_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, receiver_id)
       DO UPDATE SET status = 'pending', sender_id = EXCLUDED.sender_id, seen_at = null, updated_at = now()
       RETURNING *`,
      [playlist.id, user.id, receiverId]
    );
    broadcast({ table: 'collab_playlist_invites', event: 'INSERT', new: rowToClient(rows[0]) });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/collab-invites/:id/accept', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `UPDATE collab_playlist_invites
       SET status = 'accepted'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const invite = rows[0];
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    broadcast({ table: 'collab_playlist_invites', event: 'UPDATE', new: rowToClient(invite) });

    const updated = await pool.query(
      `UPDATE collab_playlists
       SET collaborator_ids = CASE
             WHEN $2::uuid = ANY(collaborator_ids) THEN collaborator_ids
             ELSE array_append(collaborator_ids, $2::uuid)
           END,
           collaborator_emails = CASE
             WHEN users.email = ANY(collaborator_emails) THEN collaborator_emails
             ELSE array_append(collaborator_emails, users.email)
           END,
           last_edited_by = users.email,
           last_edited_at = $3
       FROM users
       WHERE collab_playlists.id = $1
         AND users.id = $2
       RETURNING collab_playlists.*`,
      [invite.playlist_id, user.id, Date.now()]
    );
    const playlist = rowToClient(updated.rows[0]);
    if (playlist) broadcast({ table: 'collab_playlists', event: 'UPDATE', new: playlist });
    res.json({ ok: true, playlist });
  } catch (err) {
    next(err);
  }
});

app.post('/api/collab-invites/:id/decline', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const { rows } = await pool.query(
      `UPDATE collab_playlist_invites
       SET status = 'declined'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Invite not found' });
    broadcast({ table: 'collab_playlist_invites', event: 'UPDATE', new: rowToClient(rows[0]) });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/friends/:id', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const friendId = String(req.params.id || '').trim();
    if (!friendId) return res.status(400).json({ error: 'Friend id is required' });
    await pool.query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [user.id, friendId]
    );
    await pool.query(
      `DELETE FROM friend_requests
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)`,
      [user.id, friendId]
    );
    res.json({ ok: true, id: friendId });
  } catch (err) {
    next(err);
  }
});

app.post('/api/share/song', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const songId = String(req.body.song_id || '').trim();
    const receiverId = String(req.body.receiver_id || '').trim();
    if (!songId || !receiverId) return res.status(400).json({ error: 'song_id and receiver_id are required' });
    if (!await areFriends(user.id, receiverId)) return res.status(403).json({ error: 'You can share only with friends' });
    const ownSong = await pool.query('SELECT * FROM songs WHERE id = $1 AND user_id = $2 LIMIT 1', [songId, user.id]);
    if (!ownSong.rows[0]) return res.status(404).json({ error: 'Song not found' });
    const { rows } = await pool.query(
      `INSERT INTO song_shares (sender_id, receiver_id, song_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, receiverId, songId, repairMojibake(String(req.body.message || ''))]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

app.get('/api/collab-playlists/:id/songs', async (req, res, next) => {
  try {
    const user = await requireSessionUser(req);
    requireVerifiedUser(user);
    const playlist = await assertCollabAccess(req.params.id, user, 'view');
    if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
    const ids = (playlist.song_ids || []).map(String);
    if (!ids.length) return res.json([]);
    const { rows } = await pool.query(
      `SELECT *
       FROM songs
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    const byId = new Map(rows.map(row => [String(row.id), rowToClient(row)]));
    res.json(ids.map(id => byId.get(id)).filter(Boolean));
  } catch (err) {
    next(err);
  }
});

app.get('/api/entities/:table', async (req, res, next) => {
  try {
    const { table } = req.params;
    const config = assertTable(table);
    const user = privateTables.has(table) ? await requireSessionUser(req) : null;
    const where = [];
    const params = [];

    if (user) {
      requireVerifiedUser(user);
      params.push(user.id);
      where.push(`user_id = $${params.length}`);
    } else if (table === 'collab_playlists') {
      const collabUser = await requireSessionUser(req);
      requireVerifiedUser(collabUser);
      params.push(collabUser.id);
      where.push(`(owner_id = $${params.length} OR $${params.length} = ANY(collaborator_ids) OR access_level = 'public')`);
    }

    for (const [key, value] of Object.entries(req.query)) {
      if (config.columns.includes(key) || key === 'id') {
        params.push(value);
        where.push(`${key} = $${params.length}`);
      }
    }

    const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(rowToClient));
  } catch (err) {
    next(err);
  }
});

app.get('/api/entities/:table/:id', async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    const user = privateTables.has(table) ? await requireSessionUser(req) : null;
    if (user) {
      requireVerifiedUser(user);
      await queryOne(res, `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, user.id]);
    } else if (table === 'collab_playlists') {
      const collabUser = await requireSessionUser(req);
      requireVerifiedUser(collabUser);
      await assertCollabAccess(id, collabUser, 'view');
      await queryOne(res, `SELECT * FROM ${table} WHERE id = $1`, [id]);
    } else {
      await queryOne(res, `SELECT * FROM ${table} WHERE id = $1`, [id]);
    }
  } catch (err) {
    next(err);
  }
});

app.post('/api/entities/:table', async (req, res, next) => {
  try {
    const { table } = req.params;
    const user = privateTables.has(table) ? await requireSessionUser(req) : null;
    const collabUser = table === 'collab_playlists' ? await requireSessionUser(req) : null;
    if (user) requireVerifiedUser(user);
    if (collabUser) requireVerifiedUser(collabUser);
    const payload = normalizePayload(table, req.body);
    if (user) payload.user_id = user.id;
    if (collabUser) {
      payload.owner_id = collabUser.id;
      payload.owner_email = collabUser.email;
      payload.access_level = payload.access_level || 'collaborative';
      payload.collaborator_ids = [];
      payload.collaborator_emails = [];
    }
    const columns = Object.keys(payload);
    const values = Object.values(payload);
    const placeholders = values.map((_, index) => `$${index + 1}`);
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const { rows } = await pool.query(sql, values);
    const row = rowToClient(rows[0]);
    broadcast({ table, event: 'INSERT', new: row });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/entities/:table/:id', async (req, res, next) => {
  try {
    const { table, id } = req.params;
    const user = privateTables.has(table) ? await requireSessionUser(req) : null;
    const collabUser = table === 'collab_playlists' ? await requireSessionUser(req) : null;
    if (user) requireVerifiedUser(user);
    if (collabUser) requireVerifiedUser(collabUser);
    let existingCollab = null;
    if (collabUser) {
      existingCollab = await assertCollabAccess(id, collabUser, 'edit');
      if (req.body.collaborator_ids !== undefined || req.body.access_level !== undefined) {
        if (String(existingCollab.owner_id) !== String(collabUser.id)) return res.status(403).json({ error: 'Only owner can manage collaborators' });
      }
    }
    const payload = normalizePayload(table, req.body, true);
    if (collabUser) {
      delete payload.owner_id;
      delete payload.owner_email;
      if (payload.collaborator_ids !== undefined) {
        payload.collaborator_ids = await normalizeCollaborators(collabUser, payload.collaborator_ids);
        const existingIds = new Set((existingCollab?.collaborator_ids || []).map(String));
        const addsCollaborator = payload.collaborator_ids.some(id => !existingIds.has(String(id)));
        if (addsCollaborator) {
          return res.status(400).json({ error: 'Send an invite first. Collaborators are added only after they accept.' });
        }
        const emails = [];
        if (payload.collaborator_ids.length) {
          const { rows } = await pool.query('SELECT email FROM users WHERE id = ANY($1::uuid[])', [payload.collaborator_ids]);
          emails.push(...rows.map(row => row.email));
        }
        payload.collaborator_emails = emails;
      }
    }
    const columns = Object.keys(payload);
    if (!columns.length) {
      return user
        ? queryOne(res, `SELECT * FROM ${table} WHERE id = $1 AND user_id = $2`, [id, user.id])
        : queryOne(res, `SELECT * FROM ${table} WHERE id = $1`, [id]);
    }

    const values = Object.values(payload);
    const setSql = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
    const whereSql = user
      ? `id = $${columns.length + 1} AND user_id = $${columns.length + 2}`
      : `id = $${columns.length + 1}`;
    const sql = `UPDATE ${table} SET ${setSql} WHERE ${whereSql} RETURNING *`;
    const { rows } = await pool.query(sql, user ? [...values, id, user.id] : [...values, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const row = rowToClient(rows[0]);
    broadcast({ table, event: 'UPDATE', new: row });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/entities/:table/:id', async (req, res, next) => {
  try {
    const { table, id } = req.params;
    assertTable(table);
    const user = privateTables.has(table) ? await requireSessionUser(req) : null;
    const collabUser = table === 'collab_playlists' ? await requireSessionUser(req) : null;
    if (user) requireVerifiedUser(user);
    if (collabUser) requireVerifiedUser(collabUser);
    if (collabUser) await assertCollabAccess(id, collabUser, 'delete');
    const deleteSql = user ? `DELETE FROM ${table} WHERE id = $1 AND user_id = $2 RETURNING *` : collabUser ? `DELETE FROM ${table} WHERE id = $1 AND owner_id = $2 RETURNING *` : `DELETE FROM ${table} WHERE id = $1 RETURNING *`;
    const { rows } = await pool.query(deleteSql, user ? [id, user.id] : collabUser ? [id, collabUser.id] : [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const old = rowToClient(rows[0]);
    broadcast({ table, event: 'DELETE', old });

    if (table === 'songs') {
      const playlistUpdates = await pool.query(
        `UPDATE playlists
         SET song_ids = array_remove(song_ids, $1::uuid)
         WHERE $1::uuid = ANY(song_ids)
           AND user_id = $2
         RETURNING *`,
        [id, user?.id]
      );
      for (const row of playlistUpdates.rows) {
        broadcast({ table: 'playlists', event: 'UPDATE', new: rowToClient(row) });
      }

      const collabUpdates = await pool.query(
        `UPDATE collab_playlists
         SET song_ids = array_remove(song_ids, $1::uuid), last_edited_at = now()
         WHERE $1::uuid = ANY(song_ids)
         RETURNING *`,
        [id]
      );
      for (const row of collabUpdates.rows) {
        broadcast({ table: 'collab_playlists', event: 'UPDATE', new: rowToClient(row) });
      }
    }
    res.json({ id });
  } catch (err) {
    next(err);
  }
});

app.post('/api/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const bucket = String(req.body.bucket || 'songs').replace(/[^a-z0-9_-]/gi, '_');

    if (CLOUDINARY_ENABLED) {
      const publicUrl = await uploadToCloudinary(req.file.path, bucket, req.file.originalname);
      await removeTempFile(req.file.path);
      return res.json({ publicUrl });
    }

    const targetDir = path.join(uploadRoot, bucket);
    await fs.mkdir(targetDir, { recursive: true });

    const ext = path.extname(req.file.originalname || '') || '';
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    const targetPath = path.join(targetDir, name);
    await fs.rename(req.file.path, targetPath);

    res.json({ publicUrl: `${PUBLIC_BASE_URL}/uploads/${bucket}/${name}` });
  } catch (err) {
    await removeTempFile(req.file?.path);
    next(err);
  }
});

app.get('/api/youtube/search', async (req, res, next) => {
  try {
    const query = repairMojibake(String(req.query.q || '').trim());
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 10);
    let info;
    try {
      info = await youtubedl(`ytsearch${limit}:${query}`, {
        dumpSingleJson: true,
        skipDownload: true,
        noWarnings: true,
      });
    } catch (error) {
      const stdout = String(error?.stdout || '').trim();
      if (stdout) {
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? stdout.slice(jsonStart, jsonEnd + 1) : stdout;
        try {
          info = JSON.parse(jsonText);
        } catch {
          throw error;
        }
      } else {
        throw error;
      }
    }
    const entries = (info.entries?.length ? info.entries : [info])
      .filter(entry => entry?.id && !entry.is_live && entry.duration !== 0)
      .slice(0, limit)
      .map(entry => ({
        title: repairMojibake(entry.title || query),
        artist: repairMojibake(entry.artist || entry.uploader || entry.channel || ''),
        uploader: repairMojibake(entry.uploader || entry.channel || ''),
        video_id: entry.id,
        thumbnail: entry.thumbnail || `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg`,
        duration: entry.duration || null,
      }));
    if (!entries.length) return res.status(404).json({ error: 'No video found' });

    res.json({ results: entries, ...entries[0] });
  } catch (err) {
    next(err);
  }
});

app.post('/api/youtube/download', async (req, res, next) => {
  try {
    const videoId = String(req.body.videoId || '').trim();
    if (!/^[\w-]{11}$/.test(videoId)) return res.status(400).json({ error: 'Valid videoId is required' });

    const dir = path.join(mediaRoot, 'youtube');
    await fs.mkdir(dir, { recursive: true });
    const baseName = `${Date.now()}-${videoId}`;
    const outputTemplate = path.join(dir, `${baseName}.%(ext)s`);

    await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      output: outputTemplate,
      format: 'bestaudio[ext=m4a]/bestaudio/best',
      noPlaylist: true,
      noWarnings: true,
      restrictFilenames: true,
      quiet: true,
    });

    const files = await fs.readdir(dir);
    const file = files.find(item => item.startsWith(baseName + '.'));
    if (!file) throw new Error('Audio file was not created');
    const filePath = path.join(dir, file);

    if (CLOUDINARY_ENABLED) {
      const fileUrl = await uploadToCloudinary(filePath, 'youtube', file);
      await removeTempFile(filePath);
      return res.json({
        file_url: fileUrl,
        cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });
    }

    res.json({
      file_url: `${PUBLIC_BASE_URL}/media/youtube/${file}`,
      cover_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    });
  } catch (err) {
    next(err);
  }
});

function extractSpotifyPlaylistId(input) {
  const value = String(input || '').trim();
  return value.match(/playlist\/([A-Za-z0-9]+)/)?.[1] || value.match(/^spotify:playlist:([A-Za-z0-9]+)/)?.[1] || null;
}

function extractSpotifyTrackId(input) {
  const value = String(input || '').trim();
  return value.match(/track\/([A-Za-z0-9]+)/)?.[1] || value.match(/^spotify:track:([A-Za-z0-9]+)/)?.[1] || null;
}

async function getSpotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });
  if (!response.ok) throw new Error('Spotify auth failed');
  const data = await response.json();
  return data.access_token;
}

function spotifyTrackToChart(track, index) {
  if (!track?.name) return null;
  const artist = (track.artists || []).map(item => item.name).filter(Boolean).join(', ');
  const image = pickLargestSpotifyImage(track.album?.images);
  const title = cleanSearchText(track.name);
  const artistName = cleanSearchText(artist);
  return {
    rank: index + 1,
    title,
    artist: artistName,
    cover_url: image,
    source_url: track.external_urls?.spotify || '',
    youtube_query: `${title} ${artistName}`.trim(),
  };
}

function pickLargestSpotifyImage(images = []) {
  if (!Array.isArray(images) || !images.length) return '';
  return [...images]
    .filter(image => image?.url)
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0]?.url || '';
}

async function fetchSpotifyEmbedChart(playlistUrl, limit) {
  const response = await fetch(playlistUrl.replace('open.spotify.com/playlist', 'open.spotify.com/embed/playlist'), {
    headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0' },
  });
  if (!response.ok) throw new Error('Spotify embed chart unavailable');
  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Spotify embed data unavailable');
  const data = JSON.parse(match[1]);
  const tracks = data?.props?.pageProps?.state?.data?.entity?.trackList || [];
  return tracks.slice(0, limit).map((item, index) => {
    const title = cleanSearchText(item.title || '');
    const artist = cleanSearchText(item.subtitle || '');
    const trackId = String(item.uri || '').split(':').pop();
    return {
      rank: index + 1,
      title,
      artist,
      cover_url: '',
      source_url: trackId ? `https://open.spotify.com/track/${trackId}` : '',
      youtube_query: `${title} ${artist}`.trim(),
    };
  }).filter(track => track.title);
}

app.get('/api/spotify/playlist', async (req, res, next) => {
  try {
    const url = String(req.query.url || '').trim();
    const playlistId = extractSpotifyPlaylistId(url);
    if (!playlistId) return res.status(400).json({ error: 'Spotify playlist URL is required' });

    let token = null;
    try {
      token = await getSpotifyToken();
    } catch {
      token = null;
    }
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, { headers });
      if (!metaResponse.ok) throw new Error('Spotify playlist not found or not public');
      const meta = await metaResponse.json();

      const tracks = [];
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(name,artists(name),album(images(url,width,height)),external_urls(spotify)))`;
      while (nextUrl) {
        const pageResponse = await fetch(nextUrl, { headers });
        if (!pageResponse.ok) throw new Error('Failed to fetch Spotify tracks');
        const page = await pageResponse.json();
        for (const item of page.items || []) {
          if (!item.track?.name) continue;
          const title = cleanSearchText(item.track.name);
          const artist = cleanSearchText((item.track.artists || []).map(artist => artist.name).join(', '));
          tracks.push({
            title,
            artist,
            cover_url: pickLargestSpotifyImage(item.track.album?.images),
            source_url: item.track.external_urls?.spotify || '',
            youtube_query: `${title} ${artist}`.trim(),
          });
        }
        nextUrl = page.next;
      }
      return res.json({ name: meta.name || 'Spotify Playlist', tracks });
    }

    const [data, tracks] = await Promise.all([
      spotify.getData(url).catch(() => null),
      spotify.getTracks(url, { headers: { 'user-agent': 'googlebot' } }),
    ]);
    const mappedTracks = (tracks || []).map(item => ({
      title: cleanSearchText(item.name || item.title || ''),
      artist: cleanSearchText((item.artists || []).map(artist => artist.name).join(', ') || item.artist || ''),
      cover_url: pickLargestSpotifyImage(item.album?.images) || item.coverArt?.sources?.[0]?.url || '',
      source_url: item.uri ? `https://open.spotify.com/track/${String(item.uri).split(':').pop()}` : item.external_urls?.spotify || item.externalUrl || '',
    })).filter(track => track.title);
    res.json({
      name: data?.name || data?.title || 'Spotify Playlist',
      tracks: await fillSpotifyCovers(mappedTracks),
      limited: true,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/spotify/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || 8)));
    if (!query) return res.status(400).json({ error: 'Query is required' });

    let token = null;
    try {
      token = await getSpotifyToken();
    } catch {
      token = null;
    }

    const trackId = extractSpotifyTrackId(query);
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      if (trackId) {
        const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers });
        if (!response.ok) throw new Error('Spotify track unavailable');
        const track = await response.json();
        const mapped = spotifyTrackToChart(track, 0);
        return res.json({ tracks: mapped ? [mapped] : [] });
      }

      const response = await fetch(`https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`, { headers });
      if (!response.ok) throw new Error('Spotify search unavailable');
      const data = await response.json();
      const tracks = (data.tracks?.items || []).map((track, index) => spotifyTrackToChart(track, index)).filter(Boolean);
      return res.json({ tracks });
    }

    if (trackId) {
      const data = await spotify.getData(`https://open.spotify.com/track/${trackId}`).catch(() => null);
      const title = cleanSearchText(data?.name || data?.title || '');
      const artist = cleanSearchText((data?.artists || []).map?.(artist => artist.name || artist).join(', ') || data?.artist || '');
      const cover = pickLargestSpotifyImage(data?.album?.images) || data?.coverArt?.sources?.[0]?.url || await fetchSpotifyOembedCover(`https://open.spotify.com/track/${trackId}`);
      return res.json({
        tracks: title ? [{
          rank: 1,
          title,
          artist,
          cover_url: cover,
          source_url: `https://open.spotify.com/track/${trackId}`,
          youtube_query: `${title} ${artist}`.trim(),
        }] : [],
      });
    }

    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`);
    if (!response.ok) throw new Error('Track search unavailable');
    const data = await response.json();
    const tracks = (data.results || []).map((item, index) => {
      const title = cleanSearchText(item.trackName || '');
      const artist = cleanSearchText(item.artistName || '');
      return {
        rank: index + 1,
        title,
        artist,
        cover_url: item.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        source_url: item.trackViewUrl || '',
        youtube_query: `${title} ${artist}`.trim(),
      };
    }).filter(track => track.title);
    res.json({ tracks, source: 'iTunes fallback' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/spotify/cover', async (req, res, next) => {
  try {
    const url = String(req.query.url || '').trim();
    if (!url || !url.includes('open.spotify.com/track/')) return res.json({ cover_url: '' });
    const cover = await fetchSpotifyOembedCover(url);
    res.json({ cover_url: cover || '' });
  } catch (err) {
    next(err);
  }
});

app.get('/api/charts/global', async (req, res, next) => {
  try {
    const limit = Math.max(5, Math.min(50, Number(req.query.limit || 20)));
    const response = await fetch(`https://itunes.apple.com/us/rss/topsongs/limit=${limit}/json`);
    if (!response.ok) throw new Error('Failed to fetch global chart');
    const data = await response.json();
    const entries = Array.isArray(data?.feed?.entry) ? data.feed.entry : [];
    const tracks = entries.map((entry, index) => {
      const images = entry['im:image'] || [];
      const image = images[images.length - 1]?.label || images[0]?.label || '';
      const artist = entry['im:artist']?.label || '';
      const title = entry['im:name']?.label || '';
      return {
        rank: index + 1,
        title: cleanSearchText(title),
        artist: cleanSearchText(artist),
        cover_url: image.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/300x300bb.$1'),
        source_url: entry.link?.attributes?.href || '',
        youtube_query: `${cleanSearchText(title)} ${cleanSearchText(artist)}`.trim(),
      };
    }).filter(track => track.title);
    res.json({ source: 'iTunes Store', tracks });
  } catch (err) {
    next(err);
  }
});

app.get('/api/charts/spotify', async (req, res, next) => {
  try {
    const limit = Math.max(5, Math.min(50, Number(req.query.limit || 20)));
    const playlistId = '37i9dQZEVXbMDoHDwVN2tF';
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    let token = null;
    try {
      token = await getSpotifyToken();
    } catch {
      token = null;
    }

    if (token) {
      const fields = 'items(track(name,artists(name),album(images(url,width,height)),external_urls(spotify))),next';
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&fields=${encodeURIComponent(fields)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Spotify chart unavailable');
      const data = await response.json();
      const tracks = (data.items || [])
        .map((item, index) => spotifyTrackToChart(item.track, index))
        .filter(Boolean);
      return res.json({ source: 'Spotify Top 50 - Global', tracks });
    }

    let tracks = [];
    try {
      tracks = await spotify.getTracks(playlistUrl, { headers: { 'user-agent': 'googlebot' } });
    } catch {
      tracks = await fillSpotifyCovers(await fetchSpotifyEmbedChart(playlistUrl, limit));
      return res.json({ source: 'Spotify Top 50 - Global', tracks });
    }
    const mappedTracks = (tracks || []).slice(0, limit).map((item, index) => {
      const title = cleanSearchText(item.name || item.title || '');
      const artist = cleanSearchText((item.artists || item.artist || []).map?.(a => a.name || a).filter(Boolean).join(', ') || item.artist || '');
      return {
        rank: index + 1,
        title,
        artist,
        cover_url: pickLargestSpotifyImage(item.album?.images) || item.coverArt?.sources?.[0]?.url || '',
        source_url: item.uri ? `https://open.spotify.com/track/${String(item.uri).split(':').pop()}` : '',
        youtube_query: `${title} ${artist}`.trim(),
      };
    }).filter(track => track.title);
    res.json({
      source: 'Spotify Top 50 - Global',
      tracks: await fillSpotifyCovers(mappedTracks),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/lyrics', async (req, res, next) => {
  try {
    const artist = String(req.query.artist || '');
    const title = String(req.query.title || '');
    const queries = buildLyricsQueries(artist, title);

    for (const query of queries) {
      const params = new URLSearchParams({
        artist_name: query.artist,
        track_name: query.title,
      });

      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        headers: { accept: 'application/json; charset=utf-8' },
      });

      if (response.ok) {
        const data = await response.json();
        const lyrics = repairMojibake(data.syncedLyrics || data.plainLyrics || '');
        if (lyrics) return res.json({ lyrics, synced: Boolean(data.syncedLyrics), source: 'lrclib', matched: query });
      }
    }

    for (const query of queries) {
      const params = new URLSearchParams({
        artist_name: query.artist,
        track_name: query.title,
      });
      const response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
        headers: { accept: 'application/json; charset=utf-8' },
      });
      if (!response.ok) continue;
      const results = await response.json();
      const best = (Array.isArray(results) ? results : [])
        .filter(item => item?.syncedLyrics || item?.plainLyrics)
        .sort((a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)))[0];
      const lyrics = repairMojibake(best?.syncedLyrics || best?.plainLyrics || '');
      if (lyrics) {
        return res.json({
          lyrics,
          synced: Boolean(best.syncedLyrics),
          source: 'lrclib-search',
          matched: { artist: best.artistName || query.artist, title: best.trackName || query.title },
        });
      }
    }

    res.status(404).json({
      error: 'Текст не знайдено. Можеш додати його вручну.',
      lyrics: '',
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/lyrics', async (req, res, next) => {
  try {
    const artist = String(req.query.artist || '');
    const title = String(req.query.title || '');
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
    });

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { accept: 'application/json; charset=utf-8' },
    });

    if (response.ok) {
      const data = await response.json();
      const lyrics = repairMojibake(data.syncedLyrics || data.plainLyrics || '');
      if (lyrics) return res.json({ lyrics, synced: Boolean(data.syncedLyrics), source: 'lrclib' });
    }

    res.status(404).json({
      error: 'ШІ замріявся і пише вірші... Спробуйте за мить!',
      lyrics: '',
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

ensureSchema()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`DreamTune API listening on ${PUBLIC_BASE_URL}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize PostgreSQL schema:', err);
    process.exitCode = 1;
  });
