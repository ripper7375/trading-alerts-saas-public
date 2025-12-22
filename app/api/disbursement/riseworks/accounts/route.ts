/**
 * RiseWorks Accounts API Route (Part 19B)
 *
 * GET: List all affiliate RiseWorks accounts
 * POST: Create a new RiseWorks account for an affiliate
 *
 * @module app/api/disbursement/riseworks/accounts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AffiliateRiseAccount, RiseWorksKycStatus } from '@prisma/client';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

// Type for accounts with included affiliateProfile
type RiseAccountWithProfile = AffiliateRiseAccount & {
  affiliateProfile: {
    id: string;
    fullName: string;
    country: string;
    status: string;
    user: { email: string };
  };
};

// Type for status count groupBy result
type KycStatusCount = {
  kycStatus: RiseWorksKycStatus;
  _count: number;
};

/**
 * Validation schema for creating a RiseWorks account
 */
const createAccountSchema = z.object({
  affiliateProfileId: z.string().min(1, 'Affiliate profile ID is required'),
  riseId: z.string().min(1, 'Rise ID (blockchain address) is required'),
  email: z.string().email('Valid email is required'),
});

/**
 * GET /api/disbursement/riseworks/accounts
 *
 * Returns all affiliate RiseWorks accounts with their KYC status.
 *
 * Query params:
 * - kycStatus: Filter by KYC status (PENDING, SUBMITTED, APPROVED, REJECTED, EXPIRED)
 * - limit: Max number of accounts to return (default: 100)
 *
 * @returns 200 - List of RiseWorks accounts
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse query params
    const { searchParams } = new URL(request.url);
    const kycStatus = searchParams.get('kycStatus');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

    // Build filter
    const where = kycStatus
      ? { kycStatus: kycStatus as 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' }
      : undefined;

    // Get accounts
    const accounts = await prisma.affiliateRiseAccount.findMany({
      where,
      include: {
        affiliateProfile: {
          select: {
            id: true,
            fullName: true,
            country: true,
            status: true,
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get counts by status
    const statusCounts = await prisma.affiliateRiseAccount.groupBy({
      by: ['kycStatus'],
      _count: true,
    });

    const countsByStatus = statusCounts.reduce(
      (acc: Record<string, number>, item: KycStatusCount) => {
        acc[item.kycStatus] = item._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      accounts: accounts.map((acc: RiseAccountWithProfile) => ({
        id: acc.id,
        affiliateProfileId: acc.affiliateProfileId,
        affiliateName: acc.affiliateProfile.fullName,
        affiliateEmail: acc.affiliateProfile.user.email,
        affiliateCountry: acc.affiliateProfile.country,
        affiliateStatus: acc.affiliateProfile.status,
        riseId: acc.riseId,
        email: acc.email,
        kycStatus: acc.kycStatus,
        kycCompletedAt: acc.kycCompletedAt,
        invitationSentAt: acc.invitationSentAt,
        invitationAcceptedAt: acc.invitationAcceptedAt,
        lastSyncAt: acc.lastSyncAt,
        canReceivePayments: acc.kycStatus === 'APPROVED',
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      })),

      summary: {
        total: accounts.length,
        byKycStatus: countsByStatus,
        approvedCount: countsByStatus.APPROVED ?? 0,
        pendingCount: (countsByStatus.PENDING ?? 0) + (countsByStatus.SUBMITTED ?? 0),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error fetching RiseWorks accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RiseWorks accounts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/disbursement/riseworks/accounts
 *
 * Creates a new RiseWorks account for an affiliate.
 *
 * Body:
 * - affiliateProfileId: The affiliate profile ID
 * - riseId: The RiseWorks blockchain address
 * - email: The email associated with the RiseWorks account
 *
 * @returns 201 - Created account
 * @returns 400 - Validation error
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 409 - Account already exists
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse and validate body
    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateProfileId, riseId, email } = validation.data;

    // Verify affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
      include: { riseAccount: true },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Check if account already exists
    if (affiliate.riseAccount) {
      return NextResponse.json(
        { error: 'Affiliate already has a RiseWorks account' },
        { status: 409 }
      );
    }

    // Check if riseId is already in use
    const existingRiseId = await prisma.affiliateRiseAccount.findUnique({
      where: { riseId },
    });

    if (existingRiseId) {
      return NextResponse.json(
        { error: 'RiseWorks ID is already associated with another affiliate' },
        { status: 409 }
      );
    }

    // Create account
    const account = await prisma.affiliateRiseAccount.create({
      data: {
        affiliateProfileId,
        riseId,
        email,
        kycStatus: 'PENDING',
        invitationSentAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        account: {
          id: account.id,
          affiliateProfileId: account.affiliateProfileId,
          riseId: account.riseId,
          email: account.email,
          kycStatus: account.kycStatus,
          invitationSentAt: account.invitationSentAt,
          createdAt: account.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error creating RiseWorks account:', error);
    return NextResponse.json(
      { error: 'Failed to create RiseWorks account' },
      { status: 500 }
    );
  }
}
