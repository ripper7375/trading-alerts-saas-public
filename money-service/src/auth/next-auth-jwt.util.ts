import hkdf from '@panva/hkdf';
import { jwtDecrypt } from 'jose';

// Decrypts a NextAuth v4 JWE session token WITHOUT depending on the
// `next-auth` package — same bridge operation-service already proved live
// (F6/F7, DECISION-LOG.md Session 3-1/3-5). Ported verbatim rather than
// re-derived: every service that verifies the frontend's session token must
// decode it identically, and this exact HKDF derivation was already proven
// against a real next-auth-minted token before operation-service's guard was
// built.

export interface NextAuthTokenClaims {
  sub?: string;
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  tier: string;
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
