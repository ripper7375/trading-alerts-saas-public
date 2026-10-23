import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import {
  RESET_IP_LIMIT,
  RESET_WINDOW_SECONDS,
  clientIp,
  release,
  reserve,
  throttleKeys,
} from '@/lib/auth/auth-throttle';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { OperationServiceError } from '@/lib/operation-service/client';

interface ResetPasswordSuccessBody {
  success: true;
  message: string;
}

// Additive parallel path to app/api/auth/reset-password/route.ts (Session
// 3-4, F29). See token-forgot-password/route.ts for the bridge-first posture.
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  let token: unknown;
  let password: unknown;
  try {
    const body = await request.json();
    token = body?.token;
    password = body?.password;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof token !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'token and password are required' },
      { status: 400 }
    );
  }

  // CODE-01B: ten rejected tokens per quarter hour per client address (operation-service, which
  // sees Vercel's address, has no limit of its own here, decision D-4). The attempt is counted
  // before operation-service is asked, so a parallel burst cannot get past the limit; a reset
  // that works, or fails for a reason of ours, gives its count back. Redis down: open (D-1).
  const ip = clientIp(request.headers);
  const ipKey = ip ? throttleKeys.resetIp(ip) : null;
  if (ipKey) {
    const attempt = await reserve([
      {
        key: ipKey,
        limit: RESET_IP_LIMIT,
        windowSeconds: RESET_WINDOW_SECONDS,
      },
    ]);
    if (attempt.blocked) {
      return NextResponse.json(
        {
          error: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again later.',
          retryAfter: attempt.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(attempt.retryAfterSeconds) },
        }
      );
    }
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/reset-password', {
      body: { token, password } as never,
    });
    const result =
      await unwrapOperationApi<ResetPasswordSuccessBody>(apiResult);
    if (ipKey) await release([ipKey]);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      // A rejected token (400 or 401) keeps its count; anything else is not a failed guess.
      if (ipKey && error.status !== 400 && error.status !== 401) {
        await release([ipKey]);
      }
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    if (ipKey) await release([ipKey]);
    console.error(
      '[token-reset-password] operation-service call failed:',
      error
    );
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
