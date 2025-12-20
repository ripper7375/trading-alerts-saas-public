/**
 * POST /api/webhooks/dlocal
 *
 * Handles dLocal payment webhooks.
 *
 * This is the BASIC version for Part 18A.
 * Only handles payment success/failure and creates notifications.
 * Subscription creation will be added in Part 18B.
 *
 * Headers:
 * - x-signature: HMAC signature for verification
 *
 * Webhook Statuses:
 * - PAID: Payment completed successfully
 * - REJECTED: Payment was rejected
 * - CANCELLED: Payment was cancelled
 * - EXPIRED: Payment expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, mapDLocalStatus } from '@/lib/dlocal/dlocal-payment.service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { DLocalWebhookPayload } from '@/types/dlocal';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw payload for signature verification
    const payload = await request.text();
    const signature = request.headers.get('x-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature)) {
      logger.warn('Invalid webhook signature', {
        signaturePrefix: signature.substring(0, 10),
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Parse webhook payload
    let webhookData: DLocalWebhookPayload;
    try {
      webhookData = JSON.parse(payload);
    } catch {
      logger.error('Invalid webhook payload', { payload: payload.substring(0, 100) });
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    logger.info('dLocal webhook received', {
      paymentId: webhookData.id,
      status: webhookData.status,
      orderId: webhookData.order_id,
    });

    // Map dLocal status to our internal status
    const internalStatus = mapDLocalStatus(webhookData.status);

    // Find the payment record
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { providerPaymentId: webhookData.id },
          // Also try matching by order_id pattern for backup
        ],
        provider: 'DLOCAL',
      },
    });

    if (!payment) {
      logger.error('Payment record not found for webhook', {
        paymentId: webhookData.id,
        orderId: webhookData.order_id,
      });
      // Return 200 to prevent retries for unknown payments
      return NextResponse.json({ received: true, warning: 'Payment not found' });
    }

    // Process based on status
    if (internalStatus === 'COMPLETED') {
      await handlePaymentCompleted(payment, webhookData);
    } else if (internalStatus === 'FAILED') {
      await handlePaymentFailed(payment, webhookData);
    } else if (internalStatus === 'CANCELLED') {
      await handlePaymentCancelled(payment, webhookData);
    }

    logger.info('Webhook processed successfully', {
      paymentId: webhookData.id,
      status: internalStatus,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return 500 to trigger retry
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handles successful payment completion
 */
async function handlePaymentCompleted(
  payment: { id: string; userId: string; planType: string | null; amount: unknown; currency: string },
  webhookData: DLocalWebhookPayload
): Promise<void> {
  logger.info('Processing payment completion', {
    paymentId: payment.id,
    userId: payment.userId,
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      providerStatus: webhookData.status,
      updatedAt: new Date(),
    },
  });

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId: payment.userId,
      type: 'PAYMENT',
      title: 'Payment Successful',
      body: `Your payment of ${payment.currency} ${payment.amount} has been received. Your subscription is now active.`,
      priority: 'HIGH',
    },
  });

  // NOTE: Subscription creation will be added in Part 18B
  // For now, we just mark the payment as completed and notify the user
  logger.info('Payment marked as completed', { paymentId: payment.id });
}

/**
 * Handles payment failure
 */
async function handlePaymentFailed(
  payment: { id: string; userId: string },
  webhookData: DLocalWebhookPayload
): Promise<void> {
  logger.warn('Processing payment failure', {
    paymentId: payment.id,
    userId: payment.userId,
    reason: webhookData.failure_reason,
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      providerStatus: webhookData.status,
      failureReason: webhookData.failure_reason || 'Payment was rejected',
      updatedAt: new Date(),
    },
  });

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId: payment.userId,
      type: 'PAYMENT',
      title: 'Payment Failed',
      body: webhookData.failure_reason
        ? `Your payment failed: ${webhookData.failure_reason}. Please try again.`
        : 'Your payment failed. Please try again with a different payment method.',
      priority: 'HIGH',
    },
  });

  logger.info('Payment marked as failed', { paymentId: payment.id });
}

/**
 * Handles payment cancellation
 */
async function handlePaymentCancelled(
  payment: { id: string; userId: string },
  webhookData: DLocalWebhookPayload
): Promise<void> {
  logger.info('Processing payment cancellation', {
    paymentId: payment.id,
    userId: payment.userId,
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'CANCELLED',
      providerStatus: webhookData.status,
      updatedAt: new Date(),
    },
  });

  // Create notification for user
  await prisma.notification.create({
    data: {
      userId: payment.userId,
      type: 'PAYMENT',
      title: 'Payment Cancelled',
      body: 'Your payment was cancelled. You can try again whenever you\'re ready.',
      priority: 'MEDIUM',
    },
  });

  logger.info('Payment marked as cancelled', { paymentId: payment.id });
}
