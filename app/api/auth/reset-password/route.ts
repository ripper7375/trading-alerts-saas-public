import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { InvalidTokenError, ExpiredTokenError } from '@/lib/auth/errors';
import { validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';
import { rateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/rate-limit';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
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

    // Rate limiting
    const rateLimitResult = await rateLimit(request, RATE_LIMITS.AUTH);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const body = await request.json();
    const validated = resetPasswordSchema.parse(body);

    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: { resetToken: validated.token },
    });

    if (!user) {
      throw new InvalidTokenError('Invalid or expired reset token');
    }

    // Check if token expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new ExpiredTokenError('Reset token has expired');
    }

    // Hash new password with increased rounds
    const hashedPassword = await bcrypt.hash(validated.newPassword, 12);

    // Update user: set new password and clear reset token fields
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    const response = NextResponse.json({
      success: true,
      message:
        'Password reset successfully. You can now sign in with your new password.',
    });

    // Add rate limit headers
    const headers = getRateLimitHeaders(rateLimitResult);
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    if (error instanceof ExpiredTokenError) {
      return NextResponse.json(
        { error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors?.[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    console.error('Password reset failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
