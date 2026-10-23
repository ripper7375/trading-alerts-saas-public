/**
 * @jest-environment node
 */
/**
 * CODE-06B: the payout step-up token (`payout_stepup`, 120 seconds) and the attempt budget of the
 * step-up routes.
 *
 * The monolith mints the token after a fresh TOTP code (admin) or password (+ TOTP) check;
 * money-service verifies it (`money-service/src/auth/step-up.guard.ts`) and spends its jti. The
 * contract block below is mirrored there, so a drift in either file's literals fails that stack's
 * test.
 */

import jwt from 'jsonwebtoken';

const mockRedisStore = new Map<string, { value: string; ttl: number }>();
let mockRedisDown = false;
const mockGuard = (): void => {
  if (mockRedisDown) throw new Error('redis down');
};
const mockRedis = {
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

import {
  PAYOUT_STEP_UP_ATTEMPT_LIMIT,
  PAYOUT_STEP_UP_ATTEMPT_WINDOW_SECONDS,
  PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
  PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
  PAYOUT_STEP_UP_HEADER,
  PAYOUT_STEP_UP_TTL_SECONDS,
  TWO_FACTOR_CHALLENGE,
  TWO_FACTOR_ISSUER,
  TWO_FACTOR_PAYOUT_STEP_UP,
  TwoFactorUnavailableError,
  clearStepUpAttempts,
  reserveStepUpAttempt,
  signPayoutStepUp,
  twoFactorKeys,
  verifyTwoFactorToken,
} from '@/lib/auth/two-factor-token';

const SECRET = 'payout-step-up-test-secret';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

function decode(token: string, audience: string): jwt.JwtPayload {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: TWO_FACTOR_ISSUER,
    audience,
  }) as jwt.JwtPayload;
}

beforeEach(() => {
  mockRedisStore.clear();
  mockRedisDown = false;
  jest.clearAllMocks();
  setEnv('NEXTAUTH_SECRET', SECRET);
});

/**
 * The same block is in `money-service/src/auth/step-up.guard.spec.ts`: the monolith mints and
 * money-service checks, so the purpose, the issuer, the audiences, the lifetime and the header
 * name must be the same on both sides.
 */
const CONTRACT = {
  purpose: 'payout_stepup',
  issuer: 'davintrade-2fa',
  audiences: {
    approval: 'money-service:payout-approval',
    wiseRecipient: 'money-service:wise-recipient',
  },
  ttlSeconds: 120,
  header: 'X-Payout-Step-Up',
};

describe('the contract shared with money-service', () => {
  it('exports exactly the agreed purpose, issuer, audiences, lifetime and header', () => {
    expect({
      purpose: TWO_FACTOR_PAYOUT_STEP_UP,
      issuer: TWO_FACTOR_ISSUER,
      audiences: {
        approval: PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
        wiseRecipient: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
      },
      ttlSeconds: PAYOUT_STEP_UP_TTL_SECONDS,
      header: PAYOUT_STEP_UP_HEADER,
    }).toEqual(CONTRACT);
  });

  it('keeps the attempt budget at 5 per 15 minutes under a key per user', () => {
    expect(PAYOUT_STEP_UP_ATTEMPT_LIMIT).toBe(5);
    expect(PAYOUT_STEP_UP_ATTEMPT_WINDOW_SECONDS).toBe(15 * 60);
    expect(twoFactorKeys.stepUpAttempts('U1')).toBe(
      'payout-stepup:attempts:U1'
    );
  });
});

describe('signPayoutStepUp', () => {
  it('signs an HS256 token for one user and one audience that lives 120 seconds', () => {
    const token = signPayoutStepUp({
      userId: 'U1',
      audience: PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
    });

    expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256');
    const claims = decode(token, CONTRACT.audiences.approval);
    expect(claims['purpose']).toBe(CONTRACT.purpose);
    expect(claims.iss).toBe(CONTRACT.issuer);
    expect(claims.sub).toBe('U1');
    expect(claims.aud).toBe(CONTRACT.audiences.approval);
    expect(typeof claims.jti).toBe('string');
    expect((claims.exp ?? 0) - (claims.iat ?? 0)).toBe(CONTRACT.ttlSeconds);
  });

  it('gives every token its own jti, so each can be spent once', () => {
    const a = signPayoutStepUp({
      userId: 'U1',
      audience: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
    });
    const b = signPayoutStepUp({
      userId: 'U1',
      audience: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
    });

    expect(decode(a, CONTRACT.audiences.wiseRecipient).jti).not.toBe(
      decode(b, CONTRACT.audiences.wiseRecipient).jti
    );
  });

  it('is not a sign-in token: no sign-in step accepts it', () => {
    const token = signPayoutStepUp({
      userId: 'U1',
      audience: PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
    });

    expect(() => verifyTwoFactorToken(token, TWO_FACTOR_CHALLENGE)).toThrow();
  });

  it('throws when the signing secret is missing, rather than signing with nothing', () => {
    setEnv('NEXTAUTH_SECRET', undefined);

    expect(() =>
      signPayoutStepUp({
        userId: 'U1',
        audience: PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
      })
    ).toThrow('NEXTAUTH_SECRET');
  });
});

describe('the step-up attempt budget', () => {
  it('lets 5 attempts through and blocks the 6th, with the time left', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(reserveStepUpAttempt('U1')).resolves.toEqual({
        blocked: false,
        retryAfterSeconds: 0,
      });
    }

    const sixth = await reserveStepUpAttempt('U1');

    expect(sixth.blocked).toBe(true);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
    expect(sixth.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);
  });

  it('starts the 15-minute window at the first attempt', async () => {
    await reserveStepUpAttempt('U1');

    expect(mockRedis.expire).toHaveBeenCalledWith(
      'payout-stepup:attempts:U1',
      15 * 60
    );
  });

  it('keeps one budget per user', async () => {
    for (let i = 0; i < 6; i += 1) await reserveStepUpAttempt('U1');

    await expect(reserveStepUpAttempt('U2')).resolves.toMatchObject({
      blocked: false,
    });
  });

  it('forgets the failures of a user once the check succeeds', async () => {
    for (let i = 0; i < 4; i += 1) await reserveStepUpAttempt('U1');

    await clearStepUpAttempts('U1');

    expect(mockRedisStore.has('payout-stepup:attempts:U1')).toBe(false);
    await expect(reserveStepUpAttempt('U1')).resolves.toMatchObject({
      blocked: false,
    });
  });

  it('fails CLOSED when Redis is down (the step-up must not run unmetered)', async () => {
    mockRedisDown = true;

    await expect(reserveStepUpAttempt('U1')).rejects.toBeInstanceOf(
      TwoFactorUnavailableError
    );
    await expect(clearStepUpAttempts('U1')).rejects.toBeInstanceOf(
      TwoFactorUnavailableError
    );
  });
});
