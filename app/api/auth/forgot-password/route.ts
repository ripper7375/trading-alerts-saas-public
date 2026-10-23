import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { clientIp, mailLimits, reserve } from '@/lib/auth/auth-throttle';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendPasswordResetEmail } from '@/lib/email/email';

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
