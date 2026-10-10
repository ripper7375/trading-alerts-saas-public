/**
 * The keyed hash of a user id that the audit tables keep (architecture 6.11,
 * plan decisions D10 and D12): HMAC-SHA-256, hex, written on every insert next
 * to the user id. When the account is deleted the database sets the id to NULL
 * and the hash stays, so the trader's history and consent rows are still
 * attributable to one anonymous person and to nobody else.
 *
 * The key is the environment variable `ENGINE4_AUDIT_HMAC_KEY`, provisioned by
 * Davin in Vercel; this code never prints it and never has a default for it
 * outside a test. `ENGINE4_AUDIT_HMAC_KEY_VERSION` (a positive whole number,
 * default 1) names the key. Rotating the key means setting a new key and a
 * higher version: rows already written keep their hash and their version and
 * are NEVER recomputed (D12). An old hash can still be recognised, but only
 * with the key of its own version, which the operator keeps; `verifyUserHash`
 * says `OTHER_KEY_VERSION` rather than guessing.
 *
 * @module lib/engine4/store/user-hash
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const AUDIT_KEY_ENV = 'ENGINE4_AUDIT_HMAC_KEY';
export const AUDIT_KEY_VERSION_ENV = 'ENGINE4_AUDIT_HMAC_KEY_VERSION';

/** A key shorter than this many characters is refused. */
export const MIN_AUDIT_KEY_LENGTH = 32;

/**
 * The fixed key tests use when no key is set. It is public (it is in the
 * repository) and is used ONLY when `NODE_ENV` is `test`: anywhere else a
 * missing key is an error, never a quiet fallback, because a hash made with a
 * published key protects nobody.
 */
export const TEST_AUDIT_HMAC_KEY =
  'engine4-test-audit-hmac-key--public-and-not-a-secret--tests-only';

export type AuditKeyErrorCode = 'MISSING' | 'TOO_SHORT' | 'BAD_VERSION';

export class AuditKeyError extends Error {
  readonly code: AuditKeyErrorCode;

  constructor(code: AuditKeyErrorCode, message: string) {
    super(message);
    this.name = 'AuditKeyError';
    this.code = code;
  }
}

export interface AuditKey {
  /** the secret; never log it */
  readonly key: string;
  /** a positive whole number that fits a 32-bit column */
  readonly version: number;
  /** `TEST` only for the public test key */
  readonly source: 'ENV' | 'TEST';
}

export type Env = Readonly<Record<string, string | undefined>>;

/** At most nine digits, no leading zero: always inside the INTEGER column. */
const VERSION_TEXT = /^[1-9][0-9]{0,8}$/;

function readVersion(env: Env): number {
  const raw = env[AUDIT_KEY_VERSION_ENV];
  if (raw === undefined || raw === '') return 1;
  if (!VERSION_TEXT.test(raw)) {
    throw new AuditKeyError(
      'BAD_VERSION',
      `${AUDIT_KEY_VERSION_ENV} must be a positive whole number (1 to 999999999)`
    );
  }
  return Number(BigInt(raw));
}

/**
 * The key to hash with now. Throws `AuditKeyError` when there is none (outside a
 * test), when it is too short, or when the version is not a positive whole number.
 */
export function resolveAuditKey(env: Env = process.env): AuditKey {
  const key = env[AUDIT_KEY_ENV];
  if (key === undefined || key === '') {
    if (env['NODE_ENV'] === 'test') {
      return {
        key: TEST_AUDIT_HMAC_KEY,
        version: readVersion(env),
        source: 'TEST',
      };
    }
    throw new AuditKeyError(
      'MISSING',
      `${AUDIT_KEY_ENV} is not set: the audit tables cannot be written without it`
    );
  }
  if (key.length < MIN_AUDIT_KEY_LENGTH) {
    throw new AuditKeyError(
      'TOO_SHORT',
      `${AUDIT_KEY_ENV} must be at least ${MIN_AUDIT_KEY_LENGTH} characters`
    );
  }
  return { key, version: readVersion(env), source: 'ENV' };
}

export interface UserHash {
  /** HMAC-SHA-256 of the user id, 64 lowercase hex characters */
  hash: string;
  /** the version of the key that made it; stored beside it */
  keyVersion: number;
}

function readUserId(userId: unknown): string {
  if (typeof userId !== 'string' || userId === '') {
    throw new TypeError('a user id is a non-empty string');
  }
  return userId;
}

/** The hash of a user id under a key. The message is the id's UTF-8 bytes, nothing added. */
export function hashUserId(userId: string, key: AuditKey): UserHash {
  const hash = createHmac('sha256', key.key)
    .update(readUserId(userId), 'utf8')
    .digest('hex');
  return { hash, keyVersion: key.version };
}

export type HashMatch = 'MATCH' | 'MISMATCH' | 'OTHER_KEY_VERSION';

/**
 * Does a stored hash belong to this user? `key` must be the key of the stored row's
 * own version: with any other version the answer is `OTHER_KEY_VERSION`, not a
 * mismatch, because the hash may well be right and this key is simply not its key.
 */
export function verifyUserHash(
  userId: string,
  stored: UserHash,
  key: AuditKey
): HashMatch {
  if (stored.keyVersion !== key.version) return 'OTHER_KEY_VERSION';
  const expected = Buffer.from(hashUserId(userId, key).hash, 'utf8');
  const actual = Buffer.from(stored.hash, 'utf8');
  if (expected.length !== actual.length) return 'MISMATCH';
  return timingSafeEqual(expected, actual) ? 'MATCH' : 'MISMATCH';
}
