/**
 * @jest-environment node
 */
/**
 * The credentials provider asks for the second factor itself (CODE-01A) and keeps its fixed test
 * accounts to local development and the test suites (CODE-08).
 *
 * A 2FA user's right password throws `TWO_FACTOR_REQUIRED:<challenge>`; the only way on to a
 * session is the sentinel with a one-use completion token minted by the verify step.
 *
 * The token literals below are the contract shared with operation-service
 * (`operation-service/src/auth/two-factor-token.util.spec.ts` asserts the same ones). They are
 * spelled out here, not imported, so a drift in the module under test fails these tests.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

// An in-memory stand-in for the shared Redis: SET ... EX ... NX, EXISTS, INCR, EXPIRE.
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
let mockRedisDown = false;
const mockRedis = {
  set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
    if (mockRedisDown) throw new Error('redis down');
    const ttl = args[0] === 'EX' ? (args[1] as number) : null;
    if (args.includes('NX') && mockRedisStore.has(key)) return null;
    mockRedisStore.set(key, { value, ttl });
    return 'OK';
  }),
  exists: jest.fn(async (key: string) => {
    if (mockRedisDown) throw new Error('redis down');
    return mockRedisStore.has(key) ? 1 : 0;
  }),
  incr: jest.fn(async (key: string) => {
    if (mockRedisDown) throw new Error('redis down');
    const next = Number(mockRedisStore.get(key)?.value ?? '0') + 1;
    mockRedisStore.set(key, {
      value: String(next),
      ttl: mockRedisStore.get(key)?.ttl ?? null,
    });
    return next;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    if (mockRedisDown) throw new Error('redis down');
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

import { authOptions } from '@/lib/auth/auth-options';

const SECRET = 'authorize-two-factor-test-secret';
const SENTINEL = '__2fa_verified__';
const ISSUER = 'davintrade-2fa';

type Authorize = (credentials: {
  email: string;
  password: string;
}) => Promise<unknown>;

function credentialsAuthorize(): Authorize {
  const provider = authOptions.providers.find((p) => p.id === 'credentials') as
    | { options: { authorize: Authorize } }
    | undefined;
  if (!provider) throw new Error('credentials provider missing');
  return provider.options.authorize;
}

/** A token with the claims the verify step (or the password step) puts in one. */
function token(
  purpose: string,
  overrides: {
    payload?: Record<string, unknown>;
    options?: jwt.SignOptions;
    secret?: string;
  } = {}
): string {
  return jwt.sign(
    { purpose, email: 'alice@example.com', jti: 'jti-1', ...overrides.payload },
    overrides.secret ?? SECRET,
    {
      algorithm: 'HS256',
      issuer: ISSUER,
      subject: 'user-1',
      expiresIn: 60,
      ...overrides.options,
    }
  );
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
    twoFactorEnabled: true,
    emailVerified: new Date('2026-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const ENV_KEYS = ['NEXTAUTH_SECRET', 'NODE_ENV', 'VERCEL_ENV'] as const;

describe('authorize() asks for the second factor', () => {
  const saved = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of ENV_KEYS) saved.set(key, process.env[key]);
  });

  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserUpsert.mockReset();
    mockRedisStore.clear();
    mockRedisDown = false;
    setEnv('NEXTAUTH_SECRET', SECRET);
    setEnv('NODE_ENV', 'test');
    setEnv('VERCEL_ENV', undefined);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    for (const key of ENV_KEYS) setEnv(key, saved.get(key));
  });

  describe('password step', () => {
    it('a 2FA user with the right password gets a challenge, not a user', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      let thrown: Error | undefined;
      let returned: unknown;
      try {
        returned = await credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        });
      } catch (error) {
        thrown = error as Error;
      }

      expect(returned).toBeUndefined();
      expect(thrown?.message).toMatch(/^TWO_FACTOR_REQUIRED:/);

      const challenge = thrown!.message.replace('TWO_FACTOR_REQUIRED:', '');
      const claims = jwt.verify(challenge, SECRET, {
        algorithms: ['HS256'],
        issuer: ISSUER,
      }) as jwt.JwtPayload;
      expect(claims['purpose']).toBe('2fa_challenge');
      expect(claims.sub).toBe('user-1');
      expect(claims['email']).toBe('alice@example.com');
      expect(typeof claims.jti).toBe('string');
      expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(300);
    });

    it('mints a different challenge every time', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());
      const attempt = async (): Promise<string> => {
        try {
          await credentialsAuthorize()({
            email: 'alice@example.com',
            password: 'correct-password',
          });
        } catch (error) {
          return (error as Error).message;
        }
        return 'no challenge';
      };

      const first = await attempt();
      const second = await attempt();

      expect(first).toMatch(/^TWO_FACTOR_REQUIRED:/);
      expect(second).toMatch(/^TWO_FACTOR_REQUIRED:/);
      expect(first).not.toBe(second);
    });

    it('does not ask a 2FA user with a wrong password for a code (and tells nothing)', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('does not start a challenge for a deactivated or unverified 2FA account', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow({ isActive: false }));
      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).rejects.toThrow('ACCOUNT_DEACTIVATED');

      mockUserFindUnique.mockResolvedValue(
        await userRow({ emailVerified: null })
      );
      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).rejects.toThrow('EMAIL_NOT_VERIFIED');
    });

    it('still signs in a user without 2FA straight away', async () => {
      mockUserFindUnique.mockResolvedValue(
        await userRow({ twoFactorEnabled: false })
      );

      await expect(
        credentialsAuthorize()({
          email: 'alice@example.com',
          password: 'correct-password',
        })
      ).resolves.toMatchObject({ id: 'user-1', email: 'alice@example.com' });
    });

    it('reads twoFactorEnabled with the password row (explicit select)', async () => {
      mockUserFindUnique.mockResolvedValue(
        await userRow({ twoFactorEnabled: false })
      );

      await credentialsAuthorize()({
        email: 'alice@example.com',
        password: 'correct-password',
      });

      const args = mockUserFindUnique.mock.calls[0][0] as {
        select: Record<string, boolean>;
      };
      expect(args.select['twoFactorEnabled']).toBe(true);
      expect(args.select['password']).toBe(true);
    });
  });

  describe('completion step (the sentinel)', () => {
    it('a challenge presented as the completion is refused, and the sentinel is never looked up as an e-mail address', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_challenge', { options: { expiresIn: 300 } }),
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');

      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a 2fa_verification token of an earlier version',
        () => token('2fa_verification', { options: { expiresIn: 300 } }),
      ],
      [
        'a token signed with another secret',
        () => token('2fa_verified', { secret: 'another-secret' }),
      ],
      [
        'a token from another issuer',
        () => token('2fa_verified', { options: { issuer: 'someone-else' } }),
      ],
      [
        'a token with no jti',
        () =>
          jwt.sign({ purpose: '2fa_verified' }, SECRET, {
            algorithm: 'HS256',
            issuer: ISSUER,
            subject: 'user-1',
            expiresIn: 60,
          }),
      ],
      [
        'a token with no subject',
        () =>
          jwt.sign({ purpose: '2fa_verified', jti: 'jti-1' }, SECRET, {
            algorithm: 'HS256',
            issuer: ISSUER,
            expiresIn: 60,
          }),
      ],
      [
        'an expired completion',
        () => token('2fa_verified', { options: { expiresIn: -10 } }),
      ],
      [
        'a token signed with another HMAC algorithm',
        () => token('2fa_verified', { options: { algorithm: 'HS512' } }),
      ],
      ['a string that is not a JWT', () => 'not-a-jwt'],
    ])('refuses %s', async (_label, make) => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({ email: SENTINEL, password: make() })
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('signs the user in with a valid completion, and reads the row by id with an explicit select', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());

      const result = await credentialsAuthorize()({
        email: SENTINEL,
        password: token('2fa_verified', { payload: { chal: 'chal-1' } }),
      });

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'FREE',
        role: 'USER',
        isActive: true,
      });
      expect(result).not.toHaveProperty('password');

      const args = mockUserFindUnique.mock.calls[0][0] as {
        where: Record<string, unknown>;
        select: Record<string, boolean>;
      };
      expect(args.where).toEqual({ id: 'user-1' });
      expect(args.select['twoFactorEnabled']).toBe(true);
    });

    it('marks the completion as used for 120 seconds and refuses the same completion a second time', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());
      const completion = token('2fa_verified', { payload: { chal: 'chal-1' } });

      await credentialsAuthorize()({ email: SENTINEL, password: completion });
      expect(mockRedisStore.get('2fa:used:jti-1')?.ttl).toBe(120);

      await expect(
        credentialsAuthorize()({ email: SENTINEL, password: completion })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('answers ACCOUNT_DEACTIVATED when the account was locked between the code and the sign-in', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow({ isActive: false }));

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_verified'),
        })
      ).rejects.toThrow('ACCOUNT_DEACTIVATED');
    });

    it('refuses a user whose e-mail is not verified', async () => {
      mockUserFindUnique.mockResolvedValue(
        await userRow({ emailVerified: null })
      );

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_verified'),
        })
      ).rejects.toThrow('EMAIL_NOT_VERIFIED');
    });

    it('refuses a completion for a user who no longer has 2FA (nothing was asked of them)', async () => {
      mockUserFindUnique.mockResolvedValue(
        await userRow({ twoFactorEnabled: false })
      );

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_verified'),
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('refuses a completion for a user who does not exist', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_verified'),
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });

    it('fails closed when Redis is down: no user, and no detail to the client', async () => {
      mockUserFindUnique.mockResolvedValue(await userRow());
      mockRedisDown = true;

      await expect(
        credentialsAuthorize()({
          email: SENTINEL,
          password: token('2fa_verified'),
        })
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('fails closed when NEXTAUTH_SECRET is missing', async () => {
      const completion = token('2fa_verified');
      setEnv('NEXTAUTH_SECRET', undefined);
      mockUserFindUnique.mockResolvedValue(await userRow());

      await expect(
        credentialsAuthorize()({ email: SENTINEL, password: completion })
      ).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('CODE-08: no fixed test accounts outside local development', () => {
    const PASSWORD = 'TestPassword123!';
    const email = 'pro-test@trading-alerts.test';

    it('Preview: no upsert, the account falls through to the normal lookup', async () => {
      setEnv('NODE_ENV', 'production');
      setEnv('VERCEL_ENV', 'preview');
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        credentialsAuthorize()({ email, password: PASSWORD })
      ).rejects.toThrow('INVALID_CREDENTIALS');

      expect(mockUserUpsert).not.toHaveBeenCalled();
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUserFindUnique.mock.calls[0][0]).toMatchObject({
        where: { email },
      });
    });

    it.each([
      ['production', 'production', 'production'],
      [
        'a Vercel preview built with NODE_ENV=development',
        'development',
        'preview',
      ],
      ['vercel dev', 'development', 'development'],
    ])('%s: no upsert', async (_label, nodeEnv, vercelEnv) => {
      setEnv('NODE_ENV', nodeEnv);
      setEnv('VERCEL_ENV', vercelEnv);
      mockUserFindUnique.mockResolvedValue(null);

      await expect(
        credentialsAuthorize()({ email, password: PASSWORD })
      ).rejects.toThrow('INVALID_CREDENTIALS');
      expect(mockUserUpsert).not.toHaveBeenCalled();
    });

    it.each([['development'], ['test']])(
      'NODE_ENV=%s with no VERCEL_ENV: still allowed (local development and the test suites)',
      async (nodeEnv) => {
        setEnv('NODE_ENV', nodeEnv);
        mockUserUpsert.mockResolvedValue({
          id: 'user-pro',
          email,
          name: 'Pro Test User',
          image: null,
          tier: 'PRO',
          role: 'USER',
          isAffiliate: false,
          emailVerified: new Date(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await expect(
          credentialsAuthorize()({ email, password: PASSWORD })
        ).resolves.toMatchObject({ id: 'user-pro', tier: 'PRO' });
        expect(mockUserUpsert).toHaveBeenCalledTimes(1);
      }
    );
  });
});
