import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { compare } from 'bcryptjs';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { verifyTOTP, decryptSecret } from '@/lib/auth/two-factor';
import { sendTwoFactorDisabledEmail } from '@/lib/email/email';
import {
  getLoginContext,
  formatLocation,
} from '@/lib/security/device-detection';

/**
 * 2FA Disable API Route
 *
 * POST: Disable 2FA for the authenticated user
 *
 * Security:
 * - Requires authentication
 * - Requires password confirmation
 * - Requires valid TOTP code
 * - Sends security alert email
 */

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

/**
 * POST /api/user/2fa/disable
 * Disable 2FA for the authenticated user
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = disableSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { password, code } = validation.data;

    // Get user with password and 2FA data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Verify password (OAuth-only users can't have 2FA without password)
    if (!user.password) {
      return NextResponse.json(
        { error: 'Password verification required' },
        { status: 400 }
      );
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 401 }
      );
    }

    // Verify TOTP code
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Invalid 2FA configuration' },
        { status: 500 }
      );
    }

    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      return NextResponse.json(
        { error: 'Invalid 2FA configuration' },
        { status: 500 }
      );
    }

    const isValidCode = verifyTOTP(code, secret);
    if (!isValidCode) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        twoFactorVerifiedAt: null,
      },
    });

    console.log(`[2FA] Disabled for user: ${user.email}`);

    // Create security alert
    try {
      const context = await getLoginContext();
      const location = formatLocation(context.location);

      await prisma.securityAlert.create({
        data: {
          userId: session.user.id,
          type: 'TWO_FACTOR_DISABLED',
          title: 'Two-Factor Authentication Disabled',
          message: 'Two-factor authentication has been disabled on your account.',
          ipAddress: context.ipAddress,
          location,
          emailSent: true,
          emailSentAt: new Date(),
        },
      });

      // Send email notification
      await sendTwoFactorDisabledEmail(
        user.email,
        user.name || 'User',
        context.ipAddress,
        location
      );
    } catch (alertError) {
      console.error('[2FA] Failed to send security alert:', alertError);
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication disabled successfully',
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/disable] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disable two-factor authentication' },
      { status: 500 }
    );
  }
}
