import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { ExpiredTokenError, InvalidTokenError } from './errors';
import { RefreshTokenService } from './refresh-token.service';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('RefreshTokenService', () => {
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let service: RefreshTokenService;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new RefreshTokenService(prisma as unknown as PrismaService);
  });

  describe('issue', () => {
    it('stores only the SHA-256 hash, never the raw token, and returns the raw token once', async () => {
      const result = await service.issue('user-1', {
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      });

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.refreshToken.create.mock.calls[0][0];
      expect(createArgs.data.userId).toBe('user-1');
      expect(createArgs.data.userAgent).toBe('jest');
      expect(createArgs.data.ipAddress).toBe('127.0.0.1');
      expect(createArgs.data.hashedToken).toBe(sha256(result.rawToken));
      expect(createArgs.data.hashedToken).not.toBe(result.rawToken);
      expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('validate', () => {
    it('accepts a live, unexpired, unrevoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.validate('raw-token');
      expect(result).toEqual({ id: 'rt-1', userId: 'user-1' });
    });

    it('rejects a token that does not exist (never returns null silently)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.validate('nope')).rejects.toThrow(InvalidTokenError);
    });

    it('rejects a revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      await expect(service.validate('raw-token')).rejects.toThrow(
        InvalidTokenError
      );
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });
      await expect(service.validate('raw-token')).rejects.toThrow(
        ExpiredTokenError
      );
    });
  });

  describe('revokeByRawToken', () => {
    it('is idempotent — only revokes if not already revoked, never throws if missing', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await expect(service.revokeByRawToken('raw')).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { hashedToken: sha256('raw'), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('rotate', () => {
    it('validates, revokes the old token, and issues a new one for the same user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate('old-raw-token');

      expect(result.userId).toBe('user-1');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.issued.rawToken).not.toBe('old-raw-token');
    });

    it('does not issue a new token if the presented one is invalid', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.rotate('bad-token')).rejects.toThrow(
        InvalidTokenError
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });
});
