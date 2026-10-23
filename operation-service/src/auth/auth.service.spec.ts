import { ServiceUnavailableException } from '@nestjs/common';
import hkdf from '@panva/hkdf';
import bcrypt from 'bcryptjs';
import { jwtDecrypt } from 'jose';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';

// Session 4B-20: register() now sends the verification email (Deviation 2 —
// closes a gap left open since Session 3-2). Mocked the same way
// auth.service.email-flows.spec.ts already mocks this module, so register()'s
// tests don't make a real network call.
jest.mock('../email/email.util', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import { sendVerificationEmail } from '../email/email.util';

import { AuthService } from './auth.service';
import {
  AccountDeactivatedError,
  AccountExistsError,
  EmailNotVerifiedError,
  ExpiredTokenError,
  InvalidCredentialsError,
  TooManyAttemptsError,
  TwoFactorRequiredError,
} from './errors';
import { RefreshTokenService } from './refresh-token.service';

const TEST_SECRET = 'test-nextauth-secret-value-not-real';

async function decryptAccessToken(
  token: string
): Promise<Record<string, unknown>> {
  const key = await hkdf(
    'sha256',
    TEST_SECRET,
    '',
    'NextAuth.js Generated Encryption Key',
    32
  );
  const { payload } = await jwtDecrypt(token, key);
  return payload as Record<string, unknown>;
}

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    image: null,
    password: null,
    tier: 'PRO',
    role: 'USER',
    isActive: true,
    isAffiliate: false,
    sessionVersion: 0,
    emailVerified: new Date('2026-01-01'),
    twoFactorEnabled: false,
    verificationToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * An in-memory stand-in for the Redis the 2FA markers (SET ... EX ... NX) and the sign-in failure
 * counters (INCR, TTL, EXPIRE, DECR, DEL; CODE-01B) live in.
 */
function makeRedis() {
  const store = new Map<string, { value: string; ttl: number | null }>();
  const state = { down: false };
  const guard = (): void => {
    if (state.down) throw new Error('redis down');
  };
  const client = {
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      guard();
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, {
        value,
        ttl: args[0] === 'EX' ? (args[1] as number) : null,
      });
      return 'OK';
    }),
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
  return {
    service: { getClient: () => client } as unknown as RedisService,
    client,
    store,
    state,
  };
}

// sha256('alice@example.com'), spelled out: the e-mail part of every account key the monolith's
// credentials provider writes too (the contract is asserted in auth-throttle.util.spec.ts)
const ALICE_HASH =
  'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';
const ALICE_LOGIN_KEY = `authfail:login:acct:${ALICE_HASH}`;

/**
 * A 2FA token as the verify step mints it, spelled out with the contract's literals (not the util
 * under test): purpose, issuer, subject and a jti.
 */
function twoFactorToken(
  purpose: string,
  overrides: {
    payload?: Record<string, unknown>;
    options?: jwt.SignOptions;
  } = {}
): string {
  return jwt.sign(
    { purpose, email: 'alice@example.com', jti: 'jti-1', ...overrides.payload },
    TEST_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'davintrade-2fa',
      subject: 'user-1',
      expiresIn: 60,
      ...overrides.options,
    }
  );
}

describe('AuthService', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalNodeEnv = process.env['NODE_ENV'];

  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; upsert: jest.Mock };
  };
  let refreshTokens: {
    issue: jest.Mock;
    validate: jest.Mock;
    rotate: jest.Mock;
    revokeByRawToken: jest.Mock;
  };
  let redis: ReturnType<typeof makeRedis>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    process.env['NODE_ENV'] = originalNodeEnv;
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    };
    refreshTokens = {
      issue: jest.fn().mockResolvedValue({
        rawToken: 'raw-refresh-token',
        expiresAt: new Date(Date.now() + 1000),
      }),
      validate: jest.fn(),
      rotate: jest.fn(),
      revokeByRawToken: jest.fn(),
    };
    redis = makeRedis();
    service = new AuthService(
      prisma as unknown as PrismaService,
      refreshTokens as unknown as RefreshTokenService,
      redis.service
    );
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
    process.env['NODE_ENV'] = originalNodeEnv;
  });

  describe('register', () => {
    it('rejects a duplicate email (AccountExistsError, matches app/api/auth/register behavior)', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      await expect(
        service.register('alice@example.com', 'Sup3r$ecret')
      ).rejects.toThrow(AccountExistsError);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a FREE/USER/unaffiliated user with a hashed password', async () => {
      process.env['NODE_ENV'] = 'production';
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-user', ...data })
      );

      const result = await service.register(
        'bob@example.com',
        'Sup3r$ecret',
        'Bob'
      );

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.tier).toBe('FREE');
      expect(createArgs.data.role).toBe('USER');
      expect(createArgs.data.isAffiliate).toBe(false);
      expect(createArgs.data.email).toBe('bob@example.com');
      expect(createArgs.data.password).not.toBe('Sup3r$ecret');
      expect(
        await bcrypt.compare('Sup3r$ecret', createArgs.data.password)
      ).toBe(true);
      // CODE-13: new passwords are hashed at bcrypt cost 12.
      expect(bcrypt.getRounds(createArgs.data.password)).toBe(12);
      expect(createArgs.data.emailVerified).toBeNull();
      expect(createArgs.data.verificationToken).toEqual(expect.any(String));
      expect(result).toEqual({
        userId: 'new-user',
        message: expect.stringContaining('check your email'),
        autoVerified: false,
      });
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'bob@example.com',
        'Bob',
        createArgs.data.verificationToken
      );
    });

    it('auto-verifies in development (matches app/api/auth/register behavior)', async () => {
      process.env['NODE_ENV'] = 'development';
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-user', ...data })
      );

      const result = await service.register('carol@example.com', 'Sup3r$ecret');

      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.emailVerified).toEqual(expect.any(Date));
      expect(createArgs.data.verificationToken).toBeNull();
      expect(result.autoVerified).toBe(true);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('logs but does not fail registration when the verification email fails to send (Deviation 2, matches SOURCE non-fatal handling)', async () => {
      process.env['NODE_ENV'] = 'production';
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'new-user', ...data })
      );
      (sendVerificationEmail as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Resend API down',
      });
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      const result = await service.register('dave@example.com', 'Sup3r$ecret');

      expect(result.userId).toBe('new-user');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AuthService.register] Failed to send verification email:',
        'Resend API down'
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('login', () => {
    it('rejects an unknown email (InvalidCredentialsError, not a user-enumeration hint)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('nobody@example.com', 'whatever')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects an OAuth-only user with no password', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ password: null }));
      await expect(
        service.login('alice@example.com', 'whatever')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects a wrong password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ password: hashed }));
      await expect(
        service.login('alice@example.com', 'wrong-password')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects an unverified email', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, emailVerified: null })
      );
      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toThrow(EmailNotVerifiedError);
    });

    it('rejects a deactivated account with ACCOUNT_DEACTIVATED once the password is right (F21)', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, isActive: false })
      );

      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toMatchObject({
        code: 'ACCOUNT_DEACTIVATED',
        statusCode: 403,
      });
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('does not reveal a deactivated account to a wrong password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, isActive: false })
      );

      await expect(
        service.login('alice@example.com', 'wrong-password')
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('does not start the 2FA challenge for a deactivated account', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, isActive: false, twoFactorEnabled: true })
      );

      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toThrow(AccountDeactivatedError);
    });

    it('refuses to complete a 2FA login if the account was locked in between', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true, isActive: false })
      );

      await expect(
        service.login('__2fa_verified__', twoFactorToken('2fa_verified'))
      ).rejects.toThrow(AccountDeactivatedError);
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('throws TwoFactorRequiredError with a usable temp token when 2FA is enabled', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, twoFactorEnabled: true })
      );

      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toMatchObject({
        code: 'TWO_FACTOR_REQUIRED',
      });

      try {
        await service.login('alice@example.com', 'correct-password');
      } catch (error) {
        const twoFactorError = error as InstanceType<
          typeof TwoFactorRequiredError
        >;
        const decoded = jwt.verify(twoFactorError.twoFactorToken, TEST_SECRET, {
          algorithms: ['HS256'],
          issuer: 'davintrade-2fa',
        }) as jwt.JwtPayload;
        expect(decoded.sub).toBe('user-1');
        expect(decoded['email']).toBe('alice@example.com');
        expect(decoded['purpose']).toBe('2fa_challenge');
        expect(typeof decoded.jti).toBe('string');
        expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(300);
      }
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('the challenge the password step hands out is not a login (the sentinel refuses it)', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, twoFactorEnabled: true })
      );

      const challenge = await service
        .login('alice@example.com', 'correct-password')
        .then(
          () => {
            throw new Error('the password step did not ask for a code');
          },
          (error: InstanceType<typeof TwoFactorRequiredError>) =>
            error.twoFactorToken
        );

      await expect(
        service.login('__2fa_verified__', challenge)
      ).rejects.toThrow(InvalidCredentialsError);
      expect(refreshTokens.issue).not.toHaveBeenCalled();
      expect(redis.client.set).not.toHaveBeenCalled();
    });

    it('issues a NextAuth-compatible access token and a refresh token on success', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ password: hashed }));

      const result = await service.login(
        'alice@example.com',
        'correct-password',
        {
          userAgent: 'jest',
          ipAddress: '127.0.0.1',
        }
      );

      expect(result.refreshToken).toBe('raw-refresh-token');
      // The third argument is the sign-in time the refresh token carries across rotations.
      expect(refreshTokens.issue).toHaveBeenCalledWith(
        'user-1',
        {
          userAgent: 'jest',
          ipAddress: '127.0.0.1',
        },
        expect.any(Date)
      );
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: false,
      });

      const claims = await decryptAccessToken(result.accessToken);
      expect(claims).toMatchObject({
        id: 'user-1',
        email: 'alice@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: false,
      });
    });

    // CODE-02A (WS-4): the token says which version of the account it was minted for, and when the
    // person signed in; the refresh token keeps that time so a rotation cannot make it younger.
    it('stamps the database sessionVersion and the sign-in time on the access token, and the same time on the refresh token', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, sessionVersion: 5 })
      );
      const before = Math.floor(Date.now() / 1000);

      const result = await service.login(
        'alice@example.com',
        'correct-password'
      );

      const claims = await decryptAccessToken(result.accessToken);
      expect(claims['sessionVersion']).toBe(5);
      expect(claims['authTime']).toBeGreaterThanOrEqual(before);
      expect(claims['authTime']).toBeLessThanOrEqual(
        Math.floor(Date.now() / 1000)
      );
      const startedAt = refreshTokens.issue.mock.calls[0][2] as Date;
      expect(Math.floor(startedAt.getTime() / 1000)).toBe(claims['authTime']);
    });

    it('mints an access token that lasts 7 days (D-5)', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(makeUser({ password: hashed }));

      const result = await service.login(
        'alice@example.com',
        'correct-password'
      );

      const claims = await decryptAccessToken(result.accessToken);
      expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(
        7 * 24 * 60 * 60
      );
    });

    it('completes login via the __2fa_verified__ sentinel with a valid completion token', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );

      const result = await service.login(
        '__2fa_verified__',
        twoFactorToken('2fa_verified', { payload: { chal: 'chal-1' } })
      );

      expect(result.user.id).toBe('user-1');
      expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
      expect(redis.client.set).toHaveBeenCalledWith(
        '2fa:used:jti-1',
        '1',
        'EX',
        120,
        'NX'
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          twoFactorEnabled: true,
          isActive: true,
          emailVerified: true,
        }),
      });
    });

    it('does not select the password hash to complete a login', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );

      await service.login('__2fa_verified__', twoFactorToken('2fa_verified'));

      const args = prisma.user.findUnique.mock.calls[0][0] as {
        select: Record<string, boolean>;
      };
      expect(args.select).not.toHaveProperty('password');
    });

    it('rejects the __2fa_verified__ sentinel with an invalid temp token', async () => {
      await expect(
        service.login('__2fa_verified__', 'not-a-real-jwt')
      ).rejects.toThrow(InvalidCredentialsError);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a temp token whose purpose does not match', async () => {
      const wrongPurposeToken = jwt.sign(
        { userId: 'user-1', purpose: 'not_2fa' },
        TEST_SECRET,
        { expiresIn: '5m' }
      );
      await expect(
        service.login('__2fa_verified__', wrongPurposeToken)
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('rejects a 2fa_verification token of an earlier version, whatever else it carries', async () => {
      const oldToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'alice@example.com',
          purpose: '2fa_verification',
        },
        TEST_SECRET,
        { expiresIn: '5m' }
      );
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );

      await expect(service.login('__2fa_verified__', oldToken)).rejects.toThrow(
        InvalidCredentialsError
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it.each([
      [
        'another issuer',
        () => twoFactorToken('2fa_verified', { options: { issuer: 'other' } }),
      ],
      [
        'an expired completion',
        () => twoFactorToken('2fa_verified', { options: { expiresIn: -10 } }),
      ],
      [
        'another algorithm',
        () =>
          twoFactorToken('2fa_verified', { options: { algorithm: 'HS512' } }),
      ],
      [
        'no jti',
        () =>
          jwt.sign({ purpose: '2fa_verified' }, TEST_SECRET, {
            issuer: 'davintrade-2fa',
            subject: 'user-1',
            expiresIn: 60,
          }),
      ],
    ])('rejects %s', async (_label, make) => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );

      await expect(service.login('__2fa_verified__', make())).rejects.toThrow(
        InvalidCredentialsError
      );
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('spends a completion: the same one a second time is refused', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );
      const completion = twoFactorToken('2fa_verified');

      await service.login('__2fa_verified__', completion);
      await expect(
        service.login('__2fa_verified__', completion)
      ).rejects.toThrow(InvalidCredentialsError);

      expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
    });

    it('refuses a completion for an account without 2FA, an unverified e-mail or a missing user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ twoFactorEnabled: false })
      );
      await expect(
        service.login(
          '__2fa_verified__',
          twoFactorToken('2fa_verified', { payload: { jti: 'a' } })
        )
      ).rejects.toThrow(InvalidCredentialsError);

      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ twoFactorEnabled: true, emailVerified: null })
      );
      await expect(
        service.login(
          '__2fa_verified__',
          twoFactorToken('2fa_verified', { payload: { jti: 'b' } })
        )
      ).rejects.toThrow(EmailNotVerifiedError);

      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.login(
          '__2fa_verified__',
          twoFactorToken('2fa_verified', { payload: { jti: 'c' } })
        )
      ).rejects.toThrow(InvalidCredentialsError);

      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when Redis is down, and issues no session', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );
      redis.state.down = true;

      await expect(
        service.login('__2fa_verified__', twoFactorToken('2fa_verified'))
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('never grants fixed-credential bypass for admin@tradingalerts.com or admin-test@trading-alerts.test even in development/test', async () => {
      process.env['NODE_ENV'] = 'development';
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('admin@tradingalerts.com', 'ChangeMe123!')
      ).rejects.toThrow(InvalidCredentialsError);
      await expect(
        service.login('admin-test@trading-alerts.test', 'AdminPassword123!')
      ).rejects.toThrow(InvalidCredentialsError);

      expect(prisma.user.upsert).not.toHaveBeenCalled();
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('disables FIXED_TEST_ACCOUNTS when NODE_ENV is production or unset', async () => {
      process.env['NODE_ENV'] = 'production';
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('free-test@trading-alerts.test', 'TestPassword123!')
      ).rejects.toThrow(InvalidCredentialsError);
      expect(prisma.user.upsert).not.toHaveBeenCalled();

      delete process.env['NODE_ENV'];
      await expect(
        service.login('pro-test@trading-alerts.test', 'TestPassword123!')
      ).rejects.toThrow(InvalidCredentialsError);
      expect(prisma.user.upsert).not.toHaveBeenCalled();
    });

    it('allows non-admin FIXED_TEST_ACCOUNTS in test/development environments', async () => {
      process.env['NODE_ENV'] = 'test';
      prisma.user.upsert.mockResolvedValue(
        makeUser({
          id: 'free-test-id',
          email: 'free-test@trading-alerts.test',
          tier: 'FREE',
          role: 'USER',
        })
      );

      const result = await service.login(
        'free-test@trading-alerts.test',
        'TestPassword123!'
      );

      expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
      expect(result.user.email).toBe('free-test@trading-alerts.test');
      expect(result.user.role).toBe('USER');
    });

    it('hashes the stored test password at bcrypt cost 12 (CODE-13)', async () => {
      process.env['NODE_ENV'] = 'test';
      prisma.user.upsert.mockResolvedValue(
        makeUser({
          id: 'free-test-id',
          email: 'free-test@trading-alerts.test',
          tier: 'FREE',
          role: 'USER',
        })
      );

      await service.login('free-test@trading-alerts.test', 'TestPassword123!');

      const args = prisma.user.upsert.mock.calls[0][0];
      expect(bcrypt.getRounds(args.create.password)).toBe(12);
      expect(bcrypt.getRounds(args.update.password)).toBe(12);
    });

    it('hashes the password of the in-memory fallback user at bcrypt cost 12 when the upsert fails (CODE-13)', async () => {
      process.env['NODE_ENV'] = 'test';
      prisma.user.upsert.mockRejectedValue(new Error('database down'));
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const hash = jest.spyOn(bcrypt, 'hash');

      await service.login('free-test@trading-alerts.test', 'TestPassword123!');

      const costs = hash.mock.calls.map((call) => call[1]);
      hash.mockRestore();
      warn.mockRestore();
      // the upsert's own hash and the in-memory user's
      expect(costs).toEqual([12, 12]);
    });
  });

  // CODE-01B: the account half of the sign-in limits. The client address is limited in the
  // monolith (this service only sees Vercel's address, D-4); the keys below are the ones the
  // monolith's credentials provider writes, so one budget covers both ways in.
  describe('login throttling (CODE-01B)', () => {
    let hashed: string;
    let consoleWarn: jest.SpyInstance;

    beforeAll(async () => {
      hashed = await bcrypt.hash('correct-password', 4);
    });

    beforeEach(() => {
      consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      prisma.user.findUnique.mockImplementation(
        async ({ where }: { where: { email?: string } }) =>
          where.email === 'alice@example.com'
            ? makeUser({ password: hashed })
            : null
      );
    });

    afterEach(() => {
      consoleWarn.mockRestore();
    });

    async function attempt(email: string, password: string): Promise<string> {
      try {
        await service.login(email, password);
        return 'OK';
      } catch (error) {
        return (error as { code?: string }).code ?? (error as Error).message;
      }
    }

    it('refuses the 6th failed password for one account, even with the right password (8B-8)', async () => {
      for (let i = 0; i < 5; i += 1) {
        expect(await attempt('alice@example.com', 'wrong-password')).toBe(
          'INVALID_CREDENTIALS'
        );
      }
      prisma.user.findUnique.mockClear();

      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toBeInstanceOf(TooManyAttemptsError);
      // refused before any database or bcrypt work
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(refreshTokens.issue).not.toHaveBeenCalled();
    });

    it('answers 429 RATE_LIMITED with the time left in the window', async () => {
      for (let i = 0; i < 5; i += 1) {
        await attempt('alice@example.com', 'wrong-password');
      }
      redis.store.get(ALICE_LOGIN_KEY)!.ttl = 600;

      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        statusCode: 429,
        retryAfter: 600,
      });
    });

    it('shares one budget with the monolith: its counter blocks /auth/login too', async () => {
      redis.store.set(ALICE_LOGIN_KEY, { value: '5', ttl: 600 });

      expect(await attempt('alice@example.com', 'correct-password')).toBe(
        'RATE_LIMITED'
      );
    });

    it('writes the counter the monolith reads: the same key, a 15 minute window', async () => {
      await attempt('alice@example.com', 'wrong-password');
      expect(redis.store.get(ALICE_LOGIN_KEY)).toEqual({
        value: '1',
        ttl: 900,
      });
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
        expect(await attempt('nobody@example.com', 'whatever')).toBe(
          'INVALID_CREDENTIALS'
        );
      }
      expect(await attempt('nobody@example.com', 'whatever')).toBe(
        'RATE_LIMITED'
      );
    });

    it('a success clears the account counter', async () => {
      for (let i = 0; i < 4; i += 1) {
        await attempt('alice@example.com', 'wrong-password');
      }
      expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
      expect(redis.store.has(ALICE_LOGIN_KEY)).toBe(false);
      for (let i = 0; i < 5; i += 1) {
        expect(await attempt('alice@example.com', 'wrong-password')).toBe(
          'INVALID_CREDENTIALS'
        );
      }
      expect(await attempt('alice@example.com', 'wrong-password')).toBe(
        'RATE_LIMITED'
      );
    });

    it('a right password clears the counter for a 2FA user too (the code step has its own limits)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ password: hashed, twoFactorEnabled: true })
      );
      for (let i = 0; i < 3; i += 1) {
        await attempt('alice@example.com', 'wrong-password');
      }
      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toBeInstanceOf(TwoFactorRequiredError);
      expect(redis.store.has(ALICE_LOGIN_KEY)).toBe(false);
    });

    it('lets only five of a parallel burst reach the password check', async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          attempt('alice@example.com', 'wrong-password')
        )
      );
      expect(results.filter((r) => r === 'INVALID_CREDENTIALS')).toHaveLength(
        5
      );
      expect(results.filter((r) => r === 'RATE_LIMITED')).toHaveLength(7);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(5);
    });

    it('a database error is not a failed password: the reservation is given back', async () => {
      prisma.user.findUnique.mockRejectedValueOnce(
        new Error('connection reset')
      );
      await expect(
        service.login('alice@example.com', 'correct-password')
      ).rejects.toThrow('connection reset');
      expect(redis.store.has(ALICE_LOGIN_KEY)).toBe(false);
    });

    it('does not count the 2FA completion step (the 2FA limits cover it)', async () => {
      for (let i = 0; i < 12; i += 1) {
        expect(await attempt('__2fa_verified__', 'not-a-token')).toBe(
          'INVALID_CREDENTIALS'
        );
      }
      expect(
        [...redis.store.keys()].filter((k) => k.startsWith('authfail:'))
      ).toEqual([]);
    });

    it('fails OPEN when Redis is down (D-1): the sign-in works and a warning is logged', async () => {
      redis.state.down = true;
      expect(await attempt('alice@example.com', 'correct-password')).toBe('OK');
      expect(await attempt('alice@example.com', 'wrong-password')).toBe(
        'INVALID_CREDENTIALS'
      );
      expect(consoleWarn).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the refresh token and issues a fresh access token', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'user-1',
        issued: { rawToken: 'new-raw-token', expiresAt: new Date() },
      });
      prisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.refresh('old-raw-token', {
        ipAddress: '10.0.0.1',
      });

      expect(refreshTokens.rotate).toHaveBeenCalledWith('old-raw-token', {
        ipAddress: '10.0.0.1',
      });
      expect(result.refreshToken).toBe('new-raw-token');
      const claims = await decryptAccessToken(result.accessToken);
      expect(claims.id).toBe('user-1');
    });

    it('refuses a deactivated account and revokes the token it just rotated in (F21)', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: 'user-1',
        issued: { rawToken: 'new-raw-token', expiresAt: new Date() },
      });
      prisma.user.findUnique.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.refresh('old-raw-token')).rejects.toMatchObject({
        code: 'ACCOUNT_DEACTIVATED',
      });
      expect(refreshTokens.revokeByRawToken).toHaveBeenCalledWith(
        'new-raw-token'
      );
    });

    // CODE-02A (WS-4)
    describe('session version and sign-in time', () => {
      const HOUR_MS = 3600 * 1000;
      const rotated = (sessionStartedAt: Date | null) => ({
        userId: 'user-1',
        issued: { rawToken: 'new-raw-token', expiresAt: new Date() },
        sessionStartedAt,
      });

      it('mints the access token with the CURRENT database sessionVersion, not the one of the old token', async () => {
        refreshTokens.rotate.mockResolvedValue(rotated(new Date()));
        prisma.user.findUnique.mockResolvedValue(
          makeUser({ sessionVersion: 4 })
        );

        const result = await service.refresh('old-raw-token');

        const claims = await decryptAccessToken(result.accessToken);
        expect(claims['sessionVersion']).toBe(4);
      });

      it('sets authTime to the start of the session the refresh token carries, not to now', async () => {
        const started = new Date(Date.now() - 5 * HOUR_MS);
        refreshTokens.rotate.mockResolvedValue(rotated(started));
        prisma.user.findUnique.mockResolvedValue(makeUser());

        const result = await service.refresh('old-raw-token');

        const claims = await decryptAccessToken(result.accessToken);
        expect(claims['authTime']).toBe(Math.floor(started.getTime() / 1000));
      });

      it('leaves authTime out for a token whose session start is unknown, and still refreshes a USER', async () => {
        refreshTokens.rotate.mockResolvedValue(rotated(null));
        prisma.user.findUnique.mockResolvedValue(makeUser());

        const result = await service.refresh('old-raw-token');

        const claims = await decryptAccessToken(result.accessToken);
        expect(claims['authTime']).toBeUndefined();
        expect(result.refreshToken).toBe('new-raw-token');
      });

      it('refuses to rotate for an ADMIN who signed in 13 hours ago, and revokes the token it just issued', async () => {
        refreshTokens.rotate.mockResolvedValue(
          rotated(new Date(Date.now() - 13 * HOUR_MS))
        );
        prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));

        await expect(service.refresh('old-raw-token')).rejects.toBeInstanceOf(
          ExpiredTokenError
        );
        expect(refreshTokens.revokeByRawToken).toHaveBeenCalledWith(
          'new-raw-token'
        );
      });

      it('refuses to rotate for an ADMIN whose session start is unknown (D-5: sign in once more)', async () => {
        refreshTokens.rotate.mockResolvedValue(rotated(null));
        prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));

        await expect(service.refresh('old-raw-token')).rejects.toBeInstanceOf(
          ExpiredTokenError
        );
        expect(refreshTokens.revokeByRawToken).toHaveBeenCalledWith(
          'new-raw-token'
        );
      });

      it('rotates for an ADMIN who signed in 11 hours ago, and for a USER whose session is 13 hours old', async () => {
        refreshTokens.rotate.mockResolvedValue(
          rotated(new Date(Date.now() - 11 * HOUR_MS))
        );
        prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'ADMIN' }));
        await expect(service.refresh('old-raw-token')).resolves.toMatchObject({
          refreshToken: 'new-raw-token',
        });

        refreshTokens.rotate.mockResolvedValue(
          rotated(new Date(Date.now() - 13 * HOUR_MS))
        );
        prisma.user.findUnique.mockResolvedValue(makeUser({ role: 'USER' }));
        await expect(service.refresh('old-raw-token')).resolves.toMatchObject({
          refreshToken: 'new-raw-token',
        });
      });

      it('reads the user with the sessionVersion column named', async () => {
        refreshTokens.rotate.mockResolvedValue(rotated(new Date()));
        prisma.user.findUnique.mockResolvedValue(makeUser());

        await service.refresh('old-raw-token');

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-1' },
          select: expect.objectContaining({ sessionVersion: true, role: true }),
        });
      });
    });
  });

  describe('logout', () => {
    it('delegates to RefreshTokenService.revokeByRawToken', async () => {
      await service.logout('some-raw-token');
      expect(refreshTokens.revokeByRawToken).toHaveBeenCalledWith(
        'some-raw-token'
      );
    });
  });
});
