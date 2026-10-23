import bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../test/account-db-fake';

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

/**
 * An in-memory stand-in for the Redis the e-mail request counters live in (INCR, TTL, EXPIRE,
 * DECR, DEL; CODE-01B).
 */
function makeRedis() {
  const store = new Map<string, { value: string; ttl: number | null }>();
  const state = { down: false };
  const guard = (): void => {
    if (state.down) throw new Error('redis down');
  };
  const client = {
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
    store,
    state,
  };
}

// sha256('alice@example.com'), spelled out: the e-mail part of every account key the monolith's
// direct routes write too (the contract is asserted in auth-throttle.util.spec.ts)
const ALICE_HASH =
  'ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976';

describe('AuthService — email-dependent flows (Session 3-4, F29)', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    refreshToken: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let redis: ReturnType<typeof makeRedis>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      // CODE-02B: a reset and the session-version bump commit together; the callback gets the
      // same delegates as its client (the atomicity itself is shown at the end of this file).
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma)
    );
    redis = makeRedis();
    service = new AuthService(
      prisma as unknown as PrismaService,
      {} as unknown as RefreshTokenService,
      redis.service
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

  // CODE-01B: three requests an hour per e-mail address. A limited request is answered exactly
  // like a normal one, so the limit cannot tell a registered address from an unknown one
  // (checklist 8B-14). The client address is limited in the monolith (this service only sees
  // Vercel's address, D-4).
  describe('request limits (CODE-01B)', () => {
    let consoleWarn: jest.SpyInstance;

    beforeEach(() => {
      consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarn.mockRestore();
    });

    describe('forgotPassword', () => {
      it('sends three reset e-mails an hour to one address; the 4th is answered the same and sends nothing', async () => {
        prisma.user.findUnique.mockResolvedValue(makeUser());

        const results = [];
        for (let i = 0; i < 3; i += 1) {
          results.push(await service.forgotPassword('alice@example.com'));
        }
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
        prisma.user.findUnique.mockClear();

        const fourth = await service.forgotPassword('alice@example.com');
        expect(fourth).toEqual(results[0]);
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(3);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.user.update).toHaveBeenCalledTimes(3);
      });

      it('answers a known and an unknown address with the same result (8B-14)', async () => {
        prisma.user.findUnique.mockResolvedValueOnce(makeUser());
        const known = await service.forgotPassword('alice@example.com');
        prisma.user.findUnique.mockResolvedValueOnce(null);
        const unknown = await service.forgotPassword('nobody@example.com');
        expect(JSON.stringify(known)).toBe(JSON.stringify(unknown));
      });

      it('counts a mixed-case, padded address as the same one, on the key the monolith uses', async () => {
        prisma.user.findUnique.mockResolvedValue(makeUser());
        await service.forgotPassword(' Alice@Example.com ');
        expect(redis.store.get(`authmail:forgot:acct:${ALICE_HASH}`)).toEqual({
          value: '1',
          ttl: 3600,
        });
      });

      it("shares one budget with the monolith's direct route", async () => {
        redis.store.set(`authmail:forgot:acct:${ALICE_HASH}`, {
          value: '3',
          ttl: 1200,
        });
        prisma.user.findUnique.mockResolvedValue(makeUser());
        await service.forgotPassword('alice@example.com');
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it('fails OPEN when Redis is down (D-1): the e-mail is sent and a warning is logged', async () => {
        redis.state.down = true;
        prisma.user.findUnique.mockResolvedValue(makeUser());
        await service.forgotPassword('alice@example.com');
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        expect(consoleWarn).toHaveBeenCalled();
      });

      it('stores a reset token that lives at most 60 minutes', async () => {
        prisma.user.findUnique.mockResolvedValue(makeUser());
        const before = Date.now();
        await service.forgotPassword('alice@example.com');
        const { resetTokenExpiry } = prisma.user.update.mock.calls[0][0]
          .data as { resetTokenExpiry: Date };
        expect(resetTokenExpiry.getTime() - before).toBeLessThanOrEqual(
          60 * 60 * 1000 + 1000
        );
        expect(resetTokenExpiry.getTime()).toBeGreaterThan(before);
      });
    });

    describe('resendVerification', () => {
      it('sends three verification e-mails an hour to one address; the 4th is answered the same and sends nothing', async () => {
        prisma.user.findUnique.mockResolvedValue(makeUser());

        const results = [];
        for (let i = 0; i < 3; i += 1) {
          results.push(await service.resendVerification('alice@example.com'));
        }
        expect(sendVerificationEmail).toHaveBeenCalledTimes(3);
        prisma.user.findUnique.mockClear();

        const fourth = await service.resendVerification('alice@example.com');
        expect(fourth).toEqual(results[0]);
        expect(sendVerificationEmail).toHaveBeenCalledTimes(3);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });

      it('answers a registered, a verified and an unknown address with the same result (8B-14)', async () => {
        prisma.user.findUnique.mockResolvedValueOnce(makeUser());
        const registered =
          await service.resendVerification('alice@example.com');
        prisma.user.findUnique.mockResolvedValueOnce(
          makeUser({ emailVerified: new Date() })
        );
        const verified = await service.resendVerification('bob@example.com');
        prisma.user.findUnique.mockResolvedValueOnce(null);
        const unknown = await service.resendVerification('nobody@example.com');

        expect(JSON.stringify(registered)).toBe(JSON.stringify(unknown));
        expect(JSON.stringify(verified)).toBe(JSON.stringify(unknown));
        expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
      });

      it("shares one budget with the monolith's direct route", async () => {
        redis.store.set(`authmail:resend:acct:${ALICE_HASH}`, {
          value: '3',
          ttl: 1200,
        });
        prisma.user.findUnique.mockResolvedValue(makeUser());
        await service.resendVerification('alice@example.com');
        expect(sendVerificationEmail).not.toHaveBeenCalled();
      });

      it('fails OPEN when Redis is down (D-1): the e-mail is sent and a warning is logged', async () => {
        redis.state.down = true;
        prisma.user.findUnique.mockResolvedValue(makeUser());
        await service.resendVerification('alice@example.com');
        expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
        expect(consoleWarn).toHaveBeenCalled();
      });
    });

    describe('resetPassword', () => {
      it('is not limited here: the client address is limited in the monolith (D-4)', async () => {
        prisma.user.findFirst.mockResolvedValue(null);
        for (let i = 0; i < 12; i += 1) {
          await expect(
            service.resetPassword('bad-token', 'newpassword123')
          ).rejects.toThrow(InvalidTokenError);
        }
        expect(redis.store.size).toBe(0);
      });
    });
  });
});

describe('AuthService.resetPassword: session version (CODE-02B)', () => {
  let fake: AccountDbFake;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    fake = createAccountDbFake({
      users: [
        {
          id: 'user-1',
          email: 'alice@example.com',
          sessionVersion: 0,
          password: 'old-hash',
          resetToken: 'good-token',
          resetTokenExpiry: new Date(Date.now() + 60_000),
        },
        {
          id: 'user-2',
          email: 'bob@example.com',
          sessionVersion: 5,
          password: 'bob-hash',
          resetToken: null,
          resetTokenExpiry: null,
        },
      ],
      refreshTokens: [
        { id: 'rt-1', userId: 'user-1', hashedToken: 'a' },
        { id: 'rt-2', userId: 'user-1', hashedToken: 'b' },
        { id: 'rt-3', userId: 'user-2', hashedToken: 'c' },
      ],
    });
    service = new AuthService(
      {
        user: fake.client.user,
        refreshToken: fake.client.refreshToken,
        $transaction: fake.$transaction,
      } as unknown as PrismaService,
      {} as unknown as RefreshTokenService,
      makeRedis().service
    );
  });

  it('stores the new password, burns the token, raises the version and deletes the refresh tokens together', async () => {
    await service.resetPassword('good-token', 'newpassword123');

    const alice = fake.user('user-1');
    expect(alice['password']).not.toBe('old-hash');
    expect(alice['resetToken']).toBeNull();
    expect(alice['sessionVersion']).toBe(1);
    expect(fake.refreshTokensOf('user-1')).toEqual([]);
    expect(fake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves every other account alone', async () => {
    await service.resetPassword('good-token', 'newpassword123');

    expect(fake.user('user-2')['sessionVersion']).toBe(5);
    expect(fake.user('user-2')['password']).toBe('bob-hash');
    expect(fake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('keeps the old password, the token and the version when the write fails', async () => {
    fake.failNext('user.update');

    await expect(
      service.resetPassword('good-token', 'newpassword123')
    ).rejects.toThrow('user.update failed');

    const alice = fake.user('user-1');
    expect(alice['password']).toBe('old-hash');
    expect(alice['resetToken']).toBe('good-token');
    expect(alice['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('keeps the old password when the sessions cannot be ended', async () => {
    fake.failNext('refreshToken.deleteMany');

    await expect(
      service.resetPassword('good-token', 'newpassword123')
    ).rejects.toThrow('refreshToken.deleteMany failed');

    const alice = fake.user('user-1');
    expect(alice['password']).toBe('old-hash');
    expect(alice['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('changes nothing for an unknown token', async () => {
    await expect(
      service.resetPassword('bad-token', 'newpassword123')
    ).rejects.toThrow(InvalidTokenError);

    expect(fake.log).not.toContain('begin');
    expect(fake.user('user-1')['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });
});
