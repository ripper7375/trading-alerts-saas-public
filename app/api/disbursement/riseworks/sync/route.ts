/**
 * RiseWorks Sync API Route (Part 19B)
 *
 * POST: Sync RiseWorks account statuses from the provider
 *
 * @module app/api/disbursement/riseworks/sync/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/disbursement/riseworks/sync
 *
 * Sync all RiseWorks account statuses.
 * In production, this would call the RiseWorks API to get current KYC statuses.
 * Currently updates lastSyncAt timestamp for all accounts.
 *
 * @returns 200 - Sync completed
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(
  _request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    const session = await requireAdmin();

    const syncStartTime = new Date();

    // Get all accounts
    const accounts = await prisma.affiliateRiseAccount.findMany({
      select: {
        id: true,
        riseId: true,
        kycStatus: true,
      },
    });

    // Track sync results
    const results = {
      total: accounts.length,
      synced: 0,
      errors: 0,
      statusChanges: [] as Array<{
        riseId: string;
        oldStatus: string;
        newStatus: string;
      }>,
    };

    // In production, this would call the RiseWorks API to get current statuses
    // For now, we just update the lastSyncAt timestamp
    for (const account of accounts) {
      try {
        // Placeholder for RiseWorks API call
        // const riseStatus = await riseWorksClient.getPayeeStatus(account.riseId);

        // For now, just update lastSyncAt
        await prisma.affiliateRiseAccount.update({
          where: { id: account.id },
          data: {
            lastSyncAt: syncStartTime,
            // In production:
            // kycStatus: mapRiseStatusToKycStatus(riseStatus),
          },
        });

        results.synced++;
      } catch (error) {
        console.error(`Failed to sync account ${account.riseId}:`, error);
        results.errors++;
      }
    }

    // Log sync operation
    await prisma.disbursementAuditLog.create({
      data: {
        action: 'riseworks.sync',
        status: results.errors === 0 ? 'SUCCESS' : 'WARNING',
        actor: session.user?.id,
        details: {
          total: results.total,
          synced: results.synced,
          errors: results.errors,
          statusChanges: results.statusChanges,
        },
      },
    });

    return NextResponse.json({
      success: results.errors === 0,
      message: `Synced ${results.synced} of ${results.total} accounts`,
      syncedAt: syncStartTime.toISOString(),
      results: {
        total: results.total,
        synced: results.synced,
        errors: results.errors,
        statusChanges: results.statusChanges,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Error syncing RiseWorks accounts:', error);
    return NextResponse.json(
      { error: 'Failed to sync RiseWorks accounts' },
      { status: 500 }
    );
  }
}
