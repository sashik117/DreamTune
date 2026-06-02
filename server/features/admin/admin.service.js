function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export class AdminService {
  constructor({ pool, requireAdmin, broadcast, rowToClient }) {
    this.pool = pool;
    this.requireAdmin = requireAdmin;
    this.broadcast = broadcast;
    this.rowToClient = rowToClient;
  }

  async overview(req) {
    await this.requireAdmin(req);
    const [users, tracks, activeToday, collabPlaylists] = await Promise.all([
      this.pool.query('SELECT count(*)::int AS count FROM users WHERE blocked_at IS NULL'),
      this.pool.query('SELECT count(*)::int AS count FROM songs'),
      this.pool.query(
        `SELECT count(DISTINCT user_id)::int AS count
         FROM listen_history
         WHERE created_at >= now() - interval '1 day'`
      ),
      this.pool.query('SELECT count(*)::int AS count FROM collab_playlists'),
    ]);
    return {
      users: users.rows[0]?.count || 0,
      tracks: tracks.rows[0]?.count || 0,
      active_today: activeToday.rows[0]?.count || 0,
      collab_playlists: collabPlaylists.rows[0]?.count || 0,
    };
  }

  async listUsers(req) {
    await this.requireAdmin(req);
    const { rows } = await this.pool.query(
      `SELECT id, email, nickname, avatar_url, email_verified, is_verified, role, blocked_at, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    return rows.map(this.rowToClient);
  }

  async updateUser(req) {
    const admin = await this.requireAdmin(req);
    const action = String(req.body.action || '');
    if (!['block', 'unblock', 'make_admin', 'make_user'].includes(action)) {
      throw createError('Unknown admin action', 400);
    }
    if (String(admin.id) === String(req.params.id) && (action === 'block' || action === 'make_user')) {
      throw createError('You cannot remove your own admin access', 400);
    }
    const patch = {
      block: 'blocked_at = now()',
      unblock: 'blocked_at = null',
      make_admin: "role = 'admin'",
      make_user: "role = 'user'",
    }[action];
    const { rows } = await this.pool.query(
      `UPDATE users SET ${patch} WHERE id = $1 RETURNING id, email, nickname, avatar_url, email_verified, is_verified, role, blocked_at, created_at, updated_at`,
      [req.params.id]
    );
    if (!rows[0]) throw createError('User not found', 404);
    const user = this.rowToClient(rows[0]);
    this.broadcast({ table: 'users', event: 'UPDATE', new: user });
    return user;
  }

  async deleteUser(req) {
    const admin = await this.requireAdmin(req);
    if (String(admin.id) === String(req.params.id)) throw createError('You cannot delete yourself', 400);
    const { rows } = await this.pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) throw createError('User not found', 404);
    this.broadcast({ table: 'users', event: 'DELETE', old: rows[0] });
    return { ok: true, id: rows[0].id };
  }

  async listCollabPlaylists(req) {
    await this.requireAdmin(req);
    const { rows } = await this.pool.query(
      `SELECT collab_playlists.*, users.nickname AS owner_nickname
       FROM collab_playlists
       LEFT JOIN users ON users.id = collab_playlists.owner_id
       ORDER BY collab_playlists.created_at DESC`
    );
    return rows.map(this.rowToClient);
  }

  async deleteCollabPlaylist(req) {
    await this.requireAdmin(req);
    const { rows } = await this.pool.query('DELETE FROM collab_playlists WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows[0]) throw createError('Playlist not found', 404);
    const playlist = this.rowToClient(rows[0]);
    this.broadcast({ table: 'collab_playlists', event: 'DELETE', old: playlist });
    return { ok: true, id: rows[0].id };
  }
}
