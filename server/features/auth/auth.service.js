import crypto from 'node:crypto';

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const nextHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(nextHash, 'hex'));
}

function verificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export class AuthService {
  constructor({ pool, getSessionUser, publicUser, repairText, sendVerificationEmail, emailEnabled }) {
    this.pool = pool;
    this.getSessionUser = getSessionUser;
    this.publicUser = publicUser;
    this.repairText = repairText;
    this.sendVerificationEmail = sendVerificationEmail;
    this.emailEnabled = Boolean(emailEnabled);
  }

  async createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    await this.pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [userId, token]
    );
    return token;
  }

  async me(req) {
    const user = await this.getSessionUser(req);
    if (!user) throw createError('Not authenticated', 401);
    if (user.blocked_at) throw createError('Account is blocked', 403);
    return this.publicUser(user);
  }

  async register(req) {
    const email = this.repairText(String(req.body.email || '').trim().toLowerCase());
    const nickname = this.repairText(String(req.body.nickname || '').trim().replace(/^@/, ''));
    const password = String(req.body.password || '');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw createError('Valid email is required', 400);
    if (!nickname || nickname.length < 3) throw createError('Nickname must be at least 3 characters', 400);
    if (password.length < 6) throw createError('Password must be at least 6 characters', 400);

    try {
      const existing = await this.pool.query(
        `SELECT * FROM users WHERE lower(email) = $1 OR lower(nickname) = $2 LIMIT 1`,
        [email, nickname.toLowerCase()]
      );

      if (existing.rows[0]) {
        const user = existing.rows[0];
        const sameEmail = String(user.email || '').toLowerCase() === email;
        const sameNickname = String(user.nickname || '').toLowerCase() === nickname.toLowerCase();
        if (user.email_verified || user.is_verified || !sameEmail || !sameNickname) {
          throw createError('Email or nickname already exists', 409);
        }

        const code = verificationCode();
        const { rows } = await this.pool.query(
          `UPDATE users
           SET password_hash = $1, verification_token = $2, updated_at = now()
           WHERE id = $3
           RETURNING *`,
          [hashPassword(password), code, user.id]
        );
        this.sendVerificationEmail({ email, nickname, code }).catch(() => {});
        return {
          status: 200,
          body: {
            user: this.publicUser(rows[0]),
            verification_code: code,
            email_sent: this.emailEnabled,
            needs_verification: true,
          },
        };
      }

      const code = verificationCode();
      const { rows } = await this.pool.query(
        `INSERT INTO users (email, nickname, password_hash, verification_token)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [email, nickname, hashPassword(password), code]
      );
      this.sendVerificationEmail({ email, nickname, code }).catch(() => {});
      return {
        status: 201,
        body: {
          user: this.publicUser(rows[0]),
          verification_code: code,
          email_sent: this.emailEnabled,
          needs_verification: true,
        },
      };
    } catch (error) {
      if (error.code === '23505') throw createError('Email or nickname already exists', 409);
      throw error;
    }
  }

  async verifyEmail(req) {
    const token = String(req.query.token || '');
    if (!token) throw createError('Token is required', 400);
    const { rows } = await this.pool.query(
      `UPDATE users SET email_verified = true, is_verified = true, verification_token = null WHERE verification_token = $1 RETURNING *`,
      [token]
    );
    if (!rows[0]) throw createError('Verification token not found', 404);
    return { ok: true, user: this.publicUser(rows[0]) };
  }

  async verifyCode(req) {
    const email = this.repairText(String(req.body.email || '').trim().toLowerCase());
    const code = String(req.body.code || '').trim();
    if (!email || !code) throw createError('Email and code are required', 400);
    const { rows } = await this.pool.query(
      `UPDATE users
       SET email_verified = true, is_verified = true, verification_token = null
       WHERE lower(email) = $1 AND verification_token = $2
       RETURNING *`,
      [email, code]
    );
    if (!rows[0]) throw createError('Invalid verification code', 400);
    const token = await this.createSession(rows[0].id);
    return { token, user: this.publicUser(rows[0]) };
  }

  async login(req) {
    const login = this.repairText(String(req.body.login || req.body.email || '').trim().toLowerCase());
    const password = String(req.body.password || '');
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE lower(email) = $1 OR lower(nickname) = $1 LIMIT 1`,
      [login]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) throw createError('Invalid login or password', 401);
    if (!user.email_verified) {
      const code = verificationCode();
      await this.pool.query(
        `UPDATE users SET verification_token = $1, updated_at = now() WHERE id = $2`,
        [code, user.id]
      );
      this.sendVerificationEmail({ email: user.email, nickname: user.nickname, code }).catch(() => {});
      const error = createError('????? ?? ?? ????????????. ????? ??? ?????????????.', 403);
      error.needs_verification = true;
      error.verification_code = code;
      error.email = user.email;
      error.nickname = user.nickname;
      throw error;
    }
    if (user.blocked_at) throw createError('Account is blocked', 403);
    const token = await this.createSession(user.id);
    return { token, user: this.publicUser(user) };
  }

  async logout(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (token) await this.pool.query('DELETE FROM user_sessions WHERE token = $1', [token]);
    return { ok: true };
  }
}
