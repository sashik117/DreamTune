const DEMO_COVER =
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80';

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function demoTrack(index, query = 'DreamTune') {
  const title = normalizeQuery(query) || 'DreamTune Track';
  const artist = ['Luna Vale', 'Nova Echo', 'Mira Sound', 'Skyline FM'][index % 4];
  return {
    id: `demo-track-${index + 1}`,
    title: index === 0 ? title : `${title} ${index + 1}`,
    artist,
    duration: 178 + index * 19,
    cover_url: `${DEMO_COVER}&sig=${index + 1}`,
    source_url: '',
    preview_url: '',
    youtube_query: `${artist} ${title}`,
  };
}

function demoVideo(index, query = 'DreamTune') {
  const track = demoTrack(index, query);
  return {
    title: `${track.title} - ${track.artist}`,
    artist: track.artist,
    uploader: 'DreamTune Demo',
    video_id: `demo_video_${index + 1}`,
    thumbnail: track.cover_url,
    duration: track.duration,
    url: '',
  };
}

export class MediaService {
  constructor() {
    this.mode = 'mock';
  }

  async searchYouTube(req) {
    const query = normalizeQuery(req.query.q);
    if (!query) throw createError('Search query is required', 400);

    return {
      mode: this.mode,
      results: Array.from({ length: 6 }, (_, index) => demoVideo(index, query)),
    };
  }

  async downloadYouTube() {
    throw createError('Media download is disabled in the public demo build.', 403);
  }

  async spotifyPlaylist(req) {
    const url = normalizeQuery(req.query.url);
    if (!url) throw createError('Spotify playlist URL is required', 400);

    return {
      mode: this.mode,
      playlist: {
        name: 'DreamTune Demo Playlist',
        source_url: '',
        tracks: Array.from({ length: 12 }, (_, index) => demoTrack(index, 'Demo playlist track')),
      },
      tracks: Array.from({ length: 12 }, (_, index) => demoTrack(index, 'Demo playlist track')),
    };
  }

  async spotifySearch(req) {
    const query = normalizeQuery(req.query.q);
    if (!query) throw createError('Spotify search query is required', 400);
    const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 25);

    return {
      mode: this.mode,
      tracks: Array.from({ length: limit }, (_, index) => demoTrack(index, query)),
    };
  }

  async spotifyCover() {
    return {
      mode: this.mode,
      cover_url: `${DEMO_COVER}&sig=cover`,
    };
  }

  async globalChart() {
    return {
      mode: this.mode,
      tracks: Array.from({ length: 10 }, (_, index) => demoTrack(index, 'Global chart')),
    };
  }

  async spotifyChart(req) {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    return {
      mode: this.mode,
      tracks: Array.from({ length: limit }, (_, index) => demoTrack(index, 'Spotify chart')),
    };
  }

  async lyrics(req) {
    const title = normalizeQuery(req.query.title) || 'DreamTune';
    const artist = normalizeQuery(req.query.artist) || 'Demo Artist';
    return {
      mode: this.mode,
      title,
      artist,
      lyrics: [
        `${title} by ${artist}`,
        '',
        'Lyrics are hidden in the public portfolio build.',
        'Connect the private media module on your own server to enable real integrations.',
      ].join('\n'),
    };
  }
}
