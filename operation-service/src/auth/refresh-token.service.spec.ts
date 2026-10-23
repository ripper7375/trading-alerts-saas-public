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

    // CODE-02A: a refresh token is the only thing that survives a rotation, so it carries the
    // time the person signed in (the ADMIN 12 h rule and the `authTime` claim need it).
    it('stamps sessionStartedAt with the login time when none is given', async () => {
      const before = Date.now();
      await service.issue('user-1');

      const { sessionStartedAt } =
        prisma.refreshToken.create.mock.calls[0][0].data;
      expect(sessionStartedAt).toBeInstanceOf(Date);
      expect(sessionStartedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(sessionStartedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('stores the session start it is given, not the time of the rotation', async () => {
      const started = new Date('2026-10-01T08:00:00.000Z');
      await service.issue('user-1', {}, started);

      expect(
        prisma.refreshToken.create.mock.calls[0][0].data.sessionStartedAt
      ).toBe(started);
    });

    it('stores NULL when the session start is unknown (a token from before the column)', async () => {
      await service.issue('user-1', {}, null);

      expect(
        prisma.refreshToken.create.mock.calls[0][0].data.sessionStartedAt
      ).toBeNull();
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

    it('hands back the session start the token was issued under (CODE-02A)', async () => {
      const started = new Date('2026-10-01T08:00:00.000Z');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        sessionStartedAt: started,
      });

      await expect(service.validate('raw-token')).resolves.toEqual({
        id: 'rt-1',
        userId: 'user-1',
        sessionStartedAt: started,
      });
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

    it('carries the session start of the old token onto the new one and hands it back (CODE-02A)', async () => {
      const started = new Date('2026-10-01T08:00:00.000Z');
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        sessionStartedAt: started,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate('old-raw-token');

      expect(result.sessionStartedAt).toEqual(started);
      expect(
        prisma.refreshToken.create.mock.calls[0][0].data.sessionStartedAt
      ).toEqual(started);
    });

    it('keeps an unknown session start unknown: a rotation never invents a login time', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        sessionStartedAt: null,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.rotate('old-raw-token');

      expect(result.sessionStartedAt).toBeNull();
      expect(
        prisma.refreshToken.create.mock.calls[0][0].data.sessionStartedAt
      ).toBeNull();
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
