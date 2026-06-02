import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { PlaylistController } from './playlist.controller.js';
import { PlaylistService } from './playlist.service.js';

export function createPlaylistRouter(dependencies) {
  const router = express.Router();
  const controller = new PlaylistController(new PlaylistService(dependencies));

  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.delete));

  return router;
}
