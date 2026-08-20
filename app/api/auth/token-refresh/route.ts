import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import {
  forwardedRequestContext,
  OperationServiceError,
} from '@/lib/operation-service/client';
import {
  REFRESH_COOKIE_MAX_AGE,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  tokenCookieOptions,
} from '@/lib/operation-service/cookies';

interface RefreshSuccessBody {
  accessToken: string;
  refreshToken: string;
}

// Backs the silent-refresh loop (components/auth/token-refresh-provider.tsx).
// Rotates the refresh token on every call (operation-service's
// RefreshTokenService.rotate — old token revoked, new one issued) rather than
// reusing a static one, per the order's candidate step. The raw refresh
// token never reaches client JS — it lives only in this httpOnly cookie,
// stricter than the order's literal "client-side... replace" wording, which
// assumed client-visible storage; recorded as a Deviation (security-
// hardening, not a downgrade, so not escalated).
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'NO_REFRESH_TOKEN', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/refresh', {
      body: { refreshToken } as never,
      headers: forwardedRequestContext(request),
    });
    const result = await unwrapOperationApi<RefreshSuccessBody>(apiResult);

    cookieStore.set(
      SESSION_COOKIE_NAME,
      result.accessToken,
      tokenCookieOptions(SESSION_COOKIE_MAX_AGE)
    );
    cookieStore.set(
      REFRESH_COOKIE_NAME,
      result.refreshToken,
      tokenCookieOptions(REFRESH_COOKIE_MAX_AGE)
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Rotation failed (revoked/expired/invalid token) — clear both cookies
    // so the client's next request cleanly falls through to a logged-out
    // state instead of retrying a dead refresh token forever.
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(REFRESH_COOKIE_NAME);

    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-refresh] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
