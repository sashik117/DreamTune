export class CollabPlaylistController {
  constructor(collabPlaylistService) {
    this.collabPlaylistService = collabPlaylistService;
  }

  list = async (req, res) => {
    res.json(await this.collabPlaylistService.list(req));
  };

  get = async (req, res) => {
    res.json(await this.collabPlaylistService.get(req));
  };

  create = async (req, res) => {
    res.status(201).json(await this.collabPlaylistService.create(req));
  };

  update = async (req, res) => {
    res.json(await this.collabPlaylistService.update(req));
  };

  delete = async (req, res) => {
    res.json(await this.collabPlaylistService.delete(req));
  };
}
