import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { MediaController } from './media.controller.js';
import { MediaService as PublicMockMediaService } from './media.service.js';
import { createMediaAuthGuard, createMediaRateLimit } from './media.security.js';

async function resolveMediaService() {
  if (process.env.MEDIA_INTEGRATION_MODE !== 'real') {
    return PublicMockMediaService;
  }

  try {
    const privateModule = await import('../../private/media.real.service.js');
    return privateModule.MediaService || privateModule.default || PublicMockMediaService;
  } catch (error) {
    console.warn('Private media service is unavailable, using public mock service:', error.message || error);
    return PublicMockMediaService;
  }
}

export async function createMediaRouter(dependencies) {
  const router = express.Router();
  const MediaService = await resolveMediaService();
  const controller = new MediaController(new MediaService(dependencies));
  const requireMediaUser = createMediaAuthGuard({ requireSessionUser: dependencies.requireSessionUser });
  const searchLimit = createMediaRateLimit({ name: 'media-search', limit: 80, windowMs: 60_000 });
  const downloadLimit = createMediaRateLimit({ name: 'media-download', limit: 12, windowMs: 60_000 });
  const chartLimit = createMediaRateLimit({ name: 'media-chart', limit: 40, windowMs: 60_000 });

  router.get('/api/youtube/search', requireMediaUser, searchLimit, asyncHandler(controller.searchYouTube));
  router.post('/api/youtube/download', requireMediaUser, downloadLimit, asyncHandler(controller.downloadYouTube));
  router.get('/api/spotify/playlist', requireMediaUser, searchLimit, asyncHandler(controller.spotifyPlaylist));
  router.get('/api/spotify/search', requireMediaUser, searchLimit, asyncHandler(controller.spotifySearch));
  router.get('/api/spotify/cover', requireMediaUser, searchLimit, asyncHandler(controller.spotifyCover));
  router.get('/api/charts/global', requireMediaUser, chartLimit, asyncHandler(controller.globalChart));
  router.get('/api/charts/spotify', requireMediaUser, chartLimit, asyncHandler(controller.spotifyChart));
  router.get('/api/lyrics', requireMediaUser, searchLimit, asyncHandler(controller.lyrics));

  return router;
}
