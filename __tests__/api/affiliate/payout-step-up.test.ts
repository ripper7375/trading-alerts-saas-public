/**
 * @jest-environment node
 */
/**
 * CODE-06B (decision D9-4): POST /api/affiliate/payout-step-up.
 *
 * Before an affiliate adds or changes a Wise payout recipient, they prove the current password
 * and, when two-factor authentication is on, a fresh TOTP code. The answer is a 120-second token
 * for money-service's `POST /wise/recipients` and `DELETE /wise/recipients/:id`. Wrong attempts
 * are counted: 5 per 15 minutes per user, then 429.
 */

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const mockRedisStore = new Map<string, { value: string; ttl: number }>();
let mockRedisDown = false;
const mockGuard = (): void => {
  if (mockRedisDown) throw new Error('redis down');
};
const mockRedis = {
  set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
    mockGuard();
    if (args.includes('NX') && mockRedisStore.has(key)) return null;
    mockRedisStore.set(key, {
      value,
      ttl: args[0] === 'EX' ? (args[1] as number) : -1,
    });
    return 'OK';
  }),
  exists: jest.fn(async (key: string) => {
    mockGuard();
    return mockRedisStore.has(key) ? 1 : 0;
  }),
  incr: jest.fn(async (key: string) => {
    mockGuard();
    const entry = mockRedisStore.get(key);
    const next = Number(entry?.value ?? '0') + 1;
    mockRedisStore.set(key, { value: String(next), ttl: entry?.ttl ?? -1 });
    return next;
  }),
  ttl: jest.fn(async (key: string) => {
    mockGuard();
    return mockRedisStore.get(key)?.ttl ?? -2;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    mockGuard();
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
  del: jest.fn(async (...keys: string[]) => {
    mockGuard();
    let removed = 0;
    for (const key of keys) if (mockRedisStore.delete(key)) removed += 1;
    return removed;
  }),
};
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => mockRedis,
}));

const mockRequireAffiliate = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
}));

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

const mockCompare = jest.fn();
jest.mock('bcryptjs', () => ({
  __esModule: true,
  compare: (...a: unknown[]) => mockCompare(...a),
  default: { compare: (...a: unknown[]) => mockCompare(...a) },
}));

const mockVerifyTOTP = jest.fn();
const mockDecryptSecret = jest.fn();
jest.mock('@/lib/auth/two-factor', () => ({
  __esModule: true,
  verifyTOTP: (...a: unknown[]) => mockVerifyTOTP(...a),
  decryptSecret: (...a: unknown[]) => mockDecryptSecret(...a),
}));

import { POST } from '@/app/api/affiliate/payout-step-up/route';
import { AuthError } from '@/lib/auth/errors';

const SECRET = 'affiliate-step-up-test-secret';
const USER_ID = 'affiliate-user-1';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/affiliate/payout-step-up', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function account(overrides: Record<string, unknown> = {}): void {
  mockUserFindUnique.mockResolvedValue({
    id: USER_ID,
    password: 'bcrypt-hash',
    twoFactorEnabled: false,
    twoFactorSecret: null,
    ...overrides,
  });
}

beforeEach(() => {
  mockRedisStore.clear();
  mockRedisDown = false;
  jest.clearAllMocks();
  setEnv('NEXTAUTH_SECRET', SECRET);
  mockRequireAffiliate.mockResolvedValue({
    user: { id: USER_ID, isAffiliate: true },
  });
  account();
  mockCompare.mockResolvedValue(true);
  mockDecryptSecret.mockReturnValue('plain-totp-secret');
  mockVerifyTOTP.mockReturnValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

function recipientClaims(token: string): jwt.JwtPayload {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: 'davintrade-2fa',
    audience: 'money-service:wise-recipient',
  }) as jwt.JwtPayload;
}

describe('POST /api/affiliate/payout-step-up', () => {
  it('mints a 120-second recipient token for the right password (no 2FA on the account)', async () => {
    const response = await POST(post({ password: 'correct horse' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.expiresInSeconds).toBe(120);
    const claims = recipientClaims(body.stepUpToken);
    expect(claims['purpose']).toBe('payout_stepup');
    expect(claims.sub).toBe(USER_ID);
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(120);
    expect(mockCompare).toHaveBeenCalledWith('correct horse', 'bcrypt-hash');
    expect(mockVerifyTOTP).not.toHaveBeenCalled();
  });

  it('refuses a wrong password (401), counts it and mints nothing', async () => {
    mockCompare.mockResolvedValue(false);

    const response = await POST(post({ password: 'nope' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'INVALID_PASSWORD' });
    expect(body).not.toHaveProperty('stepUpToken');
    expect(mockRedisStore.get(`payout-stepup:attempts:${USER_ID}`)?.value).toBe(
      '1'
    );
  });

  it('refuses an account with no password (403, set one first) and mints nothing', async () => {
    account({ password: null });

    const response = await POST(post({ password: 'anything' }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'PASSWORD_REQUIRED' });
    expect(body).not.toHaveProperty('stepUpToken');
    expect(mockCompare).not.toHaveBeenCalled();
  });

  describe('with two-factor authentication on', () => {
    beforeEach(() =>
      account({ twoFactorEnabled: true, twoFactorSecret: 'enc' })
    );

    it('asks for the code when the password is right and no code came (400, no token)', async () => {
      const response = await POST(post({ password: 'correct horse' }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({ code: 'TWO_FACTOR_CODE_REQUIRED' });
      expect(body).not.toHaveProperty('stepUpToken');
    });

    it('mints the token for the right password and the right code', async () => {
      const response = await POST(
        post({ password: 'correct horse', code: '123456' })
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(recipientClaims(body.stepUpToken).sub).toBe(USER_ID);
      expect(mockVerifyTOTP).toHaveBeenCalledWith(
        '123456',
        'plain-totp-secret'
      );
    });

    it('refuses a wrong code (400) and a replayed one', async () => {
      mockVerifyTOTP.mockReturnValueOnce(false);
      const wrong = await POST(
        post({ password: 'correct horse', code: '000000' })
      );
      expect(wrong.status).toBe(400);
      expect(await wrong.json()).toMatchObject({ code: 'INVALID_CODE' });

      const first = await POST(
        post({ password: 'correct horse', code: '123456' })
      );
      expect(first.status).toBe(200);
      const replay = await POST(
        post({ password: 'correct horse', code: '123456' })
      );
      expect(replay.status).toBe(400);
      expect(await replay.json()).not.toHaveProperty('stepUpToken');
    });

    it('refuses a backup code (the step-up takes a TOTP code only)', async () => {
      const response = await POST(
        post({ password: 'correct horse', code: 'abcd-1234' })
      );

      expect(response.status).toBe(400);
      expect(mockVerifyTOTP).not.toHaveBeenCalled();
    });

    it('does not read the code before the password is right', async () => {
      mockCompare.mockResolvedValue(false);

      const response = await POST(post({ password: 'nope', code: '123456' }));

      expect(response.status).toBe(401);
      expect(mockVerifyTOTP).not.toHaveBeenCalled();
    });

    it('fails closed (500) when the stored secret is missing or unreadable', async () => {
      account({ twoFactorEnabled: true, twoFactorSecret: null });
      const missing = await POST(
        post({ password: 'correct horse', code: '123456' })
      );
      expect(missing.status).toBe(500);

      account({ twoFactorEnabled: true, twoFactorSecret: 'enc' });
      mockDecryptSecret.mockImplementation(() => {
        throw new Error('bad key');
      });
      const unreadable = await POST(
        post({ password: 'correct horse', code: '123456' })
      );
      expect(unreadable.status).toBe(500);
      expect(await unreadable.json()).not.toHaveProperty('stepUpToken');
    });
  });

  it('answers 429 with Retry-After from the 6th attempt and checks no password', async () => {
    mockCompare.mockResolvedValue(false);
    for (let i = 0; i < 5; i += 1) await POST(post({ password: 'nope' }));
    mockCompare.mockClear();
    mockCompare.mockResolvedValue(true);

    const response = await POST(post({ password: 'correct horse' }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({
      code: 'STEP_UP_RATE_LIMITED',
    });
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('forgets the failures once the check succeeds', async () => {
    mockCompare.mockResolvedValueOnce(false);
    await POST(post({ password: 'nope' }));

    await POST(post({ password: 'correct horse' }));

    expect(mockRedisStore.has(`payout-stepup:attempts:${USER_ID}`)).toBe(false);
  });

  it.each([
    ['no password', {}],
    ['an empty password', { password: '' }],
    ['a number', { password: 12345678 }],
  ])('refuses %s with 400', async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('passes on the refusal of requireAffiliate', async () => {
    mockRequireAffiliate.mockRejectedValue(
      new AuthError('You must be an affiliate', 'AFFILIATE_REQUIRED', 403)
    );

    const response = await POST(post({ password: 'correct horse' }));

    expect(response.status).toBe(403);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('answers 503 and mints nothing when Redis is down', async () => {
    mockRedisDown = true;

    const response = await POST(post({ password: 'correct horse' }));

    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('stepUpToken');
  });
});
