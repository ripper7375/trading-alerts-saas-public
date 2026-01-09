import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

/**
 * Account Deletion Request API Route
 *
 * POST: Request account deletion
 *
 * Flow:
 * 1. User clicks "Delete Account" button
 * 2. Create deletion request record
 * 3. Send confirmation email with link
 * 4. Return request ID
 *
 * Security:
 * - Requires authentication
 * - 7-day grace period to cancel
 * - Token-based confirmation via email
 */

/**
 * POST /api/user/account/deletion-request
 * Request account deletion
 */
export async function POST(): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for existing pending request
    const existingRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'Deletion already requested',
          message: 'You already have a pending deletion request.',
          requestId: existingRequest.id,
          expiresAt: existingRequest.expiresAt,
        },
        { status: 400 }
      );
    }

    // Generate confirmation token
    const token = randomBytes(32).toString('hex');

    // Set expiration to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create deletion request
    const deletionRequest = await prisma.accountDeletionRequest.create({
      data: {
        userId: session.user.id,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });

    // In production, send confirmation email
    const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
    const confirmationUrl = `${baseUrl}/account/confirm-deletion?token=${token}`;
    const cancelUrl = `${baseUrl}/account/cancel-deletion?token=${token}`;

    console.log('[AccountDeletion] Request created:', {
      userId: session.user.id,
      requestId: deletionRequest.id,
      confirmationUrl,
      cancelUrl,
    });

    // Get user email for notification
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });

    // TODO: Send email with confirmation and cancel links
    console.log(`[AccountDeletion] Email would be sent to: ${user?.email}`);

    return NextResponse.json({
      success: true,
      message: 'Deletion request created. Check your email for confirmation.',
      requestId: deletionRequest.id,
      expiresAt,
    });
  } catch (error) {
    console.error('[POST /api/user/account/deletion-request] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create deletion request' },
      { status: 500 }
    );
  }
}
