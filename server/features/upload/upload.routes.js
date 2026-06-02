import express from 'express';
import { asyncHandler } from '../shared/controller.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

export function createUploadRouter(dependencies) {
  const router = express.Router();
  const controller = new UploadController(new UploadService(dependencies));

  router.post('/api/upload', dependencies.upload.single('file'), asyncHandler(controller.uploadFile));

  return router;
}
