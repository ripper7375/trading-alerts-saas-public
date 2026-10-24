/**
 * WS-11 (CODE-06C): money-service's twin of the monolith's
 * `lib/affiliate/payment-details-crypto.ts`.
 *
 * money-service only READS `AffiliateProfile.paymentDetails` (the admin
 * commission-owings report and the admin affiliate detail). It decrypts
 * `paymentDetailsEncrypted` first and falls back to the plaintext column.
 * It still carries the encrypt side so the format is held by one suite per
 * stack: the known-answer vector below is the same literal as in the
 * monolith's suite (`__tests__/lib/affiliate/payment-details-crypto.test.ts`).
 */
import * as fs from 'fs';
import * as path from 'path';

import { Logger } from '@nestjs/common';

import {
  PaymentDetailsCryptoError,
  PaymentDetailsKeyError,
  decryptPaymentDetails,
  encryptPaymentDetails,
  readPaymentDetails,
  withoutPaymentDetailsCiphertext,
} from './payment-details-crypto';

const KEY_ENV = 'PAYMENT_DETAILS_ENCRYPTION_KEY';
const KEY_A = '11'.repeat(32);
const KEY_B = '22'.repeat(32);
/** Made with the public test key and IV 000102030405060708090a0b (same literal in the monolith). */
const KNOWN_VECTOR =
  'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3ad05b2120a194f319199952a10b5d2e42ce0d9e2a0ffa4a5663b1';

const DETAILS = {
  email: 'alice@wise.test',
  iban: 'DE89370400440532013000',
};

const savedKey = process.env[KEY_ENV];
const savedNodeEnv = process.env['NODE_ENV'];

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  setEnv(KEY_ENV, savedKey);
  setEnv('NODE_ENV', savedNodeEnv);
  jest.restoreAllMocks();
});

describe('encrypt / decrypt', () => {
  beforeEach(() => setEnv(KEY_ENV, KEY_A));

  it('writes v1:<iv>:<tag>:<ciphertext> in hex', () => {
    expect(encryptPaymentDetails(DETAILS)).toMatch(
      /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/
    );
  });

  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptPaymentDetails(DETAILS);
    const b = encryptPaymentDetails(DETAILS);
    expect(a).not.toBe(b);
    expect(decryptPaymentDetails(a)).toEqual(DETAILS);
    expect(decryptPaymentDetails(encryptPaymentDetails({}))).toEqual({});
    expect(decryptPaymentDetails(encryptPaymentDetails(null))).toBeNull();
  });

  it('opens a ciphertext made by the monolith (known-answer vector)', () => {
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'test');
    expect(decryptPaymentDetails(KNOWN_VECTOR)).toEqual({
      email: 'vector@wise.test',
    });
  });

  it('refuses a changed ciphertext, a changed tag and a truncated tag', () => {
    const [v, iv, tag, ct] = encryptPaymentDetails(DETAILS).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const flip = (s: string): string =>
      `${s.slice(0, -1)}${s.endsWith('0') ? '1' : '0'}`;
    expect(() =>
      decryptPaymentDetails([v, iv, tag, flip(ct)].join(':'))
    ).toThrow(PaymentDetailsCryptoError);
    expect(() =>
      decryptPaymentDetails([v, iv, flip(tag), ct].join(':'))
    ).toThrow(PaymentDetailsCryptoError);
    expect(() =>
      decryptPaymentDetails([v, iv, tag.slice(0, 8), ct].join(':'))
    ).toThrow(PaymentDetailsCryptoError);
  });

  it('refuses a well-formed ciphertext under another version label', () => {
    const blob = encryptPaymentDetails(DETAILS);
    expect(() => decryptPaymentDetails(blob.replace(/^v1:/, 'v2:'))).toThrow(
      PaymentDetailsCryptoError
    );
  });

  it('refuses a ciphertext made under another key', () => {
    const blob = encryptPaymentDetails(DETAILS);
    setEnv(KEY_ENV, KEY_B);
    expect(() => decryptPaymentDetails(blob)).toThrow(
      PaymentDetailsCryptoError
    );
  });

  it.each([
    ['an unknown version', 'v2:000102030405060708090a0b:00:00'],
    [
      'three parts',
      'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b',
    ],
    ['a short IV', 'v1:0001:151ee91b194826127c6f331bbbf6929b:6d3a'],
    [
      'non-hex text',
      'v1:zz0102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3a',
    ],
    [
      'an empty ciphertext',
      'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:',
    ],
    ['an empty string', ''],
  ])('refuses %s', (_label, blob) => {
    expect(() => decryptPaymentDetails(blob)).toThrow(
      PaymentDetailsCryptoError
    );
  });
});

describe('the key', () => {
  it('falls back to the public test key outside production', () => {
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'test');
    expect(decryptPaymentDetails(encryptPaymentDetails(DETAILS))).toEqual(
      DETAILS
    );
  });

  it('fails closed in production when the variable is missing or empty', () => {
    setEnv('NODE_ENV', 'production');
    setEnv(KEY_ENV, undefined);
    expect(() => encryptPaymentDetails(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
    expect(() => decryptPaymentDetails(KNOWN_VECTOR)).toThrow(
      PaymentDetailsKeyError
    );
    setEnv(KEY_ENV, '  ');
    expect(() => encryptPaymentDetails(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
  });

  it.each([
    ['too short', 'ab'.repeat(16)],
    ['too long', 'ab'.repeat(33)],
    ['not hex', 'zz'.repeat(32)],
  ])('refuses a variable that is %s, even outside production', (_l, bad) => {
    setEnv('NODE_ENV', 'test');
    setEnv(KEY_ENV, bad);
    expect(() => encryptPaymentDetails(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
  });
});

describe('readPaymentDetails (decrypt first, plaintext as the fallback)', () => {
  beforeEach(() => setEnv(KEY_ENV, KEY_A));

  it('prefers the encrypted column', () => {
    expect(
      readPaymentDetails({
        paymentDetails: { email: 'stale@old.test' },
        paymentDetailsEncrypted: encryptPaymentDetails(DETAILS),
      })
    ).toEqual(DETAILS);
  });

  it.each([null, undefined])(
    'uses the plaintext column when the encrypted one is %s',
    (m) => {
      const error = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      expect(
        readPaymentDetails({
          paymentDetails: DETAILS,
          paymentDetailsEncrypted: m,
        })
      ).toEqual(DETAILS);
      expect(error).not.toHaveBeenCalled();
    }
  );

  it('falls back and logs, without a value in the log, when the ciphertext does not open', () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const blob = encryptPaymentDetails({ email: 'other@key.test' });
    setEnv(KEY_ENV, KEY_B);

    expect(
      readPaymentDetails({
        paymentDetails: DETAILS,
        paymentDetailsEncrypted: blob,
      })
    ).toEqual(DETAILS);

    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain('DE89370400440532013000');
    expect(logged).not.toContain(blob);
  });

  it('falls back when the key is missing in production', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const blob = encryptPaymentDetails(DETAILS);
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'production');
    expect(
      readPaymentDetails({
        paymentDetails: DETAILS,
        paymentDetailsEncrypted: blob,
      })
    ).toEqual(DETAILS);
  });
});

describe('withoutPaymentDetailsCiphertext', () => {
  it('removes the encrypted column from a copy', () => {
    const row = {
      id: 'p',
      paymentDetails: {},
      paymentDetailsEncrypted: 'v1:a:b:c',
    };
    const out = withoutPaymentDetailsCiphertext(row);
    expect(out).toEqual({ id: 'p', paymentDetails: {} });
    expect(out).not.toHaveProperty('paymentDetailsEncrypted');
    expect(row.paymentDetailsEncrypted).toBe('v1:a:b:c');
  });
});

describe('the schema', () => {
  it('declares the nullable column and keeps the plain one', () => {
    const text = fs.readFileSync(
      path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
      'utf8'
    );
    const start = text.indexOf('model AffiliateProfile {');
    const model = text.slice(start, text.indexOf('\n}', start));
    expect(model).toMatch(
      /^\s*paymentDetailsEncrypted\s+String\?\s*(\/\/.*)?$/m
    );
    expect(model).toMatch(/^\s*paymentDetails\s+Json\s*(\/\/.*)?$/m);
  });
});
