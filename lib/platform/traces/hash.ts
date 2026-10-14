/**
 * The keyed hash of a user id that `request_traces` keeps next to the (deletable) user id
 * (architecture 7.5, plan decision D5): the SAME HMAC-SHA-256, the same key and the same key
 * versions as the Engine 4 audit tables, so one rule covers both. `ENGINE4_AUDIT_HMAC_KEY` is
 * provisioned by Davin in Vercel; this code never prints it and has no default for it outside
 * a test (a missing key is `AuditKeyError`, never a quiet fallback). Rotating the key means a
 * new key and a higher `ENGINE4_AUDIT_HMAC_KEY_VERSION`; rows already written keep their hash
 * and version and are never recomputed.
 *
 * This is the one door `lib/platform` takes to that helper, so the chat and trace code does
 * not import the Engine 4 store directly and a later move of the helper to a neutral place
 * changes one file.
 *
 * @module lib/platform/traces/hash
 */

import {
  AUDIT_KEY_ENV,
  AUDIT_KEY_VERSION_ENV,
  AuditKeyError,
  hashUserId,
  resolveAuditKey,
  verifyUserHash,
} from '@/lib/engine4/store/user-hash';
import type {
  AuditKey,
  HashMatch,
  UserHash,
} from '@/lib/engine4/store/user-hash';

export {
  AUDIT_KEY_ENV,
  AUDIT_KEY_VERSION_ENV,
  AuditKeyError,
  resolveAuditKey,
  verifyUserHash,
};
export type { AuditKey, HashMatch, UserHash };

/** The hash and key version to store beside a user id. Throws `AuditKeyError` with no usable key. */
export function hashTraceUser(
  userId: string,
  key: AuditKey = resolveAuditKey()
): UserHash {
  return hashUserId(userId, key);
}
