import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { DELETION_GRACE_PERIOD_MS } from '@/lib/account/deletion';
import { raiseSessionVersion } from '@/lib/auth/session-version';
import { forgetSessionState } from '@/lib/auth/user-active';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForUserProfile } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationServiceOptionalAuth,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

/**
 * Account Deletion Confirmation API Route
 *
 * POST: Confirm account deletion
 *
 * Flow:
 * 1. User clicks link in email
 * 2. Verify token from email
 * 3. Lock the account at once: isActive = false, every session and refresh token removed
 * 4. Return success; the 24 h worker (operation-service) does the soft delete
 *
 * Security:
 * - Token-based verification
 * - 24-hour grace period (cancellable from the e-mail) before the soft delete
 * - Soft delete (F21, Option B): the User row, Account, Payment and Commission stay for the admin
 */

// Validation schema
const confirmationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

/**
 * POST /api/user/account/deletion-confirm
 * Confirm account deletion
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Deliberately unauthenticated (public email-link token flow, zero auth
    // check in SOURCE) — forwarded via the optional-auth variant.
    if (shouldUseOperationServiceForUserProfile()) {
      const { status: opStatus, body } =
        await forwardRequestToOperationServiceOptionalAuth(
          request,
          '/user/account/deletion-confirm'
        );
      return NextResponse.json(body, { status: opStatus });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = confirmationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Find deletion request by token
    const deletionRequest = await prisma.accountDeletionRequest.findUnique({
      where: { token },
    });

    if (!deletionRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      );
    }

    // Check if request is still pending
    if (deletionRequest.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: 'Request already processed',
          message: `This deletion request has been ${deletionRequest.status.toLowerCase()}.`,
        },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date() > deletionRequest.expiresAt) {
      // Update request status to expired
      await prisma.accountDeletionRequest.update({
        where: { id: deletionRequest.id },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        {
          error: 'Token expired',
          message:
            'The deletion request has expired. Please submit a new request.',
        },
        { status: 400 }
      );
    }

    // Confirming locks the account at once (F21, Option B): the status flip, the
    // deactivation and the sign-out of every device commit together. The flip is
    // conditional on PENDING, so two clicks cannot both win. The 24 h worker in
    // operation-service (AccountDeletionWorker) finishes the job; it mirrors this
    // route, which only runs while the operation-service flag is off.
    const confirmedAt = new Date();
    const confirmed = await prisma.$transaction(async (tx) => {
      const claim = await tx.accountDeletionRequest.updateMany({
        where: { id: deletionRequest.id, status: 'PENDING' },
        data: { status: 'CONFIRMED', confirmedAt },
      });
      if (claim.count === 0) return false;

      await tx.user.updateMany({
        where: { id: deletionRequest.userId },
        data: { isActive: false },
      });
      await tx.session.deleteMany({
        where: { userId: deletionRequest.userId },
      });
      await tx.refreshToken.deleteMany({
        where: { userId: deletionRequest.userId },
      });
      await tx.userSession.updateMany({
        where: { userId: deletionRequest.userId, isActive: true },
        data: { isActive: false },
      });
      // CODE-02B: the access tokens minted so far stop working for good, not only while the
      // account is locked (a cancellation gives `isActive` back, never an old session).
      await raiseSessionVersion(tx, deletionRequest.userId);
      return true;
    });

    if (!confirmed) {
      return NextResponse.json(
        {
          error: 'Request already processed',
          message: 'This deletion request has already been processed.',
        },
        { status: 400 }
      );
    }

    // After the commit, so this instance's cached snapshot of the account cannot outlive it.
    forgetSessionState(deletionRequest.userId);

    const scheduledDeletionTime = new Date(
      confirmedAt.getTime() + DELETION_GRACE_PERIOD_MS
    );

    // No address, no token: stdout is shipped to the log store.
    console.log('[AccountDeletion] Deletion confirmed:', {
      userId: deletionRequest.userId,
      requestId: deletionRequest.id,
      scheduledDeletionTime,
    });

    // TODO: Send confirmation email

    return NextResponse.json({
      success: true,
      message:
        'Account deletion confirmed. Your account will be deleted in 24 hours.',
      scheduledDeletionTime,
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[POST /api/user/account/deletion-confirm] Error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm deletion' },
      { status: 500 }
    );
  }
}
