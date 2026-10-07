import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function sanitizeFilePart(value, fallback) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 90)
    || fallback;
}

function attachmentName({ title, artist, fileName }) {
  const provided = String(fileName || '').trim();
  if (provided.toLowerCase().endsWith('.mp3')) {
    return sanitizeFilePart(provided.replace(/\.mp3$/i, ''), 'DreamTune track') + '.mp3';
  }
  const artistPart = sanitizeFilePart(artist, '');
  const titlePart = sanitizeFilePart(title, 'DreamTune track');
  return `${artistPart ? `${artistPart} - ` : ''}${titlePart}.mp3`;
}

function contentDisposition(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export class ExportService {
  constructor({ mediaRoot, uploadRoot, publicBaseUrl, ffmpegPath }) {
    this.mediaRoot = mediaRoot;
    this.uploadRoot = uploadRoot;
    this.publicBaseUrl = publicBaseUrl;
    this.ffmpegPath = ffmpegPath || process.env.FFMPEG_PATH || ffmpegStatic || null;
  }

  assertLocalhost(req) {
    const host = String(req.hostname || '').toLowerCase();
    const remote = String(req.socket?.remoteAddress || '');
    const localHost = host === 'localhost' || host === '127.0.0.1';
    const localRemote = remote === '127.0.0.1'
      || remote === '::1'
      || remote === '::ffff:127.0.0.1';
    if (!localHost || !localRemote) {
      throw createError('MP3 export is only available on localhost', 403);
    }
  }

  resolveLocalPath(sourceUrl) {
    const raw = String(sourceUrl || '').trim();
    if (!raw) return '';

    let pathname = raw.split('?')[0];
    try {
      const parsed = new URL(raw, this.publicBaseUrl || 'http://localhost:4000');
      pathname = decodeURIComponent(parsed.pathname || '');
    } catch {
      pathname = decodeURIComponent(pathname);
    }

    const roots = [
      ['/media/', this.mediaRoot],
      ['/uploads/', this.uploadRoot],
    ];

    for (const [prefix, root] of roots) {
      if (!root || !pathname.startsWith(prefix)) continue;
      const candidate = path.resolve(root, pathname.slice(prefix.length));
      if (isInside(root, candidate)) return candidate;
    }

    return '';
  }

  async resolveInput(sourceUrl) {
    const localPath = this.resolveLocalPath(sourceUrl);
    if (localPath) {
      try {
        await fs.access(localPath);
        return { input: localPath, extension: path.extname(localPath).replace('.', '').toLowerCase() };
      } catch {
        throw createError('Audio source file was not found', 404);
      }
    }

    if (/^https?:\/\//i.test(sourceUrl)) {
      const clean = sourceUrl.split('?')[0].toLowerCase();
      const match = clean.match(/\.([a-z0-9]{2,5})$/);
      return { input: sourceUrl, extension: match?.[1] || '' };
    }

    throw createError('Audio source is missing', 400);
  }

  transcodeToMp3(input, outputPath) {
    if (!this.ffmpegPath) {
      throw createError('ffmpeg is not available', 503);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, [
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', input,
        '-vn',
        '-codec:a', 'libmp3lame',
        '-q:a', '2',
        outputPath,
      ], { windowsHide: true });

      let stderr = '';
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      child.on('error', (error) => reject(error));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(createError(stderr.trim() || 'Could not convert audio to MP3', 500));
      });
    });
  }

  async exportMp3(req, res) {
    this.assertLocalhost(req);

    const sourceUrl = String(req.body?.sourceUrl || req.body?.source_url || req.query?.sourceUrl || '').trim();
    const fileName = attachmentName({
      title: req.body?.title || req.query?.title,
      artist: req.body?.artist || req.query?.artist,
      fileName: req.body?.fileName || req.body?.file_name || req.query?.fileName,
    });

    const { input, extension } = await this.resolveInput(sourceUrl);
    const tmpOut = path.join(os.tmpdir(), `dreamtune-export-${randomUUID()}.mp3`);

    try {
      if (extension === 'mp3' && !/^https?:\/\//i.test(input)) {
        await fs.copyFile(input, tmpOut);
      } else {
        await this.transcodeToMp3(input, tmpOut);
      }

      const stat = await fs.stat(tmpOut);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Content-Disposition', contentDisposition(fileName));
      res.sendFile(tmpOut, { dotfiles: 'deny' }, async () => {
        await fs.unlink(tmpOut).catch(() => {});
      });
    } catch (error) {
      await fs.unlink(tmpOut).catch(() => {});
      throw error;
    }
  }
}
