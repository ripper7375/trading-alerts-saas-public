import hkdf from '@panva/hkdf';
import bcrypt from 'bcryptjs';
import { jwtDecrypt } from 'jose';
import jwt from 'jsonwebtoken';

import { PrismaService } from '../prisma/prisma.service';

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

describe('AuthService', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalNodeEnv = process.env['NODE_ENV'];

  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
  };
  let refreshTokens: {
    issue: jest.Mock;
    validate: jest.Mock;
    rotate: jest.Mock;
    revokeByRawToken: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
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
    service = new AuthService(
      prisma as unknown as PrismaService,
      refreshTokens as unknown as RefreshTokenService
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
        const decoded = jwt.verify(
          twoFactorError.twoFactorToken,
          TEST_SECRET
        ) as {
          userId: string;
          purpose: string;
        };
        expect(decoded.userId).toBe('user-1');
        expect(decoded.purpose).toBe('2fa_verification');
      }
      expect(refreshTokens.issue).not.toHaveBeenCalled();
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

    it('completes login via the __2fa_verified__ sentinel with a valid temp token', async () => {
      const twoFactorToken = jwt.sign(
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

      const result = await service.login('__2fa_verified__', twoFactorToken);

      expect(result.user.id).toBe('user-1');
      expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
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
