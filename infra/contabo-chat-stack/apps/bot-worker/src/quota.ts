import type Redis from 'ioredis';
import type { ChatIdentity } from './types';

/**
 * Monthly per-user AI quota for authenticated users (Session 14-0 §"F72 Sub-
 * Question 3": "the bot worker tracks message frequency and token usage per
 * user session. For authenticated PRO users, requests are validated against
 * their allowance."). GUEST users are never metered here — the socket server
 * already enforces the 10 msg/hour IP limit before a job reaches this queue.
 *
 * v1 keeps this self-contained (own Redis counter) rather than calling into
 * the monolith's Session 11-3 `trackAiTokenUsage()` limiter — that function is
 * in-process to the Next.js monolith, not an exposed API, and Session 14-0's
 * own "Phase 12 Repointing Path" note treats deeper integration as optional
 * future work once Phase 12's central router exists. Flagged as a Deviation.
 */
export async function checkAndIncrementAuthQuota(
  redis: Redis,
  identity: ChatIdentity,
  limit = Number(process.env.AUTH_MONTHLY_QUOTA) || 500
): Promise<{ exceeded: boolean }> {
  if (identity.tier === 'GUEST') {
    return { exceeded: false };
  }

  const monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const key = `chat:auth-quota:${identity.userId}:${monthKey}`;
  const count = await redis.incr(key);
  if (count === 1) {
    // ~31 days, generous — the key naturally rotates to a new month key anyway.
    await redis.expire(key, 60 * 60 * 24 * 32);
  }
  return { exceeded: count > limit };
}
