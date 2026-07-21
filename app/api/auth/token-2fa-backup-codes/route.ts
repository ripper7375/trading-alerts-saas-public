import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
  callOperationServiceWithToken,
  OperationServiceError,
} from '@/lib/operation-service/client';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

interface BackupCodesStatusBody {
  enabled: boolean;
  remainingCodes: number;
  totalCodes?: number;
}

interface RegenerateSuccessBody {
  success: true;
  message: string;
  backupCodes: string[];
  backupCodesFormatted: string[][];
}

function unauthenticated(): NextResponse {
  return NextResponse.json(
    { error: 'UNAUTHENTICATED', message: 'Not authenticated' },
    { status: 401 }
  );
}

function operationServiceFailure(error: unknown, tag: string): NextResponse {
  if (error instanceof OperationServiceError) {
    return NextResponse.json(
      { error: error.body.error, message: error.body.message },
      { status: error.status }
    );
  }
  console.error(`[${tag}] operation-service call failed:`, error);
  return NextResponse.json(
    { error: 'SERVER_ERROR', message: 'Something went wrong' },
    { status: 500 }
  );
}

// Additive parallel path to GET/POST app/api/user/2fa/backup-codes/route.ts
// (Session 3-4). No CSRF check on POST — matches the source route.
export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return unauthenticated();

  try {
    const result = await callOperationServiceWithToken<BackupCodesStatusBody>(
      '/auth/2fa/backup-codes',
      accessToken
    );
    return NextResponse.json(result);
  } catch (error) {
    return operationServiceFailure(error, 'token-2fa-backup-codes:GET');
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!accessToken) return unauthenticated();

  let password: unknown;
  try {
    const body = await request.json();
    password = body?.password;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof password !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'password is required' },
      { status: 400 }
    );
  }

  try {
    const result = await callOperationServiceWithToken<RegenerateSuccessBody>(
      '/auth/2fa/backup-codes',
      accessToken,
      { method: 'POST', body: JSON.stringify({ password }) }
    );
    return NextResponse.json(result);
  } catch (error) {
    return operationServiceFailure(error, 'token-2fa-backup-codes:POST');
  }
}
