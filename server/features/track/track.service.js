import { normalizeTrackFilters, normalizeTrackPayload } from '../../domain/services/trackValidation.js';
import { buildFilterWhere, createNotFound, insertRow, updateRow } from '../shared/sql.js';

export class TrackService {
  constructor({ pool, requireSessionUser, requireVerifiedUser, broadcast, rowToClient }) {
    this.pool = pool;
    this.requireSessionUser = requireSessionUser;
    this.requireVerifiedUser = requireVerifiedUser;
    this.broadcast = broadcast;
    this.rowToClient = rowToClient;
  }

  async getVerifiedUser(req) {
    return this.requireSessionUser(req);
  }

  async list(req) {
    const user = await this.getVerifiedUser(req);
    const params = [user.id];
    const where = ['user_id = $1', ...buildFilterWhere(normalizeTrackFilters(req.query), params)];
    const { rows } = await this.pool.query(
      `SELECT * FROM songs WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return rows.map(this.rowToClient);
  }

  async get(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      'SELECT * FROM songs WHERE id = $1 AND user_id = $2 LIMIT 1',
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createNotFound();
    return this.rowToClient(rows[0]);
  }

  async create(req) {
    const user = await this.getVerifiedUser(req);
    const payload = { ...normalizeTrackPayload(req.body), user_id: user.id };
    const row = this.rowToClient(await insertRow(this.pool, 'songs', payload));
    this.broadcast({ table: 'songs', event: 'INSERT', new: row });
    return row;
  }

  async update(req) {
    const user = await this.getVerifiedUser(req);
    const payload = normalizeTrackPayload(req.body, { partial: true });
    if (!Object.keys(payload).length) return this.get(req);
    const row = await updateRow(
      this.pool,
      'songs',
      req.params.id,
      payload,
      (index) => `user_id = $${index}`,
      [user.id]
    );
    if (!row) throw createNotFound();
    const clientRow = this.rowToClient(row);
    this.broadcast({ table: 'songs', event: 'UPDATE', new: clientRow });
    return clientRow;
  }

  async delete(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      'DELETE FROM songs WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createNotFound();
    const old = this.rowToClient(rows[0]);
    this.broadcast({ table: 'songs', event: 'DELETE', old });

    const playlistUpdates = await this.pool.query(
      `UPDATE playlists
       SET song_ids = array_remove(song_ids, $1::uuid)
       WHERE $1::uuid = ANY(song_ids)
         AND user_id = $2
       RETURNING *`,
      [req.params.id, user.id]
    );
    for (const row of playlistUpdates.rows) {
      this.broadcast({ table: 'playlists', event: 'UPDATE', new: this.rowToClient(row) });
    }

    const collabUpdates = await this.pool.query(
      `UPDATE collab_playlists
       SET song_ids = array_remove(song_ids, $1::uuid), last_edited_at = now()
       WHERE $1::uuid = ANY(song_ids)
       RETURNING *`,
      [req.params.id]
    );
    for (const row of collabUpdates.rows) {
      this.broadcast({ table: 'collab_playlists', event: 'UPDATE', new: this.rowToClient(row) });
    }

    return { id: req.params.id };
  }
}
