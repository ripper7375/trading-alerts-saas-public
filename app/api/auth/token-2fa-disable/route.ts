import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  callOperationServiceWithToken,
  OperationServiceError,
} from '@/lib/operation-service/client';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

interface DisableSuccessBody {
  success: true;
  message: string;
}

// Additive parallel path to POST app/api/user/2fa/disable/route.ts (Session
// 3-4). No CSRF check — matches the source route.
export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  let password: unknown;
  let code: unknown;
  try {
    const body = await request.json();
    password = body?.password;
    code = body?.code;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof password !== 'string' || typeof code !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'password and code are required' },
      { status: 400 }
    );
  }

  try {
    const result = await callOperationServiceWithToken<DisableSuccessBody>(
      '/auth/2fa/disable',
      accessToken,
      { method: 'POST', body: JSON.stringify({ password, code }) }
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-2fa-disable] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
