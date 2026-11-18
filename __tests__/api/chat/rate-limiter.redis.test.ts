/**
 * @jest-environment node
 */
/**
 * The chat gateway rate limiters against a real Redis
 * (infra/contabo-chat-stack/apps/server/src/rateLimiter.ts).
 *
 * This runs the actual Lua script, which rate-limiter.test.ts can only imitate.
 * It is skipped unless CHAT_TEST_REDIS_URL points at a throwaway Redis, e.g.
 *
 *   redis-server --port 56379 --bind 127.0.0.1 --save "" --appendonly no
 *   CHAT_TEST_REDIS_URL=redis://127.0.0.1:56379 npx jest __tests__/api/chat/rate-limiter.redis.test.ts
 *
 * Every key it writes is under a random address and deleted afterwards.
 */
import { randomBytes } from 'crypto';

import Redis from 'ioredis';

import {
  checkGuestRateLimit,
  checkHandshakeRateLimit,
} from '../../../infra/contabo-chat-stack/apps/server/src/rateLimiter';

const REDIS_URL = process.env['CHAT_TEST_REDIS_URL'];
const describeWithRedis = REDIS_URL ? describe : describe.skip;

describeWithRedis('rate limiters on a real Redis (CHAT_TEST_REDIS_URL)', () => {
  let redis: Redis;
  const keys: string[] = [];

  function address(): string {
    const [a, b, c, d] = randomBytes(4);
    return `198.51.${a! % 256}.${(b! + c! + d!) % 256}`;
  }

  beforeAll(() => {
    redis = new Redis(REDIS_URL as string, { maxRetriesPerRequest: 1 });
  });

  afterAll(async () => {
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  });

  it('counts up to the limit, refuses the next, and sets the expiry in the same script', async () => {
    const ip = address();
    keys.push(`chat:guest-rate:${ip}`);

    for (let i = 1; i <= 10; i++) {
      const result = await checkGuestRateLimit(redis, ip);
      expect(result).toEqual({ allowed: true, remaining: 10 - i });
    }
    expect(await checkGuestRateLimit(redis, ip)).toEqual({
      allowed: false,
      remaining: 0,
    });

    const ttl = await redis.ttl(`chat:guest-rate:${ip}`);
    expect(ttl).toBeGreaterThan(3590);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('does not move the expiry forward on later hits (fixed window)', async () => {
    const ip = address();
    const key = `chat:handshake-rate:${ip}`;
    keys.push(key);

    await checkHandshakeRateLimit(redis, ip);
    await redis.expire(key, 5);
    await checkHandshakeRateLimit(redis, ip);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5);
  });

  it('gives a counter that has no expiry one on its next hit', async () => {
    const ip = address();
    const key = `chat:guest-rate:${ip}`;
    keys.push(key);

    await redis.set(key, '4');
    expect(await redis.ttl(key)).toBe(-1);

    const result = await checkGuestRateLimit(redis, ip);

    expect(result).toEqual({ allowed: true, remaining: 5 });
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(3590);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('uses a one-minute window for connections', async () => {
    const ip = address();
    const key = `chat:handshake-rate:${ip}`;
    keys.push(key);

    for (let i = 0; i < 20; i++) {
      expect((await checkHandshakeRateLimit(redis, ip)).allowed).toBe(true);
    }
    expect((await checkHandshakeRateLimit(redis, ip)).allowed).toBe(false);

    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(50);
    expect(ttl).toBeLessThanOrEqual(60);
  });
});
