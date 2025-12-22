/**
 * RiseWorks Accounts API Route (Part 19B)
 *
 * GET: List all RiseWorks accounts
 * POST: Create new RiseWorks account
 *
 * @module app/api/disbursement/riseworks/accounts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

/**
 * Request schema for creating RiseWorks account
 */
const createAccountSchema = z.object({
  affiliateProfileId: z.string().min(1, 'Affiliate profile ID is required'),
  riseId: z.string().min(1, 'Rise ID is required'),
  email: z.string().email('Valid email is required'),
});

/**
 * GET /api/disbursement/riseworks/accounts
 *
 * Returns all RiseWorks accounts with affiliate details.
 *
 * @returns 200 - List of accounts
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const accounts = await prisma.affiliateRiseAccount.findMany({
      include: {
        affiliateProfile: {
          select: {
            id: true,
            fullName: true,
            country: true,
            status: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: account.id,
        riseId: account.riseId,
        email: account.email,
        kycStatus: account.kycStatus,
        invitationSentAt: account.invitationSentAt,
        invitationAcceptedAt: account.invitationAcceptedAt,
        lastSyncAt: account.lastSyncAt,
        createdAt: account.createdAt,
        affiliate: {
          id: account.affiliateProfile.id,
          fullName: account.affiliateProfile.fullName,
          email: account.affiliateProfile.user.email,
          country: account.affiliateProfile.country,
          status: account.affiliateProfile.status,
        },
      })),
      summary: {
        total: accounts.length,
        approved: accounts.filter((a) => a.kycStatus === 'APPROVED').length,
        pending: accounts.filter((a) => a.kycStatus === 'PENDING').length,
        rejected: accounts.filter((a) => a.kycStatus === 'REJECTED').length,
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
 * @returns 201 - Created account
 * @returns 400 - Invalid request body
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 409 - Account already exists
 * @returns 500 - Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateProfileId, riseId, email } = validation.data;

    // Verify affiliate exists
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateProfileId },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Check if account already exists
    const existingAccount = await prisma.affiliateRiseAccount.findUnique({
      where: { affiliateProfileId },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'RiseWorks account already exists for this affiliate' },
        { status: 409 }
      );
    }

    // Check if riseId is already used
    const existingRiseId = await prisma.affiliateRiseAccount.findUnique({
      where: { riseId },
    });

    if (existingRiseId) {
      return NextResponse.json(
        { error: 'Rise ID is already associated with another affiliate' },
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
    });

    return NextResponse.json({ account }, { status: 201 });
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
