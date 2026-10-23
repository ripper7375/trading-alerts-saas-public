/**
 * @jest-environment node
 */
/**
 * Login, reset and resend throttling with a per-account lockout (CODE-01B).
 *
 * Two groups:
 * 1. `lib/auth/auth-throttle.ts`: the Redis counters (client address, keys, `reserve`, `release`,
 *    `clear`) and the decision D-1: on a Redis outage the counters fail OPEN (a warning, never an
 *    error), unlike the 2FA steps, which fail closed.
 * 2. The credentials provider's `authorize()`: the checklist's brute-force scenario (the 6th
 *    failed password is refused even when it is the right one), the per-address limit across
 *    different accounts, a success clearing the account's counter, and a parallel burst.
 *
 * The key formats, limits and windows below are the contract shared with operation-service
 * (`operation-service/src/auth/auth-throttle.util.spec.ts` asserts the same literals for the keys
 * both stacks write). They are spelled out here, not imported, so a drift in the module fails.
 */

import bcrypt from 'bcryptjs';

jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

const mockUserFindUnique = jest.fn();
const mockUserUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      upsert: (...a: unknown[]) => mockUserUpsert(...a),
    },
    affiliateProfile: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

// An in-memory stand-in for the shared Redis: GET, INCR, TTL, EXPIRE, DECR, DEL, SET ... NX.
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
let mockRedisDown = false;
function redisGuard(): void {
  if (mockRedisDown) throw new Error('redis down');
}
const mockRedis = {
  get: jest.fn(async (key: string) => {
    redisGuard();
    return mockRedisStore.get(key)?.value ?? null;
  }),
  incr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') + 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  decr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') - 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  ttl: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (!entry) return -2;
    return entry.ttl ?? -1;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
  del: jest.fn(async (...keys: string[]) => {
    redisGuard();
    let removed = 0;
    for (const key of keys) {
      if (mockRedisStore.delete(key)) removed += 1;
    }
    return removed;
  }),
  set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
    redisGuard();
    const ttl = args[0] === 'EX' ? (args[1] as number) : null;
    if (args.includes('NX') && mockRedisStore.has(key)) return null;
    mockRedisStore.set(key, { value, ttl });
    return 'OK';
  }),
  exists: jest.fn(async (key: string) => {
    redisGuard();
    return mockRedisStore.has(key) ? 1 : 0;
  }),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

/** Moves the stand-in's clock forward: counters whose window has passed disappear. */
function elapse(seconds: number): void {
  for (const [key, entry] of mockRedisStore) {
    if (entry.ttl === null) continue;
    entry.ttl -= seconds;
    if (entry.ttl <= 0) mockRedisStore.delete(key);
  }
}

import { authOptions } from '@/lib/auth/auth-options';
import {
  clear,
  clientIp,
  emailHash,
  mailLimits,
  release,
  reserve,
  throttleKeys,
} from '@/lib/auth/auth-throttle';

// sha256('alice@example.com'), spelled out: the e-mail part of every account key
const ALICE_HASH =
  'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';

describe('auth-throttle: shared contract with operation-service', () => {
  it('hashes the e-mail (lower-cased, trimmed) so no address appears in a key', () => {
    expect(emailHash('alice@example.com')).toBe(ALICE_HASH);
    expect(emailHash('  Alice@Example.COM ')).toBe(ALICE_HASH);
    expect(throttleKeys.loginAccount('Alice@Example.com')).not.toContain(
      'alice'
    );
  });

  it('writes the key formats both stacks agree on', () => {
    expect(throttleKeys.loginAccount('alice@example.com')).toBe(
      `authfail:login:acct:${ALICE_HASH}`
    );
    expect(throttleKeys.forgotAccount('alice@example.com')).toBe(
      `authmail:forgot:acct:${ALICE_HASH}`
    );
    expect(throttleKeys.resendAccount('alice@example.com')).toBe(
      `authmail:resend:acct:${ALICE_HASH}`
    );
    // per-address keys exist in the monolith only (decision D-4)
    expect(throttleKeys.loginIp('203.0.113.7')).toBe(
      'authfail:login:ip:203.0.113.7'
    );
    expect(throttleKeys.resetIp('203.0.113.7')).toBe(
      'authfail:reset:ip:203.0.113.7'
    );
    expect(throttleKeys.forgotIp('203.0.113.7')).toBe(
      'authmail:forgot:ip:203.0.113.7'
    );
    expect(throttleKeys.resendIp('203.0.113.7')).toBe(
      'authmail:resend:ip:203.0.113.7'
    );
  });

  it('uses the limits and windows of decision D-3', async () => {
    const mod = await import('@/lib/auth/auth-throttle');
    expect(mod.LOGIN_ACCOUNT_LIMIT).toBe(5);
    expect(mod.LOGIN_IP_LIMIT).toBe(20);
    expect(mod.LOGIN_WINDOW_SECONDS).toBe(900);
    expect(mod.RESET_IP_LIMIT).toBe(10);
    expect(mod.RESET_WINDOW_SECONDS).toBe(900);
    expect(mod.MAIL_LIMIT).toBe(3);
    expect(mod.MAIL_WINDOW_SECONDS).toBe(3600);
  });
});

describe('auth-throttle: clientIp', () => {
  it('prefers x-real-ip', () => {
    expect(
      clientIp(
        new Headers({
          'x-real-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        })
      )
    ).toBe('203.0.113.7');
  });

  it('falls back to the first x-forwarded-for entry', () => {
    expect(
      clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))
    ).toBe('198.51.100.1');
  });

  it('reads the plain header object NextAuth hands to authorize()', () => {
    expect(clientIp({ 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7');
    expect(clientIp({ 'x-forwarded-for': ['198.51.100.1, 10.0.0.1'] })).toBe(
      '198.51.100.1'
    );
  });

  it('accepts IPv6', () => {
    expect(clientIp({ 'x-real-ip': '2001:db8::1' })).toBe('2001:db8::1');
  });

  it('returns null for a missing or invalid address', () => {
    expect(clientIp(undefined)).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp({})).toBeNull();
    expect(clientIp({ 'x-real-ip': 'not-an-ip' })).toBeNull();
    expect(clientIp({ 'x-forwarded-for': '  , 10.0.0.1' })).toBeNull();
    expect(clientIp({ 'x-real-ip': '203.0.113.7:8080' })).toBeNull();
  });
});

describe('auth-throttle: reserve, release, clear', () => {
  let consoleWarn: jest.SpyInstance;

  beforeEach(() => {
    mockRedisStore.clear();
    mockRedisDown = false;
    jest.clearAllMocks();
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  const limit = { key: 'authfail:test:one', limit: 3, windowSeconds: 900 };

  it('lets the first `limit` reservations through and refuses the next', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await reserve([limit])).blocked).toBe(false);
    }
    const fourth = await reserve([limit]);
    expect(fourth.blocked).toBe(true);
    expect(fourth.retryAfterSeconds).toBe(900);
  });

  it('starts the window on the first reservation and does not extend it', async () => {
    await reserve([limit]);
    expect(mockRedisStore.get(limit.key)?.ttl).toBe(900);
    elapse(300);
    await reserve([limit]);
    expect(mockRedisStore.get(limit.key)?.ttl).toBe(600);
  });

  it('reports the time left in the window when it refuses', async () => {
    for (let i = 0; i < 3; i += 1) await reserve([limit]);
    elapse(400);
    expect(await reserve([limit])).toEqual({
      blocked: true,
      retryAfterSeconds: 500,
    });
  });

  it('opens again when the window has passed', async () => {
    for (let i = 0; i < 4; i += 1) await reserve([limit]);
    elapse(900);
    expect((await reserve([limit])).blocked).toBe(false);
  });

  it('refuses when any one of several keys is over its limit', async () => {
    const other = { key: 'authfail:test:two', limit: 1, windowSeconds: 60 };
    expect((await reserve([limit, other])).blocked).toBe(false);
    const second = await reserve([limit, other]);
    expect(second.blocked).toBe(true);
    expect(second.retryAfterSeconds).toBe(60);
  });

  it('gives a counter without a lifetime one (a missing EXPIRE cannot lock for good)', async () => {
    mockRedisStore.set(limit.key, { value: '10', ttl: null });
    const verdict = await reserve([limit]);
    expect(verdict.blocked).toBe(true);
    expect(mockRedisStore.get(limit.key)?.ttl).toBe(900);
  });

  it('counts a parallel burst exactly: no more than `limit` get through', async () => {
    const verdicts = await Promise.all(
      Array.from({ length: 12 }, () => reserve([limit]))
    );
    expect(verdicts.filter((v) => !v.blocked)).toHaveLength(3);
  });

  it('does nothing for an empty list', async () => {
    expect(await reserve([])).toEqual({ blocked: false, retryAfterSeconds: 0 });
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('release gives one reservation back and never goes below zero', async () => {
    await reserve([limit]);
    await reserve([limit]);
    await release([limit.key]);
    expect(mockRedisStore.get(limit.key)?.value).toBe('1');
    await release([limit.key]);
    expect(mockRedisStore.has(limit.key)).toBe(false);
    await release([limit.key]);
    expect(mockRedisStore.has(limit.key)).toBe(false);
  });

  it('clear removes the counters', async () => {
    await reserve([limit]);
    await clear([limit.key]);
    expect(mockRedisStore.has(limit.key)).toBe(false);
  });

  it('fails OPEN when Redis is down (D-1): not blocked, a warning, no error', async () => {
    mockRedisDown = true;
    await expect(reserve([limit])).resolves.toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
    await expect(release([limit.key])).resolves.toBeUndefined();
    await expect(clear([limit.key])).resolves.toBeUndefined();
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('keeps addresses and e-mails out of its warnings', async () => {
    mockRedisDown = true;
    await reserve([
      {
        key: throttleKeys.loginAccount('alice@example.com'),
        limit: 5,
        windowSeconds: 900,
      },
      {
        key: throttleKeys.loginIp('203.0.113.7'),
        limit: 20,
        windowSeconds: 900,
      },
    ]);
    const logged = JSON.stringify(consoleWarn.mock.calls);
    expect(logged).not.toContain('alice');
    expect(logged).not.toContain('203.0.113.7');
    expect(logged).not.toContain(ALICE_HASH);
  });

  it('mailLimits: the e-mail and the address, three per hour each', () => {
    expect(
      mailLimits('forgot', { email: 'Alice@example.com', ip: '203.0.113.7' })
    ).toEqual([
      {
        key: `authmail:forgot:acct:${ALICE_HASH}`,
        limit: 3,
        windowSeconds: 3600,
      },
      {
        key: 'authmail:forgot:ip:203.0.113.7',
        limit: 3,
        windowSeconds: 3600,
      },
    ]);
    expect(mailLimits('resend', { ip: '203.0.113.7' })).toEqual([
      {
        key: 'authmail:resend:ip:203.0.113.7',
        limit: 3,
        windowSeconds: 3600,
      },
    ]);
    expect(
      mailLimits('resend', { email: 'alice@example.com', ip: null })
    ).toEqual([
      {
        key: `authmail:resend:acct:${ALICE_HASH}`,
        limit: 3,
        windowSeconds: 3600,
      },
    ]);
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// authorize()
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Authorize = (
  credentials: { email: string; password: string },
  req?: { headers?: Record<string, string> }
) => Promise<unknown>;

function credentialsAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as
    | { options: { authorize: Authorize } }
    | undefined;
  if (!provider) throw new Error('credentials provider missing');
  return provider.options.authorize;
}

async function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    image: null,
    password: await bcrypt.hash('correct-password', 4),
    tier: 'FREE',
    role: 'USER',
    isAffiliate: false,
    isActive: true,
    twoFactorEnabled: false,
    emailVerified: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const FROM_A = { headers: { 'x-real-ip': '203.0.113.7' } };
const ENV_KEYS = ['NEXTAUTH_SECRET'] as const;

describe('authorize(): login throttling (CODE-01B)', () => {
  const saved: Record<string, string | undefined> = {};
  let consoleWarn: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let alice: Awaited<ReturnType<typeof userRow>>;

  beforeAll(async () => {
    alice = await userRow();
  });

  beforeEach(() => {
    mockRedisStore.clear();
    mockRedisDown = false;
    jest.clearAllMocks();
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    Reflect.set(process.env, 'NEXTAUTH_SECRET', 'authorize-throttle-secret');
    mockUserFindUnique.mockReset();
    mockUserFindUnique.mockImplementation(
      async ({ where }: { where: { email?: string } }) =>
        where.email === 'alice@example.com' ? alice : null
    );
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, saved[key]);
    }
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  async function attempt(
    email: string,
    password: string,
    req: { headers?: Record<string, string> } = FROM_A
  ): Promise<string> {
    try {
      await credentialsAuthorize()({ email, password }, req);
      return 'OK';
    } catch (error) {
      return (error as Error).message;
    }
  }

  it('refuses the 6th failed password for one account, even with the right password (8B-8)', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await attempt('alice@example.com', 'wrong-password')).toBe(
        'INVALID_CREDENTIALS'
      );
    }
    mockUserFindUnique.mockClear();

    expect(await attempt('alice@example.com', 'correct-password')).toBe(
      'RATE_LIMITED'
    );
    // refused before any database or bcrypt work
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('keeps refusing until the 15 minutes are over, then lets the right password in', async () => {
    for (let i = 0; i < 5; i += 1) {
      await attempt('alice@example.com', 'wrong-password');
    }
    elapse(600);
    expect(await attempt('alice@example.com', 'correct-password')).toBe(
      'RATE_LIMITED'
    );
    elapse(301);
    expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
  });

  it('counts a mixed-case, padded address as the same account', async () => {
    for (let i = 0; i < 5; i += 1) {
      await attempt(' Alice@Example.com ', 'wrong-password');
    }
    expect(await attempt('alice@example.com', 'correct-password')).toBe(
      'RATE_LIMITED'
    );
  });

  it('counts an unknown address like a wrong password (nothing tells the two apart)', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await attempt('nobody@example.com', 'whatever-password')).toBe(
        'INVALID_CREDENTIALS'
      );
    }
    expect(await attempt('nobody@example.com', 'whatever-password')).toBe(
      'RATE_LIMITED'
    );
  });

  it('refuses the 21st failure from one address across different accounts', async () => {
    for (let i = 0; i < 20; i += 1) {
      expect(await attempt(`victim-${i}@example.com`, 'guess')).toBe(
        'INVALID_CREDENTIALS'
      );
    }
    expect(await attempt('victim-20@example.com', 'guess')).toBe(
      'RATE_LIMITED'
    );
    // a different address is not affected
    expect(
      await attempt('victim-21@example.com', 'guess', {
        headers: { 'x-real-ip': '198.51.100.9' },
      })
    ).toBe('INVALID_CREDENTIALS');
  });

  it('a success clears the account counter', async () => {
    for (let i = 0; i < 4; i += 1) {
      await attempt('alice@example.com', 'wrong-password');
    }
    expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
    // the budget is whole again: five more failures are allowed
    for (let i = 0; i < 5; i += 1) {
      expect(await attempt('alice@example.com', 'wrong-password')).toBe(
        'INVALID_CREDENTIALS'
      );
    }
    expect(await attempt('alice@example.com', 'wrong-password')).toBe(
      'RATE_LIMITED'
    );
  });

  it('a success is not a failure for the address: it gives its count back', async () => {
    for (let i = 0; i < 19; i += 1) {
      await attempt(`victim-${i}@example.com`, 'guess');
    }
    expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
    // 19 failures stand: the 20th is allowed, the 21st is not
    expect(await attempt('victim-19@example.com', 'guess')).toBe(
      'INVALID_CREDENTIALS'
    );
    expect(await attempt('victim-20@example.com', 'guess')).toBe(
      'RATE_LIMITED'
    );
  });

  it('lets only five of a parallel burst reach the password check', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        attempt('alice@example.com', 'wrong-password')
      )
    );
    expect(results.filter((r) => r === 'INVALID_CREDENTIALS')).toHaveLength(5);
    expect(results.filter((r) => r === 'RATE_LIMITED')).toHaveLength(7);
    expect(mockUserFindUnique).toHaveBeenCalledTimes(5);
  });

  it('a database error is not a failed password: the reservation is given back', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('connection reset'));
    await expect(
      credentialsAuthorize()(
        { email: 'alice@example.com', password: 'correct-password' },
        FROM_A
      )
    ).rejects.toThrow('connection reset');
    expect(
      mockRedisStore.get(throttleKeys.loginAccount('alice@example.com'))
    ).toBeUndefined();
  });

  it('works without a client address: the account is still limited', async () => {
    for (let i = 0; i < 5; i += 1) {
      await attempt('alice@example.com', 'wrong-password', {});
    }
    expect(await attempt('alice@example.com', 'correct-password', {})).toBe(
      'RATE_LIMITED'
    );
    expect(
      [...mockRedisStore.keys()].some((k) => k.startsWith('authfail:login:ip:'))
    ).toBe(false);
  });

  it('fails OPEN when Redis is down (D-1): the sign-in works and a warning is logged', async () => {
    mockRedisDown = true;
    expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
    expect(await attempt('alice@example.com', 'wrong-password')).toBe(
      'INVALID_CREDENTIALS'
    );
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('does not count the 2FA completion step (the 2FA limits cover it)', async () => {
    for (let i = 0; i < 12; i += 1) {
      expect(await attempt('__2fa_verified__', 'not-a-token', FROM_A)).toBe(
        'INVALID_CREDENTIALS'
      );
    }
    expect(
      [...mockRedisStore.keys()].filter((k) => k.startsWith('authfail:'))
    ).toEqual([]);
  });

  it('a right password clears the counter for a 2FA user too (the code step has its own limits)', async () => {
    mockUserFindUnique.mockResolvedValue(
      await userRow({ twoFactorEnabled: true })
    );
    for (let i = 0; i < 3; i += 1) {
      await attempt('alice@example.com', 'wrong-password');
    }
    expect(await attempt('alice@example.com', 'correct-password')).toMatch(
      /^TWO_FACTOR_REQUIRED:/
    );
    expect(
      mockRedisStore.get(throttleKeys.loginAccount('alice@example.com'))
    ).toBeUndefined();
  });
});
