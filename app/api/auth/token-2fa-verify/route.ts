import { NextResponse } from 'next/server';

import {
  callOperationService,
  OperationServiceError,
} from '@/lib/operation-service/client';

interface VerifySuccessBody {
  success: true;
  verified: true;
  method: 'totp' | 'backup_code';
  remainingBackupCodes?: number;
  message?: string;
}

// Additive parallel path to POST app/api/user/2fa/verify/route.ts (Session
// 3-4). Deliberately unauthenticated (no cookie read, no JwtAuthGuard on the
// operation-service side either) — this completes the 2FA step of login
// itself, before any session cookie exists; the temp token from
// token-login's twoFactorRequired branch is the only credential, matching
// the source route exactly (including that it never checks CSRF either).
export async function POST(request: Request): Promise<NextResponse> {
  let code: unknown;
  let token: unknown;
  try {
    const body = await request.json();
    code = body?.code;
    token = body?.token;
  } catch {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (typeof code !== 'string' || typeof token !== 'string') {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'code and token are required' },
      { status: 400 }
    );
  }

  try {
    const result = await callOperationService<VerifySuccessBody>(
      '/auth/2fa/verify',
      { method: 'POST', body: JSON.stringify({ code, token }) }
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(
        { error: error.body.error, message: error.body.message },
        { status: error.status }
      );
    }
    console.error('[token-2fa-verify] operation-service call failed:', error);
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}
