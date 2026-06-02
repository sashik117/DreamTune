export class UploadController {
  constructor(uploadService) {
    this.uploadService = uploadService;
  }

  uploadFile = async (req, res) => {
    res.json(await this.uploadService.uploadFile(req));
  };
}
