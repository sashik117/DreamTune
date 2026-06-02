import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

export function createAuthRouter(dependencies) {
  const router = express.Router();
  const controller = new AuthController(new AuthService(dependencies));

  router.get('/me', asyncHandler(controller.me));
  router.post('/register', asyncHandler(controller.register));
  router.get('/verify-email', asyncHandler(controller.verifyEmail));
  router.post('/verify-code', asyncHandler(controller.verifyCode));
  router.post('/login', asyncHandler(controller.login));
  router.post('/logout', asyncHandler(controller.logout));

  return router;
}
