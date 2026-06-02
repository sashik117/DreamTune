export class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  updateMe = async (req, res) => {
    res.json(await this.userService.updateMe(req));
  };

  getProfile = async (req, res) => {
    res.json(await this.userService.getProfile(req));
  };

  search = async (req, res) => {
    res.json(await this.userService.search(req));
  };
}
