/**
 * Admin Pay Commission API Route
 *
 * POST: Mark commissions as paid for an affiliate
 *
 * @module app/api/admin/commissions/pay/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const paySchema = z.object({
  affiliateId: z.string().min(1, 'Affiliate ID is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentReference: z.string().min(1, 'Payment reference is required'),
  commissionIds: z.array(z.string()).optional(),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST - Pay Commissions
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * POST /api/admin/commissions/pay
 *
 * Mark commissions as paid for an affiliate.
 * If commissionIds not provided, pays all pending commissions.
 *
 * Request body:
 * - affiliateId: Affiliate profile ID
 * - paymentMethod: Method used for payment
 * - paymentReference: Transaction reference
 * - commissionIds: Optional array of specific commission IDs to pay
 *
 * @returns 200 - Payment recorded successfully
 * @returns 400 - Invalid request or no commissions to pay
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 404 - Affiliate not found
 * @returns 500 - Server error
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    const session = await requireAdmin();

    // Parse and validate request body
    const body = await request.json();
    const validation = paySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { affiliateId, paymentMethod, paymentReference, commissionIds } = validation.data;

    // Get affiliate
    const affiliate = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateId },
    });

    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate not found' },
        { status: 404 }
      );
    }

    // Build where clause for commissions
    const where: {
      affiliateProfileId: string;
      status: string;
      id?: { in: string[] };
    } = {
      affiliateProfileId: affiliateId,
      status: 'PENDING',
    };

    if (commissionIds && commissionIds.length > 0) {
      where.id = { in: commissionIds };
    }

    // Get commissions to pay
    const commissionsToPay = await prisma.commission.findMany({
      where,
    });

    if (commissionsToPay.length === 0) {
      return NextResponse.json(
        { error: 'No pending commissions to pay' },
        { status: 400 }
      );
    }

    // Calculate total amount
    const totalAmount = commissionsToPay.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0
    );

    // Check minimum payout
    if (totalAmount < AFFILIATE_CONFIG.MINIMUM_PAYOUT) {
      return NextResponse.json(
        {
          error: `Total amount ($${totalAmount.toFixed(2)}) is below minimum payout threshold ($${AFFILIATE_CONFIG.MINIMUM_PAYOUT})`,
        },
        { status: 400 }
      );
    }

    // Generate batch ID
    const batchId = `PAY-${Date.now()}-${affiliateId.slice(-6)}`;
    const paidAt = new Date();

    // Update commissions in a transaction
    await prisma.$transaction([
      // Mark commissions as paid
      prisma.commission.updateMany({
        where: { id: { in: commissionsToPay.map((c) => c.id) } },
        data: {
          status: 'PAID',
          paidAt,
          paymentMethod,
          paymentReference,
          paymentBatchId: batchId,
        },
      }),

      // Update affiliate balances
      prisma.affiliateProfile.update({
        where: { id: affiliateId },
        data: {
          pendingCommissions: { decrement: totalAmount },
          paidCommissions: { increment: totalAmount },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Commissions marked as paid',
      payment: {
        batchId,
        affiliateId,
        commissionCount: commissionsToPay.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        paymentMethod,
        paymentReference,
        paidAt,
        paidBy: session.user?.email,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin pay commission error:', error);
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    );
  }
}
