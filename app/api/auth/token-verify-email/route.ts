import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
import { OperationServiceError } from '@/lib/operation-service/client';

interface VerifyEmailSuccessBody {
  success: true;
  message: string;
}

// Additive parallel path to app/api/auth/verify-email/route.ts (Session 3-4,
// F29). No CSRF check — matches the source route exactly (a GET, reached by
// a mailed link, has no origin to validate).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Verification token is required' },
      { status: 400 }
    );
  }

  try {
    const api = createOperationApi(null);
    const apiResult = await api.GET('/auth/verify-email', {
      params: { query: { token } },
    });
    const result = await unwrapOperationApi<VerifyEmailSuccessBody>(apiResult);
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
    console.error('[token-verify-email] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
