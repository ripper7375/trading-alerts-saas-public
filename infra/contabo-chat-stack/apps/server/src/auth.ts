import jwt from 'jsonwebtoken';
import type { ChatIdentity } from './types';

const CHAT_JWT_SECRET = process.env.CHAT_JWT_SECRET;

if (!CHAT_JWT_SECRET) {
  throw new Error(
    'CHAT_JWT_SECRET is not set — refusing to start with an unverifiable auth bridge.'
  );
}

interface ChatTokenClaims {
  userId: string;
  name?: string;
  email?: string;
  tier: 'FREE' | 'PRO';
}

/**
 * Verifies the handshake token issued by the Next.js BFF's GET /api/chat/token
 * (Session 14-2). Returns the authenticated identity, or null if no token was
 * supplied. Throws if a token WAS supplied but fails verification, so the
 * caller can distinguish "no token" (silent guest) from "bad token" (report
 * chat_error UNAUTHORIZED, then still degrade to guest — Session 14-0 §4).
 */
export function verifyChatToken(token: unknown): ChatIdentity | null {
  if (token === null || token === undefined || token === '') {
    return null;
  }
  if (typeof token !== 'string') {
    throw new Error('Malformed handshake token');
  }
  const claims = jwt.verify(
    token,
    CHAT_JWT_SECRET as string
  ) as ChatTokenClaims;
  if (!claims.userId || !claims.tier) {
    throw new Error('Handshake token missing required claims');
  }
  return {
    userId: claims.userId,
    name: claims.name,
    email: claims.email,
    tier: claims.tier,
  };
}

export function guestIdentity(socketId: string): ChatIdentity {
  return { userId: `guest_${socketId}`, tier: 'GUEST' };
}
