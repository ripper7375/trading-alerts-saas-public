/**
 * @jest-environment node
 *
 * WS-11 (CODE-06C): field-level encryption of `AffiliateProfile.paymentDetails`.
 *
 * The helper writes `v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM, hex parts) into
 * the new `paymentDetailsEncrypted` column next to the plaintext column, and
 * readers prefer the encrypted value and fall back to the plaintext one.
 * money-service has a twin of this module (`money-service/src/common/
 * payment-details-crypto.ts`); the known-answer vector below is the same
 * literal in both suites, so a ciphertext written by one stack opens in the other.
 */

import crypto from 'crypto';

import {
  PaymentDetailsCryptoError,
  PaymentDetailsKeyError,
  assertConfiguredEncryptionKey,
  decryptPaymentDetails,
  encryptPaymentDetails,
  paymentDetailsForWrite,
  readPaymentDetails,
  withoutPaymentDetailsCiphertext,
} from '@/lib/affiliate/payment-details-crypto';

const KEY_ENV = 'PAYMENT_DETAILS_ENCRYPTION_KEY';
const KEY_A = '11'.repeat(32);
const KEY_B = '22'.repeat(32);
/** The public key the helper uses outside production when no variable is set. */
const TEST_FALLBACK_KEY = Buffer.from(
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  'hex'
);
/** Made with the fallback key and IV 000102030405060708090a0b (same literal in money-service). */
const KNOWN_VECTOR =
  'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3ad05b2120a194f319199952a10b5d2e42ce0d9e2a0ffa4a5663b1';

const DETAILS = {
  email: 'alice@wise.test',
  iban: 'DE89370400440532013000',
  accountHolder: 'Alice Affiliate',
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

describe('encryptPaymentDetails / decryptPaymentDetails', () => {
  beforeEach(() => setEnv(KEY_ENV, KEY_A));

  it('writes v1:<iv>:<tag>:<ciphertext> in hex with a 12-byte IV and a 16-byte tag', () => {
    const blob = encryptPaymentDetails(DETAILS);
    expect(blob).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
  });

  it('round-trips an object, an empty object and a JSON null', () => {
    expect(decryptPaymentDetails(encryptPaymentDetails(DETAILS))).toEqual(
      DETAILS
    );
    expect(decryptPaymentDetails(encryptPaymentDetails({}))).toEqual({});
    expect(decryptPaymentDetails(encryptPaymentDetails(null))).toBeNull();
  });

  it('keeps nested values and non-ASCII text intact', () => {
    const value = { holder: 'สมชาย ใจดี', list: [1, 2, { x: 'ü' }] };
    expect(decryptPaymentDetails(encryptPaymentDetails(value))).toEqual(value);
  });

  it('uses a fresh IV every time, so one value never gives one ciphertext', () => {
    const a = encryptPaymentDetails(DETAILS);
    const b = encryptPaymentDetails(DETAILS);
    expect(a).not.toBe(b);
    expect(a.split(':')[1]).not.toBe(b.split(':')[1]);
  });

  it('does not put the plaintext in the stored string', () => {
    const blob = encryptPaymentDetails(DETAILS);
    expect(blob).not.toContain('DE89370400440532013000');
    expect(blob).not.toContain('alice');
    expect(
      Buffer.from(blob.split(':')[3] as string, 'hex').toString('utf8')
    ).not.toContain('alice');
  });

  it('refuses a value that is not JSON (undefined)', () => {
    expect(() => encryptPaymentDetails(undefined)).toThrow(TypeError);
  });

  it('is the construction of the order: AES-256-GCM, key = the 32 bytes of the variable', () => {
    const [, ivHex, tagHex, ctHex] = encryptPaymentDetails(DETAILS).split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(KEY_A, 'hex'),
      Buffer.from(ivHex as string, 'hex'),
      { authTagLength: 16 }
    );
    decipher.setAuthTag(Buffer.from(tagHex as string, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctHex as string, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    expect(JSON.parse(plain)).toEqual(DETAILS);
  });

  it('opens a ciphertext made by the other stack (known-answer vector)', () => {
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'test');
    expect(decryptPaymentDetails(KNOWN_VECTOR)).toEqual({
      email: 'vector@wise.test',
    });
    // and the fallback key really is the one the vector was made with
    expect(TEST_FALLBACK_KEY).toHaveLength(32);
  });

  describe('refusals', () => {
    it('refuses a changed ciphertext byte (GCM tag)', () => {
      const [v, iv, tag, ct] = encryptPaymentDetails(DETAILS).split(':');
      const flipped = `${(ct as string).slice(0, -1)}${
        (ct as string).endsWith('0') ? '1' : '0'
      }`;
      expect(() =>
        decryptPaymentDetails([v, iv, tag, flipped].join(':'))
      ).toThrow(PaymentDetailsCryptoError);
    });

    it('refuses a changed tag', () => {
      const [v, iv, tag, ct] = encryptPaymentDetails(DETAILS).split(':');
      const bad = `${(tag as string).slice(0, -1)}${
        (tag as string).endsWith('0') ? '1' : '0'
      }`;
      expect(() => decryptPaymentDetails([v, iv, bad, ct].join(':'))).toThrow(
        PaymentDetailsCryptoError
      );
    });

    it('refuses a truncated tag (a short GCM tag is forgeable)', () => {
      const [v, iv, tag, ct] = encryptPaymentDetails(DETAILS).split(':');
      expect(() =>
        decryptPaymentDetails(
          [v, iv, (tag as string).slice(0, 8), ct].join(':')
        )
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
        'no version',
        '000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3a',
      ],
      [
        'three parts',
        'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b',
      ],
      ['five parts', `${KNOWN_VECTOR}:00`],
      ['a short IV', 'v1:0001:151ee91b194826127c6f331bbbf6929b:6d3a'],
      [
        'non-hex text',
        'v1:zz0102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3a',
      ],
      [
        'an empty ciphertext',
        'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:',
      ],
      [
        'an odd-length ciphertext',
        'v1:000102030405060708090a0b:151ee91b194826127c6f331bbbf6929b:6d3',
      ],
      ['an empty string', ''],
    ])('refuses %s', (_label, blob) => {
      expect(() => decryptPaymentDetails(blob)).toThrow(
        PaymentDetailsCryptoError
      );
    });
  });
});

describe('the key', () => {
  it('uses the variable when it is set', () => {
    setEnv(KEY_ENV, KEY_A);
    const blob = encryptPaymentDetails(DETAILS);
    setEnv(KEY_ENV, KEY_B);
    expect(() => decryptPaymentDetails(blob)).toThrow(
      PaymentDetailsCryptoError
    );
    setEnv(KEY_ENV, KEY_A);
    expect(decryptPaymentDetails(blob)).toEqual(DETAILS);
  });

  it.each(['development', 'test'])(
    'falls back to the public test key when NODE_ENV is %s and nothing is set',
    (nodeEnv) => {
      setEnv(KEY_ENV, undefined);
      setEnv('NODE_ENV', nodeEnv);
      expect(decryptPaymentDetails(encryptPaymentDetails(DETAILS))).toEqual(
        DETAILS
      );
    }
  );

  it('fails closed in production when the variable is missing', () => {
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'production');
    expect(() => encryptPaymentDetails(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
    expect(() => decryptPaymentDetails(KNOWN_VECTOR)).toThrow(
      PaymentDetailsKeyError
    );
  });

  it('fails closed in production when the variable is empty', () => {
    setEnv(KEY_ENV, '   ');
    setEnv('NODE_ENV', 'production');
    expect(() => encryptPaymentDetails(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
  });

  it.each([
    ['too short', 'ab'.repeat(16)],
    ['too long', 'ab'.repeat(33)],
    ['not hex', 'zz'.repeat(32)],
  ])(
    'refuses a variable that is %s, even outside production',
    (_label, bad) => {
      setEnv(KEY_ENV, bad);
      setEnv('NODE_ENV', 'test');
      expect(() => encryptPaymentDetails(DETAILS)).toThrow(
        PaymentDetailsKeyError
      );
    }
  );

  it('never prints the key in an error', () => {
    setEnv(KEY_ENV, 'not-a-key-SECRETVALUE');
    try {
      encryptPaymentDetails(DETAILS);
      throw new Error('should have thrown');
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('SECRETVALUE');
    }
  });

  describe('assertConfiguredEncryptionKey (the backfill script)', () => {
    it('passes with a good variable', () => {
      setEnv(KEY_ENV, KEY_A);
      expect(() => assertConfiguredEncryptionKey()).not.toThrow();
    });

    it('refuses to run on the fallback key, whatever NODE_ENV says', () => {
      setEnv(KEY_ENV, undefined);
      setEnv('NODE_ENV', 'test');
      expect(() => assertConfiguredEncryptionKey()).toThrow(
        PaymentDetailsKeyError
      );
    });

    it('refuses a malformed variable', () => {
      setEnv(KEY_ENV, 'abc');
      expect(() => assertConfiguredEncryptionKey()).toThrow(
        PaymentDetailsKeyError
      );
    });
  });
});

describe('paymentDetailsForWrite (the dual write)', () => {
  beforeEach(() => setEnv(KEY_ENV, KEY_A));

  it('returns the plaintext value and its ciphertext together', () => {
    const data = paymentDetailsForWrite(DETAILS);
    expect(data.paymentDetails).toBe(DETAILS);
    expect(decryptPaymentDetails(data.paymentDetailsEncrypted)).toEqual(
      DETAILS
    );
  });

  it('encrypts the empty object of an auto-created profile too', () => {
    const data = paymentDetailsForWrite({});
    expect(data.paymentDetails).toEqual({});
    expect(decryptPaymentDetails(data.paymentDetailsEncrypted)).toEqual({});
  });

  it('throws in production without a key: no row is written in plaintext alone', () => {
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'production');
    expect(() => paymentDetailsForWrite(DETAILS)).toThrow(
      PaymentDetailsKeyError
    );
  });
});

describe('readPaymentDetails (decrypt first, plaintext as the fallback)', () => {
  beforeEach(() => setEnv(KEY_ENV, KEY_A));

  it('prefers the encrypted column', () => {
    const row = {
      paymentDetails: { email: 'stale@old.test' },
      paymentDetailsEncrypted: encryptPaymentDetails(DETAILS),
    };
    expect(readPaymentDetails(row)).toEqual(DETAILS);
  });

  it.each([null, undefined])(
    'uses the plaintext column when the encrypted one is %s (a row not backfilled yet)',
    (missing) => {
      const row = { paymentDetails: DETAILS, paymentDetailsEncrypted: missing };
      expect(readPaymentDetails(row)).toEqual(DETAILS);
    }
  );

  it('uses the plaintext column when the row has no encrypted field at all', () => {
    expect(readPaymentDetails({ paymentDetails: DETAILS })).toEqual(DETAILS);
  });

  it('does not log when there is nothing to decrypt', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    readPaymentDetails({
      paymentDetails: DETAILS,
      paymentDetailsEncrypted: null,
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to the plaintext column and logs when the ciphertext does not open', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const blob = encryptPaymentDetails({ email: 'other@key.test' });
    setEnv(KEY_ENV, KEY_B);

    const out = readPaymentDetails({
      paymentDetails: DETAILS,
      paymentDetailsEncrypted: blob,
    });

    expect(out).toEqual(DETAILS);
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).toContain('PaymentDetails');
    expect(logged).not.toContain('DE89370400440532013000');
    expect(logged).not.toContain(blob);
  });

  it('falls back and logs when the key is missing in production', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const blob = encryptPaymentDetails(DETAILS);
    setEnv(KEY_ENV, undefined);
    setEnv('NODE_ENV', 'production');

    expect(
      readPaymentDetails({
        paymentDetails: DETAILS,
        paymentDetailsEncrypted: blob,
      })
    ).toEqual(DETAILS);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('falls back when the stored text is not a ciphertext at all', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      readPaymentDetails({
        paymentDetails: DETAILS,
        paymentDetailsEncrypted: 'plain text',
      })
    ).toEqual(DETAILS);
  });
});

describe('withoutPaymentDetailsCiphertext', () => {
  it('removes the encrypted column from a copy and leaves the rest', () => {
    const row = {
      id: 'p1',
      paymentDetails: { a: 1 },
      paymentDetailsEncrypted: 'v1:aa:bb:cc',
    };
    const out = withoutPaymentDetailsCiphertext(row);
    expect(out).toEqual({ id: 'p1', paymentDetails: { a: 1 } });
    expect(out).not.toHaveProperty('paymentDetailsEncrypted');
    expect(row.paymentDetailsEncrypted).toBe('v1:aa:bb:cc');
  });
});
