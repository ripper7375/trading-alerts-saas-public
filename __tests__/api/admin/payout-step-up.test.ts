/**
 * @jest-environment node
 */
/**
 * CODE-06B: POST /api/admin/payout-step-up.
 *
 * An ADMIN proves a fresh TOTP code (never a backup code, never a code already used to sign in)
 * and gets a 120-second token for money-service's batch approval and execution. Wrong codes are
 * counted: 5 per 15 minutes per admin, then 429.
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

const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

const mockVerifyTOTP = jest.fn();
const mockDecryptSecret = jest.fn();
jest.mock('@/lib/auth/two-factor', () => ({
  __esModule: true,
  verifyTOTP: (...a: unknown[]) => mockVerifyTOTP(...a),
  decryptSecret: (...a: unknown[]) => mockDecryptSecret(...a),
}));

import { POST } from '@/app/api/admin/payout-step-up/route';
import { AuthError } from '@/lib/auth/errors';

const SECRET = 'admin-step-up-test-secret';
const ADMIN_ID = 'admin-1';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/payout-step-up', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mockRedisStore.clear();
  mockRedisDown = false;
  jest.clearAllMocks();
  setEnv('NEXTAUTH_SECRET', SECRET);
  mockRequireAdmin.mockResolvedValue({
    user: { id: ADMIN_ID, role: 'ADMIN' },
  });
  mockUserFindUnique.mockResolvedValue({
    id: ADMIN_ID,
    twoFactorEnabled: true,
    twoFactorSecret: 'encrypted-secret',
  });
  mockDecryptSecret.mockReturnValue('plain-totp-secret');
  mockVerifyTOTP.mockReturnValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/admin/payout-step-up', () => {
  it('mints a 120-second approval token for the admin when the code is right', async () => {
    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.expiresInSeconds).toBe(120);
    const claims = jwt.verify(body.stepUpToken, SECRET, {
      algorithms: ['HS256'],
      issuer: 'davintrade-2fa',
      audience: 'money-service:payout-approval',
    }) as jwt.JwtPayload;
    expect(claims['purpose']).toBe('payout_stepup');
    expect(claims.sub).toBe(ADMIN_ID);
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(120);
    expect(mockVerifyTOTP).toHaveBeenCalledWith('123456', 'plain-totp-secret');
  });

  it('marks the TOTP code spent, so the same code cannot mint a second token', async () => {
    await POST(post({ code: '123456' }));

    const second = await POST(post({ code: '123456' }));

    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ code: 'INVALID_CODE' });
    expect(mockRedisStore.has(`2fa:totp:${ADMIN_ID}:123456`)).toBe(true);
  });

  it('refuses a code that was just used to sign in (the sign-in marked it spent)', async () => {
    mockRedisStore.set(`2fa:totp:${ADMIN_ID}:123456`, { value: '1', ttl: 90 });

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(400);
    expect(await response.json()).not.toHaveProperty('stepUpToken');
  });

  it('refuses a wrong code (400) and counts it', async () => {
    mockVerifyTOTP.mockReturnValue(false);

    const response = await POST(post({ code: '000000' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ code: 'INVALID_CODE' });
    expect(body).not.toHaveProperty('stepUpToken');
    expect(
      mockRedisStore.get(`payout-stepup:attempts:${ADMIN_ID}`)?.value
    ).toBe('1');
  });

  it('forgets the failures once a right code comes', async () => {
    mockVerifyTOTP.mockReturnValueOnce(false);
    await POST(post({ code: '000000' }));

    await POST(post({ code: '123456' }));

    expect(mockRedisStore.has(`payout-stepup:attempts:${ADMIN_ID}`)).toBe(
      false
    );
  });

  it('answers 429 with Retry-After from the 6th attempt and checks no code', async () => {
    mockVerifyTOTP.mockReturnValue(false);
    for (let i = 0; i < 5; i += 1) await POST(post({ code: '000000' }));
    mockVerifyTOTP.mockClear();
    mockVerifyTOTP.mockReturnValue(true);

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({
      code: 'STEP_UP_RATE_LIMITED',
    });
    expect(mockVerifyTOTP).not.toHaveBeenCalled();
  });

  it.each([
    ['a backup code', { code: 'abcd-1234' }],
    ['a short code', { code: '12345' }],
    ['a non-numeric code', { code: '12ab56' }],
    ['no code', {}],
    ['a number instead of a string', { code: 123456 }],
  ])('refuses %s with 400 and no token', async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).not.toHaveProperty('stepUpToken');
    expect(mockVerifyTOTP).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON with 400', async () => {
    const response = await POST(post('{not json'));

    expect(response.status).toBe(400);
  });

  it('refuses an admin without two-factor authentication (403, no token)', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: ADMIN_ID,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'ADMIN_2FA_REQUIRED',
    });
  });

  it('fails closed (500) when the stored secret cannot be read', async () => {
    mockDecryptSecret.mockImplementation(() => {
      throw new Error('bad key');
    });

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('stepUpToken');
  });

  it('passes on the refusal of requireAdmin (not signed in, not an admin, no 2FA)', async () => {
    mockRequireAdmin.mockRejectedValue(
      new AuthError('You must be an administrator', 'ADMIN_REQUIRED', 403)
    );

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(403);
    expect(mockVerifyTOTP).not.toHaveBeenCalled();
  });

  it('answers 503 and mints nothing when Redis is down', async () => {
    mockRedisDown = true;

    const response = await POST(post({ code: '123456' }));

    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('stepUpToken');
  });
});
