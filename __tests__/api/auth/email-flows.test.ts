/**
 * @jest-environment node
 */
/**
 * forgot-password, resend-verification and reset-password route tests (CODE-01B): the e-mail
 * flows are limited to three requests per hour per e-mail address and per client address, and
 * a reset to ten rejected tokens per quarter hour per client address.
 *
 * The rule that matters most is that a limited request is INDISTINGUISHABLE from a normal one:
 * the same status and the byte-identical body, and nothing sent. So the limit cannot be used to
 * tell a registered address from an unknown one (checklist 8B-14).
 */

jest.mock('@/lib/csrf', () => ({
  validateOrigin: jest.fn(() => Promise.resolve(true)),
  csrfErrorResponse: jest.fn(
    () =>
      new Response(JSON.stringify({ error: 'Invalid request origin' }), {
        status: 403,
      })
  ),
}));

const mockUserFindUnique = jest.fn();
const mockUserFindFirst = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserUpdateMany = jest.fn();
const mockRefreshTokenDeleteMany = jest.fn();
const mockTransaction = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
      updateMany: (...a: unknown[]) => mockUserUpdateMany(...a),
    },
    refreshToken: {
      deleteMany: (...a: unknown[]) => mockRefreshTokenDeleteMany(...a),
    },
    // CODE-02B: a reset and the session-version bump commit together.
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// jest.config.js maps `next-auth` and every `next-auth/*` import to ONE stub; the `default` export
// is the provider factory `auth-options` calls at load (used by the end-to-end test at the end).
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

const mockSendPasswordResetEmail = jest.fn();
const mockSendVerificationEmail = jest.fn();
jest.mock('@/lib/email/email', () => ({
  sendPasswordResetEmail: (...a: unknown[]) => mockSendPasswordResetEmail(...a),
  sendVerificationEmail: (...a: unknown[]) => mockSendVerificationEmail(...a),
}));

// An in-memory stand-in for the shared Redis: GET, INCR, TTL, EXPIRE, DECR, DEL.
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
let mockRedisDown = false;
function redisGuard(): void {
  if (mockRedisDown) throw new Error('redis down');
}
const mockRedis = {
  get: jest.fn(async (key: string) => {
    redisGuard();
    return mockRedisStore.get(key)?.value ?? null;
  }),
  incr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') + 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  decr: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') - 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? null });
    return next;
  }),
  ttl: jest.fn(async (key: string) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (!entry) return -2;
    return entry.ttl ?? -1;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    redisGuard();
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
  del: jest.fn(async (...keys: string[]) => {
    redisGuard();
    let removed = 0;
    for (const key of keys) {
      if (mockRedisStore.delete(key)) removed += 1;
    }
    return removed;
  }),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

import {
  createAccountDbFake,
  type AccountDbFake,
} from '../../helpers/account-db-fake';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';
import { POST as resendVerification } from '@/app/api/auth/resend-verification/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import { authOptions } from '@/lib/auth/auth-options';
import { clearUserActiveCache } from '@/lib/auth/user-active';

const IP_A = '203.0.113.7';
const IP_B = '198.51.100.9';

function post(path: string, body: unknown, ip: string | null = IP_A): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ip ? { 'x-real-ip': ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function snapshot(
  response: Response
): Promise<{ status: number; text: string }> {
  return { status: response.status, text: await response.text() };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    emailVerified: null,
    verificationToken: null,
    updatedAt: new Date(Date.now() - 3_600_000),
    ...overrides,
  };
}

describe('CODE-01B: the e-mail flows and reset are limited', () => {
  let consoleWarn: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;

  beforeEach(() => {
    mockRedisStore.clear();
    mockRedisDown = false;
    jest.clearAllMocks();
    mockUserFindUnique.mockReset();
    mockUserFindFirst.mockReset();
    mockUserUpdate.mockReset();
    mockUserUpdate.mockResolvedValue({ id: 'user-1' });
    // CODE-02B: the transaction hands its callback the same delegates as the client.
    mockUserUpdateMany.mockReset();
    mockUserUpdateMany.mockResolvedValue({ count: 1 });
    mockRefreshTokenDeleteMany.mockReset();
    mockRefreshTokenDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockReset();
    mockTransaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: { update: mockUserUpdate, updateMany: mockUserUpdateMany },
          refreshToken: { deleteMany: mockRefreshTokenDeleteMany },
        })
    );
    mockSendPasswordResetEmail.mockResolvedValue({ success: true });
    mockSendVerificationEmail.mockResolvedValue({ success: true });
    consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
    consoleError.mockRestore();
    consoleLog.mockRestore();
  });

  describe('POST /api/auth/forgot-password', () => {
    const path = '/api/auth/forgot-password';

    it('sends three reset e-mails an hour to one address; the 4th is answered the same and sends nothing', async () => {
      mockUserFindUnique.mockResolvedValue(user());

      const bodies: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const res = await forgotPassword(
          post(path, { email: 'alice@example.com' })
        );
        expect(res.status).toBe(200);
        bodies.push(await res.text());
      }
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);
      mockUserFindUnique.mockClear();

      const fourth = await forgotPassword(
        post(path, { email: 'alice@example.com' })
      );
      expect(fourth.status).toBe(200);
      expect(await fourth.text()).toBe(bodies[0]);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockUserUpdate).toHaveBeenCalledTimes(3);
    });

    it('answers a known and an unknown address with the same bytes (8B-14)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(user());
      const known = await snapshot(
        await forgotPassword(post(path, { email: 'alice@example.com' }, IP_A))
      );
      mockUserFindUnique.mockResolvedValueOnce(null);
      const unknown = await snapshot(
        await forgotPassword(post(path, { email: 'nobody@example.com' }, IP_B))
      );
      expect(known).toEqual(unknown);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('limits the client address across different e-mail addresses', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      for (let i = 0; i < 3; i += 1) {
        await forgotPassword(post(path, { email: `user-${i}@example.com` }));
      }
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);

      const fourth = await forgotPassword(
        post(path, { email: 'user-3@example.com' })
      );
      expect(fourth.status).toBe(200);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);

      // another address, same e-mail budget untouched
      const other = await forgotPassword(
        post(path, { email: 'user-4@example.com' }, IP_B)
      );
      expect(other.status).toBe(200);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(4);
    });

    it('limits one e-mail address across different client addresses', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      for (let i = 0; i < 3; i += 1) {
        await forgotPassword(
          post(path, { email: 'alice@example.com' }, `203.0.113.${10 + i}`)
        );
      }
      await forgotPassword(
        post(path, { email: 'alice@example.com' }, '203.0.113.99')
      );
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);
    });

    it('opens again after the hour', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      for (let i = 0; i < 4; i += 1) {
        await forgotPassword(post(path, { email: 'alice@example.com' }));
      }
      for (const [, entry] of mockRedisStore) entry.ttl = 0;
      mockRedisStore.clear();
      await forgotPassword(post(path, { email: 'alice@example.com' }));
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(4);
    });

    it('does not count a request that fails validation', async () => {
      for (let i = 0; i < 5; i += 1) {
        const res = await forgotPassword(post(path, { email: 'not-an-email' }));
        expect(res.status).toBe(400);
      }
      expect(mockRedisStore.size).toBe(0);
    });

    it('fails OPEN when Redis is down (D-1): the e-mail is sent', async () => {
      mockRedisDown = true;
      mockUserFindUnique.mockResolvedValue(user());
      const res = await forgotPassword(
        post(path, { email: 'alice@example.com' })
      );
      expect(res.status).toBe(200);
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalled();
    });

    it('works without a client address: the e-mail address is still limited', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      for (let i = 0; i < 4; i += 1) {
        await forgotPassword(post(path, { email: 'alice@example.com' }, null));
      }
      expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(3);
    });

    it('stores a reset token that lives at most 60 minutes', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      const before = Date.now();
      await forgotPassword(post(path, { email: 'alice@example.com' }));
      const { resetTokenExpiry } = mockUserUpdate.mock.calls[0][0].data as {
        resetTokenExpiry: Date;
      };
      expect(resetTokenExpiry.getTime() - before).toBeLessThanOrEqual(
        60 * 60 * 1000 + 1000
      );
      expect(resetTokenExpiry.getTime()).toBeGreaterThan(before);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    const path = '/api/auth/resend-verification';

    it('sends three verification e-mails an hour to one address; the 4th is answered the same and sends nothing', async () => {
      mockUserFindUnique.mockResolvedValue(user());

      const bodies: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const res = await resendVerification(
          post(path, { email: 'alice@example.com' })
        );
        expect(res.status).toBe(200);
        bodies.push(await res.text());
      }
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(3);
      mockUserFindUnique.mockClear();

      const fourth = await resendVerification(
        post(path, { email: 'alice@example.com' })
      );
      expect(fourth.status).toBe(200);
      expect(await fourth.text()).toBe(bodies[0]);
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(3);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('answers a registered, a verified and an unknown address with the same bytes (8B-14)', async () => {
      mockUserFindUnique.mockResolvedValueOnce(user());
      const registered = await snapshot(
        await resendVerification(
          post(path, { email: 'alice@example.com' }, IP_A)
        )
      );
      mockUserFindUnique.mockResolvedValueOnce(
        user({ emailVerified: new Date('2026-01-01') })
      );
      const verified = await snapshot(
        await resendVerification(post(path, { email: 'bob@example.com' }, IP_B))
      );
      mockUserFindUnique.mockResolvedValueOnce(null);
      const unknown = await snapshot(
        await resendVerification(
          post(path, { email: 'nobody@example.com' }, '192.0.2.44')
        )
      );

      expect(registered.status).toBe(200);
      expect(registered).toEqual(unknown);
      expect(verified).toEqual(unknown);
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('limits the client address across different e-mail addresses', async () => {
      mockUserFindUnique.mockResolvedValue(user());
      for (let i = 0; i < 4; i += 1) {
        await resendVerification(
          post(path, { email: `user-${i}@example.com` })
        );
      }
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(3);
    });

    it('fails OPEN when Redis is down (D-1): the e-mail is sent', async () => {
      mockRedisDown = true;
      mockUserFindUnique.mockResolvedValue(user());
      const res = await resendVerification(
        post(path, { email: 'alice@example.com' })
      );
      expect(res.status).toBe(200);
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(consoleWarn).toHaveBeenCalled();
    });

    it('keeps its own 60 second guard for one account', async () => {
      mockUserFindUnique.mockResolvedValue(
        user({ verificationToken: 'pending', updatedAt: new Date() })
      );
      const res = await resendVerification(
        post(path, { email: 'alice@example.com' })
      );
      expect(res.status).toBe(429);
      expect(mockSendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const path = '/api/auth/reset-password';
    const body = { token: 'not-a-real-token', password: 'a-new-password-1' };

    it('answers the 11th rejected token from one address with 429 and looks nothing up', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      for (let i = 0; i < 10; i += 1) {
        const res = await resetPassword(post(path, body));
        expect(res.status).toBe(400);
      }
      mockUserFindFirst.mockClear();

      const eleventh = await resetPassword(post(path, body));
      expect(eleventh.status).toBe(429);
      expect(eleventh.headers.get('retry-after')).toBe('900');
      const json = await eleventh.json();
      expect(json.error).toMatch(/too many/i);
      expect(mockUserFindFirst).not.toHaveBeenCalled();
    });

    it('counts an expired token like an unknown one', async () => {
      mockUserFindFirst.mockResolvedValue({
        id: 'user-1',
        resetTokenExpiry: new Date(Date.now() - 1000),
      });
      for (let i = 0; i < 10; i += 1) {
        expect((await resetPassword(post(path, body))).status).toBe(400);
      }
      expect((await resetPassword(post(path, body))).status).toBe(429);
    });

    it('does not count a successful reset', async () => {
      for (let i = 0; i < 9; i += 1) {
        mockUserFindFirst.mockResolvedValueOnce(null);
        await resetPassword(post(path, body));
      }
      mockUserFindFirst.mockResolvedValueOnce({
        id: 'user-1',
        resetTokenExpiry: new Date(Date.now() + 60_000),
      });
      const ok = await resetPassword(post(path, body));
      expect(ok.status).toBe(200);

      // nine rejections stand: the 10th is allowed, the 11th is not
      mockUserFindFirst.mockResolvedValueOnce(null);
      expect((await resetPassword(post(path, body))).status).toBe(400);
      mockUserFindFirst.mockResolvedValueOnce(null);
      expect((await resetPassword(post(path, body))).status).toBe(429);
    });

    it('does not count a request that fails validation', async () => {
      for (let i = 0; i < 12; i += 1) {
        const res = await resetPassword(
          post(path, { token: 'x', password: 'short' })
        );
        expect(res.status).toBe(400);
      }
      mockUserFindFirst.mockResolvedValueOnce(null);
      expect((await resetPassword(post(path, body))).status).toBe(400);
    });

    it('limits per client address only', async () => {
      mockUserFindFirst.mockResolvedValue(null);
      for (let i = 0; i < 10; i += 1) {
        await resetPassword(post(path, body));
      }
      expect((await resetPassword(post(path, body))).status).toBe(429);
      expect((await resetPassword(post(path, body, IP_B))).status).toBe(400);
    });

    it('fails OPEN when Redis is down (D-1)', async () => {
      mockRedisDown = true;
      mockUserFindFirst.mockResolvedValue({
        id: 'user-1',
        resetTokenExpiry: new Date(Date.now() + 60_000),
      });
      const res = await resetPassword(post(path, body));
      expect(res.status).toBe(200);
      expect(consoleWarn).toHaveBeenCalled();
    });
  });
});

describe('CODE-02B: a password reset ends every session of the account', () => {
  const path = '/api/auth/reset-password';
  const resetBody = { token: 'valid-token', password: 'a-new-password-1' };
  let fake: AccountDbFake;

  async function runJwt(
    token: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const callback = authOptions.callbacks?.jwt;
    if (!callback) throw new Error('jwt callback missing');
    return (await callback({ token, trigger: undefined } as never)) as never;
  }

  beforeEach(() => {
    mockRedisStore.clear();
    mockRedisDown = false;
    jest.clearAllMocks();
    clearUserActiveCache();
    fake = createAccountDbFake({
      users: [
        {
          id: 'user-1',
          email: 'alice@example.com',
          sessionVersion: 0,
          role: 'USER',
          tier: 'FREE',
          isActive: true,
          deletedAt: null,
          password: 'old-hash',
          resetToken: 'valid-token',
          resetTokenExpiry: new Date(Date.now() + 60_000),
        },
        {
          id: 'user-2',
          email: 'bob@example.com',
          sessionVersion: 5,
          role: 'USER',
          tier: 'FREE',
          isActive: true,
          deletedAt: null,
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
    mockUserFindFirst.mockReset();
    mockUserFindFirst.mockImplementation((args) =>
      fake.client.user.findFirst(args)
    );
    mockUserFindUnique.mockReset();
    mockUserFindUnique.mockImplementation((args) =>
      fake.client.user.findUnique(args)
    );
    mockUserUpdate.mockReset();
    mockUserUpdate.mockImplementation((args) => fake.client.user.update(args));
    mockUserUpdateMany.mockReset();
    mockUserUpdateMany.mockImplementation((args) =>
      fake.client.user.updateMany(args)
    );
    mockRefreshTokenDeleteMany.mockReset();
    mockRefreshTokenDeleteMany.mockImplementation((args) =>
      fake.client.refreshToken.deleteMany(args)
    );
    mockTransaction.mockReset();
    mockTransaction.mockImplementation((callback) =>
      fake.$transaction(callback)
    );
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores the new password, burns the token, raises the version and deletes the refresh tokens together', async () => {
    const res = await resetPassword(post(path, resetBody));

    expect(res.status).toBe(200);
    const alice = fake.user('user-1');
    expect(alice['password']).not.toBe('old-hash');
    expect(alice['resetToken']).toBeNull();
    expect(alice['sessionVersion']).toBe(1);
    expect(fake.refreshTokensOf('user-1')).toEqual([]);
    expect(fake.writesOutsideTransaction()).toEqual([]);
  });

  it('leaves every other account alone', async () => {
    await resetPassword(post(path, resetBody));

    expect(fake.user('user-2')['sessionVersion']).toBe(5);
    expect(fake.user('user-2')['password']).toBe('bob-hash');
    expect(fake.refreshTokensOf('user-2')).toHaveLength(1);
  });

  it('keeps the old password, the token and the version when the write fails', async () => {
    fake.failNext('user.update');

    const res = await resetPassword(post(path, resetBody));

    expect(res.status).toBe(500);
    const alice = fake.user('user-1');
    expect(alice['password']).toBe('old-hash');
    expect(alice['resetToken']).toBe('valid-token');
    expect(alice['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('keeps the old password when the sessions cannot be ended', async () => {
    fake.failNext('refreshToken.deleteMany');

    const res = await resetPassword(post(path, resetBody));

    expect(res.status).toBe(500);
    const alice = fake.user('user-1');
    expect(alice['password']).toBe('old-hash');
    expect(alice['resetToken']).toBe('valid-token');
    expect(alice['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('changes nothing for an unknown token', async () => {
    const res = await resetPassword(
      post(path, { token: 'nobody-has-this', password: 'a-new-password-1' })
    );

    expect(res.status).toBe(400);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(fake.user('user-1')['sessionVersion']).toBe(0);
    expect(fake.refreshTokensOf('user-1')).toHaveLength(2);
  });

  it('end to end: a session minted at version 0 is refused by the jwt callback once the password is reset', async () => {
    const token = {
      id: 'user-1',
      sessionVersion: 0,
      role: 'USER',
      tier: 'FREE',
    };
    // The session is fine, and the answer is cached for 30 s on this instance.
    await expect(runJwt(token)).resolves.toMatchObject({ id: 'user-1' });

    const res = await resetPassword(post(path, resetBody));
    expect(res.status).toBe(200);

    // Refused at once, not after the cache runs out.
    await expect(runJwt(token)).rejects.toThrow('SESSION_REVOKED');
    // A session of someone else is untouched.
    await expect(
      runJwt({ id: 'user-2', sessionVersion: 5, role: 'USER', tier: 'FREE' })
    ).resolves.toMatchObject({ id: 'user-2' });
  });
});
