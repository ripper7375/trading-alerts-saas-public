/**
 * Signed, purpose-bound, time-stamped cookie values.
 *
 * The admin "view as" cookies name two ids (the admin and the account being
 * viewed). A value is `<purpose>:<firstId>:<secondId>:<iat>:<mac>`, where `iat`
 * is the issue time in unix seconds and `mac` is an HMAC-SHA256 over everything
 * before it, keyed with NEXTAUTH_SECRET.
 *
 * A value is accepted only when ALL of these hold:
 * - it has exactly this shape, and both ids match the id pattern;
 * - its purpose is the one the caller verifies for (the purpose is part of the
 *   signed text, so a value minted for one purpose never verifies for another);
 * - the signature matches (constant-time compare);
 * - it is no older than the caller's maximum age and not issued in the future.
 *
 * Anything else resolves to `null`: verification fails closed. Rotating
 * NEXTAUTH_SECRET ends every open view, which only means the admin starts the
 * view again.
 *
 * @module lib/security/signed-value
 */

import 'server-only';

import { createHmac, timingSafeEqual } from 'crypto';

/** One entry per kind of cookie; add a new one rather than reuse one. */
export type SignedValuePurpose = 'uview1' | 'aview1';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const IAT_PATTERN = /^\d{1,12}$/;
const MAC_PATTERN = /^[0-9a-f]{64}$/;

/** The longest well-formed value is about 215 characters. */
const MAX_VALUE_LENGTH = 256;

/** How far ahead of the server clock an issue time may be (clock skew). */
export const SIGNED_VALUE_FUTURE_SKEW_SECONDS = 60;

/**
 * Used only when NEXTAUTH_SECRET is unset AND the process is neither a
 * production build nor a Vercel production/preview deployment (Vercel Preview
 * runs with NODE_ENV=production). Anywhere else a missing secret is an error.
 */
const DEV_ONLY_FALLBACK_KEY = 'davintrade-dev-only-signed-value-key';

function devFallbackAllowed(): boolean {
  if (process.env['NODE_ENV'] === 'production') return false;
  const vercelEnv = process.env['VERCEL_ENV'];
  return vercelEnv !== 'production' && vercelEnv !== 'preview';
}

function signingKey(): string {
  const secret = process.env['NEXTAUTH_SECRET'];
  if (secret) return secret;
  if (devFallbackAllowed()) return DEV_ONLY_FALLBACK_KEY;
  throw new Error('NEXTAUTH_SECRET is required to sign cookie values');
}

function macOf(text: string): string {
  return createHmac('sha256', signingKey()).update(text, 'utf8').digest('hex');
}

export function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Sign a pair of ids for `purpose`. Throws when an id is malformed or no
 * signing key is available, so a caller never hands out a value that cannot
 * verify.
 */
export function signIdPair(
  purpose: SignedValuePurpose,
  firstId: string,
  secondId: string,
  issuedAtSec: number = currentUnixSeconds()
): string {
  if (!ID_PATTERN.test(firstId) || !ID_PATTERN.test(secondId)) {
    throw new Error('Cannot sign a malformed id');
  }
  if (!IAT_PATTERN.test(String(issuedAtSec))) {
    throw new Error('Cannot sign a malformed issue time');
  }
  const text = `${purpose}:${firstId}:${secondId}:${issuedAtSec}`;
  return `${text}:${macOf(text)}`;
}

export interface VerifiedIdPair {
  firstId: string;
  secondId: string;
  issuedAtSec: number;
}

/**
 * Verify a value produced by `signIdPair` for the same `purpose`. `nowSec` is
 * the clock to compare the issue time with (defaults to the current time).
 */
export function verifyIdPair(
  purpose: SignedValuePurpose,
  value: string | undefined | null,
  options: { maxAgeSeconds: number; nowSec?: number }
): VerifiedIdPair | null {
  if (!value || value.length > MAX_VALUE_LENGTH) return null;

  const parts = value.split(':');
  if (parts.length !== 5) return null;
  const [prefix, firstId, secondId, iat, mac] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (prefix !== purpose) return null;
  if (!ID_PATTERN.test(firstId) || !ID_PATTERN.test(secondId)) return null;
  if (!IAT_PATTERN.test(iat) || !MAC_PATTERN.test(mac)) return null;

  let expected: string;
  try {
    expected = macOf(`${prefix}:${firstId}:${secondId}:${iat}`);
  } catch {
    return null;
  }
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }

  // The issue time is trusted only after the signature has checked out.
  const issuedAtSec = Number(iat);
  const age = (options.nowSec ?? currentUnixSeconds()) - issuedAtSec;
  if (age > options.maxAgeSeconds) return null;
  if (age < -SIGNED_VALUE_FUTURE_SKEW_SECONDS) return null;

  return { firstId, secondId, issuedAtSec };
}
