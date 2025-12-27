import crypto from 'crypto';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { sendPasswordResetEmail } from '@/lib/email/email';
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // CSRF origin validation
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Rate limiting - stricter for password reset
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.PASSWORD_RESET);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const body = await request.json();
    const validated = forgotPasswordSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    // If user exists, generate reset token
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      // Send password reset email
      const emailResult = await sendPasswordResetEmail(
        validated.email,
        user.name || 'User',
        resetToken
      );

      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
        // Don't reveal email delivery issues to prevent enumeration
      }
    }

    // Always return success for security (don't reveal if email exists)
    const response = NextResponse.json({
      success: true,
      message:
        'If an account exists with this email, you will receive a password reset link.',
    });

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
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
