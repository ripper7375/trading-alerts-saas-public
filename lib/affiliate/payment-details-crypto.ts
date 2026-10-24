/**
 * Field-level encryption of `AffiliateProfile.paymentDetails` (WS-11, CODE-06C).
 *
 * The affiliate's bank or wallet data used to sit in one plain `Json` column. During the
 * transition it is written to TWO columns: the plain `paymentDetails` and the new nullable
 * `paymentDetailsEncrypted`, which holds
 *
 *     v1:<iv>:<tag>:<ciphertext>
 *
 * (AES-256-GCM, every part in hex: a 12-byte IV, a 16-byte tag, the ciphertext of the JSON
 * text of the value). Readers decrypt first and fall back to the plain column, so a row that
 * the backfill has not reached yet still reads. A later order drops the plain column.
 *
 * The construction is the one of `encryptSecret` / `decryptSecret` in `lib/auth/two-factor.ts`
 * (AES-256-GCM, hex parts), with a version prefix, a 12-byte IV (NIST SP 800-38D) and a tag
 * length that is fixed at 16 bytes on both sides, so a shortened tag is refused instead of
 * accepted. The key is `PAYMENT_DETAILS_ENCRYPTION_KEY`: 32 random bytes as 64 hex characters
 * (`openssl rand -hex 32`), used as the AES key as it is.
 *
 * Without the variable: outside production a fixed, PUBLIC test key is used (so `next dev`, Jest
 * and the seed work); in production a write throws `PaymentDetailsKeyError` and a read falls
 * back to the plain column and logs. money-service has a twin of this file
 * (`money-service/src/common/payment-details-crypto.ts`); a known-answer vector held by both
 * test suites keeps the two formats equal.
 *
 * @module lib/affiliate/payment-details-crypto
 */

import 'server-only';

import crypto from 'crypto';

export const PAYMENT_DETAILS_KEY_ENV = 'PAYMENT_DETAILS_ENCRYPTION_KEY';

const CIPHER_VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;

/**
 * TEST ONLY. Published in the repository on purpose: it is used only when no key is configured
 * AND `NODE_ENV` is not `production`. Anything it encrypts is, by definition, not protected.
 */
const PUBLIC_TEST_KEY = Buffer.from(
  '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
  'hex'
);

/** The key is missing or malformed. Never carries the key. */
export class PaymentDetailsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDetailsKeyError';
  }
}

/** A stored value is not a ciphertext this key opens (malformed, tampered, wrong key). */
export class PaymentDetailsCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentDetailsCryptoError';
  }
}

function encryptionKey(allowTestFallback = true): Buffer {
  const raw = process.env[PAYMENT_DETAILS_KEY_ENV]?.trim();

  if (raw) {
    if (!KEY_PATTERN.test(raw)) {
      throw new PaymentDetailsKeyError(
        `${PAYMENT_DETAILS_KEY_ENV} must be 64 hexadecimal characters (32 bytes)`
      );
    }
    return Buffer.from(raw, 'hex');
  }

  if (allowTestFallback && process.env['NODE_ENV'] !== 'production') {
    return PUBLIC_TEST_KEY;
  }
  throw new PaymentDetailsKeyError(`${PAYMENT_DETAILS_KEY_ENV} is not set`);
}

/**
 * For the backfill script: throws unless a REAL key is configured. The public test key is never
 * accepted here, whatever `NODE_ENV` says, so a script run on a laptop cannot encrypt a real row
 * with a key that is in the repository.
 */
export function assertConfiguredEncryptionKey(): void {
  encryptionKey(false);
}

/** Encrypts any JSON value. Throws `TypeError` for a value that has no JSON form. */
export function encryptPaymentDetails(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError('paymentDetails must be a JSON value');
  }

  const key = encryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: TAG_BYTES,
  });
  const ciphertext = Buffer.concat([
    cipher.update(json, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    CIPHER_VERSION,
    iv.toString('hex'),
    tag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
}

/** Decrypts a value made by `encryptPaymentDetails`. Throws instead of returning a guess. */
export function decryptPaymentDetails(blob: string): unknown {
  const parts = blob.split(':');
  const [version, ivHex, tagHex, ctHex] = parts;

  if (
    parts.length !== 4 ||
    version !== CIPHER_VERSION ||
    !ivHex ||
    !tagHex ||
    !ctHex ||
    ivHex.length !== IV_BYTES * 2 ||
    tagHex.length !== TAG_BYTES * 2 ||
    !HEX_PATTERN.test(ivHex) ||
    !HEX_PATTERN.test(tagHex) ||
    !HEX_PATTERN.test(ctHex)
  ) {
    throw new PaymentDetailsCryptoError(
      'The stored payment details are not in the v1 format'
    );
  }

  const key = encryptionKey();

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
      { authTagLength: TAG_BYTES }
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const json = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(json) as unknown;
  } catch {
    throw new PaymentDetailsCryptoError(
      'The stored payment details could not be authenticated'
    );
  }
}

/**
 * The data to put in a Prisma `create` / `upsert` / `update`: the plain value and its
 * ciphertext TOGETHER (the dual write). Spread it: `...paymentDetailsForWrite(details)`.
 *
 * Throws `PaymentDetailsKeyError` in production without a key, so no row is ever written with a
 * plain value alone by a build that was meant to encrypt.
 */
export function paymentDetailsForWrite<T>(value: T): {
  paymentDetails: T;
  paymentDetailsEncrypted: string;
} {
  return {
    paymentDetails: value,
    paymentDetailsEncrypted: encryptPaymentDetails(value),
  };
}

/**
 * The payment details of a profile row: the decrypted value when the row has one, otherwise
 * (a row the backfill has not reached) the plain column. An encrypted value that does not open
 * is logged WITHOUT any value and the plain column is returned, so one bad row or a missing
 * key does not take an admin report down while both columns exist.
 */
export function readPaymentDetails(row: {
  paymentDetails: unknown;
  paymentDetailsEncrypted?: string | null;
}): unknown {
  const blob = row.paymentDetailsEncrypted;
  if (blob === null || blob === undefined) return row.paymentDetails;

  try {
    return decryptPaymentDetails(blob);
  } catch (error) {
    console.error(
      '[PaymentDetails] The encrypted copy could not be read; using the plain column',
      { reason: error instanceof Error ? error.name : 'unknown' }
    );
    return row.paymentDetails;
  }
}

/** A copy of a profile row without the ciphertext, for anything that serializes the row. */
export function withoutPaymentDetailsCiphertext<T extends object>(
  row: T
): Omit<T, 'paymentDetailsEncrypted'> {
  const copy = { ...row } as Record<string, unknown>;
  delete copy['paymentDetailsEncrypted'];
  return copy as Omit<T, 'paymentDetailsEncrypted'>;
}
