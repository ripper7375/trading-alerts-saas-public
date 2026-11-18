/**
 * @jest-environment node
 */
/**
 * Chat gateway rate limiters
 * (infra/contabo-chat-stack/apps/server/src/rateLimiter.ts).
 *
 * The counters are one Redis script (INCR and EXPIRE together), so a failure
 * between the two cannot leave a counter without an expiry. Here a stand-in for
 * Redis that implements that script's behaviour records what the limiters send;
 * rate-limiter.redis.test.ts runs the real script when CHAT_TEST_REDIS_URL is set.
 */
import type Redis from 'ioredis';

import {
  checkGuestRateLimit,
  checkHandshakeRateLimit,
} from '../../../infra/contabo-chat-stack/apps/server/src/rateLimiter';
import { normalizeClientIp } from '../../../infra/contabo-chat-stack/apps/server/src/security';

const env = process.env as Record<string, string | undefined>;
const SAVED = {
  GUEST_RATE_LIMIT_PER_HOUR: env['GUEST_RATE_LIMIT_PER_HOUR'],
  HANDSHAKE_RATE_LIMIT_PER_MINUTE: env['HANDSHAKE_RATE_LIMIT_PER_MINUTE'],
};

function fakeRedis() {
  const counters = new Map<string, number>();
  const expirySeconds = new Map<string, number>();

  const evalMock = jest.fn(
    async (
      _script: string,
      _numKeys: number,
      key: string,
      windowSeconds: number
    ): Promise<number> => {
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      if (count === 1 || (expirySeconds.get(key) ?? -1) < 0) {
        expirySeconds.set(key, windowSeconds);
      }
      return count;
    }
  );

  // Only `eval` exists, so a separate INCR or EXPIRE call would throw.
  const redis = { eval: evalMock } as unknown as Redis;
  return { redis, counters, expirySeconds, evalMock };
}

afterEach(() => {
  for (const [name, value] of Object.entries(SAVED)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
});

describe('checkGuestRateLimit', () => {
  it('allows 10 messages an hour and refuses the 11th', async () => {
    const { redis } = fakeRedis();
    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(await checkGuestRateLimit(redis, '203.0.113.50'));
    }

    expect(results.slice(0, 10).every((r) => r.allowed)).toBe(true);
    expect(results.slice(0, 10).map((r) => r.remaining)).toEqual([
      9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
    ]);
    expect(results[10]).toEqual({ allowed: false, remaining: 0 });
  });

  it('counts each address on its own', async () => {
    const { redis } = fakeRedis();
    for (let i = 0; i < 10; i++)
      await checkGuestRateLimit(redis, '203.0.113.50');

    expect((await checkGuestRateLimit(redis, '203.0.113.50')).allowed).toBe(
      false
    );
    expect((await checkGuestRateLimit(redis, '203.0.113.51')).allowed).toBe(
      true
    );
  });

  it('shares one counter across a whole IPv6 /64 once keyed by the normalised address', async () => {
    const { redis, counters } = fakeRedis();
    const first = normalizeClientIp(
      '2001:db8:abcd:12:1111:2222:3333:4444'
    ) as string;
    const second = normalizeClientIp(
      '2001:db8:abcd:12:aaaa:bbbb:cccc:dddd'
    ) as string;

    await checkGuestRateLimit(redis, first);
    await checkGuestRateLimit(redis, second);

    expect([...counters.entries()]).toEqual([
      ['chat:guest-rate:2001:db8:abcd:12::/64', 2],
    ]);
  });

  it('sends INCR and EXPIRE as one script for one key, with a one-hour window', async () => {
    const { redis, evalMock, expirySeconds } = fakeRedis();
    await checkGuestRateLimit(redis, '203.0.113.50');

    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, windowSeconds] = evalMock.mock.calls[0]!;
    expect(script).toContain("redis.call('INCR'");
    expect(script).toContain("redis.call('EXPIRE'");
    expect(numKeys).toBe(1);
    expect(key).toBe('chat:guest-rate:203.0.113.50');
    expect(windowSeconds).toBe(3600);
    expect(expirySeconds.get(key)).toBe(3600);
  });

  it('repairs a counter that was left without an expiry', () => {
    const { redis, evalMock } = fakeRedis();
    return checkGuestRateLimit(redis, '203.0.113.50').then(() => {
      // the script re-applies the expiry whenever the TTL is missing, not only on the first hit
      expect(evalMock.mock.calls[0]![0]).toContain("redis.call('TTL'");
    });
  });

  it('takes its limit from the argument, then GUEST_RATE_LIMIT_PER_HOUR, then 10', async () => {
    const { redis } = fakeRedis();
    expect((await checkGuestRateLimit(redis, 'a1', 1)).allowed).toBe(true);
    expect((await checkGuestRateLimit(redis, 'a1', 1)).allowed).toBe(false);

    env['GUEST_RATE_LIMIT_PER_HOUR'] = '2';
    expect((await checkGuestRateLimit(redis, 'a2')).allowed).toBe(true);
    expect((await checkGuestRateLimit(redis, 'a2')).allowed).toBe(true);
    expect((await checkGuestRateLimit(redis, 'a2')).allowed).toBe(false);

    delete env['GUEST_RATE_LIMIT_PER_HOUR'];
    for (let i = 0; i < 10; i++) await checkGuestRateLimit(redis, 'a3');
    expect((await checkGuestRateLimit(redis, 'a3')).allowed).toBe(false);
  });

  it('refuses rather than allows when Redis answers with something that is not a count', async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue('not-a-number'),
    } as unknown as Redis;
    expect((await checkGuestRateLimit(redis, 'a1')).allowed).toBe(false);
  });

  it('lets a Redis failure reach the caller', async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as Redis;
    await expect(checkGuestRateLimit(redis, 'a1')).rejects.toThrow(
      'connection lost'
    );
  });
});

describe('checkHandshakeRateLimit', () => {
  it('allows 20 connections a minute per address and refuses the 21st', async () => {
    const { redis } = fakeRedis();
    const results = [];
    for (let i = 0; i < 21; i++) {
      results.push(await checkHandshakeRateLimit(redis, '203.0.113.50'));
    }

    expect(results.slice(0, 20).every((r) => r.allowed)).toBe(true);
    expect(results[19]).toEqual({ allowed: true, remaining: 0 });
    expect(results[20]).toEqual({ allowed: false, remaining: 0 });
  });

  it('is counted apart from the guest message limit, with a one-minute window', async () => {
    const { redis, counters, expirySeconds } = fakeRedis();
    await checkHandshakeRateLimit(redis, '203.0.113.50');
    await checkGuestRateLimit(redis, '203.0.113.50');

    expect([...counters.keys()].sort()).toEqual([
      'chat:guest-rate:203.0.113.50',
      'chat:handshake-rate:203.0.113.50',
    ]);
    expect(expirySeconds.get('chat:handshake-rate:203.0.113.50')).toBe(60);
    expect(expirySeconds.get('chat:guest-rate:203.0.113.50')).toBe(3600);
  });

  it('takes its limit from the argument, then HANDSHAKE_RATE_LIMIT_PER_MINUTE, then 20', async () => {
    const { redis } = fakeRedis();
    expect((await checkHandshakeRateLimit(redis, 'h1', 1)).allowed).toBe(true);
    expect((await checkHandshakeRateLimit(redis, 'h1', 1)).allowed).toBe(false);

    env['HANDSHAKE_RATE_LIMIT_PER_MINUTE'] = '3';
    for (let i = 0; i < 3; i++) {
      expect((await checkHandshakeRateLimit(redis, 'h2')).allowed).toBe(true);
    }
    expect((await checkHandshakeRateLimit(redis, 'h2')).allowed).toBe(false);
  });

  it('shares one counter across a whole IPv6 /64', async () => {
    const { redis } = fakeRedis();
    for (let i = 0; i < 20; i++) {
      const address = `2001:db8:abcd:12:${i.toString(16)}:0:0:1`;
      await checkHandshakeRateLimit(
        redis,
        normalizeClientIp(address) as string
      );
    }
    const next = normalizeClientIp('2001:db8:abcd:12:ffff:0:0:1') as string;
    expect((await checkHandshakeRateLimit(redis, next)).allowed).toBe(false);
  });
});
