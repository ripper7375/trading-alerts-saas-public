import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { AuthError } from '@/lib/auth/errors';
import { requireAdmin } from '@/lib/auth/session';
import { decryptSecret, verifyTOTP } from '@/lib/auth/two-factor';
import {
  PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
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
 * Payout step-up for an administrator (CODE-06B)
 *
 * POST { code }: a CURRENT authenticator code buys a 120-second token for money-service's batch
 * approval and execution (`audience: money-service:payout-approval`). The browser sends it back
 * in `X-Payout-Step-Up` on the execute call; money-service checks the signature, the subject and
 * the audience and spends the token, so one token opens one call.
 *
 * - `requireAdmin()` first: signed in, an ADMIN, and (WS-8) with two-factor authentication on.
 * - A TOTP code only: no backup code can approve a payout.
 * - A code is good once: the sign-in and this step share the replay marker, so a code used to
 *   sign in a minute ago cannot be used here.
 * - 5 attempts per admin per 15 minutes, then 429. Redis down is a 503 (fails closed).
 */

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'The code is six digits'),
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
    const session = await requireAdmin();
    const userId = session.user.id;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return refusal(400, 'INVALID_INPUT', 'Invalid request body');
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return refusal(400, 'INVALID_INPUT', 'Enter the 6-digit code');
    }
    const { code } = parsed.data;

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
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return refusal(
        403,
        'ADMIN_2FA_REQUIRED',
        'Two-factor authentication is required for this action'
      );
    }

    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      console.error('[payout-step-up] Unreadable 2FA secret for an admin');
      return refusal(
        500,
        'INVALID_2FA_CONFIGURATION',
        'Invalid 2FA configuration'
      );
    }

    // A right code that was already used (to sign in, or for an earlier step-up) is refused.
    if (
      !verifyTOTP(code, secret) ||
      !(await consumeOnce(
        twoFactorKeys.totp(userId, code),
        TOTP_REPLAY_TTL_SECONDS
      ))
    ) {
      return refusal(400, 'INVALID_CODE', 'Invalid verification code');
    }

    await clearStepUpAttempts(userId);

    return NextResponse.json(
      {
        stepUpToken: signPayoutStepUp({
          userId,
          audience: PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
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
      console.error('[POST /api/admin/payout-step-up] Redis unavailable');
      return refusal(
        503,
        'STEP_UP_UNAVAILABLE',
        'The identity check is temporarily unavailable. Please try again.'
      );
    }
    console.error('[POST /api/admin/payout-step-up] Error:', error);
    return refusal(
      500,
      'STEP_UP_ERROR',
      'Failed to complete the identity check'
    );
  }
}
