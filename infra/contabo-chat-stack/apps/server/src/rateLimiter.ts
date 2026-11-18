import type Redis from 'ioredis';

const GUEST_WINDOW_SECONDS = 60 * 60; // 1 hour
const HANDSHAKE_WINDOW_SECONDS = 60; // 1 minute

// INCR and EXPIRE run as ONE script, so a crash or a dropped connection between
// them can never leave a counter without an expiry (which would block that
// address for good). A counter found without an expiry, written by an earlier
// release, is given one on its next hit.
const INCREMENT_WITH_EXPIRY_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return count
`;

async function countHit(
  redis: Redis,
  key: string,
  windowSeconds: number
): Promise<number> {
  const count = await redis.eval(
    INCREMENT_WITH_EXPIRY_SCRIPT,
    1,
    key,
    windowSeconds
  );
  return Number(count);
}

/**
 * Fixed-window IP rate limit for GUEST connections only (Session 14-0 §4:
 * "10 messages/hour rate limit"). Authenticated users are metered separately,
 * bot-worker-side, against their monthly AI quota — this limiter never
 * applies to them.
 */
export async function checkGuestRateLimit(
  redis: Redis,
  ip: string,
  limit = Number(process.env['GUEST_RATE_LIMIT_PER_HOUR']) || 10
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await countHit(
    redis,
    `chat:guest-rate:${ip}`,
    GUEST_WINDOW_SECONDS
  );
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

/**
 * Fixed-window limit on new connections per client address, checked before the
 * handshake token is looked at, so it holds for guests and signed-in users
 * alike. Every page view opens a chat socket, so the default leaves room for
 * several people behind one address.
 */
export async function checkHandshakeRateLimit(
  redis: Redis,
  ip: string,
  limit = Number(process.env['HANDSHAKE_RATE_LIMIT_PER_MINUTE']) || 20
): Promise<{ allowed: boolean; remaining: number }> {
  const count = await countHit(
    redis,
    `chat:handshake-rate:${ip}`,
    HANDSHAKE_WINDOW_SECONDS
  );
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
