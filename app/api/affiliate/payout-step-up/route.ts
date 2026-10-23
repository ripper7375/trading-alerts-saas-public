import { compare } from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthError } from '@/lib/auth/errors';
import { requireAffiliate } from '@/lib/auth/session';
import { decryptSecret, verifyTOTP } from '@/lib/auth/two-factor';
import {
  PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
  PAYOUT_STEP_UP_TTL_SECONDS,
  TOTP_REPLAY_TTL_SECONDS,
  TwoFactorUnavailableError,
  clearStepUpAttempts,
  consumeOnce,
  reserveStepUpAttempt,
  signPayoutStepUp,
  twoFactorKeys,
} from '@/lib/auth/two-factor-token';
import { prisma } from '@/lib/db/prisma';

/**
 * Payout step-up for an affiliate (CODE-06B, decision D9-4)
 *
 * POST { password, code? }: before an affiliate adds, replaces or removes their Wise payout
 * recipient they prove the CURRENT password and, when two-factor authentication is on, a current
 * authenticator code. The answer is a 120-second token for money-service
 * (`audience: money-service:wise-recipient`) that the browser sends back in `X-Payout-Step-Up` on
 * `POST /wise/recipients`; money-service spends it, so one token opens one call.
 *
 * - An account with no password (sign-in through a provider only) cannot step up: 403
 *   `PASSWORD_REQUIRED`. Setting a password is the way in; this route never skips the check.
 * - A TOTP code only: no backup code. A code is good once (the sign-in shares the marker).
 * - 5 attempts per affiliate per 15 minutes, then 429. Redis down is a 503 (fails closed).
 */

const bodySchema = z.object({
  password: z.string().min(1),
  code: z.string().optional(),
});

function refusal(
  status: number,
  code: string,
  error: string,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json({ error, code }, { status, headers });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireAffiliate();
    const userId = session.user.id;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return refusal(400, 'INVALID_INPUT', 'Invalid request body');
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return refusal(400, 'INVALID_INPUT', 'Enter your current password');
    }
    const { password, code } = parsed.data;

    const attempt = await reserveStepUpAttempt(userId);
    if (attempt.blocked) {
      return refusal(
        429,
        'STEP_UP_RATE_LIMITED',
        'Too many attempts. Try again later.',
        { 'Retry-After': String(attempt.retryAfterSeconds) }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });
    if (!user) {
      return refusal(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (!user.password) {
      return refusal(
        403,
        'PASSWORD_REQUIRED',
        'Set a password on your account before changing payout details'
      );
    }

    if (!(await compare(password, user.password))) {
      return refusal(401, 'INVALID_PASSWORD', 'Incorrect password');
    }

    if (user.twoFactorEnabled) {
      if (!code) {
        return refusal(
          400,
          'TWO_FACTOR_CODE_REQUIRED',
          'Enter the code from your authenticator app'
        );
      }
      if (!user.twoFactorSecret) {
        console.error('[affiliate-payout-step-up] 2FA on, secret missing');
        return refusal(
          500,
          'INVALID_2FA_CONFIGURATION',
          'Invalid 2FA configuration'
        );
      }
      let secret: string;
      try {
        secret = decryptSecret(user.twoFactorSecret);
      } catch {
        console.error('[affiliate-payout-step-up] Unreadable 2FA secret');
        return refusal(
          500,
          'INVALID_2FA_CONFIGURATION',
          'Invalid 2FA configuration'
        );
      }
      if (
        !/^\d{6}$/.test(code) ||
        !verifyTOTP(code, secret) ||
        !(await consumeOnce(
          twoFactorKeys.totp(userId, code),
          TOTP_REPLAY_TTL_SECONDS
        ))
      ) {
        return refusal(400, 'INVALID_CODE', 'Invalid verification code');
      }
    }

    await clearStepUpAttempts(userId);

    return NextResponse.json(
      {
        stepUpToken: signPayoutStepUp({
          userId,
          audience: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
        }),
        expiresInSeconds: PAYOUT_STEP_UP_TTL_SECONDS,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return refusal(error.statusCode, error.code, error.message);
    }
    if (error instanceof TwoFactorUnavailableError) {
      console.error('[POST /api/affiliate/payout-step-up] Redis unavailable');
      return refusal(
        503,
        'STEP_UP_UNAVAILABLE',
        'The identity check is temporarily unavailable. Please try again.'
      );
    }
    console.error('[POST /api/affiliate/payout-step-up] Error:', error);
    return refusal(
      500,
      'STEP_UP_ERROR',
      'Failed to complete the identity check'
    );
  }
}
