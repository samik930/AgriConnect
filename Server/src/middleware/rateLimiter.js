/**
 * In-memory sliding-window rate limiter middleware for AI endpoints
 * Protects Gemini API quota, PostgreSQL connection pool, and prevents automated spam.
 */

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 25; // 25 requests per minute per IP or authenticated user

const requestLog = new Map();

// Periodic cleanup every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog.entries()) {
    const valid = timestamps.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}, 2 * 60 * 1000);

export const aiRateLimiter = (req, res, next) => {
  const identifier =
    req.user?.id ||
    req.user?._id ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "anonymous";

  const now = Date.now();
  const timestamps = requestLog.get(identifier) || [];
  const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS) {
    const oldest = validTimestamps[0];
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);

    res.set("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      success: false,
      message: `AI rate limit reached (${MAX_REQUESTS} requests/minute). Please wait ${retryAfterSec}s before making another query.`,
      retryAfter: retryAfterSec,
    });
  }

  validTimestamps.push(now);
  requestLog.set(identifier, validTimestamps);
  next();
};

export default aiRateLimiter;

