/**
 * @jest-environment node
 */
/**
 * lib/security/signed-value.ts -- signed, purpose-bound, time-stamped values.
 *
 * A value verifies only for the purpose it was signed for, under the key it
 * was signed with, and while it is young enough. Everything else is `null`.
 */

import {
  SIGNED_VALUE_FUTURE_SKEW_SECONDS,
  currentUnixSeconds,
  signIdPair,
  verifyIdPair,
} from '@/lib/security/signed-value';

const env = process.env as Record<string, string | undefined>;
const SAVED = {
  NEXTAUTH_SECRET: env['NEXTAUTH_SECRET'],
  NODE_ENV: env['NODE_ENV'],
  VERCEL_ENV: env['VERCEL_ENV'],
};

const NOW = 1_793_000_000;
const MAX_AGE = 2 * 60 * 60;

function sign(
  purpose: 'uview1' | 'aview1' = 'uview1',
  first = 'admin_1',
  second = 'user_42',
  iat = NOW
): string {
  return signIdPair(purpose, first, second, iat);
}

function verify(
  value: string | null | undefined,
  nowSec = NOW,
  purpose: 'uview1' | 'aview1' = 'uview1'
): ReturnType<typeof verifyIdPair> {
  return verifyIdPair(purpose, value, { maxAgeSeconds: MAX_AGE, nowSec });
}

function restoreEnv(): void {
  for (const [name, value] of Object.entries(SAVED)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
}

afterEach(() => {
  restoreEnv();
  jest.restoreAllMocks();
});

describe('shape', () => {
  it('is purpose:first:second:iat:mac with a 64-character lowercase hex mac', () => {
    expect(sign()).toMatch(/^uview1:admin_1:user_42:1793000000:[0-9a-f]{64}$/);
    expect(sign('aview1', 'admin_1', 'prof_1')).toMatch(
      /^aview1:admin_1:prof_1:1793000000:[0-9a-f]{64}$/
    );
  });

  it('is deterministic for the same inputs and differs when any input differs', () => {
    expect(sign()).toBe(sign());
    const variants = [
      sign('aview1'),
      sign('uview1', 'admin_2'),
      sign('uview1', 'admin_1', 'user_43'),
      sign('uview1', 'admin_1', 'user_42', NOW + 1),
    ];
    expect(new Set([sign(), ...variants]).size).toBe(5);
  });

  it('stamps the current time when no issue time is given', () => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000 + 999);
    expect(currentUnixSeconds()).toBe(NOW);
    expect(signIdPair('uview1', 'admin_1', 'user_42')).toBe(sign());
  });

  it('refuses to sign a malformed id or issue time', () => {
    expect(() => sign('uview1', 'admin:1')).toThrow();
    expect(() => sign('uview1', 'admin_1', '')).toThrow();
    expect(() => sign('uview1', 'admin_1', 'x'.repeat(65))).toThrow();
    expect(() => sign('uview1', 'admin_1', 'user 42')).toThrow();
    expect(() => sign('uview1', 'admin_1', '../etc')).toThrow();
    expect(() => sign('uview1', 'admin_1', 'user_42', -1)).toThrow();
    expect(() => sign('uview1', 'admin_1', 'user_42', 1.5)).toThrow();
    expect(() => sign('uview1', 'admin_1', 'user_42', 10 ** 12)).toThrow();
  });
});

describe('verification', () => {
  it('round-trips both ids and the issue time', () => {
    expect(verify(sign())).toEqual({
      firstId: 'admin_1',
      secondId: 'user_42',
      issuedAtSec: NOW,
    });
  });

  it('accepts the 64-character ids that signing accepts', () => {
    const id = 'x'.repeat(64);
    expect(verify(sign('uview1', id, id))).toMatchObject({
      firstId: id,
      secondId: id,
    });
  });

  it.each([
    [undefined],
    [null],
    [''],
    ['only-one-part'],
    ['admin_1:user_42'],
    ['a:b:c'],
    ['uview1:admin_1:user_42:1793000000'],
    ['uview1:admin_1:user_42:1793000000:'],
    [`uview1:admin_1:user_42:1793000000:${'0'.repeat(64)}`],
    [`${sign()}:extra`],
    [`x${sign()}`],
    [` ${sign()}`],
    [`${sign()} `],
  ])('rejects %p', (value) => {
    expect(verify(value)).toBeNull();
  });

  it('rejects a value of absurd length without processing it', () => {
    expect(verify(`uview1:${'a'.repeat(5000)}`)).toBeNull();
  });

  it('rejects a value whose first id, second id or issue time does not match its signature', () => {
    const [purpose, first, second, iat, mac] = sign().split(':') as [
      string,
      string,
      string,
      string,
      string,
    ];
    expect(verify([purpose, 'admin_2', second, iat, mac].join(':'))).toBeNull();
    expect(verify([purpose, first, 'user_43', iat, mac].join(':'))).toBeNull();
    expect(
      verify([purpose, first, second, String(NOW + 1), mac].join(':'))
    ).toBeNull();
    // the same value, untouched, still verifies
    expect(verify([purpose, first, second, iat, mac].join(':'))).not.toBeNull();
  });

  it('rejects a signature that is altered, shortened, lengthened or not lowercase hex', () => {
    const [purpose, first, second, iat, mac] = sign().split(':') as [
      string,
      string,
      string,
      string,
      string,
    ];
    const flipped = `${mac.slice(0, -1)}${mac.endsWith('0') ? '1' : '0'}`;
    const join = (m: string): string =>
      [purpose, first, second, iat, m].join(':');

    expect(verify(join(flipped))).toBeNull();
    expect(verify(join(mac.slice(0, 63)))).toBeNull();
    expect(verify(join(`${mac}0`))).toBeNull();
    expect(verify(join(mac.toUpperCase()))).toBeNull();
    expect(verify(join(`${mac.slice(0, 63)}g`))).toBeNull();
  });

  it('rejects a value signed for a different purpose, including a relabelled one', () => {
    const forAffiliate = sign('aview1', 'admin_1', 'prof_1');
    expect(verify(forAffiliate)).toBeNull();
    expect(verify(forAffiliate, NOW, 'aview1')).not.toBeNull();

    const relabelled = forAffiliate.replace(/^aview1/, 'uview1');
    expect(verify(relabelled)).toBeNull();

    const forUser = sign('uview1', 'admin_1', 'prof_1');
    expect(verify(forUser, NOW, 'aview1')).toBeNull();
    expect(
      verify(forUser.replace(/^uview1/, 'aview1'), NOW, 'aview1')
    ).toBeNull();
  });
});

describe('age', () => {
  it('accepts a value up to the maximum age and rejects it one second later', () => {
    const value = sign();
    expect(verify(value, NOW)).not.toBeNull();
    expect(verify(value, NOW + MAX_AGE)).not.toBeNull();
    expect(verify(value, NOW + MAX_AGE + 1)).toBeNull();
    expect(verify(value, NOW + 10 * MAX_AGE)).toBeNull();
  });

  it('accepts a small clock skew into the future and rejects more than that', () => {
    const value = sign('uview1', 'admin_1', 'user_42', NOW + 30);
    expect(verify(value, NOW)).not.toBeNull();

    const edge = sign(
      'uview1',
      'admin_1',
      'user_42',
      NOW + SIGNED_VALUE_FUTURE_SKEW_SECONDS
    );
    expect(verify(edge, NOW)).not.toBeNull();

    const tooFar = sign(
      'uview1',
      'admin_1',
      'user_42',
      NOW + SIGNED_VALUE_FUTURE_SKEW_SECONDS + 1
    );
    expect(verify(tooFar, NOW)).toBeNull();
  });

  it('compares with the current clock when no time is given', () => {
    jest.spyOn(Date, 'now').mockReturnValue((NOW + MAX_AGE) * 1000);
    const value = sign();
    expect(
      verifyIdPair('uview1', value, { maxAgeSeconds: MAX_AGE })
    ).not.toBeNull();

    jest.spyOn(Date, 'now').mockReturnValue((NOW + MAX_AGE + 1) * 1000);
    expect(
      verifyIdPair('uview1', value, { maxAgeSeconds: MAX_AGE })
    ).toBeNull();
  });
});

describe('signing key', () => {
  it('does not verify under a different NEXTAUTH_SECRET', () => {
    env['NEXTAUTH_SECRET'] = 'secret-one';
    const value = sign();
    expect(verify(value)).not.toBeNull();

    env['NEXTAUTH_SECRET'] = 'secret-two';
    expect(verify(value)).toBeNull();
  });

  it('uses the development key only when no secret is set outside production and Vercel production/preview', () => {
    delete env['NEXTAUTH_SECRET'];
    env['NODE_ENV'] = 'development';
    delete env['VERCEL_ENV'];

    const value = sign();
    expect(verify(value)).not.toBeNull();

    // `vercel dev` is a development environment too
    env['VERCEL_ENV'] = 'development';
    expect(verify(value)).not.toBeNull();

    // a value minted with the development key never verifies once a real secret is set
    env['NEXTAUTH_SECRET'] = 'a-real-secret';
    expect(verify(value)).toBeNull();
  });

  it.each([
    ['a production build', { NODE_ENV: 'production', VERCEL_ENV: undefined }],
    [
      'a Vercel production deployment',
      { NODE_ENV: 'test', VERCEL_ENV: 'production' },
    ],
    [
      'a Vercel preview deployment',
      { NODE_ENV: 'test', VERCEL_ENV: 'preview' },
    ],
    [
      'a Vercel preview build running as production',
      { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
    ],
  ])(
    'has no fallback key on %s: signing throws and verifying fails closed',
    (_label, settings) => {
      // mint a value while the development fallback is allowed
      delete env['NEXTAUTH_SECRET'];
      env['NODE_ENV'] = 'development';
      delete env['VERCEL_ENV'];
      const minted = sign();
      expect(verify(minted)).not.toBeNull();

      // the same process, now configured as the deployed environment, with no secret
      for (const [name, value] of Object.entries(settings)) {
        if (value === undefined) delete env[name];
        else env[name] = value;
      }
      delete env['NEXTAUTH_SECRET'];

      expect(() => sign()).toThrow(/NEXTAUTH_SECRET/);
      expect(verify(minted)).toBeNull();
    }
  );
});
