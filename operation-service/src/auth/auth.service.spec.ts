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
  InvalidCredentialsError,
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
    emailVerified: new Date('2026-01-01'),
    twoFactorEnabled: false,
    verificationToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** An in-memory stand-in for the Redis the 2FA markers live in (SET ... EX ... NX only). */
function makeRedis() {
  const store = new Map<string, { ttl: number | null }>();
  const state = { down: false };
  const client = {
    set: jest.fn(async (key: string, _value: string, ...args: unknown[]) => {
      if (state.down) throw new Error('redis down');
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, { ttl: args[0] === 'EX' ? (args[1] as number) : null });
      return 'OK';
    }),
  };
  return {
    service: { getClient: () => client } as unknown as RedisService,
    client,
    store,
    state,
  };
}

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
      expect(refreshTokens.issue).toHaveBeenCalledWith('user-1', {
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      });
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
