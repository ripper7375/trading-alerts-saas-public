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

interface RegisterSuccessBody {
  userId: string;
  message: string;
  autoVerified: boolean;
}

// Additive parallel path to app/api/auth/register/route.ts (bridge-first,
// F6) — calls operation-service's /auth/register. F27's blocking condition
// ("email logic ported") is now satisfied (Session 3-4/F29, re-confirmed at
// 4A-11/4B-19), and Session 4B-20 closed the one real gap that would have
// blocked this being a genuine behavior-preserving port: AuthService.register()
// didn't actually send the verification email until this session (Deviation 2).
// Mirrors token-login's own established shape exactly (CSRF/origin validation,
// forwardedRequestContext(), OperationServiceError handling) — no cookies are
// set here, matching SOURCE: registration never logs the user in immediately,
// it requires email verification first. Not wired into
// components/auth/register-form.tsx until NEXT_PUBLIC_AUTH_BRIDGE_ENABLED
// gates it (Session 4B-20's own rollout mechanism, DECISION-LOG.md F56).
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  let email: unknown;
  let password: unknown;
  let name: unknown;
  try {
    const body = await request.json();
    email = body?.email;
    password = body?.password;
    name = body?.name;
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

  if (name !== undefined && typeof name !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'name must be a string' },
      { status: 400 }
    );
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/register', {
      body: { email, password, name } as never,
      headers: forwardedRequestContext(request),
    });
    const result = await unwrapOperationApi<RegisterSuccessBody>(apiResult);

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-register] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
