import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { UsersService } from './users.service';

jest.mock('../email/email.util', () => ({
  sendPasswordChangedEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../security/geo-location.util', () => ({
  getGeoLocation: jest
    .fn()
    .mockResolvedValue({
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
    }),
  formatLocation: jest.fn().mockReturnValue('Unknown location'),
}));

// DI-based construction (mocked PrismaService/TwoFactorService), matching
// the established Session 4B-2/4B-5/4B-8 convention for this service.
describe('UsersService', () => {
  const mockPrisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    userPreferences: { findUnique: jest.fn(), upsert: jest.fn() },
    userSession: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    session: { deleteMany: jest.fn() },
    loginHistory: { findMany: jest.fn(), count: jest.fn() },
    securityAlert: { create: jest.fn() },
    accountDeletionRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockTwoFactorService = {
    getStatus: jest.fn(),
    setup: jest.fn(),
    verifySetup: jest.fn(),
    verify: jest.fn(),
    getBackupCodesStatus: jest.fn(),
    regenerateBackupCodes: jest.fn(),
    disable: jest.fn(),
  };

  function makeService() {
    return new UsersService(mockPrisma as never, mockTwoFactorService as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns the user with a boolean emailVerified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'A',
        email: 'a@b.com',
        image: null,
        tier: 'PRO',
        role: 'USER',
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await makeService().getProfile('user-1');
      expect(result.user.emailVerified).toBe(true);
    });

    it('throws NotFoundException when the user is missing', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(makeService().getProfile('user-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('updateProfile', () => {
    it('throws ConflictException when the new email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user' });

      await expect(
        makeService().updateProfile('user-1', 'old@b.com', {
          email: 'taken@b.com',
        })
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('skips the email-collision check when email is unchanged', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        emailVerified: null,
      });

      await makeService().updateProfile('user-1', 'same@b.com', {
        email: 'same@b.com',
        name: 'New Name',
      });

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'New Name', email: 'same@b.com' },
        })
      );
    });
  });

  describe('getPreferences', () => {
    it('merges stored preferences with defaults', async () => {
      mockPrisma.userPreferences.findUnique.mockResolvedValue({
        preferences: { theme: 'dark' },
      });

      const result = await makeService().getPreferences('user-1');
      expect(result.preferences.theme).toBe('dark');
      expect(result.preferences.language).toBe('en-US');
    });

    it('returns bare defaults on a lookup error, not a throw', async () => {
      mockPrisma.userPreferences.findUnique.mockRejectedValue(
        new Error('db down')
      );
      const result = await makeService().getPreferences('user-1');
      expect(result.preferences.theme).toBe('system');
    });
  });

  describe('changePassword', () => {
    it('throws BadRequestException for OAuth-only accounts (no password)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        password: null,
      });

      await expect(
        makeService().changePassword('user-1', {
          currentPassword: 'x',
          newPassword: 'Newpass1',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws UnauthorizedException on an incorrect current password', async () => {
      const hashed = await bcrypt.hash('correct', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        password: hashed,
      });

      await expect(
        makeService().changePassword('user-1', {
          currentPassword: 'wrong',
          newPassword: 'Newpass1',
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws BadRequestException when the new password matches the old one', async () => {
      const hashed = await bcrypt.hash('Samepass1', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        password: hashed,
      });

      await expect(
        makeService().changePassword('user-1', {
          currentPassword: 'Samepass1',
          newPassword: 'Samepass1',
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates the password and returns success on a valid change', async () => {
      const hashed = await bcrypt.hash('Oldpass1', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        name: 'A',
        password: hashed,
      });
      mockPrisma.userPreferences.findUnique.mockResolvedValue(null);

      const result = await makeService().changePassword('user-1', {
        currentPassword: 'Oldpass1',
        newPassword: 'Newpass1',
      });

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } })
      );
    });
  });

  describe('revokeSession', () => {
    it('throws NotFoundException when nothing was revoked', async () => {
      mockPrisma.userSession.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.userSession.findUnique.mockResolvedValue(null);

      await expect(
        makeService().revokeSession('session-1', 'user-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('also deletes the linked NextAuth session on success', async () => {
      mockPrisma.userSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.userSession.findUnique.mockResolvedValue({
        sessionToken: 'tok-1',
      });

      const result = await makeService().revokeSession('session-1', 'user-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { sessionToken: 'tok-1' },
      });
    });
  });

  describe('2FA delegation', () => {
    it('verify2FA delegates to TwoFactorService.verify without a userId', async () => {
      mockTwoFactorService.verify.mockResolvedValue({ success: true });
      await makeService().verify2FA('123456', 'tmp-token');
      expect(mockTwoFactorService.verify).toHaveBeenCalledWith(
        '123456',
        'tmp-token'
      );
    });

    it('disable2FA forwards ipAddress as context', async () => {
      mockTwoFactorService.disable.mockResolvedValue({ success: true });
      await makeService().disable2FA('user-1', 'pw', '123456', '1.2.3.4');
      expect(mockTwoFactorService.disable).toHaveBeenCalledWith(
        'user-1',
        'pw',
        '123456',
        { ipAddress: '1.2.3.4' }
      );
    });
  });

  describe('requestDeletion', () => {
    it('throws BadRequestException with the existing request id when one is pending', async () => {
      mockPrisma.accountDeletionRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        expiresAt: new Date(),
      });

      await expect(
        makeService().requestDeletion('user-1')
      ).rejects.toMatchObject({
        response: expect.objectContaining({ requestId: 'req-1' }),
      });
      expect(mockPrisma.accountDeletionRequest.create).not.toHaveBeenCalled();
    });

    it('creates a 7-day token-based request when none is pending', async () => {
      mockPrisma.accountDeletionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.accountDeletionRequest.create.mockResolvedValue({
        id: 'req-2',
      });
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@b.com' });

      await makeService().requestDeletion('user-1');

      const createCall =
        mockPrisma.accountDeletionRequest.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const diffDays =
        (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(6.9);
      expect(diffDays).toBeLessThan(7.1);
    });
  });

  describe('confirmDeletion', () => {
    it('is callable without a userId (unauthenticated, token-only)', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
        userId: 'user-1',
      });
      mockPrisma.accountDeletionRequest.update.mockResolvedValue({
        id: 'req-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@b.com' });

      const result = await makeService().confirmDeletion('tok-1');
      expect(result.success).toBe(true);
      expect(result.scheduledDeletionTime).toBeInstanceOf(Date);
    });

    it('throws NotFoundException for an unknown token', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(null);
      await expect(
        makeService().confirmDeletion('bad-tok')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('expires a stale PENDING request instead of confirming it', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      });
      mockPrisma.accountDeletionRequest.update.mockResolvedValue({});

      await expect(
        makeService().confirmDeletion('tok-1')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.accountDeletionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'EXPIRED' },
      });
    });
  });

  describe('cancelDeletion', () => {
    it('throws UnauthorizedException with neither a token nor a userId', async () => {
      await expect(
        makeService().cancelDeletion(undefined, undefined)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('cancels by session userId when no token is given', async () => {
      mockPrisma.accountDeletionRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
        status: 'PENDING',
      });
      mockPrisma.accountDeletionRequest.update.mockResolvedValue({
        id: 'req-1',
      });
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'a@b.com' });

      const result = await makeService().cancelDeletion(undefined, 'user-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.accountDeletionRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: { in: ['PENDING', 'CONFIRMED'] } },
        })
      );
    });

    it('rejects cancelling an already-cancelled request', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
        status: 'CANCELLED',
      });

      await expect(
        makeService().cancelDeletion('tok-1', undefined)
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
