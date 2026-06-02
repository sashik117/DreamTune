import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import dns from 'node:dns';
import multer from 'multer';
import pg from 'pg';
import youtubedlExec from 'youtube-dl-exec';
import ytdl from '@distube/ytdl-core';
import spotifyUrlInfo from 'spotify-url-info';
import { WebSocketServer } from 'ws';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import { createAuthRouter } from './features/auth/auth.routes.js';
import { createTrackRouter } from './features/track/track.routes.js';
import { createPlaylistRouter } from './features/playlist/playlist.routes.js';
import { createCollabPlaylistRouter } from './features/playlist/collab-playlist.routes.js';
import { createListenHistoryRouter } from './features/listen-history/listen-history.routes.js';
import { createUserRouter } from './features/user/user.routes.js';
import { createSocialRouter } from './features/social/social.routes.js';
import { createAdminRouter } from './features/admin/admin.routes.js';
import { createUploadRouter } from './features/upload/upload.routes.js';
import { createMediaRouter } from './features/media/media.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dns.setDefaultResultOrder?.('ipv4first');
const rootDir = path.resolve(__dirname, '..');
const youtubedl = process.env.YT_DLP_PATH ? youtubedlExec.create(process.env.YT_DLP_PATH) : youtubedlExec;
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

async function ensureSchema() {
  const schema = await fs.readFile(path.join(rootDir, 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
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

function scoreText(text) {
  const replacement = (text.match(/[\ufffd]/g) || []).length * 20;
  const mojibake = (text.match(/(?:\u00c3|\u00c2|\u00d0|\u00d1|\u0420\u00a0|\u0420\u040e|\u0432\u0402|\u043f\u0457\u0405)/g) || []).length * 8;
  const cyrillic = (text.match(/[\u0410-\u042f\u0430-\u044f\u0406\u0456\u0407\u0457\u0404\u0454\u0490\u0491]/g) || []).length * 3;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const useful = (text.match(/[0-9'?.,!?():\-& ]/g) || []).length * 0.2;
  return cyrillic + latin + useful - mojibake - replacement;
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

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

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

  try {
    await mailer.sendMail({
      from: `"DreamTune Team" <${SUPPORT_EMAIL}>`,
      to: email,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.warn(`DreamTune email delivery failed for ${email}. Verification code: ${code}`, err);
    return false;
  }
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

const featureDependencies = {
  pool,
  fs,
  upload,
  uploadRoot,
  mediaRoot,
  publicBaseUrl: PUBLIC_BASE_URL,
  cloudinaryEnabled: CLOUDINARY_ENABLED,
  uploadToCloudinary,
  removeTempFile,
  ytdl,
  youtubedl,
  spotify,
  getSessionUser,
  requireSessionUser,
  requireVerifiedUser,
  requireAdmin,
  assertCollabAccess,
  normalizeCollaborators,
  areFriends,
  publicUser,
  sendVerificationEmail,
  emailEnabled: Boolean(mailer),
  broadcast,
  rowToClient,
  repairText: repairMojibake,
};

app.use('/api/auth', createAuthRouter(featureDependencies));
app.use('/api/tracks', createTrackRouter(featureDependencies));
app.use('/api/playlists', createPlaylistRouter(featureDependencies));
app.use('/api/collab-playlists', createCollabPlaylistRouter(featureDependencies));
app.use('/api/listen-history', createListenHistoryRouter(featureDependencies));
app.use('/api/users', createUserRouter(featureDependencies));
app.use(createSocialRouter(featureDependencies));
app.use('/api/admin', createAdminRouter(featureDependencies));
app.use(createUploadRouter(featureDependencies));
app.use(createMediaRouter(featureDependencies));

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
