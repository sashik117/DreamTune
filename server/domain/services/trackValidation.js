import { normalizeEntityPayload, pickEntityFilters } from './entityPayload.js';

export const TRACK_COLUMNS = [
  'title',
  'artist',
  'cover_url',
  'cover_position',
  'cover_scale',
  'file_url',
  'duration',
  'is_favorite',
  'lyrics',
  'trim_start',
  'trim_end',
];

export const LISTEN_HISTORY_COLUMNS = [
  'song_id',
  'song_title',
  'song_artist',
  'listened_at',
  'mood',
];

export function normalizeTrackPayload(payload, { partial = false } = {}) {
  return normalizeEntityPayload({
    payload,
    columns: TRACK_COLUMNS,
    required: ['title', 'file_url'],
    partial,
  });
}

export function normalizeTrackFilters(query) {
  return pickEntityFilters(query, TRACK_COLUMNS);
}

export function normalizeListenHistoryPayload(payload, { partial = false } = {}) {
  return normalizeEntityPayload({
    payload,
    columns: LISTEN_HISTORY_COLUMNS,
    required: ['song_id'],
    partial,
  });
}

export function normalizeListenHistoryFilters(query) {
  return pickEntityFilters(query, LISTEN_HISTORY_COLUMNS);
}
