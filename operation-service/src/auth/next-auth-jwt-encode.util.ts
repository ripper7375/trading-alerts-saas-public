import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';

// F24 (DECISION-LOG.md, Session 3-2): /auth/login issues NextAuth-compatible
// JWEs — "perfect compatibility with the existing Next.js frontend during
// the 'bridge-first' phase." Mirrors next-auth v4's own encode() the same
// way next-auth-jwt.util.ts's decodeNextAuthToken mirrors its decode() half
// (same HKDF derivation, same alg/enc, proven via the F7 round-trip check,
// DECISION-LOG.md) — operation-service does not depend on the `next-auth`
// package itself, it re-implements only the encode half.
//
// session.maxAge in lib/auth/auth-options.ts is 30 days — matched here so a
// token minted by operation-service expires on the same schedule NextAuth's
// own tokens do.
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface NextAuthTokenPayload {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  tier: string;
  role: string;
  isAffiliate: boolean;
}

async function getDerivedEncryptionKey(
  keyMaterial: string,
  salt: string
): Promise<Uint8Array> {
  return hkdf(
    'sha256',
    keyMaterial,
    salt,
    `NextAuth.js Generated Encryption Key${salt ? ` (${salt})` : ''}`,
    32
  );
}

export async function encodeNextAuthToken(
  payload: NextAuthTokenPayload,
  secret: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const key = await getDerivedEncryptionKey(secret, '');
  const now = Math.floor(Date.now() / 1000);

  return new EncryptJWT({
    sub: payload.id,
    id: payload.id,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    tier: payload.tier,
    role: payload.role,
    isAffiliate: payload.isAffiliate,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt(now)
    .setExpirationTime(now + maxAgeSeconds)
    .encrypt(key);
}
