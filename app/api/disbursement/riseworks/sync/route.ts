/**
 * RiseWorks Sync API Route (Part 19B)
 *
 * POST: Sync account statuses from RiseWorks
 *
 * @module app/api/disbursement/riseworks/sync/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { getDefaultProvider } from '@/lib/disbursement/constants';
import { createPaymentProvider } from '@/lib/disbursement/providers/provider-factory';

/**
 * POST /api/disbursement/riseworks/sync
 *
 * Synchronizes RiseWorks account statuses from the provider.
 * In production, this fetches actual KYC statuses from RiseWorks API.
 * In development with mock provider, it simulates sync.
 *
 * @returns 200 - Sync result
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin();

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
        message: 'No accounts to sync',
        syncedAt: new Date(),
        results: [],
      });
    }

    const providerType = getDefaultProvider();
    const provider = createPaymentProvider(providerType);

    const syncResults: Array<{
      accountId: string;
      riseId: string;
      previousStatus: string;
      newStatus: string;
      changed: boolean;
    }> = [];

    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    for (const account of accounts) {
      try {
        // Get payee info from provider
        const payeeInfo = await provider.getPayeeInfo(account.riseId);

        const newStatus = payeeInfo.kycStatus;
        const changed = account.kycStatus !== newStatus;

        if (changed) {
          // Update account status
          await prisma.affiliateRiseAccount.update({
            where: { id: account.id },
            data: {
              kycStatus: newStatus,
              lastSyncAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          // Just update sync timestamp
          await prisma.affiliateRiseAccount.update({
            where: { id: account.id },
            data: {
              lastSyncAt: new Date(),
            },
          });
          unchangedCount++;
        }

        syncResults.push({
          accountId: account.id,
          riseId: account.riseId,
          previousStatus: account.kycStatus,
          newStatus,
          changed,
        });
      } catch (error) {
        console.error(
          `Failed to sync account ${account.id}:`,
          error
        );
        errorCount++;
        syncResults.push({
          accountId: account.id,
          riseId: account.riseId,
          previousStatus: account.kycStatus,
          newStatus: account.kycStatus,
          changed: false,
        });
      }
    }

    return NextResponse.json({
      success: errorCount === 0,
      message: `Synced ${updatedCount + unchangedCount} accounts, ${updatedCount} updated, ${errorCount} errors`,
      syncedAt: new Date(),
      provider: providerType,
      summary: {
        total: accounts.length,
        updated: updatedCount,
        unchanged: unchangedCount,
        errors: errorCount,
      },
      results: syncResults,
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
