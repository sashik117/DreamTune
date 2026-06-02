import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function extractYouTubeVideoId(input) {
  const value = String(input || '').trim();
  return value.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1]
    || value.match(/^[\w-]{11}$/)?.[0]
    || '';
}

function extractSpotifyPlaylistId(input) {
  const value = String(input || '').trim();
  return value.match(/playlist\/([A-Za-z0-9]+)/)?.[1] || value.match(/^spotify:playlist:([A-Za-z0-9]+)/)?.[1] || null;
}

function extractSpotifyTrackId(input) {
  const value = String(input || '').trim();
  return value.match(/track\/([A-Za-z0-9]+)/)?.[1] || value.match(/^spotify:track:([A-Za-z0-9]+)/)?.[1] || null;
}

function audioExtensionFromType(type = '') {
  const value = String(type).toLowerCase();
  if (value.includes('mp4') || value.includes('m4a')) return 'm4a';
  if (value.includes('mpeg') || value.includes('mp3')) return 'mp3';
  if (value.includes('webm')) return 'webm';
  if (value.includes('ogg')) return 'ogg';
  return 'm4a';
}

export class MediaService {
  constructor({
    pool,
    fs,
    ytdl,
    youtubedl,
    mediaRoot,
    publicBaseUrl,
    cloudinaryEnabled,
    uploadToCloudinary,
    removeTempFile,
    spotify,
    repairText,
  }) {
    this.pool = pool;
    this.fs = fs;
    this.ytdl = ytdl;
    this.youtubedl = youtubedl;
    this.mediaRoot = mediaRoot;
    this.publicBaseUrl = publicBaseUrl;
    this.cloudinaryEnabled = Boolean(cloudinaryEnabled);
    this.uploadToCloudinary = uploadToCloudinary;
    this.removeTempFile = removeTempFile;
    this.spotify = spotify;
    this.repairText = repairText || (value => value);
  }

  readLimit(value, fallback = 20) {
    return Math.max(5, Math.min(50, Number(value || fallback)));
  }

  cleanSearchText(value) {
    return this.repairText(String(value || ''))
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cleanLyricsText(value) {
    return this.cleanSearchText(value)
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
      .replace(/^[\s\-\u2013\u2014]+|[\s\-\u2013\u2014]+$/g, '')
      .trim();
  }

  buildLyricsQueries(artist, title) {
    const cleanArtist = this.cleanLyricsText(artist);
    const cleanTitle = this.cleanLyricsText(title)
      .replace(/\s+(feat\.?|ft\.?|with)\s+.+$/i, '')
      .replace(/\s*[\-\u2013\u2014]\s*(official|audio|video|lyrics?).*$/i, '')
      .trim();
    const titleWithoutArtist = cleanArtist
      ? this.cleanLyricsText(cleanTitle.replace(new RegExp(`^${cleanArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[\-\u2013\u2014:]\\s*`, 'i'), ''))
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

  async getSpotifyToken() {
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

  pickLargestSpotifyImage(images = []) {
    if (!Array.isArray(images) || !images.length) return '';
    return [...images]
      .filter(image => image?.url)
      .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0]?.url || '';
  }

  spotifyTrackToChart(track, index) {
    if (!track?.name) return null;
    const artist = (track.artists || []).map(item => item.name).filter(Boolean).join(', ');
    const image = this.pickLargestSpotifyImage(track.album?.images);
    const title = this.cleanSearchText(track.name);
    const artistName = this.cleanSearchText(artist);
    return {
      rank: index + 1,
      title,
      artist: artistName,
      cover_url: image,
      source_url: track.external_urls?.spotify || '',
      preview_url: track.preview_url || '',
      youtube_query: `${title} ${artistName}`.trim(),
    };
  }

  async fetchSpotifyEmbedChart(playlistUrl, limit) {
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
      const title = this.cleanSearchText(item.title || '');
      const artist = this.cleanSearchText(item.subtitle || '');
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

  async fetchSpotifyOembedCover(sourceUrl) {
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

  async fillSpotifyCovers(tracks) {
    return Promise.all((tracks || []).map(async (track) => ({
      ...track,
      cover_url: track.cover_url || await this.fetchSpotifyOembedCover(track.source_url),
    })));
  }

  async getYouTubeOembedEntry(videoId, fallbackTitle = '') {
    const fallback = {
      title: fallbackTitle || `YouTube ${videoId}`,
      artist: 'YouTube',
      uploader: 'YouTube',
      video_id: videoId,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: null,
    };
    try {
      const response = await withTimeout(
        fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, {
          headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0' },
        }),
        4500,
        'YouTube oEmbed timed out'
      );
      if (!response.ok) return fallback;
      const meta = await response.json();
      return {
        ...fallback,
        title: this.repairText(meta.title || fallback.title),
        artist: this.repairText(meta.author_name || fallback.artist),
        uploader: this.repairText(meta.author_name || fallback.uploader),
        thumbnail: meta.thumbnail_url || fallback.thumbnail,
      };
    } catch {
      return fallback;
    }
  }

  async searchYouTubeByPage(query, limit = 6) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'accept-language': 'en-US,en;q=0.8,uk;q=0.6',
      },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const ids = [];
    for (const match of html.matchAll(/"videoId":"([\w-]{11})"/g)) {
      const id = match[1];
      if (!ids.includes(id)) ids.push(id);
      if (ids.length >= limit) break;
    }

    const entries = await Promise.all(ids.map(async (id) => this.getYouTubeOembedEntry(id, query)));
    return entries.filter(entry => entry.video_id);
  }

  async searchYouTubeViaPiped(query, limit = 6) {
    const instances = [
      'https://api.piped.private.coffee',
      'https://pipedapi.adminforge.de',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi-libre.kavin.rocks',
      'https://pipedapi.syncpundit.io',
    ];

    for (const base of instances) {
      try {
        const response = await withTimeout(
          fetch(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`, {
            headers: {
              'user-agent': 'Mozilla/5.0 DreamTune/1.0',
              accept: 'application/json',
            },
          }),
          8500,
          'Piped search timed out'
        );
        if (!response.ok) continue;
        const data = await response.json();
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const entries = items
          .map(item => {
            const id = item?.url ? String(item.url).match(/[?&]v=([\w-]{11})/)?.[1] : item?.videoId || item?.id;
            if (!id) return null;
            return {
              title: this.repairText(item.title || query),
              artist: this.repairText(item.uploaderName || item.uploader || 'YouTube'),
              uploader: this.repairText(item.uploaderName || item.uploader || 'YouTube'),
              video_id: id,
              thumbnail: item.thumbnail || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
              duration: item.duration || null,
            };
          })
          .filter(Boolean)
          .slice(0, limit);
        if (entries.length) return entries;
      } catch (error) {
        console.warn('Piped search failed:', base, error.message || error);
      }
    }

    return [];
  }

  async searchYouTubeViaInvidious(query, limit = 6) {
    const instances = [
      'https://inv.thepixora.com',
      'https://yt.chocolatemoo53.com',
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yewtu.be',
    ];

    for (const base of instances) {
      try {
        const response = await withTimeout(
          fetch(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
            headers: {
              'user-agent': 'Mozilla/5.0 DreamTune/1.0',
              accept: 'application/json',
            },
          }),
          8500,
          'Invidious search timed out'
        );
        if (!response.ok) continue;
        const data = await response.json();
        const entries = (Array.isArray(data) ? data : [])
          .filter(item => item?.type === 'video' && item?.videoId)
          .map(item => {
            const thumb =
              item.videoThumbnails?.find?.(image => image?.quality === 'medium')?.url ||
              item.videoThumbnails?.[0]?.url ||
              `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`;
            return {
              title: this.repairText(item.title || query),
              artist: this.repairText(item.author || 'YouTube'),
              uploader: this.repairText(item.author || 'YouTube'),
              video_id: item.videoId,
              thumbnail: thumb.startsWith('//') ? `https:${thumb}` : thumb,
              duration: item.lengthSeconds || null,
            };
          })
          .slice(0, limit);
        if (entries.length) return entries;
      } catch (error) {
        console.warn('Invidious search failed:', base, error.message || error);
      }
    }

    return [];
  }

  async searchYouTubeViaLemnosLife(query, limit = 6) {
    const response = await withTimeout(
      fetch(`https://yt.lemnoslife.com/search?part=snippet&q=${encodeURIComponent(query)}&type=video`, {
        headers: {
          'user-agent': 'Mozilla/5.0 DreamTune/1.0',
          accept: 'application/json',
        },
      }),
      8500,
      'LemnosLife search timed out'
    );
    if (!response.ok) return [];
    const data = await response.json();
    return (data.items || [])
      .map(item => {
        const id = item?.id?.videoId || item?.videoId;
        if (!id) return null;
        return {
          title: this.repairText(item.snippet?.title || query),
          artist: this.repairText(item.snippet?.channelTitle || 'YouTube'),
          uploader: this.repairText(item.snippet?.channelTitle || 'YouTube'),
          video_id: id,
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          duration: null,
        };
      })
      .filter(Boolean)
      .slice(0, limit);
  }

  async searchYouTubeViaDuckDuckGo(query, limit = 6) {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(`${query} site:youtube.com/watch`)}`;
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (DreamTune music search)',
        accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);
    const html = await response.text();
    const ids = [];
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/g,
      /uddg=([^"&]+)/g,
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) && ids.length < limit * 2) {
        let value = match[1];
        if (pattern.source.includes('uddg=')) {
          try {
            value = decodeURIComponent(value);
          } catch {}
          const idMatch = value.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
          value = idMatch?.[1] || '';
        }
        if (/^[\w-]{11}$/.test(value) && !ids.includes(value)) ids.push(value);
      }
    }

    const entries = [];
    for (const id of ids.slice(0, limit)) {
      entries.push(await this.getYouTubeOembedEntry(id, query));
    }
    return entries;
  }

  async saveRemoteAudio(url, dir, baseName, extension, headers = {}) {
    const filePath = path.join(dir, `${baseName}.${extension || 'm4a'}`);
    const response = await withTimeout(
      fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 DreamTune/1.0',
          accept: '*/*',
          ...headers,
        },
      }),
      20000,
      'Remote audio stream timed out'
    );
    if (!response.ok || !response.body) {
      throw new Error(`Remote audio stream failed: ${response.status}`);
    }
    await withTimeout(
      pipeline(Readable.fromWeb(response.body), createWriteStream(filePath)),
      90000,
      'Remote audio save timed out'
    );
    return filePath;
  }

  async downloadYouTubeFromPipedOrInvidious(videoId, dir, baseName) {
    const pipedInstances = [
      'https://api.piped.private.coffee',
      'https://pipedapi.adminforge.de',
      'https://pipedapi.kavin.rocks',
      'https://pipedapi-libre.kavin.rocks',
      'https://pipedapi.syncpundit.io',
    ];
    for (const base of pipedInstances) {
      try {
        const response = await withTimeout(
          fetch(`${base}/streams/${videoId}`, {
            headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0', accept: 'application/json' },
          }),
          10000,
          'Piped stream lookup timed out'
        );
        if (!response.ok) continue;
        const data = await response.json();
        const audio = (data.audioStreams || [])
          .filter(item => item?.url)
          .sort((a, b) => Number(b.bitrate || b.quality || 0) - Number(a.bitrate || a.quality || 0))[0];
        if (!audio?.url) continue;
        const ext = audioExtensionFromType(audio.mimeType || audio.format);
        return await this.saveRemoteAudio(audio.url, dir, `${baseName}-piped`, ext);
      } catch (error) {
        console.warn('Piped audio fallback failed:', base, error.message || error);
      }
    }

    const invidiousInstances = [
      'https://inv.thepixora.com',
      'https://yt.chocolatemoo53.com',
      'https://inv.nadeko.net',
      'https://invidious.nerdvpn.de',
      'https://yewtu.be',
    ];
    for (const base of invidiousInstances) {
      try {
        const response = await withTimeout(
          fetch(`${base}/api/v1/videos/${videoId}`, {
            headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0', accept: 'application/json' },
          }),
          10000,
          'Invidious stream lookup timed out'
        );
        if (!response.ok) continue;
        const data = await response.json();
        const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
        const audio = formats
          .filter(item => item?.url && String(item.type || item.mimeType || '').toLowerCase().includes('audio'))
          .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
        if (!audio?.url) continue;
        const ext = audioExtensionFromType(audio.type || audio.mimeType);
        return await this.saveRemoteAudio(audio.url, dir, `${baseName}-iv`, ext);
      } catch (error) {
        console.warn('Invidious audio fallback failed:', base, error.message || error);
      }
    }

    throw new Error('No fallback audio stream found');
  }

  async downloadYouTubeWithNode(videoId, dir, baseName) {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await withTimeout(
      this.ytdl.getInfo(url, {
        requestOptions: {
          family: 4,
          headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0' },
        },
      }),
      25000,
      'YouTube metadata timed out'
    );
    const format = this.ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });
    if (!format?.url) throw new Error('No playable YouTube audio stream found');
    const ext = String(format.container || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';
    const filePath = path.join(dir, `${baseName}.${ext}`);
    await withTimeout(
      pipeline(
        this.ytdl.downloadFromInfo(info, {
          format,
          requestOptions: {
            family: 4,
            headers: { 'user-agent': 'Mozilla/5.0 DreamTune/1.0' },
          },
        }),
        createWriteStream(filePath)
      ),
      90000,
      'YouTube audio download timed out'
    );
    return filePath;
  }

  async searchYouTube(req) {
    const query = this.repairText(String(req.query.q || '').trim());
    if (!query) throw createError('Query is required', 400);

    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 10);
    const directVideoId = extractYouTubeVideoId(query);
    if (directVideoId) {
      const entry = await this.getYouTubeOembedEntry(directVideoId, query);
      return { results: [entry], ...entry };
    }

    let info;
    try {
      info = await withTimeout(
        this.youtubedl(`ytsearch${limit}:${query}`, {
          dumpSingleJson: true,
          skipDownload: true,
          noWarnings: true,
          forceIpv4: true,
          socketTimeout: 8,
        }),
        9000,
        'YouTube search timed out'
      );
    } catch (error) {
      const stdout = String(error?.stdout || '').trim();
      if (stdout) {
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? stdout.slice(jsonStart, jsonEnd + 1) : stdout;
        try {
          info = JSON.parse(jsonText);
        } catch {
          info = null;
        }
      }
    }
    let entries = (info?.entries?.length ? info.entries : info ? [info] : [])
      .filter(entry => entry?.id && !entry.is_live && entry.duration !== 0)
      .slice(0, limit)
      .map(entry => ({
        title: this.repairText(entry.title || query),
        artist: this.repairText(entry.artist || entry.uploader || entry.channel || ''),
        uploader: this.repairText(entry.uploader || entry.channel || ''),
        video_id: entry.id,
        thumbnail: entry.thumbnail || `https://img.youtube.com/vi/${entry.id}/hqdefault.jpg`,
        duration: entry.duration || null,
      }));

    if (!entries.length) {
      try {
        entries = await this.searchYouTubeViaPiped(query, limit);
      } catch (pipedError) {
        console.warn('YouTube Piped fallback failed:', pipedError.message || pipedError);
      }
    }
    if (!entries.length) {
      try {
        entries = await this.searchYouTubeViaInvidious(query, limit);
      } catch (invidiousError) {
        console.warn('YouTube Invidious fallback failed:', invidiousError.message || invidiousError);
      }
    }
    if (!entries.length) {
      try {
        entries = await this.searchYouTubeViaLemnosLife(query, limit);
      } catch (lemnosError) {
        console.warn('YouTube LemnosLife fallback failed:', lemnosError.message || lemnosError);
      }
    }
    if (!entries.length) {
      try {
        entries = await this.searchYouTubeByPage(query, limit);
      } catch (fallbackError) {
        console.warn('YouTube page fallback failed:', fallbackError.message || fallbackError);
      }
    }
    if (!entries.length) {
      try {
        entries = await this.searchYouTubeViaDuckDuckGo(query, limit);
      } catch (duckError) {
        console.warn('YouTube DuckDuckGo fallback failed:', duckError.message || duckError);
      }
    }
    if (!entries.length) {
      throw createError('YouTube зараз блокує пошук на цьому сервері. Спробуй ще раз трохи пізніше або додай аудіофайл з телефона.', 503);
    }

    return { results: entries, ...entries[0] };
  }

  async downloadYouTube(req) {
    const videoId = String(req.body.videoId || '').trim();
    if (!/^[\w-]{11}$/.test(videoId)) throw createError('Valid videoId is required', 400);

    const cached = await this.pool.query('SELECT file_url, cover_url FROM youtube_cache WHERE video_id = $1 LIMIT 1', [videoId]);
    if (cached.rows[0]?.file_url) {
      return {
        file_url: cached.rows[0].file_url,
        cover_url: cached.rows[0].cover_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        cached: true,
      };
    }

    const dir = path.join(this.mediaRoot, 'youtube');
    await this.fs.mkdir(dir, { recursive: true });
    const baseName = `${Date.now()}-${videoId}`;
    const outputTemplate = path.join(dir, `${baseName}.%(ext)s`);

    let filePath = '';
    let downloadedFile = '';
    try {
      await this.youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
        output: outputTemplate,
        format: 'bestaudio[ext=m4a]/bestaudio/best',
        noPlaylist: true,
        noWarnings: true,
        restrictFilenames: true,
        quiet: true,
        forceIpv4: true,
        noCheckCertificates: true,
        geoBypass: true,
        socketTimeout: 15,
        retries: 2,
        fragmentRetries: 2,
      });

      const files = await this.fs.readdir(dir);
      const file = files.find(item => item.startsWith(baseName + '.'));
      if (!file) throw new Error('Audio file was not created');
      downloadedFile = file;
      filePath = path.join(dir, file);
    } catch (error) {
      console.warn('yt-dlp download failed, trying node fallback:', error.message || error);
      try {
        filePath = await this.downloadYouTubeWithNode(videoId, dir, baseName);
      } catch (fallbackError) {
        console.warn('node YouTube fallback failed, trying public stream fallback:', fallbackError.message || fallbackError);
        try {
          filePath = await this.downloadYouTubeFromPipedOrInvidious(videoId, dir, baseName);
        } catch (streamError) {
          const message = `${error.message || ''} ${fallbackError.message || ''} ${streamError.message || ''}`;
          if (/not a bot|Sign in|confirm|TLS|SSL|EOF|No fallback/i.test(message)) {
            throw createError('YouTube блокує скачування на безкоштовному сервері. Спробуй інший трек, Spotify-метадані або додай файл з телефона.', 503);
          }
          throw streamError;
        }
      }
      downloadedFile = path.basename(filePath);
    }

    const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    if (this.cloudinaryEnabled) {
      const fileUrl = await this.uploadToCloudinary(filePath, 'youtube', downloadedFile);
      await this.removeTempFile(filePath);
      await this.pool.query(
        `INSERT INTO youtube_cache (video_id, file_url, cover_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (video_id) DO UPDATE SET file_url = EXCLUDED.file_url, cover_url = EXCLUDED.cover_url`,
        [videoId, fileUrl, coverUrl]
      );
      return {
        file_url: fileUrl,
        cover_url: coverUrl,
      };
    }

    const fileUrl = `${this.publicBaseUrl}/media/youtube/${downloadedFile}`;
    await this.pool.query(
      `INSERT INTO youtube_cache (video_id, file_url, cover_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (video_id) DO UPDATE SET file_url = EXCLUDED.file_url, cover_url = EXCLUDED.cover_url`,
      [videoId, fileUrl, coverUrl]
    );
    return {
      file_url: fileUrl,
      cover_url: coverUrl,
    };
  }

  async spotifyPlaylist(req) {
    const url = String(req.query.url || '').trim();
    const playlistId = extractSpotifyPlaylistId(url);
    if (!playlistId) throw createError('Spotify playlist URL is required', 400);

    let token = null;
    try {
      token = await this.getSpotifyToken();
    } catch {
      token = null;
    }
    if (token) {
      const headers = { Authorization: `Bearer ${token}` };
      const metaResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name`, { headers });
      if (!metaResponse.ok) throw new Error('Spotify playlist not found or not public');
      const meta = await metaResponse.json();

      const tracks = [];
      let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(name,preview_url,artists(name),album(images(url,width,height)),external_urls(spotify)))`;
      while (nextUrl) {
        const pageResponse = await fetch(nextUrl, { headers });
        if (!pageResponse.ok) throw new Error('Failed to fetch Spotify tracks');
        const page = await pageResponse.json();
        for (const item of page.items || []) {
          if (!item.track?.name) continue;
          const title = this.cleanSearchText(item.track.name);
          const artist = this.cleanSearchText((item.track.artists || []).map(artist => artist.name).join(', '));
          tracks.push({
            title,
            artist,
            cover_url: this.pickLargestSpotifyImage(item.track.album?.images),
            source_url: item.track.external_urls?.spotify || '',
            preview_url: item.track.preview_url || '',
            youtube_query: `${title} ${artist}`.trim(),
          });
        }
        nextUrl = page.next;
      }
      return { name: meta.name || 'Spotify Playlist', tracks };
    }

    const [data, tracks] = await Promise.all([
      this.spotify.getData(url).catch(() => null),
      this.spotify.getTracks(url, { headers: { 'user-agent': 'googlebot' } }),
    ]);
    const mappedTracks = (tracks || []).map(item => ({
      title: this.cleanSearchText(item.name || item.title || ''),
      artist: this.cleanSearchText((item.artists || []).map(artist => artist.name).join(', ') || item.artist || ''),
      cover_url: this.pickLargestSpotifyImage(item.album?.images) || item.coverArt?.sources?.[0]?.url || '',
      source_url: item.uri ? `https://open.spotify.com/track/${String(item.uri).split(':').pop()}` : item.external_urls?.spotify || item.externalUrl || '',
      preview_url: item.preview_url || item.previewUrl || '',
    })).filter(track => track.title);
    return {
      name: data?.name || data?.title || 'Spotify Playlist',
      tracks: await this.fillSpotifyCovers(mappedTracks),
      limited: true,
    };
  }

  async spotifySearch(req) {
    const query = String(req.query.q || '').trim();
    const limit = Math.max(1, Math.min(20, Number(req.query.limit || 8)));
    if (!query) throw createError('Query is required', 400);

    let token = null;
    try {
      token = await this.getSpotifyToken();
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
        const mapped = this.spotifyTrackToChart(track, 0);
        return { tracks: mapped ? [mapped] : [] };
      }

      const response = await fetch(`https://api.spotify.com/v1/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`, { headers });
      if (!response.ok) throw new Error('Spotify search unavailable');
      const data = await response.json();
      const tracks = (data.tracks?.items || []).map((track, index) => this.spotifyTrackToChart(track, index)).filter(Boolean);
      return { tracks };
    }

    if (trackId) {
      const data = await this.spotify.getData(`https://open.spotify.com/track/${trackId}`).catch(() => null);
      const title = this.cleanSearchText(data?.name || data?.title || '');
      const artist = this.cleanSearchText((data?.artists || []).map?.(artist => artist.name || artist).join(', ') || data?.artist || '');
      const cover = this.pickLargestSpotifyImage(data?.album?.images) || data?.coverArt?.sources?.[0]?.url || await this.fetchSpotifyOembedCover(`https://open.spotify.com/track/${trackId}`);
      return {
        tracks: title ? [{
          rank: 1,
          title,
          artist,
          cover_url: cover,
          source_url: `https://open.spotify.com/track/${trackId}`,
          youtube_query: `${title} ${artist}`.trim(),
        }] : [],
      };
    }

    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`);
    if (!response.ok) throw new Error('Track search unavailable');
    const data = await response.json();
    const tracks = (data.results || []).map((item, index) => {
      const title = this.cleanSearchText(item.trackName || '');
      const artist = this.cleanSearchText(item.artistName || '');
      return {
        rank: index + 1,
        title,
        artist,
        cover_url: item.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        source_url: item.trackViewUrl || '',
        youtube_query: `${title} ${artist}`.trim(),
      };
    }).filter(track => track.title);
    return { tracks, source: 'iTunes fallback' };
  }

  async spotifyCover(req) {
    const url = String(req.query.url || '').trim();
    if (!url || !url.includes('open.spotify.com/track/')) return { cover_url: '' };
    const cover = await this.fetchSpotifyOembedCover(url);
    return { cover_url: cover || '' };
  }

  async globalChart(req) {
    const limit = this.readLimit(req.query.limit);
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
        title: this.cleanSearchText(title),
        artist: this.cleanSearchText(artist),
        cover_url: image.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/300x300bb.$1'),
        source_url: entry.link?.attributes?.href || '',
        youtube_query: `${this.cleanSearchText(title)} ${this.cleanSearchText(artist)}`.trim(),
      };
    }).filter(track => track.title);
    return { source: 'iTunes Store', tracks };
  }

  async spotifyChart(req) {
    const limit = this.readLimit(req.query.limit);
    const playlistId = '37i9dQZEVXbMDoHDwVN2tF';
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    let token = null;
    try {
      token = await this.getSpotifyToken();
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
        .map((item, index) => this.spotifyTrackToChart(item.track, index))
        .filter(Boolean);
      return { source: 'Spotify Top 50 - Global', tracks };
    }

    let tracks = [];
    try {
      tracks = await this.spotify.getTracks(playlistUrl, { headers: { 'user-agent': 'googlebot' } });
    } catch {
      const embedTracks = await this.fillSpotifyCovers(await this.fetchSpotifyEmbedChart(playlistUrl, limit));
      return { source: 'Spotify Top 50 - Global', tracks: embedTracks };
    }
    const mappedTracks = (tracks || []).slice(0, limit).map((item, index) => {
      const title = this.cleanSearchText(item.name || item.title || '');
      const artist = this.cleanSearchText((item.artists || item.artist || []).map?.(a => a.name || a).filter(Boolean).join(', ') || item.artist || '');
      return {
        rank: index + 1,
        title,
        artist,
        cover_url: this.pickLargestSpotifyImage(item.album?.images) || item.coverArt?.sources?.[0]?.url || '',
        source_url: item.uri ? `https://open.spotify.com/track/${String(item.uri).split(':').pop()}` : '',
        youtube_query: `${title} ${artist}`.trim(),
      };
    }).filter(track => track.title);
    return {
      source: 'Spotify Top 50 - Global',
      tracks: await this.fillSpotifyCovers(mappedTracks),
    };
  }

  async lyrics(req) {
    const artist = String(req.query.artist || '');
    const title = String(req.query.title || '');
    const queries = this.buildLyricsQueries(artist, title);

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
        const lyrics = this.repairText(data.syncedLyrics || data.plainLyrics || '');
        if (lyrics) return { lyrics, synced: Boolean(data.syncedLyrics), source: 'lrclib', matched: query };
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
      const lyrics = this.repairText(best?.syncedLyrics || best?.plainLyrics || '');
      if (lyrics) {
        return {
          lyrics,
          synced: Boolean(best.syncedLyrics),
          source: 'lrclib-search',
          matched: { artist: best.artistName || query.artist, title: best.trackName || query.title },
        };
      }
    }

    const error = createError('Текст не знайдено. Можеш додати його вручну.', 404);
    error.lyrics = '';
    throw error;
  }
}
