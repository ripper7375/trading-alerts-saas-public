import jwt from 'jsonwebtoken';

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
  type TwoFactorRedis,
  TwoFactorUnavailableError,
  consumeOnce,
  isConsumed,
  registerAttempt,
  signChallenge,
  signCompletion,
  twoFactorKeys,
  verifyTwoFactorToken,
} from './two-factor-token.util';

/**
 * CODE-01A: the two-stage 2FA tokens, operation-service's half.
 *
 * The monolith (`lib/auth/two-factor-token.ts`) and this module mint and check each other's tokens
 * against ONE Redis. `CONTRACT` below is the same block as in
 * `__tests__/lib/auth/two-factor-token.test.ts`: if either stack's literals drift, that stack's
 * test fails.
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

const SECRET = 'test-nextauth-secret-value-not-real';

/** An in-memory stand-in for the shared Redis: SET ... EX ... NX, EXISTS, INCR, EXPIRE. */
function fakeRedis() {
  const store = new Map<string, { value: string; ttl: number | null }>();
  const state = { down: false };
  const guard = (): void => {
    if (state.down) throw new Error('redis down');
  };
  const redis = {
    set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
      guard();
      const ttl = args[0] === 'EX' ? (args[1] as number) : null;
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, { value, ttl });
      return 'OK';
    }),
    exists: jest.fn(async (key: string) => {
      guard();
      return store.has(key) ? 1 : 0;
    }),
    incr: jest.fn(async (key: string) => {
      guard();
      const next = Number(store.get(key)?.value ?? '0') + 1;
      store.set(key, {
        value: String(next),
        ttl: store.get(key)?.ttl ?? null,
      });
      return next;
    }),
    expire: jest.fn(async (key: string, ttl: number) => {
      guard();
      const entry = store.get(key);
      if (entry) entry.ttl = ttl;
      return entry ? 1 : 0;
    }),
  };
  return {
    redis: redis as unknown as TwoFactorRedis,
    mocks: redis,
    store,
    state,
  };
}

function decode(token: string): jwt.JwtPayload {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: 'davintrade-2fa',
  }) as jwt.JwtPayload;
}

describe('two-factor-token.util', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = SECRET;
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  describe('the contract shared with the monolith', () => {
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

      expect(jwt.decode(challenge, { complete: true })?.header.alg).toBe(
        'HS256'
      );
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

    it('accepts a token the monolith would mint (same literals, signed here by hand)', () => {
      const monolithChallenge = jwt.sign(
        { purpose: '2fa_challenge', email: 'a@b.test', jti: 'J1' },
        SECRET,
        {
          algorithm: 'HS256',
          issuer: 'davintrade-2fa',
          subject: 'U1',
          expiresIn: 300,
        }
      );

      expect(
        verifyTwoFactorToken(monolithChallenge, TWO_FACTOR_CHALLENGE)
      ).toEqual({ userId: 'U1', email: 'a@b.test', jti: 'J1' });
    });
  });

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
          `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(
            '{"purpose":"2fa_challenge","jti":"j","sub":"U1","iss":"davintrade-2fa"}'
          ).toString('base64url')}.`,
      ],
      ['garbage', () => 'not-a-jwt'],
    ])('refuses %s', (_label, make) => {
      expect(() =>
        verifyTwoFactorToken(make(), TWO_FACTOR_CHALLENGE)
      ).toThrow();
    });

    it('fails closed when NEXTAUTH_SECRET is missing (sign and verify)', () => {
      const token = signChallenge({ userId: 'U1', email: 'a@b.test' });
      delete process.env['NEXTAUTH_SECRET'];

      expect(() => verifyTwoFactorToken(token, TWO_FACTOR_CHALLENGE)).toThrow();
      expect(() =>
        signChallenge({ userId: 'U1', email: 'a@b.test' })
      ).toThrow();
      expect(() =>
        signCompletion({ userId: 'U1', challengeJti: 'J1' })
      ).toThrow();
    });
  });

  describe('the Redis helpers', () => {
    it('consumeOnce is true the first time and false after, with the given lifetime', async () => {
      const { redis, mocks, store } = fakeRedis();

      await expect(consumeOnce(redis, 'k', 90)).resolves.toBe(true);
      await expect(consumeOnce(redis, 'k', 90)).resolves.toBe(false);

      expect(store.get('k')?.ttl).toBe(90);
      expect(mocks.set).toHaveBeenCalledWith('k', '1', 'EX', 90, 'NX');
    });

    it('consumeOnce defaults to the 300 second used-marker lifetime', async () => {
      const { redis, store } = fakeRedis();

      await consumeOnce(redis, 'k');

      expect(store.get('k')?.ttl).toBe(300);
    });

    it('isConsumed reads the marker without setting it', async () => {
      const { redis } = fakeRedis();

      await expect(isConsumed(redis, 'k')).resolves.toBe(false);
      await consumeOnce(redis, 'k');
      await expect(isConsumed(redis, 'k')).resolves.toBe(true);
    });

    it('registerAttempt counts, and starts the 300 second window only on the first attempt', async () => {
      const { redis, mocks } = fakeRedis();

      await expect(registerAttempt(redis, 'J1')).resolves.toBe(1);
      await expect(registerAttempt(redis, 'J1')).resolves.toBe(2);
      await expect(registerAttempt(redis, 'J1')).resolves.toBe(3);

      expect(mocks.expire).toHaveBeenCalledTimes(1);
      expect(mocks.expire).toHaveBeenCalledWith('2fa:attempts:J1', 300);
    });

    it.each([
      ['consumeOnce', (r: TwoFactorRedis) => consumeOnce(r, 'k')],
      ['isConsumed', (r: TwoFactorRedis) => isConsumed(r, 'k')],
      ['registerAttempt', (r: TwoFactorRedis) => registerAttempt(r, 'J1')],
    ])(
      '%s turns every Redis error into TwoFactorUnavailableError',
      async (_name, run) => {
        const { redis, state } = fakeRedis();
        state.down = true;

        await expect(run(redis)).rejects.toBeInstanceOf(
          TwoFactorUnavailableError
        );
      }
    );
  });
});
