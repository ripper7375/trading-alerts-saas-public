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

interface LoginSuccessBody {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    tier: string;
    role: string;
    isAffiliate: boolean;
  };
}

interface TwoFactorRequiredBody {
  twoFactorRequired: true;
  token: string;
}

// Additive parallel path to app/api/auth/[...nextauth]/route.ts (bridge-
// first, F6) — calls operation-service's /auth/login (F24: issues a
// NextAuth-compatible JWE) and stores it under NextAuth's own cookie name
// (F26), so existing session-reading code (getServerSession, next-auth/jwt's
// getToken) accepts it unmodified. Not wired into
// components/auth/login-form.tsx — that stays on next-auth/react's signIn()
// until a dedicated cutover session flips it; this session's "done when" is
// the new path working end-to-end, not switching real user traffic onto it
// (see the order's "Known blocker" section — NextAuth stays untouched in
// production this session).
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  let email: unknown;
  let password: unknown;
  try {
    const body = await request.json();
    email = body?.email;
    password = body?.password;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'email and password are required' },
      { status: 400 }
    );
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/login', {
      body: { email, password } as never,
      headers: forwardedRequestContext(request),
    });
    const result = await unwrapOperationApi<
      LoginSuccessBody | TwoFactorRequiredBody
    >(apiResult);

    if ('twoFactorRequired' in result && result.twoFactorRequired) {
      // Same intermediate step the existing NextAuth flow already uses
      // (lib/auth/auth-options.ts's TWO_FACTOR_REQUIRED sentinel): the
      // caller completes 2FA via the existing app/api/user/2fa/verify route,
      // then re-POSTs here with email: '__2fa_verified__', password: <token>
      // — operation-service's AuthService.login() handles that sentinel
      // itself, nothing extra needed on this end.
      return NextResponse.json(result);
    }

    const { accessToken, refreshToken, user } = result as LoginSuccessBody;
    const cookieStore = await cookies();
    cookieStore.set(
      SESSION_COOKIE_NAME,
      accessToken,
      tokenCookieOptions(SESSION_COOKIE_MAX_AGE)
    );
    cookieStore.set(
      REFRESH_COOKIE_NAME,
      refreshToken,
      tokenCookieOptions(REFRESH_COOKIE_MAX_AGE)
    );

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-login] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
