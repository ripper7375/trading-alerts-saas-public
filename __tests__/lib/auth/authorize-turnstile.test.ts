/**
 * @jest-environment node
 */
/**
 * The credentials provider checks the Cloudflare Turnstile token (CODE-15).
 *
 * With `TURNSTILE_SECRET_KEY` set, `authorize()` reads the `turnstileToken` credential and asks
 * Cloudflare BEFORE it counts an attempt, looks the account up or compares a password: a bot
 * with no token can neither guess passwords nor burn a victim's failed-password budget. The
 * second step of a 2FA sign-in (the sentinel) is not a new sign-in and is not asked again. With
 * the secret unset nothing changes (local development).
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

// An in-memory stand-in for the shared Redis: the failed-password counters.
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
const mockRedis = {
  get: jest.fn(async (key: string) => mockRedisStore.get(key)?.value ?? null),
  set: jest.fn(async () => 'OK'),
  exists: jest.fn(async () => 0),
  incr: jest.fn(async (key: string) => {
    const next = Number(mockRedisStore.get(key)?.value ?? '0') + 1;
    mockRedisStore.set(key, {
      value: String(next),
      ttl: mockRedisStore.get(key)?.ttl ?? null,
    });
    return next;
  }),
  decr: jest.fn(async () => 0),
  del: jest.fn(async () => 0),
  ttl: jest.fn(async () => -1),
  expire: jest.fn(async () => 1),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

import { authOptions } from '@/lib/auth/auth-options';

const SECRET = 'authorize-turnstile-test-secret';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SENTINEL = '__2fa_verified__';

type Authorize = (
  credentials: { email: string; password: string; turnstileToken?: string },
  req?: { headers: Record<string, string> }
) => Promise<unknown>;

function credentialsAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as
    | { options: { authorize: Authorize } }
    | undefined;
  if (!provider) throw new Error('credentials provider missing');
  return provider.options.authorize;
}

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
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

/** Cloudflare answers every siteverify call with `verdict`. */
function cloudflare(verdict: { success: boolean } | Error): jest.Mock {
  const fetchMock = jest.fn(async () => {
    if (verdict instanceof Error) throw verdict;
    return new Response(JSON.stringify(verdict), { status: 200 });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function sentBody(fetchMock: jest.Mock): URLSearchParams {
  const init = fetchMock.mock.calls[0]?.[1] as { body: unknown };
  return new URLSearchParams(String(init.body));
}

async function messageOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return 'did not throw';
}

const ENV_KEYS = [
  'NEXTAUTH_SECRET',
  'NODE_ENV',
  'VERCEL_ENV',
  'TURNSTILE_SECRET_KEY',
] as const;

describe('CODE-15: authorize() checks the Turnstile token', () => {
  const saved = new Map<string, string | undefined>();
  const originalFetch = global.fetch;

  beforeAll(() => {
    for (const key of ENV_KEYS) saved.set(key, process.env[key]);
  });

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserUpsert.mockReset();
    mockRedisStore.clear();
    mockRedis.incr.mockClear();
    setEnv('NEXTAUTH_SECRET', 'authorize-turnstile-nextauth-secret');
    setEnv('NODE_ENV', 'test');
    setEnv('VERCEL_ENV', undefined);
    setEnv('TURNSTILE_SECRET_KEY', SECRET);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    for (const key of ENV_KEYS) setEnv(key, saved.get(key));
  });

  it('declares the turnstileToken credential', () => {
    const provider = authOptions.providers.find(
      (p) => p.id === 'credentials'
    ) as { options: { credentials: Record<string, unknown> } };

    expect(Object.keys(provider.options.credentials)).toEqual(
      expect.arrayContaining(['email', 'password', 'turnstileToken'])
    );
  });

  describe('secret set', () => {
    it('signs in a user whose token Cloudflare accepts, and sends it the token and the client address', async () => {
      const fetchMock = cloudflare({ success: true });
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()(
          {
            email: 'alice@example.com',
            password: 'correct-password',
            turnstileToken: 'cf-token-1',
          },
          { headers: { 'x-real-ip': '203.0.113.7' } }
        )
      ).resolves.toMatchObject({ id: 'user-1', email: 'alice@example.com' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(SITEVERIFY);
      const body = sentBody(fetchMock);
      expect(body.get('secret')).toBe(SECRET);
      expect(body.get('response')).toBe('cf-token-1');
      expect(body.get('remoteip')).toBe('203.0.113.7');
    });

    it.each([
      ['no token', undefined],
      ['an empty token', ''],
    ])(
      'refuses %s with TURNSTILE_FAILED before counting an attempt or looking at the account',
      async (_label, turnstileToken) => {
        const fetchMock = cloudflare({ success: true });
        mockUserFindUnique.mockResolvedValue(await userRow());

        const message = await messageOf(
          credentialsAuthorize()({
            email: 'alice@example.com',
            password: 'correct-password',
            ...(turnstileToken === undefined ? {} : { turnstileToken }),
          })
        );

        expect(message).toBe('TURNSTILE_FAILED');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockRedis.incr).not.toHaveBeenCalled();
        expect(mockUserFindUnique).not.toHaveBeenCalled();
      }
    );

    it('refuses a token Cloudflare rejects, with the right password, and touches nothing else', async () => {
      cloudflare({ success: false });
      mockUserFindUnique.mockResolvedValue(await userRow());

      const message = await messageOf(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
          turnstileToken: 'cf-token-bad',
        })
      );

      expect(message).toBe('TURNSTILE_FAILED');
      expect(mockRedis.incr).not.toHaveBeenCalled();
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('fails closed when Cloudflare cannot be reached', async () => {
      cloudflare(new TypeError('fetch failed'));
      mockUserFindUnique.mockResolvedValue(await userRow());

      const message = await messageOf(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
          turnstileToken: 'cf-token-1',
        })
      );

      expect(message).toBe('TURNSTILE_FAILED');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('still checks the password of a user whose token is good (a wrong one is the usual error)', async () => {
      cloudflare({ success: true });
      mockUserFindUnique.mockResolvedValue(await userRow());

      const message = await messageOf(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'wrong-password',
          turnstileToken: 'cf-token-1',
        })
      );

      expect(message).toBe('INVALID_CREDENTIALS');
    });

    it('also asks for the token on the fixed development test accounts', async () => {
      const fetchMock = cloudflare({ success: true });

      const message = await messageOf(
        credentialsAuthorize()({
          email: 'free-test@trading-alerts.test',
          password: 'TestPassword123!',
        })
      );

      expect(message).toBe('TURNSTILE_FAILED');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockUserUpsert).not.toHaveBeenCalled();
    });

    it('does not ask again at the second step of a 2FA sign-in (the sentinel)', async () => {
      const fetchMock = cloudflare({ success: false });

      const message = await messageOf(
        credentialsAuthorize()({
          email: SENTINEL,
          password: 'not-a-valid-completion-token',
        })
      );

      expect(message).not.toBe('TURNSTILE_FAILED');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('secret unset (local development)', () => {
    it('signs in without a token and never calls Cloudflare', async () => {
      setEnv('TURNSTILE_SECRET_KEY', undefined);
      const fetchMock = cloudflare({ success: false });
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).resolves.toMatchObject({ id: 'user-1' });

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
