/**
 * GET /api/payments/dlocal/[paymentId]
 *
 * Returns the status of a dLocal payment.
 *
 * Path Parameters:
 * - paymentId: The dLocal payment ID
 *
 * Response:
 * - 200: Payment details and status
 * - 401: Unauthorized
 * - 403: Not allowed (payment belongs to another user)
 * - 404: Payment not found
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getPaymentStatus } from '@/lib/dlocal/dlocal-payment.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    paymentId: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { paymentId } = await params;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Find payment in database
    const payment = await prisma.payment.findFirst({
      where: {
        providerPaymentId: paymentId,
        provider: 'DLOCAL',
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (payment.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get status from dLocal (for real-time status)
    let dLocalStatus;
    try {
      dLocalStatus = await getPaymentStatus(paymentId);
    } catch {
      // Use database status if dLocal API fails
      dLocalStatus = {
        id: paymentId,
        status: payment.providerStatus,
      };
    }

    logger.info('Payment status retrieved', { paymentId, status: payment.status });

    return NextResponse.json({
      id: payment.id,
      paymentId: payment.providerPaymentId,
      status: payment.status,
      providerStatus: dLocalStatus.status,
      amount: {
        local: payment.amount.toString(),
        usd: payment.amountUSD.toString(),
        currency: payment.currency,
      },
      country: payment.country,
      paymentMethod: payment.paymentMethod,
      planType: payment.planType,
      duration: payment.duration,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get payment status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to get payment status' },
      { status: 500 }
    );
  }
}
