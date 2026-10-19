import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { sendAccountDeletionEmail } from '../email/email.util';
import { UsersService } from './users.service';

jest.mock('../email/email.util', () => ({
  sendPasswordChangedEmail: jest.fn().mockResolvedValue({ success: true }),
  sendAccountDeletionEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../security/geo-location.util', () => ({
  getGeoLocation: jest.fn().mockResolvedValue({
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
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    userPreferences: { findUnique: jest.fn(), upsert: jest.fn() },
    userSession: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    session: { deleteMany: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    loginHistory: { findMany: jest.fn(), count: jest.fn() },
    securityAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
    accountDeletionRequest: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    // Interactive transaction: the callback gets the same mock as its client.
    $transaction: jest.fn(),
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
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma)
    );
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

    it('throws NotFoundException when the user is missing and no email fallback is given', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(makeService().getProfile('user-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });

    // F58 (DECISION-LOG.md): resolveUserId's email fallback.
    it('falls back to an email lookup when the id lookup misses', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // resolveUserId's id lookup
        .mockResolvedValueOnce({ id: 'user-1' }) // resolveUserId's email lookup
        .mockResolvedValueOnce({
          id: 'user-1',
          name: 'A',
          email: 'a@b.com',
          image: null,
          tier: 'PRO',
          role: 'USER',
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }); // getProfile's own lookup

      const result = await makeService().getProfile('user-1', 'a@b.com');
      expect(result.user.email).toBe('a@b.com');
      expect(mockPrisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'a@b.com' },
        select: { id: true },
      });
    });

    it('throws NotFoundException when both id and email lookups miss', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        makeService().getProfile('user-1', 'nobody@b.com')
      ).rejects.toBeInstanceOf(NotFoundException);
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
      expect(result.preferences.language).toBe('en-GB');
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

  describe('getSecurityAlerts', () => {
    it('returns alerts scoped to the caller with pagination', async () => {
      mockPrisma.securityAlert.findMany.mockResolvedValue([
        { id: 'alert-1', type: 'PASSWORD_CHANGED' },
      ]);
      mockPrisma.securityAlert.count.mockResolvedValue(1);

      const result = await makeService().getSecurityAlerts('user-1', 20, 0);

      expect(mockPrisma.securityAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } })
      );
      expect(result.pagination).toEqual({
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    });
  });

  describe('markSecurityAlertRead', () => {
    it('throws NotFoundException for a non-existent or non-owned alert', async () => {
      mockPrisma.securityAlert.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.securityAlert.findFirst.mockResolvedValue(null);

      await expect(
        makeService().markSecurityAlertRead('user-1', 'alert-1')
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns alreadyRead without rewriting readAt when already read', async () => {
      mockPrisma.securityAlert.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.securityAlert.findFirst.mockResolvedValue({ id: 'alert-1' });

      const result = await makeService().markSecurityAlertRead(
        'user-1',
        'alert-1'
      );
      expect(result).toEqual({
        success: true,
        alreadyRead: true,
        message: 'Security alert was already marked as read',
      });
    });

    it('marks an unread alert read, scoped to the caller', async () => {
      mockPrisma.securityAlert.updateMany.mockResolvedValue({ count: 1 });

      const result = await makeService().markSecurityAlertRead(
        'user-1',
        'alert-1'
      );
      expect(mockPrisma.securityAlert.updateMany).toHaveBeenCalledWith({
        where: { id: 'alert-1', userId: 'user-1', read: false },
        data: expect.objectContaining({ read: true }),
      });
      expect(result).toEqual({
        success: true,
        alreadyRead: false,
        message: 'Security alert marked as read',
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
        { ipAddress: '1.2.3.4' },
        undefined
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

    describe('token hygiene and the confirmation email', () => {
      const ORIGINAL_NEXTAUTH_URL = process.env['NEXTAUTH_URL'];
      const sendEmailMock = sendAccountDeletionEmail as jest.Mock;
      let loggerLog: jest.SpyInstance;
      let loggerWarn: jest.SpyInstance;
      let loggerError: jest.SpyInstance;
      let consoleLog: jest.SpyInstance;
      let consoleError: jest.SpyInstance;

      /** Everything any log channel received, as one string. */
      function everythingLogged(): string {
        return JSON.stringify([
          loggerLog.mock.calls,
          loggerWarn.mock.calls,
          loggerError.mock.calls,
          consoleLog.mock.calls,
          consoleError.mock.calls,
        ]);
      }

      function issuedToken(): string {
        return mockPrisma.accountDeletionRequest.create.mock.calls[0][0].data
          .token as string;
      }

      beforeEach(() => {
        process.env['NEXTAUTH_URL'] = 'https://app.example.test';
        mockPrisma.accountDeletionRequest.findFirst.mockResolvedValue(null);
        mockPrisma.accountDeletionRequest.create.mockResolvedValue({
          id: 'req-9',
        });
        mockPrisma.user.findUnique.mockResolvedValue({
          email: 'private.person@example.test',
          name: 'Alice',
        });
        sendEmailMock.mockResolvedValue({ success: true });
        loggerLog = jest
          .spyOn(Logger.prototype, 'log')
          .mockImplementation(() => undefined);
        loggerWarn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        loggerError = jest
          .spyOn(Logger.prototype, 'error')
          .mockImplementation(() => undefined);
        consoleLog = jest
          .spyOn(console, 'log')
          .mockImplementation(() => undefined);
        consoleError = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);
      });

      afterEach(() => {
        jest.restoreAllMocks();
        if (ORIGINAL_NEXTAUTH_URL === undefined) {
          delete process.env['NEXTAUTH_URL'];
        } else {
          process.env['NEXTAUTH_URL'] = ORIGINAL_NEXTAUTH_URL;
        }
      });

      it('logs only the user id, request id and expiry', async () => {
        await makeService().requestDeletion('user-1');

        const created = mockPrisma.accountDeletionRequest.create.mock
          .calls[0][0].data.expiresAt as Date;
        expect(loggerLog).toHaveBeenCalledTimes(1);
        expect(loggerLog).toHaveBeenCalledWith('Account deletion requested', {
          userId: 'user-1',
          requestId: 'req-9',
          expiresAt: created,
        });
      });

      it('never writes the token, either link or the address to any log', async () => {
        await makeService().requestDeletion('user-1');

        const logged = everythingLogged();
        const token = issuedToken();
        expect(token).toMatch(/^[0-9a-f]{64}$/);
        expect(logged).not.toContain(token);
        expect(logged).not.toContain('confirm?token');
        expect(logged).not.toContain('cancel?token');
        expect(logged).not.toContain('private.person@example.test');
        expect(consoleLog).not.toHaveBeenCalled();
      });

      it('sends the address, the name and both links, and the expiry', async () => {
        await makeService().requestDeletion('user-1');

        const token = issuedToken();
        const expiresAt = mockPrisma.accountDeletionRequest.create.mock
          .calls[0][0].data.expiresAt as Date;
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
        expect(sendEmailMock).toHaveBeenCalledWith(
          'private.person@example.test',
          'Alice',
          `https://app.example.test/settings/account/delete/confirm?token=${token}`,
          `https://app.example.test/settings/account/delete/cancel?token=${token}`,
          expiresAt
        );
      });

      it('passes a missing name through as null (the e-mail helper greets "User")', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
          email: 'private.person@example.test',
          name: null,
        });

        await makeService().requestDeletion('user-1');

        expect(sendEmailMock.mock.calls[0][1]).toBeNull();
      });

      it('still succeeds, and logs without the secrets, when the send reports a failure', async () => {
        sendEmailMock.mockResolvedValue({
          success: false,
          error: 'Email service not configured',
        });

        await expect(makeService().requestDeletion('user-1')).resolves.toEqual(
          expect.objectContaining({ success: true, requestId: 'req-9' })
        );

        expect(loggerError).toHaveBeenCalledWith(
          'Failed to send account deletion email',
          {
            userId: 'user-1',
            requestId: 'req-9',
            error: 'Email service not configured',
          }
        );
        const logged = everythingLogged();
        expect(logged).not.toContain(issuedToken());
        expect(logged).not.toContain('private.person@example.test');
      });

      it('still succeeds when the sender throws', async () => {
        sendEmailMock.mockRejectedValue(new Error('network down'));

        await expect(makeService().requestDeletion('user-1')).resolves.toEqual(
          expect.objectContaining({ success: true })
        );

        expect(loggerError).toHaveBeenCalledWith(
          'Failed to send account deletion email',
          expect.objectContaining({ error: 'network down' })
        );
      });

      it('still succeeds when the user lookup throws, and sends nothing', async () => {
        mockPrisma.user.findUnique.mockRejectedValue(new Error('db blip'));

        await expect(makeService().requestDeletion('user-1')).resolves.toEqual(
          expect.objectContaining({ success: true })
        );

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(loggerError).toHaveBeenCalled();
      });

      it('sends nothing, and warns, when the account has no address', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
          email: null,
          name: 'Alice',
        });

        await makeService().requestDeletion('user-1');

        expect(sendEmailMock).not.toHaveBeenCalled();
        expect(loggerWarn).toHaveBeenCalledWith(
          'Account deletion email not sent: no address',
          { userId: 'user-1', requestId: 'req-9' }
        );
      });
    });
  });

  describe('confirmDeletion', () => {
    const pendingRequest = () => ({
      id: 'req-1',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'user-1',
    });

    function wonClaim() {
      mockPrisma.accountDeletionRequest.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.userSession.updateMany.mockResolvedValue({ count: 2 });
    }

    it('is callable without a userId (unauthenticated, token-only)', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(
        pendingRequest()
      );
      wonClaim();

      const result = await makeService().confirmDeletion('tok-1');
      expect(result.success).toBe(true);
      expect(result.scheduledDeletionTime).toBeInstanceOf(Date);
    });

    it('schedules the deletion 24 h after the confirmation it stored', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(
        pendingRequest()
      );
      wonClaim();

      const result = await makeService().confirmDeletion('tok-1');

      const claim = mockPrisma.accountDeletionRequest.updateMany.mock
        .calls[0][0] as { data: { confirmedAt: Date } };
      expect(result.scheduledDeletionTime.getTime()).toBe(
        claim.data.confirmedAt.getTime() + 24 * 60 * 60 * 1000
      );
    });

    it('flips PENDING to CONFIRMED, deactivates the user and signs out every device in one transaction', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(
        pendingRequest()
      );
      wonClaim();

      await makeService().confirmDeletion('tok-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.accountDeletionRequest.updateMany).toHaveBeenCalledWith(
        {
          where: { id: 'req-1', status: 'PENDING' },
          data: { status: 'CONFIRMED', confirmedAt: expect.any(Date) },
        }
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isActive: false },
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.userSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true },
        data: { isActive: false },
      });
    });

    it('changes nothing when another click already won the claim', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(
        pendingRequest()
      );
      mockPrisma.accountDeletionRequest.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        makeService().confirmDeletion('tok-1')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a request that is already CONFIRMED without touching the account', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
        ...pendingRequest(),
        status: 'CONFIRMED',
      });

      await expect(
        makeService().confirmDeletion('tok-1')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not log the address or the token', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue(
        pendingRequest()
      );
      wonClaim();
      const loggerLog = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const consoleLog = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      await makeService().confirmDeletion('secret-token-value');

      const everything = JSON.stringify([
        loggerLog.mock.calls,
        consoleLog.mock.calls,
      ]);
      expect(everything).not.toContain('secret-token-value');
      expect(everything).not.toContain('@');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      loggerLog.mockRestore();
      consoleLog.mockRestore();
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
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('cancelDeletion', () => {
    it('throws UnauthorizedException with neither a token nor a userId', async () => {
      await expect(
        makeService().cancelDeletion(undefined, undefined)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    const HOUR = 60 * 60 * 1000;

    function flipWon(confirmedAtAfterFlip: Date | null) {
      mockPrisma.accountDeletionRequest.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        confirmedAt: confirmedAtAfterFlip,
      });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    }

    it('cancels by session userId when no token is given', async () => {
      mockPrisma.accountDeletionRequest.findFirst.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
        status: 'PENDING',
        confirmedAt: null,
      });
      flipWon(null);

      const result = await makeService().cancelDeletion(undefined, 'user-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.accountDeletionRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', status: { in: ['PENDING', 'CONFIRMED'] } },
        })
      );
    });

    it('leaves isActive alone when the request was only PENDING', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'PENDING',
        confirmedAt: null,
      });
      flipWon(null);

      await makeService().cancelDeletion('tok-1', undefined);

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('cancels a CONFIRMED request inside the grace period and gives the account back', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        confirmedAt: new Date(Date.now() - 2 * HOUR),
      });
      flipWon(new Date(Date.now() - 2 * HOUR));

      const result = await makeService().cancelDeletion('tok-1', undefined);

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.accountDeletionRequest.updateMany).toHaveBeenCalledWith(
        {
          where: {
            id: 'req-1',
            OR: [
              { status: 'PENDING' },
              { status: 'CONFIRMED', confirmedAt: { gt: expect.any(Date) } },
            ],
          },
          data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
        }
      );
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
        data: { isActive: true },
      });
    });

    it('still gives the account back when a confirm landed between the read and the flip', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'PENDING',
        confirmedAt: null,
      });
      flipWon(new Date());

      await makeService().cancelDeletion('tok-1', undefined);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', deletedAt: null },
        data: { isActive: true },
      });
    });

    it('refuses once the 24 h grace period is over and touches nothing', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        confirmedAt: new Date(Date.now() - 25 * HOUR),
      });

      await expect(
        makeService().cancelDeletion('tok-1', undefined)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the conditional flip loses (the worker took the request first)', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'CONFIRMED',
        confirmedAt: new Date(Date.now() - 23.99 * HOUR),
      });
      mockPrisma.accountDeletionRequest.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        makeService().cancelDeletion('tok-1', undefined)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
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

    it('rejects cancelling a COMPLETED request', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        userId: 'user-1',
        status: 'COMPLETED',
      });

      await expect(
        makeService().cancelDeletion('tok-1', undefined)
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not log the address', async () => {
      mockPrisma.accountDeletionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        userId: 'user-1',
        status: 'PENDING',
        confirmedAt: null,
      });
      flipWon(null);
      const loggerLog = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);
      const consoleLog = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);

      await makeService().cancelDeletion('tok-1', undefined);

      expect(
        JSON.stringify([loggerLog.mock.calls, consoleLog.mock.calls])
      ).not.toContain('@');
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      loggerLog.mockRestore();
      consoleLog.mockRestore();
    });
  });
});
