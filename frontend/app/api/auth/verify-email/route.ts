import { NextResponse } from 'next/server';

import { InvalidTokenError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { sendWelcomeEmail } from '@/lib/email/email';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find user with matching verification token
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new InvalidTokenError('Invalid or expired verification token');
    }

    // SIMPLE FIX: Prevent Gmail auto-preview from triggering verification
    // Token must be at least 5 seconds old before we allow verification
    const tokenAge = Date.now() - user.updatedAt.getTime();
    const MIN_DELAY_MS = 5000; // 5 seconds

    if (tokenAge < MIN_DELAY_MS) {
      const waitSeconds = Math.ceil((MIN_DELAY_MS - tokenAge) / 1000);
      return NextResponse.json(
        {
          error: `Please wait ${waitSeconds} more seconds, then refresh this page.`,
          retryAfter: waitSeconds,
        },
        { status: 429 }
      );
    }

    // Update user: set emailVerified and clear verificationToken
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    // Send welcome email after successful verification
    try {
      const welcomeResult = await sendWelcomeEmail(
        user.email,
        user.name || 'User'
      );

      if (!welcomeResult.success) {
        console.error(
          '[Verify Email] Failed to send welcome email:',
          welcomeResult.error
        );
      } else {
        console.log(
          '[Verify Email] Welcome email sent successfully to:',
          user.email
        );
      }
    } catch (emailError) {
      console.error(
        '[Verify Email] Exception while sending welcome email:',
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
    });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    console.error('[Verify Email] Email verification failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
