import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  verifyTOTP,
  decryptSecret,
  generateBackupCodes,
  formatBackupCodesForDisplay,
} from '@/lib/auth/two-factor';
import { sendTwoFactorEnabledEmail } from '@/lib/email/email';
import {
  getLoginContext,
  formatLocation,
} from '@/lib/security/device-detection';

// Type for user with 2FA fields (until Prisma client is regenerated)
interface UserWith2FA {
  id: string;
  email: string;
  name: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
}

/**
 * 2FA Verify Setup API Route
 *
 * POST: Verify TOTP code and enable 2FA
 *
 * Security:
 * - Requires authentication
 * - Validates TOTP code against stored secret
 * - Generates backup codes on successful verification
 * - Sends security alert email
 */

const verifySetupSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

/**
 * POST /api/user/2fa/verify-setup
 * Verify TOTP code and enable 2FA
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
    const validation = verifySetupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { code } = validation.data;

    // Get user with 2FA secret
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    })) as UserWith2FA | null;

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

    // Check if secret exists (setup was initiated)
    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Please initiate 2FA setup first' },
        { status: 400 }
      );
    }

    // Decrypt the secret
    let secret: string;
    try {
      secret = decryptSecret(user.twoFactorSecret);
    } catch {
      return NextResponse.json(
        { error: 'Invalid 2FA configuration. Please restart setup.' },
        { status: 400 }
      );
    }

    // Verify the TOTP code
    const isValid = verifyTOTP(code, secret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Generate backup codes
    const { plainCodes, hashedCodes } = await generateBackupCodes();

    // Enable 2FA and store backup codes
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
        twoFactorVerifiedAt: new Date(),
      },
    });

    console.log(`[2FA] Enabled for user: ${user.email}`);

    // Create security alert
    try {
      const context = await getLoginContext();
      const location = formatLocation(context.location);

      await prisma.securityAlert.create({
        data: {
          userId: session.user.id,
          type: 'TWO_FACTOR_ENABLED',
          title: 'Two-Factor Authentication Enabled',
          message: 'Two-factor authentication has been enabled on your account.',
          ipAddress: context.ipAddress,
          location,
          emailSent: true,
          emailSentAt: new Date(),
        },
      });

      // Send email notification
      await sendTwoFactorEnabledEmail(
        user.email,
        user.name || 'User',
        context.ipAddress,
        location
      );
    } catch (alertError) {
      console.error('[2FA] Failed to send security alert:', alertError);
    }

    // Format backup codes for display
    const formattedCodes = formatBackupCodesForDisplay(plainCodes);

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      backupCodes: plainCodes,
      backupCodesFormatted: formattedCodes,
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/verify-setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}
