import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

import { prisma } from '@/lib/db/prisma';
import {
  verifyTOTP,
  decryptSecret,
  verifyBackupCode,
  isBackupCode,
} from '@/lib/auth/two-factor';

// Type for user with 2FA fields (until Prisma client is regenerated)
interface UserWith2FA {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: string | null;
}

/**
 * 2FA Verification API Route
 *
 * POST: Verify TOTP or backup code during login
 *
 * Security:
 * - Uses temporary 2FA token from login flow
 * - Validates TOTP or backup code
 * - Marks backup codes as used
 * - Returns session token on success
 */

const verifySchema = z.object({
  code: z.string().min(6, 'Code is required'),
  token: z.string().min(1, 'Token is required'),
});

/**
 * POST /api/user/2fa/verify
 * Verify TOTP or backup code during login
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { code, token } = validation.data;

    // Verify the temporary 2FA token
    let tokenPayload: { userId: string; email: string; exp: number };
    try {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) {
        throw new Error('NEXTAUTH_SECRET not configured');
      }

      tokenPayload = jwt.verify(token, secret) as typeof tokenPayload;
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired verification token. Please log in again.' },
        { status: 401 }
      );
    }

    // Get user with 2FA data
    const user = (await prisma.user.findUnique({
      where: { id: tokenPayload.userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    })) as UserWith2FA | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify 2FA is enabled
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Normalize code (remove dashes/spaces)
    const normalizedCode = code.replace(/[-\s]/g, '');

    // Check if it's a backup code or TOTP code
    if (isBackupCode(normalizedCode)) {
      // Verify backup code
      const backupCodes: string[] = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : [];

      const matchedIndex = await verifyBackupCode(normalizedCode, backupCodes);

      if (matchedIndex === -1) {
        return NextResponse.json(
          { error: 'Invalid backup code' },
          { status: 400 }
        );
      }

      // Mark backup code as used (set to empty string)
      backupCodes[matchedIndex] = '';

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        },
      });

      // Count remaining backup codes
      const remainingCodes = backupCodes.filter((c) => c !== '').length;

      console.log(`[2FA] Backup code used for user: ${user.email}. Remaining: ${remainingCodes}`);

      return NextResponse.json({
        success: true,
        verified: true,
        method: 'backup_code',
        remainingBackupCodes: remainingCodes,
        message: remainingCodes <= 2
          ? `Verified with backup code. Only ${remainingCodes} backup codes remaining. Consider generating new ones.`
          : 'Verified with backup code',
      });
    } else {
      // Verify TOTP code
      let secret: string;
      try {
        secret = decryptSecret(user.twoFactorSecret);
      } catch {
        return NextResponse.json(
          { error: 'Invalid 2FA configuration' },
          { status: 500 }
        );
      }

      const isValid = verifyTOTP(normalizedCode, secret);

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }

      console.log(`[2FA] TOTP verified for user: ${user.email}`);

      return NextResponse.json({
        success: true,
        verified: true,
        method: 'totp',
      });
    }
  } catch (error) {
    console.error('[POST /api/user/2fa/verify] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}
