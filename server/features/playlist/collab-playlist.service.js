import { normalizeCollabPlaylistFilters, normalizeCollabPlaylistPayload } from '../../domain/services/playlistRules.js';
import { buildFilterWhere, createNotFound, insertRow, updateRow } from '../shared/sql.js';

export class CollabPlaylistService {
  constructor({
    pool,
    requireSessionUser,
    requireVerifiedUser,
    assertCollabAccess,
    normalizeCollaborators,
    broadcast,
    rowToClient,
  }) {
    this.pool = pool;
    this.requireSessionUser = requireSessionUser;
    this.requireVerifiedUser = requireVerifiedUser;
    this.assertCollabAccess = assertCollabAccess;
    this.normalizeCollaborators = normalizeCollaborators;
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
    const where = [
      `(owner_id = $1 OR $1 = ANY(collaborator_ids) OR access_level = 'public')`,
      ...buildFilterWhere(normalizeCollabPlaylistFilters(req.query), params),
    ];
    const { rows } = await this.pool.query(
      `SELECT * FROM collab_playlists WHERE ${where.join(' AND ')} ORDER BY created_at DESC`,
      params
    );
    return rows.map(this.rowToClient);
  }

  async get(req) {
    const user = await this.getVerifiedUser(req);
    await this.assertCollabAccess(req.params.id, user, 'view');
    const { rows } = await this.pool.query('SELECT * FROM collab_playlists WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!rows[0]) throw createNotFound('Playlist not found');
    return this.rowToClient(rows[0]);
  }

  async create(req) {
    const user = await this.getVerifiedUser(req);
    const payload = {
      ...normalizeCollabPlaylistPayload(req.body),
      owner_id: user.id,
      owner_email: user.email,
      access_level: req.body?.access_level || 'collaborative',
      collaborator_ids: [],
      collaborator_emails: [],
    };
    const row = this.rowToClient(await insertRow(this.pool, 'collab_playlists', payload));
    this.broadcast({ table: 'collab_playlists', event: 'INSERT', new: row });
    return row;
  }

  async update(req) {
    const user = await this.getVerifiedUser(req);
    const existing = await this.assertCollabAccess(req.params.id, user, 'edit');
    if (!existing) throw createNotFound('Playlist not found');
    if (req.body?.collaborator_ids !== undefined || req.body?.access_level !== undefined) {
      if (String(existing.owner_id) !== String(user.id)) {
        const error = new Error('Only owner can manage collaborators');
        error.status = 403;
        throw error;
      }
    }

    const payload = normalizeCollabPlaylistPayload(req.body, { partial: true });
    delete payload.owner_id;
    delete payload.owner_email;

    if (payload.collaborator_ids !== undefined) {
      payload.collaborator_ids = await this.normalizeCollaborators(user, payload.collaborator_ids);
      const existingIds = new Set((existing.collaborator_ids || []).map(String));
      const addsCollaborator = payload.collaborator_ids.some(id => !existingIds.has(String(id)));
      if (addsCollaborator) {
        const error = new Error('Send an invite first. Collaborators are added only after they accept.');
        error.status = 400;
        throw error;
      }
      const emails = [];
      if (payload.collaborator_ids.length) {
        const { rows } = await this.pool.query('SELECT email FROM users WHERE id = ANY($1::uuid[])', [payload.collaborator_ids]);
        emails.push(...rows.map(row => row.email));
      }
      payload.collaborator_emails = emails;
    }

    if (!Object.keys(payload).length) return this.get(req);
    const row = await updateRow(this.pool, 'collab_playlists', req.params.id, payload);
    if (!row) throw createNotFound('Playlist not found');
    const clientRow = this.rowToClient(row);
    this.broadcast({ table: 'collab_playlists', event: 'UPDATE', new: clientRow });
    return clientRow;
  }

  async delete(req) {
    const user = await this.getVerifiedUser(req);
    await this.assertCollabAccess(req.params.id, user, 'delete');
    const { rows } = await this.pool.query(
      'DELETE FROM collab_playlists WHERE id = $1 AND owner_id = $2 RETURNING *',
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createNotFound('Playlist not found');
    this.broadcast({ table: 'collab_playlists', event: 'DELETE', old: this.rowToClient(rows[0]) });
    return { id: req.params.id };
  }
}
