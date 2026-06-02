export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  me = async (req, res) => {
    res.json(await this.authService.me(req));
  };

  register = async (req, res) => {
    const result = await this.authService.register(req);
    res.status(result.status).json(result.body);
  };

  verifyEmail = async (req, res) => {
    res.json(await this.authService.verifyEmail(req));
  };

  verifyCode = async (req, res) => {
    res.json(await this.authService.verifyCode(req));
  };

  login = async (req, res) => {
    try {
      res.json(await this.authService.login(req));
    } catch (error) {
      if (error.needs_verification) {
        return res.status(error.status || 403).json({
          error: error.message,
          needs_verification: true,
          verification_code: error.verification_code,
          email: error.email,
          nickname: error.nickname,
        });
      }
      throw error;
    }
  };

  logout = async (req, res) => {
    res.json(await this.authService.logout(req));
  };
}
