import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';

import { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
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

/**
 * An in-memory stand-in for the Redis the 2FA markers live in: SET ... EX ... NX, EXISTS, INCR,
 * EXPIRE. `failPrefix` makes only the keys that start with it fail.
 */
function makeRedis() {
  const store = new Map<string, { value: string; ttl: number | null }>();
  const state = { down: false, failPrefix: null as string | null };
  const guard = (key: string): void => {
    if (state.down) throw new Error('redis down');
    if (state.failPrefix && key.startsWith(state.failPrefix)) {
      throw new Error('redis failed on this key');
    }
  };
  const client = {
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      guard(key);
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, {
        value,
        ttl: args[0] === 'EX' ? (args[1] as number) : null,
      });
      return 'OK';
    }),
    exists: jest.fn(async (key: string) => {
      guard(key);
      return store.has(key) ? 1 : 0;
    }),
    incr: jest.fn(async (key: string) => {
      guard(key);
      const next = Number(store.get(key)?.value ?? '0') + 1;
      store.set(key, {
        value: String(next),
        ttl: store.get(key)?.ttl ?? null,
      });
      return next;
    }),
    expire: jest.fn(async (key: string, ttl: number) => {
      guard(key);
      const entry = store.get(key);
      if (entry) entry.ttl = ttl;
      return entry ? 1 : 0;
    }),
  };
  return {
    service: { getClient: () => client } as unknown as RedisService,
    client,
    store,
    state,
  };
}

/** A token as the monolith's or this service's password step mints it (the contract's literals). */
function twoFactorToken(
  purpose: string,
  overrides: {
    payload?: Record<string, unknown>;
    options?: jwt.SignOptions;
  } = {}
): string {
  return jwt.sign(
    {
      purpose,
      email: 'alice@example.com',
      jti: 'chal-1',
      ...overrides.payload,
    },
    TEST_SECRET,
    {
      algorithm: 'HS256',
      issuer: 'davintrade-2fa',
      subject: 'user-1',
      expiresIn: 300,
      ...overrides.options,
    }
  );
}

describe('TwoFactorService', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalEncryptionKey = process.env['TWO_FACTOR_ENCRYPTION_KEY'];

  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
    securityAlert: { create: jest.Mock };
  };
  let redis: ReturnType<typeof makeRedis>;
  let service: TwoFactorService;

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    process.env['TWO_FACTOR_ENCRYPTION_KEY'] = 'test-encryption-key-not-real';
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      securityAlert: { create: jest.fn().mockResolvedValue({}) },
    };
    redis = makeRedis();
    service = new TwoFactorService(
      prisma as unknown as PrismaService,
      redis.service
    );
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
    /** A user with 2FA on, and a code that is right at this moment. */
    function enrolledUser(extra: Record<string, unknown> = {}) {
      const secret = twoFactorUtil.generateTOTPSecret();
      const user = makeUser({
        twoFactorEnabled: true,
        twoFactorSecret: twoFactorUtil.encryptSecret(secret),
        ...extra,
      });
      return { user, validCode: () => authenticator.generate(secret) };
    }

    it('rejects an invalid/expired temp token', async () => {
      await expect(service.verify('123456', 'not-a-jwt')).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('rejects when the user has no 2FA enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ twoFactorEnabled: false })
      );
      await expect(
        service.verify('123456', twoFactorToken('2fa_challenge'))
      ).rejects.toThrow(BadRequestException);
    });

    it('verifies a valid TOTP code and returns a completion for that challenge', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.verify(
        validCode(),
        twoFactorToken('2fa_challenge')
      );

      expect(result).toMatchObject({
        success: true,
        verified: true,
        method: 'totp',
      });
      const completion = jwt.verify(
        (result as { completionToken: string }).completionToken,
        TEST_SECRET,
        { algorithms: ['HS256'], issuer: 'davintrade-2fa' }
      ) as jwt.JwtPayload;
      expect(completion['purpose']).toBe('2fa_verified');
      expect(completion.sub).toBe('user-1');
      expect(completion['chal']).toBe('chal-1');
      expect((completion.exp ?? 0) - (completion.iat ?? 0)).toBe(60);
      expect(redis.store.get('2fa:used:chal-1')?.ttl).toBe(300);
    });

    it('verifies a valid backup code, marks it used and returns a completion', async () => {
      const secret = twoFactorUtil.generateTOTPSecret();
      const encrypted = twoFactorUtil.encryptSecret(secret);
      const { plainCodes, hashedCodes } =
        await twoFactorUtil.generateBackupCodes();
      prisma.user.findUnique.mockResolvedValue(
        makeUser({
          twoFactorEnabled: true,
          twoFactorSecret: encrypted,
          twoFactorBackupCodes: JSON.stringify(hashedCodes),
        })
      );

      const result = await service.verify(
        plainCodes[0]!,
        twoFactorToken('2fa_challenge')
      );
      expect(result.method).toBe('backup_code');
      expect(
        (result as { remainingBackupCodes: number }).remainingBackupCodes
      ).toBe(9);
      expect(result).toHaveProperty('completionToken');

      const updateArgs = prisma.user.update.mock.calls[0][0];
      const storedCodes: string[] = JSON.parse(
        updateArgs.data.twoFactorBackupCodes
      );
      expect(storedCodes[0]).toBe('');
    });

    it('spends the challenge: the same one a second time is a 401', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      const challenge = twoFactorToken('2fa_challenge');
      await service.verify(validCode(), challenge);

      await expect(
        service.verify(validCode(), challenge)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('a wrong code is a 400 with no completion, and the challenge stays usable', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      const challenge = twoFactorToken('2fa_challenge');

      await expect(service.verify('000000', challenge)).rejects.toThrow(
        BadRequestException
      );
      expect(redis.store.has('2fa:totp:user-1:000000')).toBe(false);

      await expect(
        service.verify(validCode(), challenge)
      ).resolves.toHaveProperty('completionToken');
    });

    it('the 6th attempt is a 429 and burns the challenge, even if the code is then right', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      const challenge = twoFactorToken('2fa_challenge');

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await expect(service.verify('000000', challenge)).rejects.toThrow(
          BadRequestException
        );
      }
      expect(redis.store.get('2fa:attempts:chal-1')?.value).toBe('5');
      expect(redis.store.get('2fa:attempts:chal-1')?.ttl).toBe(300);

      const sixth = await service
        .verify('000000', challenge)
        .catch((error: unknown) => error);
      expect(sixth).toBeInstanceOf(HttpException);
      expect((sixth as HttpException).getStatus()).toBe(429);
      expect((sixth as HttpException).message).toBe(
        'Too many attempts. Please log in again.'
      );
      expect(redis.store.has('2fa:used:chal-1')).toBe(true);

      await expect(
        service.verify(validCode(), challenge)
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('the 5th attempt can still succeed', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      const challenge = twoFactorToken('2fa_challenge');
      for (let attempt = 1; attempt < 5; attempt += 1) {
        await expect(service.verify('000000', challenge)).rejects.toThrow(
          BadRequestException
        );
      }

      await expect(
        service.verify(validCode(), challenge)
      ).resolves.toHaveProperty('completionToken');
    });

    it('refuses a completion presented as the challenge (401), without touching the user', async () => {
      await expect(
        service.verify(
          '123456',
          twoFactorToken('2fa_verified', { payload: { chal: 'x' } })
        )
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('refuses a 2fa_verification token of an earlier version', async () => {
      const oldToken = jwt.sign(
        {
          userId: 'user-1',
          email: 'alice@example.com',
          purpose: '2fa_verification',
        },
        TEST_SECRET,
        { expiresIn: '5m' }
      );

      await expect(service.verify('123456', oldToken)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('refuses any other JWT signed with the secret (no purpose, no jti)', async () => {
      const other = jwt.sign({ userId: 'user-1' }, TEST_SECRET, {
        expiresIn: '5m',
      });

      await expect(service.verify('123456', other)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
    });

    it('accepts one TOTP code once: the same code on a second challenge is a 400', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      const code = validCode();

      await service.verify(
        code,
        twoFactorToken('2fa_challenge', { payload: { jti: 'chal-a' } })
      );
      await expect(
        service.verify(
          code,
          twoFactorToken('2fa_challenge', { payload: { jti: 'chal-b' } })
        )
      ).rejects.toThrow(BadRequestException);
      expect(redis.store.get(`2fa:totp:user-1:${code}`)?.ttl).toBe(90);
    });

    it('a concurrent request that spends the challenge first wins: this one is a 401', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockImplementation(async () => {
        redis.store.set('2fa:used:chal-1', { value: '1', ttl: 300 });
        return user;
      });
      // isConsumed has already passed by the time the user is read.
      redis.client.exists.mockImplementationOnce(async () => 0);

      await expect(
        service.verify(validCode(), twoFactorToken('2fa_challenge'))
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('Redis down: 503, and the code is never checked', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      redis.state.down = true;

      const error = await service
        .verify(validCode(), twoFactorToken('2fa_challenge'))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).message).toBe(
        'Verification is temporarily unavailable. Please try again.'
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('Redis failing at the used-marker after a right code: 503 and no completion', async () => {
      const { user, validCode } = enrolledUser();
      prisma.user.findUnique.mockResolvedValue(user);
      redis.state.failPrefix = '2fa:used:';
      redis.client.exists.mockImplementationOnce(async () => 0);

      await expect(
        service.verify(validCode(), twoFactorToken('2fa_challenge'))
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('a missing NEXTAUTH_SECRET is a 401', async () => {
      const challenge = twoFactorToken('2fa_challenge');
      delete process.env['NEXTAUTH_SECRET'];

      await expect(service.verify('123456', challenge)).rejects.toBeInstanceOf(
        UnauthorizedException
      );
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
