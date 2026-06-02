import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { ListenHistoryController } from './listen-history.controller.js';
import { ListenHistoryService } from './listen-history.service.js';

export function createListenHistoryRouter(dependencies) {
  const router = express.Router();
  const controller = new ListenHistoryController(new ListenHistoryService(dependencies));

  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.delete));

  return router;
}
