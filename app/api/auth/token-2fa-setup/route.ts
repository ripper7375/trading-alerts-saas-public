import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  callOperationServiceWithToken,
  OperationServiceError,
} from '@/lib/operation-service/client';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

interface SetupSuccessBody {
  success: true;
  qrCode: string;
  secret: string;
  message: string;
}

// Additive parallel path to POST app/api/user/2fa/setup/route.ts (Session
// 3-4). No CSRF check — matches the source route exactly (it never
// validates origin either, relying on session-cookie auth alone).
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'UNAUTHENTICATED', message: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const result = await callOperationServiceWithToken<SetupSuccessBody>(
      '/auth/2fa/setup',
      accessToken,
      { method: 'POST' }
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-2fa-setup] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
