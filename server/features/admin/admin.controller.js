export class AdminController {
  constructor(adminService) {
    this.adminService = adminService;
  }

  overview = async (req, res) => {
    res.json(await this.adminService.overview(req));
  };

  listUsers = async (req, res) => {
    res.json(await this.adminService.listUsers(req));
  };

  updateUser = async (req, res) => {
    res.json(await this.adminService.updateUser(req));
  };

  deleteUser = async (req, res) => {
    res.json(await this.adminService.deleteUser(req));
  };

  listCollabPlaylists = async (req, res) => {
    res.json(await this.adminService.listCollabPlaylists(req));
  };

  deleteCollabPlaylist = async (req, res) => {
    res.json(await this.adminService.deleteCollabPlaylist(req));
  };
}
