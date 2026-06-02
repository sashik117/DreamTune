export class TrackController {
  constructor(trackService) {
    this.trackService = trackService;
  }

  list = async (req, res) => {
    res.json(await this.trackService.list(req));
  };

  get = async (req, res) => {
    res.json(await this.trackService.get(req));
  };

  create = async (req, res) => {
    res.status(201).json(await this.trackService.create(req));
  };

  update = async (req, res) => {
    res.json(await this.trackService.update(req));
  };

  delete = async (req, res) => {
    res.json(await this.trackService.delete(req));
  };
}
