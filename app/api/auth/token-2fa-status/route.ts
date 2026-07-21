import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  callOperationServiceWithToken,
  OperationServiceError,
} from '@/lib/operation-service/client';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

interface StatusBody {
  enabled: boolean;
  verifiedAt: string | null;
}

// Additive parallel path to GET app/api/user/2fa/setup/route.ts (Session
// 3-4, candidate step 2 — lib/auth/two-factor.ts ported into
// operation-service). Forwards the access-token cookie as a Bearer token,
// same SSR-forwarding pattern lib/operation-service/client.ts's own comment
// documents for /auth/me.
export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const result = await callOperationServiceWithToken<StatusBody>(
      '/auth/2fa/status',
      accessToken
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-2fa-status] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
