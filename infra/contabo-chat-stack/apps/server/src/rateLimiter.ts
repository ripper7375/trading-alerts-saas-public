import type Redis from 'ioredis';

const WINDOW_SECONDS = 60 * 60; // 1 hour

/**
 * Fixed-window IP rate limit for GUEST connections only (Session 14-0 §4:
 * "10 messages/hour rate limit"). Authenticated users are metered separately,
 * bot-worker-side, against their monthly AI quota — this limiter never
 * applies to them.
 */
export async function checkGuestRateLimit(
  redis: Redis,
  ip: string,
  limit = Number(process.env.GUEST_RATE_LIMIT_PER_HOUR) || 10
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `chat:guest-rate:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
