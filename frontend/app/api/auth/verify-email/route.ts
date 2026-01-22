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

    // Update user: set emailVerified and clear verificationToken
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
      },
    });

    // FIX APPLIED: Send welcome email AFTER successful email verification
    // ====================================================================
    // This ensures user only receives welcome email once they've verified
    // their email address. This prevents the confusion of receiving two
    // emails simultaneously during registration.
    //
    // Benefits:
    // 1. User receives only ONE email during registration (verification)
    // 2. Welcome email comes after verification is complete
    // 3. "Go to Dashboard" button in welcome email will work properly
    //    since the account is now verified and ready to use
    try {
      const welcomeResult = await sendWelcomeEmail(
        user.email,
        user.name || 'User'
      );

      if (!welcomeResult.success) {
        // Log error but don't fail the verification
        // Email verification is more important than welcome email delivery
        console.error(
          '[Verify Email] Failed to send welcome email:',
          welcomeResult.error
        );
        console.error(
          '[Verify Email] User email verified successfully, but welcome email failed'
        );
      } else {
        console.log(
          '[Verify Email] Welcome email sent successfully to:',
          user.email
        );
      }
    } catch (emailError) {
      // Log error but don't fail the verification
      // The user's email is verified - that's the critical operation
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
