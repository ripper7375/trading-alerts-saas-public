import { NextRequest, NextResponse } from 'next/server';

import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import {
  callOperationService,
  OperationServiceError,
} from '@/lib/operation-service/client';

interface ForgotPasswordSuccessBody {
  success: true;
  message: string;
}

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

  try {
    const result = await callOperationService<ForgotPasswordSuccessBody>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
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
