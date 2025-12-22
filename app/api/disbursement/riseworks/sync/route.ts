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
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';

/**
 * POST /api/disbursement/riseworks/sync
 *
 * Syncs RiseWorks account statuses from the payment provider.
 * In production, this calls the RiseWorks API to check KYC status.
 * In development (MOCK provider), it just updates the lastSyncAt timestamp.
 *
 * @returns 200 - Sync results
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    const session = await requireAdmin();

    // Get all Rise accounts
    const accounts = await prisma.affiliateRiseAccount.findMany({
      select: {
        id: true,
        riseId: true,
        kycStatus: true,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No RiseWorks accounts to sync',
        syncedCount: 0,
        updatedCount: 0,
        syncedAt: new Date(),
      });
    }

    // Get payment provider
    let provider;
    try {
      provider = createPaymentProvider();
    } catch {
      // If provider not available, just update lastSyncAt
      const result = await prisma.affiliateRiseAccount.updateMany({
        data: { lastSyncAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Provider not available, updated sync timestamps only',
        syncedCount: result.count,
        updatedCount: 0,
        syncedAt: new Date(),
      });
    }

    // Sync each account
    let syncedCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        // Get payee info from provider
        const payeeInfo = await provider.getPayeeInfo(account.riseId);

        // Check if status needs updating
        if (payeeInfo.kycStatus !== account.kycStatus) {
          await prisma.affiliateRiseAccount.update({
            where: { id: account.id },
            data: {
              kycStatus: payeeInfo.kycStatus,
              kycCompletedAt: payeeInfo.kycStatus === 'APPROVED' ? new Date() : null,
              lastSyncAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          await prisma.affiliateRiseAccount.update({
            where: { id: account.id },
            data: { lastSyncAt: new Date() },
          });
        }

        syncedCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to sync account ${account.riseId}: ${message}`);
      }
    }

    // Log the sync
    await prisma.disbursementAuditLog.create({
      data: {
        action: 'riseworks.sync',
        status: errors.length === 0 ? 'SUCCESS' : 'WARNING',
        actor: session.user?.id,
        details: {
          syncedCount,
          updatedCount,
          errorCount: errors.length,
          errors: errors.slice(0, 10), // Only log first 10 errors
        },
      },
    });

    return NextResponse.json({
      success: errors.length === 0,
      message: `Synced ${syncedCount} accounts, updated ${updatedCount}`,
      syncedCount,
      updatedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 10),
      syncedAt: new Date(),
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
