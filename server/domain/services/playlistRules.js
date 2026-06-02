import { normalizeEntityPayload, pickEntityFilters } from './entityPayload.js';

export const PLAYLIST_COLUMNS = [
  'name',
  'song_ids',
  'cover_url',
  'cover_position',
  'cover_scale',
  'is_public',
];

export const COLLAB_PLAYLIST_COLUMNS = [
  'name',
  'song_ids',
  'cover_url',
  'cover_position',
  'cover_scale',
  'access_level',
  'owner_id',
  'owner_email',
  'collaborator_ids',
  'collaborator_emails',
  'last_edited_by',
  'last_edited_at',
];

export function normalizeSongIds(songIds) {
  return Array.from(new Set((Array.isArray(songIds) ? songIds : []).filter(Boolean).map(String)));
}

export function mergeSongIds(currentSongIds = [], incomingSongIds = []) {
  return normalizeSongIds([...currentSongIds, ...incomingSongIds]);
}

export function normalizePlaylistPayload(payload, { partial = false } = {}) {
  const cleaned = normalizeEntityPayload({
    payload,
    columns: PLAYLIST_COLUMNS,
    required: ['name'],
    arrayColumns: ['song_ids'],
    partial,
  });
  if (cleaned.song_ids !== undefined) cleaned.song_ids = normalizeSongIds(cleaned.song_ids);
  return cleaned;
}

export function normalizePlaylistFilters(query) {
  return pickEntityFilters(query, PLAYLIST_COLUMNS);
}

export function normalizeCollabPlaylistPayload(payload, { partial = false } = {}) {
  const cleaned = normalizeEntityPayload({
    payload,
    columns: COLLAB_PLAYLIST_COLUMNS,
    required: ['name'],
    arrayColumns: ['song_ids', 'collaborator_ids', 'collaborator_emails'],
    partial,
  });
  if (cleaned.song_ids !== undefined) cleaned.song_ids = normalizeSongIds(cleaned.song_ids);
  return cleaned;
}

export function normalizeCollabPlaylistFilters(query) {
  return pickEntityFilters(query, COLLAB_PLAYLIST_COLUMNS);
}
