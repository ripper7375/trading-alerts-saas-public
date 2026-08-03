import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';

import { PrismaService } from '../prisma/prisma.service';
import * as twoFactorUtil from '../two-factor/two-factor.util';

jest.mock('../email/email.util', () => ({
  sendTwoFactorEnabledEmail: jest.fn().mockResolvedValue({ success: true }),
  sendTwoFactorDisabledEmail: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../security/geo-location.util', () => ({
  getGeoLocation: jest.fn().mockResolvedValue({
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
  }),
  formatLocation: jest.fn().mockReturnValue('Unknown location'),
}));

import { TwoFactorService } from './two-factor.service';

const TEST_SECRET = 'test-nextauth-secret-value-not-real';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    password: null,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
    twoFactorVerifiedAt: null,
    ...overrides,
  };
}

describe('TwoFactorService', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalEncryptionKey = process.env['TWO_FACTOR_ENCRYPTION_KEY'];

  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    securityAlert: { create: jest.Mock };
  };
  let service: TwoFactorService;

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    process.env['TWO_FACTOR_ENCRYPTION_KEY'] = 'test-encryption-key-not-real';
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      securityAlert: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new TwoFactorService(prisma as unknown as PrismaService);
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
    process.env['TWO_FACTOR_ENCRYPTION_KEY'] = originalEncryptionKey;
  });

  describe('setup', () => {
    it('rejects when 2FA is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true })
      );
      await expect(service.setup('user-1')).rejects.toThrow(
        BadRequestException
      );
    });

    it('generates and stores an encrypted secret without enabling 2FA yet', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      const result = await service.setup('user-1');

      expect(result.success).toBe(true);
      expect(result.secret).toEqual(expect.any(String));
      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);

      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.twoFactorSecret).toEqual(expect.any(String));
      expect(updateArgs.data.twoFactorSecret).not.toBe(result.secret);
      expect(updateArgs.data.twoFactorEnabled).toBeUndefined();
    });

    // F58 (DECISION-LOG.md): resolveUserId's email fallback.
    it('falls back to an email lookup when the id lookup misses', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // resolveUserId's id lookup
        .mockResolvedValueOnce({ id: 'user-1' }) // resolveUserId's email lookup
        .mockResolvedValueOnce(makeUser()); // setup()'s own lookup

      const result = await service.setup('user-1', 'alice@example.com');
      expect(result.success).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, {
        where: { email: 'alice@example.com' },
        select: { id: true },
      });
    });

    it('throws NotFoundException when both id and email lookups miss', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.setup('user-1', 'nobody@example.com')
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('verifySetup', () => {
    it('rejects an invalid TOTP code', async () => {
      const encrypted = twoFactorUtil.encryptSecret(
        twoFactorUtil.generateTOTPSecret()
      );
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorSecret: encrypted })
      );
      await expect(service.verifySetup('user-1', '000000')).rejects.toThrow(
        BadRequestException
      );
    });

    it('enables 2FA and returns backup codes for a valid code', async () => {
      const secret = twoFactorUtil.generateTOTPSecret();
      const encrypted = twoFactorUtil.encryptSecret(secret);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorSecret: encrypted })
      );
      const validCode = authenticator.generate(secret);

      const result = await service.verifySetup('user-1', validCode, {
        ipAddress: '127.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data.twoFactorEnabled).toBe(true);
      expect(updateArgs.data.twoFactorVerifiedAt).toBeInstanceOf(Date);
      expect(prisma.securityAlert.create).toHaveBeenCalled();
    });
  });

  describe('verify (login-time, unauthenticated)', () => {
    it('rejects an invalid/expired temp token', async () => {
      await expect(service.verify('123456', 'not-a-jwt')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejects when the user has no 2FA enabled', async () => {
      const token = jwt.sign({ userId: 'user-1' }, TEST_SECRET, {
        expiresIn: '5m',
      });
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: false })
      );
      await expect(service.verify('123456', token)).rejects.toThrow(
        BadRequestException
      );
    });

    it('verifies a valid TOTP code', async () => {
      const secret = twoFactorUtil.generateTOTPSecret();
      const encrypted = twoFactorUtil.encryptSecret(secret);
      const token = jwt.sign({ userId: 'user-1' }, TEST_SECRET, {
        expiresIn: '5m',
      });
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true, twoFactorSecret: encrypted })
      );
      const validCode = authenticator.generate(secret);

      const result = await service.verify(validCode, token);
      expect(result).toEqual({
        success: true,
        verified: true,
        method: 'totp',
      });
    });

    it('verifies a valid backup code and marks it used', async () => {
      const secret = twoFactorUtil.generateTOTPSecret();
      const encrypted = twoFactorUtil.encryptSecret(secret);
      const { plainCodes, hashedCodes } =
        await twoFactorUtil.generateBackupCodes();
      const token = jwt.sign({ userId: 'user-1' }, TEST_SECRET, {
        expiresIn: '5m',
      });
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: encrypted,
          twoFactorBackupCodes: JSON.stringify(hashedCodes),
        })
      );

      const result = await service.verify(plainCodes[0]!, token);
      expect(result.method).toBe('backup_code');
      expect(
        (result as { remainingBackupCodes: number }).remainingBackupCodes
      ).toBe(9);

      const updateArgs = prisma.user.update.mock.calls[0][0];
      const storedCodes: string[] = JSON.parse(
        updateArgs.data.twoFactorBackupCodes
      );
      expect(storedCodes[0]).toBe('');
    });
  });

  describe('disable', () => {
    it('rejects an incorrect password', async () => {
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: true, password: hashed })
      );
      await expect(
        service.disable('user-1', 'wrong-password', '123456')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('disables 2FA and clears all related fields on success', async () => {
      const secret = twoFactorUtil.generateTOTPSecret();
      const encrypted = twoFactorUtil.encryptSecret(secret);
      const hashed = await bcrypt.hash('correct-password', 10);
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: encrypted,
          password: hashed,
        })
      );
      const validCode = authenticator.generate(secret);

      const result = await service.disable(
        'user-1',
        'correct-password',
        validCode,
        { ipAddress: '127.0.0.1' }
      );

      expect(result.success).toBe(true);
      const updateArgs = prisma.user.update.mock.calls[0][0];
      expect(updateArgs.data).toEqual({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
      });
      expect(prisma.securityAlert.create).toHaveBeenCalled();
    });
  });

  describe('getStatus / getBackupCodesStatus', () => {
    it('getStatus throws NotFoundException for a missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('missing')).rejects.toThrow(
        NotFoundException
      );
    });

    it('getBackupCodesStatus counts only unused codes', async () => {
      const codes = ['h1', '', 'h2', '', '', 'h3', 'h4', 'h5', 'h6', 'h7'];
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorBackupCodes: JSON.stringify(codes),
        })
      );
      const result = await service.getBackupCodesStatus('user-1');
      expect(result).toEqual({
        enabled: true,
        remainingCodes: 7,
        totalCodes: 10,
      });
    });
  });
});
