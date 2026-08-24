import hkdf from '@panva/hkdf';
import { jwtDecrypt } from 'jose';

// Decrypts a NextAuth v4 JWE session token WITHOUT depending on the
// `next-auth` package at all — operation-service is a separate NestJS
// process from the Next.js app, so it re-implements only the decrypt half
// of next-auth's own `node_modules/next-auth/jwt/index.js`.
//
// F7 (DECISION-LOG.md, Session 3-1): NextAuth's default `strategy: 'jwt'`
// with no custom jwt.encode/decode encrypts the session as a JWE (alg:
// 'dir', enc: 'A256GCM'), not a signed JWT — `jsonwebtoken`'s `jwt.verify()`
// cannot read this. The key is HKDF-SHA256-derived from NEXTAUTH_SECRET
// with an empty salt (the app sets no custom `jwt.salt` in auth-options.ts)
// and the fixed info string below — this exact derivation was proven
// against a real token minted by next-auth's own `encode()` before this
// guard was built (DECISION-LOG.md F7 evidence).

import type { Tier } from '@trading-alerts/types/tier';

export interface NextAuthTokenClaims {
  sub?: string;
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  tier: Tier;
  role: string;
  isAffiliate: boolean;
  iat: number;
  exp: number;
  jti?: string;
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

// Throws (never returns null/undefined) on any invalid, expired, malformed,
// or wrong-secret token — callers must not treat a thrown error as a silent
// pass-through.
export async function decodeNextAuthToken(
  token: string,
  secret: string
): Promise<NextAuthTokenClaims> {
  const key = await getDerivedEncryptionKey(secret, '');
  const { payload } = await jwtDecrypt(token, key, { clockTolerance: 15 });
  return payload as unknown as NextAuthTokenClaims;
}
