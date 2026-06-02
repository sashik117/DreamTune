import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

export function createAdminRouter(dependencies) {
  const router = express.Router();
  const controller = new AdminController(new AdminService(dependencies));

  router.get('/overview', asyncHandler(controller.overview));
  router.get('/users', asyncHandler(controller.listUsers));
  router.patch('/users/:id', asyncHandler(controller.updateUser));
  router.delete('/users/:id', asyncHandler(controller.deleteUser));
  router.get('/collab-playlists', asyncHandler(controller.listCollabPlaylists));
  router.delete('/collab-playlists/:id', asyncHandler(controller.deleteCollabPlaylist));

  return router;
}
