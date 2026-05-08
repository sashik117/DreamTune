CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  nickname text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url text DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'user',
  blocked_at timestamptz,
  verification_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
UPDATE users SET is_verified = email_verified WHERE is_verified IS DISTINCT FROM email_verified;
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  artist text DEFAULT '',
  cover_url text DEFAULT '',
  cover_position text DEFAULT '50% 50%',
  cover_scale double precision NOT NULL DEFAULT 1,
  file_url text NOT NULL,
  duration double precision,
  trim_start double precision,
  trim_end double precision,
  is_favorite boolean NOT NULL DEFAULT false,
  lyrics text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE songs ADD COLUMN IF NOT EXISTS trim_start double precision;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS trim_end double precision;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_position text DEFAULT '50% 50%';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_scale double precision NOT NULL DEFAULT 1;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS songs_user_id_created_at_idx ON songs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  song_ids uuid[] NOT NULL DEFAULT '{}',
  cover_url text DEFAULT '',
  cover_position text DEFAULT '50% 50%',
  cover_scale double precision NOT NULL DEFAULT 1,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE playlists ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS cover_position text DEFAULT '50% 50%';
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS cover_scale double precision NOT NULL DEFAULT 1;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS playlists_user_id_created_at_idx ON playlists(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS listen_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  song_id uuid,
  song_title text DEFAULT '',
  song_artist text DEFAULT '',
  listened_at bigint,
  mood text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listen_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS listen_history_user_id_created_at_idx ON listen_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS collab_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  song_ids uuid[] NOT NULL DEFAULT '{}',
  cover_url text DEFAULT '',
  cover_position text DEFAULT '50% 50%',
  cover_scale double precision NOT NULL DEFAULT 1,
  access_level text NOT NULL DEFAULT 'collaborative',
  owner_email text DEFAULT '',
  collaborator_ids uuid[] NOT NULL DEFAULT '{}',
  collaborator_emails text[] NOT NULL DEFAULT '{}',
  last_edited_by text,
  last_edited_at bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE collab_playlists ADD COLUMN IF NOT EXISTS cover_position text DEFAULT '50% 50%';
ALTER TABLE collab_playlists ADD COLUMN IF NOT EXISTS cover_scale double precision NOT NULL DEFAULT 1;
ALTER TABLE collab_playlists ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE collab_playlists ADD COLUMN IF NOT EXISTS collaborator_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE collab_playlists ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'collaborative';
UPDATE collab_playlists
SET owner_id = users.id
FROM users
WHERE collab_playlists.owner_id IS NULL
  AND lower(collab_playlists.owner_email) = lower(users.email);
CREATE INDEX IF NOT EXISTS collab_playlists_owner_id_created_at_idx ON collab_playlists(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_playlists_collaborator_ids_gin_idx ON collab_playlists USING gin(collaborator_ids);

CREATE TABLE IF NOT EXISTS collab_playlist_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES collab_playlists(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, receiver_id)
);
CREATE INDEX IF NOT EXISTS collab_playlist_invites_receiver_status_idx ON collab_playlist_invites(receiver_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS song_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  message text DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS song_shares_receiver_id_created_at_idx ON song_shares(receiver_id, created_at DESC);

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS songs_touch_updated_at ON songs;
CREATE TRIGGER songs_touch_updated_at
BEFORE UPDATE ON songs
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS users_touch_updated_at ON users;
CREATE TRIGGER users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS playlists_touch_updated_at ON playlists;
CREATE TRIGGER playlists_touch_updated_at
BEFORE UPDATE ON playlists
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS listen_history_touch_updated_at ON listen_history;
CREATE TRIGGER listen_history_touch_updated_at
BEFORE UPDATE ON listen_history
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS collab_playlists_touch_updated_at ON collab_playlists;
CREATE TRIGGER collab_playlists_touch_updated_at
BEFORE UPDATE ON collab_playlists
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS friend_requests_touch_updated_at ON friend_requests;
CREATE TRIGGER friend_requests_touch_updated_at
BEFORE UPDATE ON friend_requests
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS collab_playlist_invites_touch_updated_at ON collab_playlist_invites;
CREATE TRIGGER collab_playlist_invites_touch_updated_at
BEFORE UPDATE ON collab_playlist_invites
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
