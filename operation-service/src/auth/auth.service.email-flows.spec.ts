import bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';

import { AuthService } from './auth.service';
import { ExpiredTokenError, InvalidTokenError } from './errors';
import { RefreshTokenService } from './refresh-token.service';

jest.mock('../email/email.util', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
}));

import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../email/email.util';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    password: null,
    resetToken: null,
    resetTokenExpiry: null,
    verificationToken: null,
    emailVerified: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService — email-dependent flows (Session 3-4, F29)', () => {
  let prisma: {
    user: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as unknown as RefreshTokenService
    );
  });

  describe('forgotPassword', () => {
    it('returns the same generic message whether or not the user exists (anti-enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@example.com');
      expect(result.success).toBe(true);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('stores a reset token and sends the reset email for a real user', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      const result = await service.forgotPassword('alice@example.com');

      expect(result.success).toBe(true);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.resetToken).toEqual(expect.any(String));
      expect(updateArgs.data.resetTokenExpiry).toBeInstanceOf(Date);
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice',
        updateArgs.data.resetToken
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword('bad-token', 'newpassword123')
      ).rejects.toThrow(InvalidTokenError);
    });

    it('rejects an expired token', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ resetTokenExpiry: new Date(Date.now() - 1000) })
      );
      await expect(
        service.resetPassword('expired-token', 'newpassword123')
      ).rejects.toThrow(ExpiredTokenError);
    });

    it('hashes the new password and clears the reset token', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ resetTokenExpiry: new Date(Date.now() + 1000) })
      );
      const result = await service.resetPassword(
        'good-token',
        'newpassword123'
      );

      expect(result.success).toBe(true);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.resetToken).toBeNull();
      expect(updateArgs.data.resetTokenExpiry).toBeNull();
      expect(
        await bcrypt.compare('newpassword123', updateArgs.data.password)
      ).toBe(true);
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown token', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        InvalidTokenError
      );
    });

    it('rate-limits a token younger than 5 seconds (Gmail-preview guard)', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ updatedAt: new Date() })
      );
      await expect(service.verifyEmail('fresh-token')).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number),
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('verifies and sends the welcome email once the token is old enough', async () => {
      prisma.user.findFirst.mockResolvedValue(
        makeUser({ updatedAt: new Date(Date.now() - 6000) })
      );
      const result = await service.verifyEmail('old-token');

      expect(result.success).toBe(true);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.emailVerified).toBeInstanceOf(Date);
      expect(updateArgs.data.verificationToken).toBeNull();
      expect(sendWelcomeEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice'
      );
    });
  });

  describe('resendVerification', () => {
    it('returns the generic message for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.resendVerification('nobody@example.com');
      expect(result.success).toBe(true);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns the generic message for an already-verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ emailVerified: new Date() })
      );
      const result = await service.resendVerification('alice@example.com');
      expect(result.success).toBe(true);
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('rate-limits a resend within 60 seconds of the last one', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ verificationToken: 'existing-token', updatedAt: new Date() })
      );
      await expect(
        service.resendVerification('alice@example.com')
      ).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: expect.any(Number),
      });
      expect(sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('issues a new token and sends the verification email', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          verificationToken: 'stale-token',
          updatedAt: new Date(Date.now() - 61_000),
        })
      );
      const result = await service.resendVerification('alice@example.com');

      expect(result.success).toBe(true);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.verificationToken).toEqual(expect.any(String));
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice',
        updateArgs.data.verificationToken
      );
    });
  });
});
