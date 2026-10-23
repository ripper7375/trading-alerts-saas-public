/**
 * @jest-environment node
 */
/**
 * CODE-01A: the two-stage 2FA tokens and the verify step that mints them.
 *
 * Stage one is a CHALLENGE (the password was right; 5 minutes; proves nothing else). Stage two is
 * a COMPLETION (the code was right; 60 seconds; one use). Only a completion opens a session.
 *
 * Three groups: the contract (the literals operation-service must share), the token module, and
 * `POST /api/user/2fa/verify`.
 */

import jwt from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

// An in-memory stand-in for the shared Redis: SET ... EX ... NX, EXISTS, INCR, EXPIRE.
const mockRedisStore = new Map<string, { value: string; ttl: number | null }>();
let mockRedisDown = false;
let mockRedisFailPrefix: string | null = null;
const mockGuard = (key: string): void => {
  if (mockRedisDown) throw new Error('redis down');
  if (mockRedisFailPrefix && key.startsWith(mockRedisFailPrefix)) {
    throw new Error('redis failed on this key');
  }
};
const mockRedis = {
  set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
    mockGuard(key);
    const ttl = args[0] === 'EX' ? (args[1] as number) : null;
    if (args.includes('NX') && mockRedisStore.has(key)) return null;
    mockRedisStore.set(key, { value, ttl });
    return 'OK';
  }),
  exists: jest.fn(async (key: string) => {
    mockGuard(key);
    return mockRedisStore.has(key) ? 1 : 0;
  }),
  incr: jest.fn(async (key: string) => {
    mockGuard(key);
    const next = Number(mockRedisStore.get(key)?.value ?? '0') + 1;
    mockRedisStore.set(key, {
      value: String(next),
      ttl: mockRedisStore.get(key)?.ttl ?? null,
    });
    return next;
  }),
  expire: jest.fn(async (key: string, ttl: number) => {
    mockGuard(key);
    const entry = mockRedisStore.get(key);
    if (entry) entry.ttl = ttl;
    return entry ? 1 : 0;
  }),
};
let mockRedisClientError: Error | null = null;
jest.mock('@/lib/redis/client', () => ({
  __esModule: true,
  getRedisClient: () => {
    if (mockRedisClientError) throw mockRedisClientError;
    return mockRedis;
  },
}));

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
  },
}));

const mockVerifyTOTP = jest.fn();
const mockVerifyBackupCode = jest.fn();
jest.mock('@/lib/auth/two-factor', () => ({
  __esModule: true,
  verifyTOTP: (...a: unknown[]) => mockVerifyTOTP(...a),
  decryptSecret: () => 'plain-totp-secret',
  verifyBackupCode: (...a: unknown[]) => mockVerifyBackupCode(...a),
  isBackupCode: (code: string) => /^[A-Z0-9]{8}$/.test(code),
}));

jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUser2FA: () => false,
}));
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationServiceOptionalAuth: jest.fn(),
  OperationServiceError: class OperationServiceError extends Error {
    status = 500;
    body: unknown = {};
  },
}));

import { POST } from '@/app/api/user/2fa/verify/route';
import {
  ATTEMPTS_KEY_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
  CHALLENGE_USED_TTL_SECONDS,
  COMPLETION_TTL_SECONDS,
  COMPLETION_USED_TTL_SECONDS,
  MAX_CODE_ATTEMPTS,
  TOTP_REPLAY_TTL_SECONDS,
  TWO_FACTOR_CHALLENGE,
  TWO_FACTOR_ISSUER,
  TWO_FACTOR_VERIFIED,
  TwoFactorUnavailableError,
  consumeOnce,
  isConsumed,
  registerAttempt,
  signChallenge,
  signCompletion,
  twoFactorKeys,
  verifyTwoFactorToken,
} from '@/lib/auth/two-factor-token';

const SECRET = 'two-factor-token-test-secret';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function decode(token: string): jwt.JwtPayload {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: 'davintrade-2fa',
  }) as jwt.JwtPayload;
}

beforeEach(() => {
  mockRedisStore.clear();
  mockRedisDown = false;
  mockRedisFailPrefix = null;
  mockRedisClientError = null;
  jest.clearAllMocks();
  setEnv('NEXTAUTH_SECRET', SECRET);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

// ─── The contract ─────────────────────────────────────────────────────────────

/**
 * The same block is in `operation-service/src/auth/two-factor-token.util.spec.ts`. The two stacks
 * mint and check each other's tokens against ONE Redis, so a drift in either file's literals fails
 * that stack's test.
 */
const CONTRACT = {
  purposes: { challenge: '2fa_challenge', verified: '2fa_verified' },
  issuer: 'davintrade-2fa',
  ttlSeconds: {
    challenge: 300,
    completion: 60,
    attemptsKey: 300,
    challengeUsed: 300,
    completionUsed: 120,
    totpReplay: 90,
  },
  maxCodeAttempts: 5,
  keys: {
    attempts: '2fa:attempts:J1',
    used: '2fa:used:J1',
    totp: '2fa:totp:U1:123456',
  },
};

describe('the contract shared with operation-service', () => {
  it('exports exactly the agreed purposes, issuer, lifetimes and attempt limit', () => {
    expect({
      purposes: {
        challenge: TWO_FACTOR_CHALLENGE,
        verified: TWO_FACTOR_VERIFIED,
      },
      issuer: TWO_FACTOR_ISSUER,
      ttlSeconds: {
        challenge: CHALLENGE_TTL_SECONDS,
        completion: COMPLETION_TTL_SECONDS,
        attemptsKey: ATTEMPTS_KEY_TTL_SECONDS,
        challengeUsed: CHALLENGE_USED_TTL_SECONDS,
        completionUsed: COMPLETION_USED_TTL_SECONDS,
        totpReplay: TOTP_REPLAY_TTL_SECONDS,
      },
      maxCodeAttempts: MAX_CODE_ATTEMPTS,
    }).toEqual({
      purposes: CONTRACT.purposes,
      issuer: CONTRACT.issuer,
      ttlSeconds: CONTRACT.ttlSeconds,
      maxCodeAttempts: CONTRACT.maxCodeAttempts,
    });
  });

  it('builds the agreed Redis keys', () => {
    expect({
      attempts: twoFactorKeys.attempts('J1'),
      used: twoFactorKeys.used('J1'),
      totp: twoFactorKeys.totp('U1', '123456'),
    }).toEqual(CONTRACT.keys);
  });

  it('signs HS256 tokens with the agreed issuer, subject and lifetimes', () => {
    const challenge = signChallenge({ userId: 'U1', email: 'a@b.test' });
    const completion = signCompletion({ userId: 'U1', challengeJti: 'J1' });

    expect(jwt.decode(challenge, { complete: true })?.header.alg).toBe('HS256');
    const c = decode(challenge);
    expect(c['purpose']).toBe(CONTRACT.purposes.challenge);
    expect(c.iss).toBe(CONTRACT.issuer);
    expect(c.sub).toBe('U1');
    expect(c['email']).toBe('a@b.test');
    expect((c.exp ?? 0) - (c.iat ?? 0)).toBe(CONTRACT.ttlSeconds.challenge);

    const d = decode(completion);
    expect(d['purpose']).toBe(CONTRACT.purposes.verified);
    expect(d.iss).toBe(CONTRACT.issuer);
    expect(d.sub).toBe('U1');
    expect(d['chal']).toBe('J1');
    expect((d.exp ?? 0) - (d.iat ?? 0)).toBe(CONTRACT.ttlSeconds.completion);
    expect(d.jti).not.toBe(c.jti);
  });
});

// ─── The token module ─────────────────────────────────────────────────────────

describe('verifyTwoFactorToken', () => {
  it('returns the user, the e-mail and the jti of a challenge', () => {
    const token = signChallenge({ userId: 'U1', email: 'a@b.test' });

    expect(verifyTwoFactorToken(token, TWO_FACTOR_CHALLENGE)).toEqual({
      userId: 'U1',
      email: 'a@b.test',
      jti: decode(token).jti,
    });
  });

  it('returns the challenge jti of a completion', () => {
    const token = signCompletion({ userId: 'U1', challengeJti: 'J1' });

    expect(verifyTwoFactorToken(token, TWO_FACTOR_VERIFIED)).toMatchObject({
      userId: 'U1',
      jti: decode(token).jti,
      chal: 'J1',
    });
  });

  it('refuses a challenge where a completion is expected and the other way round', () => {
    const challenge = signChallenge({ userId: 'U1', email: 'a@b.test' });
    const completion = signCompletion({ userId: 'U1', challengeJti: 'J1' });

    expect(() =>
      verifyTwoFactorToken(challenge, TWO_FACTOR_VERIFIED)
    ).toThrow();
    expect(() =>
      verifyTwoFactorToken(completion, TWO_FACTOR_CHALLENGE)
    ).toThrow();
  });

  it.each([
    [
      'the old purpose 2fa_verification',
      () =>
        jwt.sign(
          { userId: 'U1', email: 'a@b.test', purpose: '2fa_verification' },
          SECRET,
          { expiresIn: '5m' }
        ),
    ],
    [
      'no purpose at all',
      () => jwt.sign({ userId: 'U1', email: 'a@b.test' }, SECRET),
    ],
    [
      'another secret',
      () =>
        jwt.sign({ purpose: '2fa_challenge', jti: 'j' }, 'other-secret', {
          issuer: 'davintrade-2fa',
          subject: 'U1',
        }),
    ],
    [
      'another issuer',
      () =>
        jwt.sign({ purpose: '2fa_challenge', jti: 'j' }, SECRET, {
          issuer: 'other',
          subject: 'U1',
        }),
    ],
    [
      'another algorithm',
      () =>
        jwt.sign({ purpose: '2fa_challenge', jti: 'j' }, SECRET, {
          algorithm: 'HS512',
          issuer: 'davintrade-2fa',
          subject: 'U1',
        }),
    ],
    [
      'no jti',
      () =>
        jwt.sign({ purpose: '2fa_challenge' }, SECRET, {
          issuer: 'davintrade-2fa',
          subject: 'U1',
        }),
    ],
    [
      'no subject',
      () =>
        jwt.sign({ purpose: '2fa_challenge', jti: 'j' }, SECRET, {
          issuer: 'davintrade-2fa',
        }),
    ],
    [
      'an expired token',
      () =>
        jwt.sign({ purpose: '2fa_challenge', jti: 'j' }, SECRET, {
          issuer: 'davintrade-2fa',
          subject: 'U1',
          expiresIn: -5,
        }),
    ],
    [
      'unsigned (alg none)',
      () =>
        `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from('{"purpose":"2fa_challenge","jti":"j","sub":"U1","iss":"davintrade-2fa"}').toString('base64url')}.`,
    ],
    ['garbage', () => 'not-a-jwt'],
  ])('refuses %s', (_label, make) => {
    expect(() => verifyTwoFactorToken(make(), TWO_FACTOR_CHALLENGE)).toThrow();
  });

  it('fails closed when NEXTAUTH_SECRET is missing (sign and verify)', () => {
    const token = signChallenge({ userId: 'U1', email: 'a@b.test' });
    setEnv('NEXTAUTH_SECRET', undefined);

    expect(() => verifyTwoFactorToken(token, TWO_FACTOR_CHALLENGE)).toThrow();
    expect(() => signChallenge({ userId: 'U1', email: 'a@b.test' })).toThrow();
    expect(() =>
      signCompletion({ userId: 'U1', challengeJti: 'J1' })
    ).toThrow();
  });
});

describe('the Redis helpers', () => {
  it('consumeOnce is true the first time and false after, with the given lifetime', async () => {
    await expect(consumeOnce('k', 90)).resolves.toBe(true);
    await expect(consumeOnce('k', 90)).resolves.toBe(false);
    expect(mockRedisStore.get('k')?.ttl).toBe(90);
    expect(mockRedis.set).toHaveBeenCalledWith('k', '1', 'EX', 90, 'NX');
  });

  it('consumeOnce defaults to the 300 second used-marker lifetime', async () => {
    await consumeOnce('k');
    expect(mockRedisStore.get('k')?.ttl).toBe(300);
  });

  it('isConsumed reads the marker without setting it', async () => {
    await expect(isConsumed('k')).resolves.toBe(false);
    await consumeOnce('k');
    await expect(isConsumed('k')).resolves.toBe(true);
  });

  it('registerAttempt counts, and starts the 300 second window only on the first attempt', async () => {
    await expect(registerAttempt('J1')).resolves.toBe(1);
    await expect(registerAttempt('J1')).resolves.toBe(2);
    await expect(registerAttempt('J1')).resolves.toBe(3);

    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    expect(mockRedis.expire).toHaveBeenCalledWith('2fa:attempts:J1', 300);
  });

  it.each([
    ['consumeOnce', () => consumeOnce('k')],
    ['isConsumed', () => isConsumed('k')],
    ['registerAttempt', () => registerAttempt('J1')],
  ])(
    '%s turns every Redis error into TwoFactorUnavailableError',
    async (_n, run) => {
      mockRedisDown = true;
      await expect(run()).rejects.toBeInstanceOf(TwoFactorUnavailableError);
    }
  );

  it('turns a missing or broken Redis client (no REDIS_URL) into TwoFactorUnavailableError', async () => {
    mockRedisClientError = new Error(
      'REDIS_URL environment variable is not set'
    );
    await expect(consumeOnce('k')).rejects.toBeInstanceOf(
      TwoFactorUnavailableError
    );
  });
});

// ─── POST /api/user/2fa/verify ────────────────────────────────────────────────

function verifyRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

async function post(
  code: string,
  token: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await POST(verifyRequest({ code, token }));
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

const twoFactorUser = {
  id: 'user-1',
  email: 'alice@example.com',
  twoFactorEnabled: true,
  twoFactorSecret: 'encrypted-secret',
  twoFactorBackupCodes: JSON.stringify(['hash-0', 'hash-1']),
};

describe('POST /api/user/2fa/verify', () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserUpdate.mockReset();
    mockVerifyTOTP.mockReset();
    mockVerifyBackupCode.mockReset();
    mockUserFindUnique.mockResolvedValue(twoFactorUser);
    mockUserUpdate.mockResolvedValue({ id: 'user-1' });
    mockVerifyTOTP.mockReturnValue(true);
    mockVerifyBackupCode.mockResolvedValue(-1);
  });

  function challenge(): { token: string; jti: string } {
    const token = signChallenge({
      userId: 'user-1',
      email: twoFactorUser.email,
    });
    return { token, jti: decode(token).jti as string };
  }

  it('a challenge and the right TOTP code give a 2fa_verified completion for that challenge', async () => {
    const { token, jti } = challenge();

    const { status, body } = await post('123456', token);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      verified: true,
      method: 'totp',
    });
    const completion = decode(body['completionToken'] as string);
    expect(completion['purpose']).toBe('2fa_verified');
    expect(completion.sub).toBe('user-1');
    expect(completion['chal']).toBe(jti);
    expect((completion.exp ?? 0) - (completion.iat ?? 0)).toBe(60);
    // The challenge is spent, and so is this TOTP code.
    expect(mockRedisStore.get(`2fa:used:${jti}`)?.ttl).toBe(300);
    expect(mockRedisStore.get('2fa:totp:user-1:123456')?.ttl).toBe(90);
  });

  it('the same challenge a second time is refused with 401 and mints nothing', async () => {
    const { token } = challenge();
    await post('123456', token);

    const { status, body } = await post('123456', token);

    expect(status).toBe(401);
    expect(body).not.toHaveProperty('completionToken');
  });

  it('a wrong code is a 400 with no completion, and the challenge stays usable', async () => {
    const { token } = challenge();
    mockVerifyTOTP.mockReturnValueOnce(false);

    const wrong = await post('000000', token);
    expect(wrong.status).toBe(400);
    expect(wrong.body).toEqual({ error: 'Invalid verification code' });
    expect(mockRedisStore.has('2fa:totp:user-1:000000')).toBe(false);

    const right = await post('123456', token);
    expect(right.status).toBe(200);
    expect(right.body).toHaveProperty('completionToken');
  });

  it('the 6th attempt is a 429 and burns the challenge, even if the code is then right', async () => {
    const { token, jti } = challenge();
    mockVerifyTOTP.mockReturnValue(false);

    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      const wrong = await post('000000', token);
      expect(wrong.status).toBe(400);
    }
    expect(mockRedisStore.get(`2fa:attempts:${jti}`)?.value).toBe('5');
    expect(mockRedisStore.get(`2fa:attempts:${jti}`)?.ttl).toBe(300);

    const sixth = await post('000000', token);
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({
      error: 'Too many attempts. Please log in again.',
    });
    expect(mockVerifyTOTP).toHaveBeenCalledTimes(5);
    expect(mockRedisStore.has(`2fa:used:${jti}`)).toBe(true);

    mockVerifyTOTP.mockReturnValue(true);
    const afterwards = await post('123456', token);
    expect(afterwards.status).toBe(401);
    expect(afterwards.body).not.toHaveProperty('completionToken');
  });

  it('the 5th attempt can still succeed', async () => {
    const { token } = challenge();
    mockVerifyTOTP.mockReturnValue(false);
    for (let attempt = 1; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      await post('000000', token);
    }
    mockVerifyTOTP.mockReturnValue(true);

    const { status, body } = await post('123456', token);

    expect(status).toBe(200);
    expect(body).toHaveProperty('completionToken');
  });

  it('a completion presented as the challenge is a 401', async () => {
    const completion = signCompletion({
      userId: 'user-1',
      challengeJti: 'some-challenge',
    });

    const { status, body } = await post('123456', completion);

    expect(status).toBe(401);
    expect(body).not.toHaveProperty('completionToken');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('a token with the old purpose 2fa_verification is a 401', async () => {
    const old = jwt.sign(
      {
        userId: 'user-1',
        email: twoFactorUser.email,
        purpose: '2fa_verification',
      },
      SECRET,
      { expiresIn: '5m' }
    );

    const { status, body } = await post('123456', old);

    expect(status).toBe(401);
    expect(body).toEqual({
      error: 'Invalid or expired verification token. Please log in again.',
    });
  });

  it('any other JWT signed with the secret (a session token, say) is a 401', async () => {
    const other = jwt.sign({ userId: 'user-1', email: 'a@b.test' }, SECRET);

    const { status } = await post('123456', other);

    expect(status).toBe(401);
  });

  it('the same TOTP code twice, on two challenges, is accepted once (400 the second time)', async () => {
    const first = challenge();
    const second = challenge();

    const a = await post('123456', first.token);
    const b = await post('123456', second.token);

    expect(a.status).toBe(200);
    expect(b.status).toBe(400);
    expect(b.body).toEqual({ error: 'Invalid verification code' });
    expect(b.body).not.toHaveProperty('completionToken');
  });

  it('a backup code gives a completion too, and is marked used', async () => {
    const { token, jti } = challenge();
    mockVerifyBackupCode.mockResolvedValue(0);

    const { status, body } = await post('ABCD-1234', token);

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      verified: true,
      method: 'backup_code',
      remainingBackupCodes: 1,
    });
    expect(decode(body['completionToken'] as string)['chal']).toBe(jti);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.has(`2fa:used:${jti}`)).toBe(true);
  });

  it('a wrong backup code is a 400 with no completion', async () => {
    const { token } = challenge();

    const { status, body } = await post('ABCD1234', token);

    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Invalid backup code' });
  });

  it('a concurrent request that spends the challenge first wins; this one gets a 401 and no completion', async () => {
    const { token, jti } = challenge();
    mockVerifyTOTP.mockImplementationOnce(() => {
      mockRedisStore.set(`2fa:used:${jti}`, { value: '1', ttl: 300 });
      return true;
    });

    const { status, body } = await post('123456', token);

    expect(status).toBe(401);
    expect(body).not.toHaveProperty('completionToken');
  });

  it('Redis down: 503, no completion, and the user is never asked for the code', async () => {
    const { token } = challenge();
    mockRedisDown = true;

    const { status, body } = await post('123456', token);

    expect(status).toBe(503);
    expect(body).toEqual({
      error: 'Verification is temporarily unavailable. Please try again.',
    });
    expect(mockVerifyTOTP).not.toHaveBeenCalled();
  });

  it('Redis failing at the used-marker after a right code: 503 and no completion', async () => {
    const { token } = challenge();
    // The TOTP replay marker goes through; the challenge's own marker is the one that fails.
    mockRedisFailPrefix = '2fa:used:';
    // isConsumed also reads a 2fa:used: key, so let the first read through by failing later:
    mockRedis.exists.mockImplementationOnce(async () => 0);

    const { status, body } = await post('123456', token);

    expect(status).toBe(503);
    expect(body).not.toHaveProperty('completionToken');
  });

  it('a missing NEXTAUTH_SECRET is a 401 (nothing can be minted or checked)', async () => {
    const { token } = challenge();
    setEnv('NEXTAUTH_SECRET', undefined);

    const { status } = await post('123456', token);

    expect(status).toBe(401);
  });

  it('still answers 404 for a user that no longer exists and 400 when 2FA is off', async () => {
    const { token } = challenge();
    mockUserFindUnique.mockResolvedValueOnce(null);
    expect((await post('123456', token)).status).toBe(404);

    const again = challenge();
    mockUserFindUnique.mockResolvedValueOnce({
      ...twoFactorUser,
      twoFactorEnabled: false,
    });
    expect((await post('123456', again.token)).status).toBe(400);
  });
});
