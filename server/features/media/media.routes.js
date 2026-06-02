import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';

export function createMediaRouter(dependencies) {
  const router = express.Router();
  const controller = new MediaController(new MediaService(dependencies));

  router.get('/api/youtube/search', asyncHandler(controller.searchYouTube));
  router.post('/api/youtube/download', asyncHandler(controller.downloadYouTube));
  router.get('/api/spotify/playlist', asyncHandler(controller.spotifyPlaylist));
  router.get('/api/spotify/search', asyncHandler(controller.spotifySearch));
  router.get('/api/spotify/cover', asyncHandler(controller.spotifyCover));
  router.get('/api/charts/global', asyncHandler(controller.globalChart));
  router.get('/api/charts/spotify', asyncHandler(controller.spotifyChart));
  router.get('/api/lyrics', asyncHandler(controller.lyrics));

  return router;
}
