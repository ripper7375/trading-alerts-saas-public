import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  RESET_IP_LIMIT,
  RESET_WINDOW_SECONDS,
  clientIp,
  release,
  reserve,
  throttleKeys,
} from '@/lib/auth/auth-throttle';
import { ExpiredTokenError, InvalidTokenError } from '@/lib/auth/errors';
import { BCRYPT_COST } from '@/lib/auth/password-hash';
import { withSessionBump } from '@/lib/auth/session-version';
import { csrfErrorResponse, validateOrigin } from '@/lib/csrf';
import { prisma } from '@/lib/db/prisma';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: Request): Promise<NextResponse> {
  // CSRF protection: validate request origin
  if (!(await validateOrigin())) {
    return csrfErrorResponse() as NextResponse;
  }

  // The client address whose count a request that is no failed token gives back (CODE-01B).
  let countedKey: string | null = null;

  try {
    const body = await request.json();
    const validated = resetPasswordSchema.parse(body);

    // CODE-01B: ten rejected tokens per quarter hour per client address. The attempt is counted
    // before the token is looked at, so a parallel burst cannot get past the limit; a reset that
    // works, or fails for a reason of ours, gives its count back. Redis down: open (D-1).
    const ip = clientIp(request.headers);
    if (ip) {
      const attempt = await reserve([
        {
          key: throttleKeys.resetIp(ip),
          limit: RESET_IP_LIMIT,
          windowSeconds: RESET_WINDOW_SECONDS,
        },
      ]);
      if (attempt.blocked) {
        return NextResponse.json(
          {
            error: 'Too many attempts. Please try again later.',
            retryAfter: attempt.retryAfterSeconds,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(attempt.retryAfterSeconds) },
          }
        );
      }
      countedKey = throttleKeys.resetIp(ip);
    }

    // Find user by reset token
    const user = await prisma.user.findFirst({
      where: { resetToken: validated.token },
      select: { id: true, resetTokenExpiry: true },
    });

    if (!user) {
      throw new InvalidTokenError('Invalid or expired reset token');
    }

    // Check if token expired
    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      throw new ExpiredTokenError('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validated.password, BCRYPT_COST);

    // Update user: set new password and clear reset token fields. Every session of the account
    // ends with it (CODE-02B): the new password, the new session version and the deleted refresh
    // tokens commit together.
    await withSessionBump(user.id, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
        select: { id: true },
      })
    );

    if (countedKey) await release([countedKey]);

    return NextResponse.json({
      success: true,
      message:
        'Password reset successfully. You can now sign in with your new password.',
    });
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

    // Not a rejected token: a failure of ours does not count against the address.
    if (countedKey) await release([countedKey]);

    console.error('Password reset failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
