import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

export function createUserRouter(dependencies) {
  const router = express.Router();
  const controller = new UserController(new UserService(dependencies));

  router.patch('/me', asyncHandler(controller.updateMe));
  router.get('/search', asyncHandler(controller.search));
  router.get('/:id/profile', asyncHandler(controller.getProfile));

  return router;
}
