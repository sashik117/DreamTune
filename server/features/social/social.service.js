function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export class SocialService {
  constructor({ pool, requireSessionUser, requireVerifiedUser, assertCollabAccess, areFriends, publicUser, broadcast, rowToClient, repairText }) {
    this.pool = pool;
    this.requireSessionUser = requireSessionUser;
    this.requireVerifiedUser = requireVerifiedUser;
    this.assertCollabAccess = assertCollabAccess;
    this.areFriends = areFriends;
    this.publicUser = publicUser;
    this.broadcast = broadcast;
    this.rowToClient = rowToClient;
    this.repairText = repairText;
  }

  async getVerifiedUser(req) {
    const user = await this.requireSessionUser(req);
    this.requireVerifiedUser(user);
    return user;
  }

  async listFriends(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `SELECT users.id, users.email, users.nickname, users.avatar_url, users.email_verified, users.created_at
       FROM friendships
       JOIN users ON users.id = friendships.friend_id
       WHERE friendships.user_id = $1
       ORDER BY users.nickname ASC`,
      [user.id]
    );
    return rows.map(this.publicUser);
  }

  async listRequests(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `SELECT friend_requests.*, users.nickname AS sender_nickname, users.email AS sender_email, users.avatar_url AS sender_avatar_url
       FROM friend_requests
       JOIN users ON users.id = friend_requests.sender_id
       WHERE friend_requests.receiver_id = $1 AND friend_requests.status = 'pending'
       ORDER BY friend_requests.created_at DESC`,
      [user.id]
    );
    const collabInvites = await this.pool.query(
      `SELECT
         collab_playlist_invites.*,
         users.nickname AS sender_nickname,
         users.email AS sender_email,
         users.avatar_url AS sender_avatar_url,
         collab_playlists.name AS playlist_name
       FROM collab_playlist_invites
       JOIN users ON users.id = collab_playlist_invites.sender_id
       JOIN collab_playlists ON collab_playlists.id = collab_playlist_invites.playlist_id
       WHERE collab_playlist_invites.receiver_id = $1
         AND collab_playlist_invites.status = 'pending'
       ORDER BY collab_playlist_invites.created_at DESC`,
      [user.id]
    );
    await this.pool.query(
      `UPDATE friend_requests
       SET seen_at = COALESCE(seen_at, now())
       WHERE receiver_id = $1 AND status = 'pending'`,
      [user.id]
    );
    await this.pool.query(
      `UPDATE collab_playlist_invites
       SET seen_at = COALESCE(seen_at, now())
       WHERE receiver_id = $1 AND status = 'pending'`,
      [user.id]
    );
    return [
      ...rows.map(row => ({ ...row, request_type: 'friend' })),
      ...collabInvites.rows.map(row => ({ ...row, request_type: 'collab_playlist' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async countRequests(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `SELECT
         (
           SELECT count(*)::int
           FROM friend_requests
           WHERE receiver_id = $1 AND status = 'pending' AND seen_at IS NULL
         )
         +
         (
           SELECT count(*)::int
           FROM collab_playlist_invites
           WHERE receiver_id = $1 AND status = 'pending' AND seen_at IS NULL
         ) AS count`,
      [user.id]
    );
    return { count: rows[0]?.count || 0 };
  }

  async requestFriend(req) {
    const user = await this.getVerifiedUser(req);
    const nickname = this.repairText(String(req.body.nickname || '').trim().replace(/^@/, ''));
    const friendId = String(req.body.friend_id || '').trim();
    const { rows } = friendId
      ? await this.pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [friendId])
      : await this.pool.query('SELECT * FROM users WHERE lower(nickname) = lower($1) LIMIT 1', [nickname]);
    const receiver = rows[0];
    if (!receiver) throw createError('User not found', 404);
    if (String(receiver.id) === String(user.id)) throw createError('You cannot add yourself', 400);
    if (await this.areFriends(user.id, receiver.id)) return { ok: true, already_friends: true, user: this.publicUser(receiver) };

    const existingReverse = await this.pool.query(
      `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'
       LIMIT 1`,
      [receiver.id, user.id]
    );
    if (existingReverse.rows[0]) {
      await this.pool.query(
        `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
         ON CONFLICT DO NOTHING`,
        [user.id, receiver.id]
      );
      const accepted = await this.pool.query('UPDATE friend_requests SET status = $1 WHERE id = $2 RETURNING *', ['accepted', existingReverse.rows[0].id]);
      if (accepted.rows[0]) this.broadcast({ table: 'friend_requests', event: 'UPDATE', new: this.rowToClient(accepted.rows[0]) });
      return { ok: true, accepted: true, user: this.publicUser(receiver) };
    }

    const request = await this.pool.query(
      `INSERT INTO friend_requests (sender_id, receiver_id)
       VALUES ($1, $2)
       ON CONFLICT (sender_id, receiver_id) DO UPDATE SET status = 'pending', updated_at = now()
       RETURNING *`,
      [user.id, receiver.id]
    );
    this.broadcast({ table: 'friend_requests', event: 'INSERT', new: this.rowToClient(request.rows[0]) });
    return { status: 201, body: request.rows[0] };
  }

  async acceptFriendRequest(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `UPDATE friend_requests
       SET status = 'accepted'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const request = rows[0];
    if (!request) throw createError('Friend request not found', 404);
    await this.pool.query(
      `INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1)
       ON CONFLICT DO NOTHING`,
      [request.sender_id, request.receiver_id]
    );
    this.broadcast({ table: 'friend_requests', event: 'UPDATE', new: this.rowToClient(request) });
    return { ok: true };
  }

  async declineFriendRequest(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `UPDATE friend_requests
       SET status = 'declined'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const request = rows[0];
    if (!request) throw createError('Friend request not found', 404);
    this.broadcast({ table: 'friend_requests', event: 'UPDATE', new: this.rowToClient(request) });
    return { ok: true };
  }

  async inviteToCollabPlaylist(req) {
    const user = await this.getVerifiedUser(req);
    const playlist = await this.assertCollabAccess(req.params.id, user, 'view');
    if (!playlist) throw createError('Playlist not found', 404);
    if (String(playlist.owner_id) !== String(user.id)) throw createError('Only owner can invite collaborators', 403);

    const receiverId = String(req.body.receiver_id || '').trim();
    if (!receiverId) throw createError('receiver_id is required', 400);
    if (receiverId === String(user.id)) throw createError('You cannot invite yourself', 400);
    if (!await this.areFriends(user.id, receiverId)) throw createError('Only friends can be invited', 403);
    if ((playlist.collaborator_ids || []).map(String).includes(receiverId)) {
      return { ok: true, already_collaborator: true };
    }

    const { rows } = await this.pool.query(
      `INSERT INTO collab_playlist_invites (playlist_id, sender_id, receiver_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, receiver_id)
       DO UPDATE SET status = 'pending', sender_id = EXCLUDED.sender_id, seen_at = null, updated_at = now()
       RETURNING *`,
      [playlist.id, user.id, receiverId]
    );
    this.broadcast({ table: 'collab_playlist_invites', event: 'INSERT', new: this.rowToClient(rows[0]) });
    return { status: 201, body: rows[0] };
  }

  async acceptCollabInvite(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `UPDATE collab_playlist_invites
       SET status = 'accepted'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    const invite = rows[0];
    if (!invite) throw createError('Invite not found', 404);
    this.broadcast({ table: 'collab_playlist_invites', event: 'UPDATE', new: this.rowToClient(invite) });

    const updated = await this.pool.query(
      `UPDATE collab_playlists
       SET collaborator_ids = CASE
             WHEN $2::uuid = ANY(collaborator_ids) THEN collaborator_ids
             ELSE array_append(collaborator_ids, $2::uuid)
           END,
           collaborator_emails = CASE
             WHEN users.email = ANY(collaborator_emails) THEN collaborator_emails
             ELSE array_append(collaborator_emails, users.email)
           END,
           last_edited_by = users.email,
           last_edited_at = $3
       FROM users
       WHERE collab_playlists.id = $1
         AND users.id = $2
       RETURNING collab_playlists.*`,
      [invite.playlist_id, user.id, Date.now()]
    );
    const playlist = this.rowToClient(updated.rows[0]);
    if (playlist) this.broadcast({ table: 'collab_playlists', event: 'UPDATE', new: playlist });
    return { ok: true, playlist };
  }

  async declineCollabInvite(req) {
    const user = await this.getVerifiedUser(req);
    const { rows } = await this.pool.query(
      `UPDATE collab_playlist_invites
       SET status = 'declined'
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, user.id]
    );
    if (!rows[0]) throw createError('Invite not found', 404);
    this.broadcast({ table: 'collab_playlist_invites', event: 'UPDATE', new: this.rowToClient(rows[0]) });
    return { ok: true };
  }

  async removeFriend(req) {
    const user = await this.getVerifiedUser(req);
    const friendId = String(req.params.id || '').trim();
    if (!friendId) throw createError('Friend id is required', 400);
    await this.pool.query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_id = $2)
          OR (user_id = $2 AND friend_id = $1)`,
      [user.id, friendId]
    );
    await this.pool.query(
      `DELETE FROM friend_requests
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)`,
      [user.id, friendId]
    );
    return { ok: true, id: friendId };
  }

  async shareSong(req) {
    const user = await this.getVerifiedUser(req);
    const songId = String(req.body.song_id || '').trim();
    const receiverId = String(req.body.receiver_id || '').trim();
    if (!songId || !receiverId) throw createError('song_id and receiver_id are required', 400);
    if (!await this.areFriends(user.id, receiverId)) throw createError('You can share only with friends', 403);
    const ownSong = await this.pool.query('SELECT * FROM songs WHERE id = $1 AND user_id = $2 LIMIT 1', [songId, user.id]);
    if (!ownSong.rows[0]) throw createError('Song not found', 404);
    const { rows } = await this.pool.query(
      `INSERT INTO song_shares (sender_id, receiver_id, song_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, receiverId, songId, this.repairText(String(req.body.message || ''))]
    );
    return rows[0];
  }

  async listCollabPlaylistSongs(req) {
    const user = await this.getVerifiedUser(req);
    const playlist = await this.assertCollabAccess(req.params.id, user, 'view');
    if (!playlist) throw createError('Playlist not found', 404);
    const ids = (playlist.song_ids || []).map(String);
    if (!ids.length) return [];
    const { rows } = await this.pool.query(
      `SELECT *
       FROM songs
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    const byId = new Map(rows.map(row => [String(row.id), this.rowToClient(row)]));
    return ids.map(id => byId.get(id)).filter(Boolean);
  }
}
