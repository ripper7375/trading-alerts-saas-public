import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';
import {
  verifyTOTP,
  decryptSecret,
  verifyBackupCode,
  isBackupCode,
} from '@/lib/auth/two-factor';
import {
  CHALLENGE_USED_TTL_SECONDS,
  MAX_CODE_ATTEMPTS,
  TOTP_REPLAY_TTL_SECONDS,
  TWO_FACTOR_CHALLENGE,
  TwoFactorUnavailableError,
  consumeOnce,
  isConsumed,
  registerAttempt,
  signCompletion,
  twoFactorKeys,
  verifyTwoFactorToken,
} from '@/lib/auth/two-factor-token';
import { shouldUseOperationServiceForUser2FA } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationServiceOptionalAuth,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

// Type for user with 2FA fields (until Prisma client is regenerated)
interface UserWith2FA {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string | null;
}

/**
 * 2FA Verification API Route
 *
 * POST: Verify TOTP or backup code during login
 *
 * Security (CODE-01A):
 * - Takes the CHALLENGE from the password step (`2fa_challenge`, 5 minutes); any other
 *   token is a 401
 * - Counts the attempts against that challenge: the 6th is a 429 and burns it
 * - Validates TOTP (each code once) or backup code
 * - Marks backup codes as used
 * - On success spends the challenge and returns a one-use COMPLETION token
 *   (`2fa_verified`, 60 seconds); the sign-in itself (authorize() or
 *   operation-service) accepts only that
 * - Redis down: 503 (the step fails closed)
 */

const verifySchema = z.object({
  code: z.string().min(6, 'Code is required'),
  token: z.string().min(1, 'Token is required'),
});

function invalidTokenResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid or expired verification token. Please log in again.',
    },
    { status: 401 }
  );
}

/**
 * POST /api/user/2fa/verify
 * Verify TOTP or backup code during login
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Deliberately unauthenticated (mid-login 2FA challenge — no session
    // cookie exists yet at this point in the flow) — forwarded via the
    // optional-auth variant, which never requires a session token.
    if (shouldUseOperationServiceForUser2FA()) {
      const { status: opStatus, body } =
        await forwardRequestToOperationServiceOptionalAuth(
          request,
          '/user/2fa/verify'
        );
      return NextResponse.json(body, { status: opStatus });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { code, token } = validation.data;

    // Verify the challenge from the password step: right purpose, issuer and algorithm.
    let challenge: { userId: string; jti: string };
    try {
      challenge = verifyTwoFactorToken(token, TWO_FACTOR_CHALLENGE);
    } catch {
      return invalidTokenResponse();
    }

    // A spent challenge is dead, and a challenge gets MAX_CODE_ATTEMPTS codes.
    if (await isConsumed(twoFactorKeys.used(challenge.jti))) {
      return invalidTokenResponse();
    }

    if ((await registerAttempt(challenge.jti)) > MAX_CODE_ATTEMPTS) {
      await consumeOnce(twoFactorKeys.used(challenge.jti));
      return NextResponse.json(
        { error: 'Too many attempts. Please log in again.' },
        { status: 429 }
      );
    }

    // Get user with 2FA data
    const user = (await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })) as UserWith2FA | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify 2FA is enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Normalize code (remove dashes/spaces)
    const normalizedCode = code.replace(/[-\s]/g, '');

    // Check if it's a backup code or TOTP code
    if (isBackupCode(normalizedCode)) {
      // Verify backup code
      const backupCodes: string[] = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : [];

      const matchedIndex = await verifyBackupCode(normalizedCode, backupCodes);

      if (matchedIndex === -1) {
        return NextResponse.json(
          { error: 'Invalid backup code' },
          { status: 400 }
        );
      }

      // Mark backup code as used (set to empty string)
      backupCodes[matchedIndex] = '';

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        },
        select: { id: true },
      });

      // Count remaining backup codes
      const remainingCodes = backupCodes.filter((c) => c !== '').length;

      console.log(
        `[2FA] Backup code used for user: ${user.id}. Remaining: ${remainingCodes}`
      );

      // Spend the challenge. Losing this race to a concurrent request means that one got the
      // completion, not this one.
      if (
        !(await consumeOnce(
          twoFactorKeys.used(challenge.jti),
          CHALLENGE_USED_TTL_SECONDS
        ))
      ) {
        return invalidTokenResponse();
      }

      return NextResponse.json({
        success: true,
        verified: true,
        method: 'backup_code',
        completionToken: signCompletion({
          userId: user.id,
          challengeJti: challenge.jti,
        }),
        remainingBackupCodes: remainingCodes,
        message:
          remainingCodes <= 2
            ? `Verified with backup code. Only ${remainingCodes} backup codes remaining. Consider generating new ones.`
            : 'Verified with backup code',
      });
    } else {
      // Verify TOTP code
      let secret: string;
      try {
        secret = decryptSecret(user.twoFactorSecret);
      } catch {
        return NextResponse.json(
          { error: 'Invalid 2FA configuration' },
          { status: 500 }
        );
      }

      const isValid = verifyTOTP(normalizedCode, secret);

      // A TOTP code is good once: the same code on another challenge is refused.
      if (
        !isValid ||
        !(await consumeOnce(
          twoFactorKeys.totp(user.id, normalizedCode),
          TOTP_REPLAY_TTL_SECONDS
        ))
      ) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }

      console.log(`[2FA] TOTP verified for user: ${user.id}`);

      if (
        !(await consumeOnce(
          twoFactorKeys.used(challenge.jti),
          CHALLENGE_USED_TTL_SECONDS
        ))
      ) {
        return invalidTokenResponse();
      }

      return NextResponse.json({
        success: true,
        verified: true,
        method: 'totp',
        completionToken: signCompletion({
          userId: user.id,
          challengeJti: challenge.jti,
        }),
      });
    }
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    if (error instanceof TwoFactorUnavailableError) {
      console.error('[POST /api/user/2fa/verify] Redis unavailable');
      return NextResponse.json(
        { error: 'Verification is temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }
    console.error('[POST /api/user/2fa/verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}
