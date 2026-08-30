// BFF chat token endpoint (Session 14-2, Decision 1). Mints a short-lived
// signed JWT the Contabo chat stack's `verifyChatToken()` (Session 14-1,
// infra/contabo-chat-stack/apps/server/src/auth.ts) verifies at the socket
// handshake -- claim names/shape must match that verifier exactly. Guest
// (no session) is a first-class supported path per Session 14-0 Decision 4,
// so it returns HTTP 200 with a null token, never 401.

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

import { getSession } from '@/lib/auth/session';

const CHAT_TOKEN_TTL_SECONDS = 300;

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const url = process.env['NEXT_PUBLIC_SOCKET_CHAT_URL'] ?? null;

  if (!session?.user) {
    return NextResponse.json({ token: null, url });
  }

  const configuredSecret = process.env['CHAT_JWT_SECRET'];
  let signingKey: string;

  if (configuredSecret) {
    signingKey = configuredSecret;
  } else if (process.env['NODE_ENV'] !== 'production') {
    const fallback = process.env['NEXTAUTH_SECRET'];
    if (!fallback) {
      throw new Error(
        'Neither CHAT_JWT_SECRET nor NEXTAUTH_SECRET is configured -- cannot mint a chat token.'
      );
    }
    console.warn(
      'CHAT_JWT_SECRET is not set -- falling back to NEXTAUTH_SECRET for chat token signing (non-production only).'
    );
    signingKey = fallback;
  } else {
    throw new Error(
      'CHAT_JWT_SECRET is not set in production -- refusing to mint chat tokens.'
    );
  }

  const token = jwt.sign(
    {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      tier: session.user.tier ?? 'FREE',
    },
    signingKey,
    { expiresIn: CHAT_TOKEN_TTL_SECONDS }
  );

  return NextResponse.json({ token, url });
}
