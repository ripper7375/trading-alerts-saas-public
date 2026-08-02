// Bridges the browser's realtime socket connection to operation-service's
// RealtimeGateway (F8, Session 4B-17). A persistent client-initiated
// Socket.IO connection can't be proxied through a Next.js route handler the
// way a REST call can (F45's own server-side-proxy pattern) — the browser
// must connect to operation-service directly, so it needs the same session
// token getOperationServiceToken() already bridges for REST calls, handed
// to it via this one same-origin, session-authenticated endpoint. This is
// the direct consequence of this session's own F8 Q4 decision (verify the
// real NextAuth JWE at the socket handshake, not a separate short-lived
// ticket scheme) — the raw token this returns is exactly the value the
// RealtimeGateway's handshake auth already trusts as a Bearer token
// elsewhere.

import { NextResponse } from 'next/server';

import { getOperationServiceToken } from '@/lib/operation-service/client';

const OPERATION_SERVICE_URL =
  process.env['OPERATION_SERVICE_URL'] ?? 'http://localhost:3001';

export async function GET(): Promise<NextResponse> {
  const token = await getOperationServiceToken();

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ token, url: OPERATION_SERVICE_URL });
}
