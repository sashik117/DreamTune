import { normalizeProfilePatch, normalizeUserSearchQuery } from '../../domain/services/userProfileRules.js';

export class UserService {
  constructor({ pool, requireSessionUser, requireVerifiedUser, publicUser, areFriends, broadcast, rowToClient, repairText }) {
    this.pool = pool;
    this.requireSessionUser = requireSessionUser;
    this.requireVerifiedUser = requireVerifiedUser;
    this.publicUser = publicUser;
    this.areFriends = areFriends;
    this.broadcast = broadcast;
    this.rowToClient = rowToClient;
    this.repairText = repairText;
  }

  async updateMe(req) {
    const user = await this.requireSessionUser(req);
    const patch = normalizeProfilePatch(req.body, { repairText: this.repairText });
    const keys = Object.keys(patch);
    if (!keys.length) return { user: this.publicUser(user) };
    const values = Object.values(patch);
    const setSql = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    let rows;
    try {
      const result = await this.pool.query(
        `UPDATE users SET ${setSql}, updated_at = now() WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, user.id]
      );
      rows = result.rows;
    } catch (error) {
      if (error.code === '23505') {
        const conflict = new Error('Nickname already exists');
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }
    const publicRow = this.publicUser(rows[0]);
    this.broadcast({ table: 'users', event: 'UPDATE', new: publicRow });
    return { user: publicRow };
  }

  async getProfile(req) {
    const currentUser = await this.requireSessionUser(req);
    const { rows } = await this.pool.query(
      `SELECT id, email, nickname, avatar_url, email_verified, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );
    const user = rows[0];
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }

    const playlists = await this.pool.query(
      `SELECT *
       FROM playlists
       WHERE user_id = $1 AND is_public = true
       ORDER BY created_at DESC`,
      [user.id]
    );
    const songIds = Array.from(new Set(playlists.rows.flatMap(row => row.song_ids || []).map(String)));
    const songs = songIds.length
      ? await this.pool.query(
        `SELECT id, title, artist, cover_url, cover_position, cover_scale, duration, created_at
         FROM songs
         WHERE user_id = $1 AND id = ANY($2::uuid[])`,
        [user.id, songIds]
      )
      : { rows: [] };
    const friend = await this.areFriends(currentUser.id, user.id);
    return {
      user: this.publicUser(user),
      relationship: user.id === currentUser.id ? 'self' : friend ? 'friend' : 'none',
      playlists: playlists.rows.map(this.rowToClient),
      songs: songs.rows.map(this.rowToClient),
    };
  }

  async search(req) {
    const user = await this.requireSessionUser(req);
    this.requireVerifiedUser(user);
    const q = normalizeUserSearchQuery(req.query.q, { repairText: this.repairText });
    if (q.length < 2) return [];
    const { rows } = await this.pool.query(
      `SELECT
         users.id,
         users.email,
         users.nickname,
         users.avatar_url,
         users.email_verified,
         users.created_at,
         EXISTS (
           SELECT 1 FROM friendships
           WHERE friendships.user_id = $2 AND friendships.friend_id = users.id
         ) AS is_friend,
         EXISTS (
           SELECT 1 FROM friend_requests
           WHERE friend_requests.sender_id = $2 AND friend_requests.receiver_id = users.id AND friend_requests.status = 'pending'
         ) AS request_sent
       FROM users
       WHERE users.id <> $2 AND users.nickname ILIKE $1
       ORDER BY nickname ASC
       LIMIT 20`,
      [`%${q}%`, user.id]
    );
    return rows.map(row => ({
      ...this.publicUser(row),
      relationship: row.is_friend ? 'friend' : row.request_sent ? 'pending' : 'none',
    }));
  }
}
