import type { ThrottleRedis } from './auth-throttle.util';
import {
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_WINDOW_SECONDS,
  MAIL_LIMIT,
  MAIL_WINDOW_SECONDS,
  clear,
  emailHash,
  release,
  reserve,
  throttleKeys,
} from './auth-throttle.util';

/**
 * The failure counters of sign-in and the e-mail flows (CODE-01B), the account half of the limits.
 *
 * The monolith has the same contract in `lib/auth/auth-throttle.ts` (its test,
 * `__tests__/lib/auth/auth-throttle.test.ts`, asserts the same literals): the credentials
 * provider there and `AuthService` here write the SAME account keys, so one budget covers both
 * ways in (decision D-4). The per-address keys exist only in the monolith, which is the side that
 * sees the client's address.
 *
 * Redis down: the counters fail OPEN (decision D-1): a warning and no error.
 */

// sha256('alice@example.com'), spelled out: the e-mail part of every account key
const ALICE_HASH =
  'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';

/** An in-memory stand-in for the Redis the counters live in. */
function makeRedis() {
  const store = new Map<string, { value: string; ttl: number | null }>();
  const state = { down: false };
  const guard = (): void => {
    if (state.down) throw new Error('redis down');
  };
  const client = {
    incr: jest.fn(async (key: string) => {
      guard();
      const entry = store.get(key);
      const next = Number(entry?.value ?? '0') + 1;
      store.set(key, { value: String(next), ttl: entry?.ttl ?? null });
      return next;
    }),
    decr: jest.fn(async (key: string) => {
      guard();
      const entry = store.get(key);
      const next = Number(entry?.value ?? '0') - 1;
      store.set(key, { value: String(next), ttl: entry?.ttl ?? null });
      return next;
    }),
    ttl: jest.fn(async (key: string) => {
      guard();
      const entry = store.get(key);
      if (!entry) return -2;
      return entry.ttl ?? -1;
    }),
    expire: jest.fn(async (key: string, ttl: number) => {
      guard();
      const entry = store.get(key);
      if (entry) entry.ttl = ttl;
      return entry ? 1 : 0;
    }),
    del: jest.fn(async (...keys: string[]) => {
      guard();
      let removed = 0;
      for (const key of keys) {
        if (store.delete(key)) removed += 1;
      }
      return removed;
    }),
  };
  const elapse = (seconds: number): void => {
    for (const [key, entry] of store) {
      if (entry.ttl === null) continue;
      entry.ttl -= seconds;
      if (entry.ttl <= 0) store.delete(key);
    }
  };
  return {
    client: client as unknown as ThrottleRedis,
    store,
    state,
    elapse,
    mock: client,
  };
}

describe('auth-throttle.util: shared contract with the monolith', () => {
  it('hashes the e-mail (lower-cased, trimmed) so no address appears in a key', () => {
    expect(emailHash('alice@example.com')).toBe(ALICE_HASH);
    expect(emailHash('  Alice@Example.COM ')).toBe(ALICE_HASH);
    expect(throttleKeys.loginAccount('Alice@Example.com')).not.toContain(
      'alice'
    );
  });

  it('writes the account key formats both stacks agree on', () => {
    expect(throttleKeys.loginAccount('alice@example.com')).toBe(
      `authfail:login:acct:${ALICE_HASH}`
    );
    expect(throttleKeys.forgotAccount('alice@example.com')).toBe(
      `authmail:forgot:acct:${ALICE_HASH}`
    );
    expect(throttleKeys.resendAccount('alice@example.com')).toBe(
      `authmail:resend:acct:${ALICE_HASH}`
    );
  });

  it('uses the limits and windows of decision D-3', () => {
    expect(LOGIN_ACCOUNT_LIMIT).toBe(5);
    expect(LOGIN_WINDOW_SECONDS).toBe(900);
    expect(MAIL_LIMIT).toBe(3);
    expect(MAIL_WINDOW_SECONDS).toBe(3600);
  });
});

describe('auth-throttle.util: reserve, release, clear', () => {
  let redis: ReturnType<typeof makeRedis>;
  let consoleWarn: jest.SpyInstance;
  const limit = { key: 'authfail:test:one', limit: 3, windowSeconds: 900 };

  beforeEach(() => {
    redis = makeRedis();
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  it('lets the first `limit` reservations through and refuses the next', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await reserve(redis.client, [limit])).blocked).toBe(false);
    }
    const fourth = await reserve(redis.client, [limit]);
    expect(fourth.blocked).toBe(true);
    expect(fourth.retryAfterSeconds).toBe(900);
  });

  it('starts the window on the first reservation and does not extend it', async () => {
    await reserve(redis.client, [limit]);
    expect(redis.store.get(limit.key)?.ttl).toBe(900);
    redis.elapse(300);
    await reserve(redis.client, [limit]);
    expect(redis.store.get(limit.key)?.ttl).toBe(600);
  });

  it('reports the time left in the window when it refuses', async () => {
    for (let i = 0; i < 3; i += 1) await reserve(redis.client, [limit]);
    redis.elapse(400);
    expect(await reserve(redis.client, [limit])).toEqual({
      blocked: true,
      retryAfterSeconds: 500,
    });
  });

  it('opens again when the window has passed', async () => {
    for (let i = 0; i < 4; i += 1) await reserve(redis.client, [limit]);
    redis.elapse(900);
    expect((await reserve(redis.client, [limit])).blocked).toBe(false);
  });

  it('gives a counter without a lifetime one (a missing EXPIRE cannot lock for good)', async () => {
    redis.store.set(limit.key, { value: '10', ttl: null });
    const verdict = await reserve(redis.client, [limit]);
    expect(verdict.blocked).toBe(true);
    expect(redis.store.get(limit.key)?.ttl).toBe(900);
  });

  it('counts a parallel burst exactly: no more than `limit` get through', async () => {
    const verdicts = await Promise.all(
      Array.from({ length: 12 }, () => reserve(redis.client, [limit]))
    );
    expect(verdicts.filter((v) => !v.blocked)).toHaveLength(3);
  });

  it('does nothing for an empty list', async () => {
    expect(await reserve(redis.client, [])).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
    expect(redis.mock.incr).not.toHaveBeenCalled();
  });

  it('release gives one reservation back and never goes below zero', async () => {
    await reserve(redis.client, [limit]);
    await reserve(redis.client, [limit]);
    await release(redis.client, [limit.key]);
    expect(redis.store.get(limit.key)?.value).toBe('1');
    await release(redis.client, [limit.key]);
    expect(redis.store.has(limit.key)).toBe(false);
    await release(redis.client, [limit.key]);
    expect(redis.store.has(limit.key)).toBe(false);
  });

  it('clear removes the counters', async () => {
    await reserve(redis.client, [limit]);
    await clear(redis.client, [limit.key]);
    expect(redis.store.has(limit.key)).toBe(false);
  });

  it('fails OPEN when Redis is down (D-1): not blocked, a warning, no error', async () => {
    redis.state.down = true;
    await expect(reserve(redis.client, [limit])).resolves.toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
    await expect(release(redis.client, [limit.key])).resolves.toBeUndefined();
    await expect(clear(redis.client, [limit.key])).resolves.toBeUndefined();
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('keeps e-mail addresses out of its warnings', async () => {
    redis.state.down = true;
    await reserve(redis.client, [
      {
        key: throttleKeys.loginAccount('alice@example.com'),
        limit: 5,
        windowSeconds: 900,
      },
    ]);
    const logged = JSON.stringify(consoleWarn.mock.calls);
    expect(logged).not.toContain('alice');
    expect(logged).not.toContain(ALICE_HASH);
  });

  it('fails open when the Redis client itself cannot be had', async () => {
    const broken = {
      incr: () => {
        throw new TypeError('getClient is not a function');
      },
    } as unknown as ThrottleRedis;
    await expect(reserve(broken, [limit])).resolves.toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });
});
