const PENDING_HISTORY_KEY = 'dreamtune-pending-listen-history-v1';

export function readPendingHistory() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function writePendingHistory(rows) {
  try {
    if (rows?.length) localStorage.setItem(PENDING_HISTORY_KEY, JSON.stringify(rows.slice(-500)));
    else localStorage.removeItem(PENDING_HISTORY_KEY);
  } catch {}
}

export function appendPendingHistory(row) {
  writePendingHistory([...readPendingHistory(), row]);
}
