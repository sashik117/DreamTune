export class PlaylistController {
  constructor(playlistService) {
    this.playlistService = playlistService;
  }

  list = async (req, res) => {
    res.json(await this.playlistService.list(req));
  };

  get = async (req, res) => {
    res.json(await this.playlistService.get(req));
  };

  create = async (req, res) => {
    res.status(201).json(await this.playlistService.create(req));
  };

  update = async (req, res) => {
    res.json(await this.playlistService.update(req));
  };

  delete = async (req, res) => {
    res.json(await this.playlistService.delete(req));
  };
}
