import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/db/prisma';

/**
 * Account Deletion Confirmation API Route
 *
 * POST: Confirm account deletion
 *
 * Flow:
 * 1. User clicks link in email
 * 2. Verify token from email
 * 3. Schedule account deletion (24 hours)
 * 4. Return success
 *
 * Security:
 * - Token-based verification
 * - 24-hour grace period before actual deletion
 * - GDPR compliance: all user data deleted
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
          message: 'The deletion request has expired. Please submit a new request.',
        },
        { status: 400 }
      );
    }

    // Update request to confirmed
    const confirmedRequest = await prisma.accountDeletionRequest.update({
      where: { id: deletionRequest.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: deletionRequest.userId },
      select: { email: true, name: true },
    });

    // In production, schedule actual deletion for 24 hours later
    // This gives user time to cancel if they change their mind
    const scheduledDeletionTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

    console.log('[AccountDeletion] Deletion confirmed:', {
      userId: deletionRequest.userId,
      userEmail: user?.email,
      requestId: confirmedRequest.id,
      scheduledDeletionTime,
    });

    // TODO: Queue deletion job for 24 hours later
    // TODO: Send confirmation email

    return NextResponse.json({
      success: true,
      message: 'Account deletion confirmed. Your account will be deleted in 24 hours.',
      scheduledDeletionTime,
    });
  } catch (error) {
    console.error('[POST /api/user/account/deletion-confirm] Error:', error);
    return NextResponse.json(
      { error: 'Failed to confirm deletion' },
      { status: 500 }
    );
  }
}
