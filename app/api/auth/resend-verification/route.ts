import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendVerificationEmail } from '@/lib/email/email';

const resendSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * POST /api/auth/resend-verification
 *
 * Resends the verification email to a user who hasn't verified their email yet.
 * Rate limited: Only allows one resend every 60 seconds per email.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // CSRF protection: validate request origin
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const body = await request.json();
    const validated = resendSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        verificationToken: true,
        updatedAt: true,
      },
    });

    // Security: Always return success to prevent email enumeration
    // But only actually send email if conditions are met
    if (!user) {
      console.log('[Resend] User not found:', validated.email);
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a verification email.',
      });
    }

    // If email is already verified, don't send another email
    if (user.emailVerified) {
      console.log('[Resend] Email already verified:', validated.email);
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a verification email.',
      });
    }

    // Rate limiting: Check if user recently requested a resend (within 60 seconds)
    const timeSinceLastUpdate = Date.now() - user.updatedAt.getTime();
    const RATE_LIMIT_MS = 60 * 1000; // 60 seconds

    if (user.verificationToken && timeSinceLastUpdate < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - timeSinceLastUpdate) / 1000);
      return NextResponse.json(
        {
          error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
          retryAfter: waitSeconds,
        },
        { status: 429 }
      );
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        updatedAt: new Date(),
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(
      user.email,
      user.name || 'User',
      verificationToken
    );

    if (!emailResult.success) {
      console.error('[Resend] Failed to send verification email:', emailResult.error);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[Resend] Verification email sent to:', user.email);

    return NextResponse.json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.message || 'Invalid email format' },
        { status: 400 }
      );
    }

    console.error('[Resend] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email. Please try again.' },
      { status: 500 }
    );
  }
}
