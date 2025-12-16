import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

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
 * - Only pending/confirmed requests can be cancelled
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

    // Update request to cancelled
    const cancelledRequest = await prisma.accountDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Get user information for logging
    const user = await prisma.user.findUnique({
      where: { id: deletionRequest.userId },
      select: { email: true, name: true },
    });

    console.log('[AccountDeletion] Deletion cancelled:', {
      userId: deletionRequest.userId,
      userEmail: user?.email,
      requestId: cancelledRequest.id,
    });

    // TODO: Send cancellation confirmation email

    return NextResponse.json({
      success: true,
      message: 'Account deletion cancelled. Your account will not be deleted.',
    });
  } catch (error) {
    console.error('[POST /api/user/account/deletion-cancel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel deletion' },
      { status: 500 }
    );
  }
}
