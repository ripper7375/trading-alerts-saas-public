import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { clientIp, mailLimits, reserve } from '@/lib/auth/auth-throttle';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import {
  forwardedEmailLocale,
  OperationServiceError,
} from '@/lib/operation-service/client';

interface ForgotPasswordSuccessBody {
  success: true;
  message: string;
}

// What operation-service answers every request, and so what a limited request is answered
// (CODE-01B): the limit tells nothing about the address.
const GENERIC_BODY: ForgotPasswordSuccessBody = {
  success: true,
  message:
    'If an account exists with this email, you will receive a password reset link.',
};

// Additive parallel path to app/api/auth/forgot-password/route.ts (Session
// 3-4, F29: forgot/reset/verify-email/resend-verification logic ported into
// operation-service). Not wired into any frontend form yet — same
// bridge-first posture as Session 3-3's token-login: the existing route
// keeps handling real traffic until a dedicated cutover session.
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  let email: unknown;
  try {
    const body = await request.json();
    email = body?.email;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof email !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'email is required' },
      { status: 400 }
    );
  }

  // CODE-01B: three requests an hour per client address here. The e-mail address is limited in
  // operation-service (the same key as the direct route), once: counting it here too would count
  // it twice. Redis down: open (D-1).
  const throttled = await reserve(
    mailLimits('forgot', { ip: clientIp(request.headers) })
  );
  if (throttled.blocked) {
    return NextResponse.json(GENERIC_BODY);
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/forgot-password', {
      body: { email } as never,
      // The reset e-mail is written in the reader's language (locale only: the
      // rest of the request is deliberately not forwarded here)
      headers: forwardedEmailLocale(request),
    });
    const result =
      await unwrapOperationApi<ForgotPasswordSuccessBody>(apiResult);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error(
      '[token-forgot-password] operation-service call failed:',
      error
    );
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
