export function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function normalizeEntityPayload({ payload = {}, columns = [], required = [], arrayColumns = [], partial = false }) {
  const arraySet = new Set(arrayColumns);
  for (const key of required) {
    if (!partial && (payload[key] === undefined || payload[key] === null || payload[key] === '')) {
      throw createHttpError(`${key} is required`, 400);
    }
  }

  const cleaned = {};
  for (const key of columns) {
    if (payload[key] === undefined) continue;
    cleaned[key] = arraySet.has(key) ? (Array.isArray(payload[key]) ? payload[key] : []) : payload[key];
  }
  return cleaned;
}

export function pickEntityFilters(query = {}, columns = []) {
  const allowed = new Set([...columns, 'id']);
  return Object.entries(query).filter(([key, value]) => allowed.has(key) && value !== undefined && value !== null && value !== '');
}
