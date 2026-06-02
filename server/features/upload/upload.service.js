import path from 'node:path';

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export class UploadService {
  constructor({ fs, uploadRoot, publicBaseUrl, cloudinaryEnabled, uploadToCloudinary, removeTempFile }) {
    this.fs = fs;
    this.uploadRoot = uploadRoot;
    this.publicBaseUrl = publicBaseUrl;
    this.cloudinaryEnabled = Boolean(cloudinaryEnabled);
    this.uploadToCloudinary = uploadToCloudinary;
    this.removeTempFile = removeTempFile;
  }

  async uploadFile(req) {
    try {
      if (!req.file) throw createError('File is required', 400);
      const bucket = String(req.body.bucket || 'songs').replace(/[^a-z0-9_-]/gi, '_');

      if (this.cloudinaryEnabled) {
        const publicUrl = await this.uploadToCloudinary(req.file.path, bucket, req.file.originalname);
        await this.removeTempFile(req.file.path);
        return { publicUrl };
      }

      const targetDir = path.join(this.uploadRoot, bucket);
      await this.fs.mkdir(targetDir, { recursive: true });

      const ext = path.extname(req.file.originalname || '') || '';
      const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
      const targetPath = path.join(targetDir, name);
      await this.fs.rename(req.file.path, targetPath);

      return { publicUrl: `${this.publicBaseUrl}/uploads/${bucket}/${name}` };
    } catch (error) {
      await this.removeTempFile(req.file?.path);
      throw error;
    }
  }
}
