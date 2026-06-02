import { normalizePlaylistFilters, normalizePlaylistPayload } from '../../domain/services/playlistRules.js';
import { buildFilterWhere, createNotFound, insertRow, updateRow } from '../shared/sql.js';

export class PlaylistService {
  constructor({ pool, requireSessionUser, requireVerifiedUser, broadcast, rowToClient }) {
    this.pool = pool;
    this.requireSessionUser = requireSessionUser;
    this.requireVerifiedUser = requireVerifiedUser;
    this.broadcast = broadcast;
    this.rowToClient = rowToClient;
  }

  async getVerifiedUser(req) {
    const user = await this.requireSessionUser(req);
    this.requireVerifiedUser(user);
    return user;
  }

  async list(req) {
    const user = await this.getVerifiedUser(req);
    const params = [user.id];
    const where = ['user_id = $1', ...buildFilterWhere(normalizePlaylistFilters(req.query), params)];
    const { rows } = await this.pool.query(
      `SELECT * FROM playlists WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return rows.map(this.rowToClient);
  }

  async get(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      'SELECT * FROM playlists WHERE id = $1 AND user_id = $2 LIMIT 1',
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createNotFound('Playlist not found');
    return this.rowToClient(rows[0]);
  }

  async create(req) {
    const user = await this.getVerifiedUser(req);
    const payload = { ...normalizePlaylistPayload(req.body), user_id: user.id };
    const row = this.rowToClient(await insertRow(this.pool, 'playlists', payload));
    this.broadcast({ table: 'playlists', event: 'INSERT', new: row });
    return row;
  }

  async update(req) {
    const user = await this.getVerifiedUser(req);
    const payload = normalizePlaylistPayload(req.body, { partial: true });
    if (!Object.keys(payload).length) return this.get(req);
    const row = await updateRow(
      this.pool,
      'playlists',
      req.params.id,
      payload,
      (index) => `user_id = $${index}`,
      [user.id]
    );
    if (!row) throw createNotFound('Playlist not found');
    const clientRow = this.rowToClient(row);
    this.broadcast({ table: 'playlists', event: 'UPDATE', new: clientRow });
    return clientRow;
  }

  async delete(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createNotFound('Playlist not found');
    this.broadcast({ table: 'playlists', event: 'DELETE', old: this.rowToClient(rows[0]) });
    return { id: req.params.id };
  }
}
