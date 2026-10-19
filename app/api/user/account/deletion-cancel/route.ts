import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { DELETION_GRACE_PERIOD_MS } from '@/lib/account/deletion';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { shouldUseOperationServiceForUserProfile } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationServiceOptionalAuth,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';

/**
 * Account Deletion Cancellation API Route
 *
 * POST: Cancel deletion request
 *
 * Flow:
 * 1. User clicks cancel link in email OR uses API
 * 2. Mark request as cancelled
 * 3. Return success
 *
 * Security:
 * - Can cancel via token (from email) or session (logged in)
 * - Only pending requests, or confirmed ones inside the 24 h grace period, can be cancelled
 * - Cancelling a confirmed request gives the account back (isActive = true); the user was
 *   locked out and signed out when they confirmed, so the e-mail link is how they return
 */

// Validation schema
const cancellationSchema = z.object({
  token: z.string().optional(),
});

/**
 * POST /api/user/account/deletion-cancel
 * Cancel account deletion request
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // No blanket auth check by design — SOURCE accepts EITHER an anonymous
    // token OR a logged-in session (see the dual-mode branch below), so
    // this is forwarded via the optional-auth variant regardless of
    // whether a session cookie exists.
    if (shouldUseOperationServiceForUserProfile()) {
      const { status: opStatus, body } =
        await forwardRequestToOperationServiceOptionalAuth(
          request,
          '/user/account/deletion-cancel'
        );
      return NextResponse.json(body, { status: opStatus });
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validation = cancellationSchema.safeParse(body);

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
    let deletionRequest;

    if (token) {
      // Find by token (from email link)
      deletionRequest = await prisma.accountDeletionRequest.findUnique({
        where: { token },
      });

      if (!deletionRequest) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 404 }
        );
      }
    } else {
      // Find by session (logged in user)
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized - provide token or be logged in' },
          { status: 401 }
        );
      }

      // Find pending/confirmed request for this user
      deletionRequest = await prisma.accountDeletionRequest.findFirst({
        where: {
          userId: session.user.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!deletionRequest) {
        return NextResponse.json(
          { error: 'No active deletion request found' },
          { status: 404 }
        );
      }
    }

    // Check if request can be cancelled
    if (!['PENDING', 'CONFIRMED'].includes(deletionRequest.status)) {
      return NextResponse.json(
        {
          error: 'Cannot cancel this request',
          message: `This deletion request has been ${deletionRequest.status.toLowerCase()} and cannot be cancelled.`,
        },
        { status: 400 }
      );
    }

    // The 24 h after confirmation is the whole grace period. Past it the worker owns the
    // request (and may already have cancelled the subscription), so a late click is refused.
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - DELETION_GRACE_PERIOD_MS);
    const refused = NextResponse.json(
      {
        error: 'Cannot cancel this request',
        message:
          'The 24-hour cancellation window has ended, so this deletion can no longer be cancelled.',
      },
      { status: 400 }
    );
    if (
      deletionRequest.status === 'CONFIRMED' &&
      deletionRequest.confirmedAt !== null &&
      deletionRequest.confirmedAt <= graceCutoff
    ) {
      return refused;
    }

    // One transaction: the conditional flip to CANCELLED and the reactivation. The grace test
    // is in the WHERE too, so a request the worker is about to take cannot also be cancelled.
    // `confirmedAt` is read back after the flip: a click that raced a confirm still gets the
    // account back.
    const cancelled = await prisma.$transaction(async (tx) => {
      const flip = await tx.accountDeletionRequest.updateMany({
        where: {
          id: deletionRequest.id,
          OR: [
            { status: 'PENDING' },
            { status: 'CONFIRMED', confirmedAt: { gt: graceCutoff } },
          ],
        },
        data: { status: 'CANCELLED', cancelledAt: now },
      });
      if (flip.count === 0) return false;

      const after = await tx.accountDeletionRequest.findUnique({
        where: { id: deletionRequest.id },
        select: { confirmedAt: true },
      });
      if (after?.confirmedAt) {
        // `deletedAt: null` keeps a completed deletion from being undone by a stale call.
        await tx.user.updateMany({
          where: { id: deletionRequest.userId, deletedAt: null },
          data: { isActive: true },
        });
      }
      return true;
    });
    if (!cancelled) return refused;

    // No address: stdout is shipped to the log store.
    console.log('[AccountDeletion] Deletion cancelled:', {
      userId: deletionRequest.userId,
      requestId: deletionRequest.id,
    });

    // TODO: Send cancellation confirmation email

    return NextResponse.json({
      success: true,
      message: 'Account deletion cancelled. Your account will not be deleted.',
    });
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error('[POST /api/user/account/deletion-cancel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel deletion' },
      { status: 500 }
    );
  }
}
