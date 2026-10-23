import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { clientIp, mailLimits, reserve } from '@/lib/auth/auth-throttle';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendVerificationEmail } from '@/lib/email/email';

const resendSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// What every request that is not refused outright gets, whether the address is registered,
// verified, unknown or the request was limited (CODE-01B, checklist 8B-14).
const GENERIC_MESSAGE =
  'If your email is registered, you will receive a verification email.';

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

    // CODE-01B: three requests an hour per e-mail address and per client address. Past that the
    // answer is the one every request gets and nothing is looked up or sent, so the limit tells
    // nothing about the address. Redis down: open (D-1).
    const throttled = await reserve(
      mailLimits('resend', {
        email: validated.email,
        ip: clientIp(request.headers),
      })
    );
    if (throttled.blocked) {
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

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
      console.log('[Resend] User not found');
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    // If email is already verified, don't send another email
    if (user.emailVerified) {
      console.log('[Resend] Email already verified for user:', user.id);
      return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Rate limiting: Check if user recently requested a resend (within 60 seconds)
    const timeSinceLastUpdate = Date.now() - user.updatedAt.getTime();
    const RATE_LIMIT_MS = 60 * 1000; // 60 seconds

    if (user.verificationToken && timeSinceLastUpdate < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil(
        (RATE_LIMIT_MS - timeSinceLastUpdate) / 1000
      );
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
      select: { id: true },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(
      user.email,
      user.name || 'User',
      verificationToken
    );

    if (!emailResult.success) {
      console.error(
        '[Resend] Failed to send verification email:',
        emailResult.error
      );
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[Resend] Verification email sent to user:', user.id);

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
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
