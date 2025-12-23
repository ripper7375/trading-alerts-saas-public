/**
 * RiseWorks Accounts API Route (Part 19B)
 *
 * GET: List all RiseWorks accounts
 * POST: Create a new RiseWorks account for an affiliate
 *
 * @module app/api/disbursement/riseworks/accounts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

/**
 * Validation schema for creating RiseWorks account
 */
const createAccountSchema = z.object({
  affiliateProfileId: z.string().min(1, 'Affiliate profile ID is required'),
  riseId: z.string().min(1, 'RiseWorks ID is required'),
  email: z.string().email('Valid email is required'),
});

/**
 * GET /api/disbursement/riseworks/accounts
 *
 * List all RiseWorks accounts with affiliate information.
 *
 * @returns 200 - List of RiseWorks accounts
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(
  _request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    const accounts = await prisma.affiliateRiseAccount.findMany({
      include: {
        affiliateProfile: {
          select: {
            fullName: true,
            country: true,
            status: true,
            user: { select: { email: true } },
          },
        },
        _count: {
          select: { disbursementTransactions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type AccountWithProfile = (typeof accounts)[number];

    // Group by KYC status for summary
    const summary = {
      total: accounts.length,
      byKycStatus: {
        pending: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'PENDING').length,
        submitted: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'SUBMITTED').length,
        approved: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'APPROVED').length,
        rejected: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'REJECTED').length,
        expired: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'EXPIRED').length,
      },
      canReceivePayments: accounts.filter((a: AccountWithProfile) => a.kycStatus === 'APPROVED').length,
    };

    return NextResponse.json({
      accounts: accounts.map((account: AccountWithProfile) => ({
        id: account.id,
        affiliateProfileId: account.affiliateProfileId,
        affiliateName: account.affiliateProfile?.fullName,
        affiliateEmail: account.affiliateProfile?.user?.email,
        affiliateCountry: account.affiliateProfile?.country,
        affiliateStatus: account.affiliateProfile?.status,
        riseId: account.riseId,
        email: account.email,
        kycStatus: account.kycStatus,
        kycCompletedAt: account.kycCompletedAt,
        invitationSentAt: account.invitationSentAt,
        invitationAcceptedAt: account.invitationAcceptedAt,
        lastSyncAt: account.lastSyncAt,
        transactionCount: account._count?.disbursementTransactions || 0,
        createdAt: account.createdAt,
        canReceivePayments: account.kycStatus === 'APPROVED',
      })),
      summary,
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
 * Create a new RiseWorks account for an affiliate.
 *
 * @returns 201 - Account created successfully
 * @returns 400 - Invalid request body
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
        { error: 'Invalid request body', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateProfileId, riseId, email } = validation.data;

    // Check if affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate profile not found' },
        { status: 404 }
      );
    }

    // Check if account already exists for this affiliate
    const existingByAffiliate = await prisma.affiliateRiseAccount.findUnique({
      where: { affiliateProfileId },
    });

    if (existingByAffiliate) {
      return NextResponse.json(
        { error: 'RiseWorks account already exists for this affiliate' },
        { status: 409 }
      );
    }

    // Check if riseId is already in use
    const existingByRiseId = await prisma.affiliateRiseAccount.findUnique({
      where: { riseId },
    });

    if (existingByRiseId) {
      return NextResponse.json(
        { error: 'RiseWorks ID already in use' },
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
      },
      include: {
        affiliateProfile: {
          select: {
            fullName: true,
            user: { select: { email: true } },
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: 'RiseWorks account created successfully',
        account: {
          id: account.id,
          affiliateProfileId: account.affiliateProfileId,
          affiliateName: account.affiliateProfile?.fullName,
          riseId: account.riseId,
          email: account.email,
          kycStatus: account.kycStatus,
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
