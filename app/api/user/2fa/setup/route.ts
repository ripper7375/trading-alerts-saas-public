import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  generateTOTPSecret,
  generateOtpauthURL,
  generateQRCodeDataURL,
  encryptSecret,
} from '@/lib/auth/two-factor';

// Type for user with 2FA fields (until Prisma client is regenerated)
interface UserWith2FA {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorVerifiedAt: Date | null;
}

/**
 * 2FA Setup API Route
 *
 * POST: Generate a new TOTP secret and return QR code
 *
 * Security:
 * - Requires authentication
 * - Does NOT enable 2FA yet (requires verification step)
 * - Encrypts secret before storing temporarily
 */

/**
 * POST /api/user/2fa/setup
 * Generate a new TOTP secret and QR code for authenticator app setup
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
      },
    })) as Pick<UserWith2FA, 'id' | 'email' | 'twoFactorEnabled'> | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    // Generate new TOTP secret
    const secret = generateTOTPSecret();

    // Generate otpauth URL for authenticator apps
    const otpauthURL = generateOtpauthURL(user.email, secret);

    // Generate QR code as data URL
    const qrCodeDataURL = await generateQRCodeDataURL(otpauthURL);

    // Store the encrypted secret temporarily (not enabled yet)
    // This will be committed when the user verifies with a valid code
    const encryptedSecret = encryptSecret(secret);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorSecret: encryptedSecret,
        // Don't set twoFactorEnabled to true yet
      },
    });

    console.log(`[2FA] Setup initiated for user: ${user.email}`);

    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataURL,
      secret: secret, // Show secret for manual entry
      message: 'Scan the QR code with your authenticator app, then verify with a code',
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set up two-factor authentication' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/2fa/setup
 * Get current 2FA status
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user 2FA status
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorVerifiedAt: true,
      },
    })) as Pick<UserWith2FA, 'twoFactorEnabled' | 'twoFactorVerifiedAt'> | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      enabled: user.twoFactorEnabled,
      verifiedAt: user.twoFactorVerifiedAt,
    });
  } catch (error) {
    console.error('[GET /api/user/2fa/setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get 2FA status' },
      { status: 500 }
    );
  }
}
