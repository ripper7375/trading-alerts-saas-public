import { NextRequest, NextResponse } from 'next/server';

import {
  createOperationApi,
  unwrapOperationApi,
} from '@/lib/api/generated/operation-api/client';
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

  try {
    const api = createOperationApi(null);
    const apiResult = await api.POST('/auth/reset-password', {
      body: { token, password } as never,
    });
    const result =
      await unwrapOperationApi<ResetPasswordSuccessBody>(apiResult);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
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
