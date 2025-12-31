import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { compare } from 'bcryptjs';
import { z } from 'zod';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  generateBackupCodes,
  formatBackupCodesForDisplay,
} from '@/lib/auth/two-factor';

// Type for user with 2FA fields (until Prisma client is regenerated)
interface UserWith2FA {
  id: string;
  email: string;
  password: string | null;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes: string | null;
}

/**
 * 2FA Backup Codes API Route
 *
 * POST: Regenerate backup codes
 * GET: Get backup codes count (remaining)
 *
 * Security:
 * - Requires authentication
 * - Requires password confirmation for regeneration
 * - Only works when 2FA is enabled
 */

const regenerateSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/user/2fa/backup-codes
 * Regenerate backup codes (invalidates old ones)
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
    const validation = regenerateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { password } = validation.data;

    // Get user with password and 2FA status
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        password: true,
        twoFactorEnabled: true,
      },
    })) as UserWith2FA | null;

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

    // Verify password
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

    // Generate new backup codes
    const { plainCodes, hashedCodes } = await generateBackupCodes();

    // Update user with new backup codes
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorBackupCodes: JSON.stringify(hashedCodes),
      },
    });

    console.log(`[2FA] Backup codes regenerated for user: ${user.email}`);

    // Format backup codes for display
    const formattedCodes = formatBackupCodesForDisplay(plainCodes);

    return NextResponse.json({
      success: true,
      message: 'Backup codes regenerated successfully. Old codes are no longer valid.',
      backupCodes: plainCodes,
      backupCodesFormatted: formattedCodes,
    });
  } catch (error) {
    console.error('[POST /api/user/2fa/backup-codes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/2fa/backup-codes
 * Get remaining backup codes count
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with 2FA data
    const user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    })) as Pick<UserWith2FA, 'twoFactorEnabled' | 'twoFactorBackupCodes'> | null;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return NextResponse.json({
        enabled: false,
        remainingCodes: 0,
      });
    }

    // Count remaining backup codes
    const backupCodes: string[] = user.twoFactorBackupCodes
      ? JSON.parse(user.twoFactorBackupCodes)
      : [];

    const remainingCodes = backupCodes.filter((code) => code !== '').length;

    return NextResponse.json({
      enabled: true,
      remainingCodes,
      totalCodes: 10,
    });
  } catch (error) {
    console.error('[GET /api/user/2fa/backup-codes] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get backup codes info' },
      { status: 500 }
    );
  }
}
