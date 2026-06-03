const DEFAULT_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;

const buckets = new Map();

function getClientKey(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  return token || ip;
}

function cleanupBuckets(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function createMediaRateLimit({ name, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS } = {}) {
  return (req, _res, next) => {
    const now = Date.now();
    if (buckets.size > 2000) cleanupBuckets(now);

    const key = `${name || req.path}:${getClientKey(req)}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      const err = new Error('Too many media requests. Please try again later.');
      err.status = 429;
      next(err);
      return;
    }

    next();
  };
}

export function createMediaAuthGuard({ requireSessionUser }) {
  return async (req, _res, next) => {
    try {
      if (process.env.MEDIA_AUTH_DISABLED === 'true') {
        next();
        return;
      }

      const user = await requireSessionUser(req);
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
