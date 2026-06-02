export class ListenHistoryController {
  constructor(listenHistoryService) {
    this.listenHistoryService = listenHistoryService;
  }

  list = async (req, res) => {
    res.json(await this.listenHistoryService.list(req));
  };

  get = async (req, res) => {
    res.json(await this.listenHistoryService.get(req));
  };

  create = async (req, res) => {
    res.status(201).json(await this.listenHistoryService.create(req));
  };

  update = async (req, res) => {
    res.json(await this.listenHistoryService.update(req));
  };

  delete = async (req, res) => {
    res.json(await this.listenHistoryService.delete(req));
  };
}
