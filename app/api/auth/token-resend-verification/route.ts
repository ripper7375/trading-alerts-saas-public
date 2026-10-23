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

interface ResendVerificationSuccessBody {
  success: true;
  message: string;
}

// What operation-service answers every request, and so what a limited request is answered
// (CODE-01B): the limit tells nothing about the address.
const GENERIC_BODY: ResendVerificationSuccessBody = {
  success: true,
  message:
    'If your email is registered, you will receive a verification email.',
};

// Additive parallel path to app/api/auth/resend-verification/route.ts
// (Session 3-4, F29).
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
    mailLimits('resend', { ip: clientIp(request.headers) })
  );
  if (throttled.blocked) {
    return NextResponse.json(GENERIC_BODY);
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/resend-verification', {
      body: { email } as never,
      // The verification e-mail is written in the reader's language
      headers: forwardedEmailLocale(request),
    });
    const result =
      await unwrapOperationApi<ResendVerificationSuccessBody>(apiResult);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        {
          error: error.body.error,
          message: error.body.message,
          ...(error.body.retryAfter !== undefined && {
            retryAfter: error.body.retryAfter,
          }),
        },
        { status: error.status }
      );
    }
    console.error(
      '[token-resend-verification] operation-service call failed:',
      error
    );
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
