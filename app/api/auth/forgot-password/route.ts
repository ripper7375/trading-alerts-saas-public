import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { clientIp, mailLimits, reserve } from '@/lib/auth/auth-throttle';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendPasswordResetEmail } from '@/lib/email/email';
import {
  TURNSTILE_FAILED_CODE,
  verifyTurnstile,
} from '@/lib/security/turnstile';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function POST(request: Request): Promise<NextResponse> {
  // CSRF protection: validate request origin
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  try {
    const body = await request.json();
    const validated = forgotPasswordSchema.parse(body);

    // CODE-15: with TURNSTILE_SECRET_KEY set, a request needs a Cloudflare Turnstile token that
    // Cloudflare accepts. Checked BEFORE the limits below, so a bot with no token cannot use up
    // an address's three requests an hour, and before anything is looked up or sent. The refusal
    // is the same for every address, so it tells nothing about the account. Unset: skipped
    // (local development).
    const humanCheck = await verifyTurnstile(
      body?.turnstileToken,
      clientIp(request.headers)
    );
    if (!humanCheck.ok) {
      return NextResponse.json(
        { error: TURNSTILE_FAILED_CODE },
        { status: 400 }
      );
    }

    // CODE-01B: three requests an hour per e-mail address and per client address. Past that the
    // answer is the one every request gets and nothing is looked up or sent, so the limit tells
    // nothing about the address. Redis down: open (D-1).
    const throttled = await reserve(
      mailLimits('forgot', {
        email: validated.email,
        ip: clientIp(request.headers),
      })
    );

    // Find user by email
    const user = throttled.blocked
      ? null
      : await prisma.user.findUnique({
          where: { email: validated.email },
          select: { id: true, name: true },
        });

    // If user exists, generate reset token and send email
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
        select: { id: true },
      });

      // Send password reset email
      const emailResult = await sendPasswordResetEmail(
        validated.email,
        user.name || 'User',
        resetToken
      );

      if (!emailResult.success) {
        console.error(
          'Failed to send password reset email:',
          emailResult.error
        );
      }
    }

    // Always return success for security (don't reveal if email exists)
    return NextResponse.json({
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    console.error('Password reset request failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
