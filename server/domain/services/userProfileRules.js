export function normalizeProfilePatch(payload = {}, { repairText = value => value } = {}) {
  const patch = {};
  if (payload.nickname !== undefined) {
    const nickname = repairText(String(payload.nickname || '').trim().replace(/^@/, ''));
    if (nickname.length < 2) {
      const error = new Error('Nickname is too short');
      error.status = 400;
      throw error;
    }
    patch.nickname = nickname;
  }
  if (payload.avatar_url !== undefined) {
    patch.avatar_url = String(payload.avatar_url || '').slice(0, 2000000);
  }
  return patch;
}

export function normalizeUserSearchQuery(value, { repairText = text => text } = {}) {
  return repairText(String(value || '').trim().replace(/^@/, ''));
}
