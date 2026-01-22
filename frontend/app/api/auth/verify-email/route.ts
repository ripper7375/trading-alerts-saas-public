import { NextResponse } from 'next/server';

import { InvalidTokenError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { sendWelcomeEmail } from '@/lib/email/email'; // ✅ ADDED: Import welcome email function

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

    // ✅ FIX: Send welcome email AFTER successful email verification
    // This ensures user only receives welcome email once they've verified
    // and the "Go to Dashboard" button will work properly
    try {
      const welcomeResult = await sendWelcomeEmail(
        user.email,
        user.name || 'User'
      );

      if (!welcomeResult.success) {
        // Log error but don't fail the verification
        console.error('[Verify Email] Failed to send welcome email:', welcomeResult.error);
        console.error('[Verify Email] User email verified successfully, but welcome email failed');
      } else {
        console.log('[Verify Email] Welcome email sent successfully to:', user.email);
      }
    } catch (emailError) {
      // Log error but don't fail the verification
      console.error('[Verify Email] Exception sending welcome email:', emailError);
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

    console.error('Email verification failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
