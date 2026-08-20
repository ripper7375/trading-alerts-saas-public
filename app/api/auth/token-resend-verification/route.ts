import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { OperationServiceError } from '@/lib/operation-service/client';

interface ResendVerificationSuccessBody {
  success: true;
  message: string;
}

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

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/resend-verification', {
      body: { email } as never,
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
