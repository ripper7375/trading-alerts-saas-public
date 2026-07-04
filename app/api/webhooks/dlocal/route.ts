/**
 * POST /api/webhooks/dlocal
 *
 * Handles dLocal payment webhooks with full subscription lifecycle.
 *
 * Part 18B Enhanced Version:
 * - Creates subscriptions on successful payment
 * - Upgrades user to PRO tier
 * - Marks 3-day plan as used (anti-abuse)
 * - Creates notifications
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
import {
  verifyWebhookSignature,
  mapDLocalStatus,
} from '@/lib/dlocal/dlocal-payment.service';
import { markThreeDayPlanUsed } from '@/lib/dlocal/three-day-validator.service';
import { processAffiliateConversion } from '@/lib/affiliate/conversion-processor';
import { PRICING } from '@/lib/dlocal/constants';
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
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Parse webhook payload
    let webhookData: DLocalWebhookPayload;
    try {
      webhookData = JSON.parse(payload);
    } catch {
      logger.error('Invalid webhook payload', {
        payload: payload.substring(0, 100),
      });
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
      return NextResponse.json({
        received: true,
        warning: 'Payment not found',
      });
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
 * Payment record type for webhook processing
 */
interface PaymentRecord {
  id: string;
  userId: string;
  planType: string | null;
  amount: unknown;
  amountUSD?: unknown;
  currency: string;
  country: string | null;
  paymentMethod: string | null;
  providerPaymentId: string;
  discountCode?: string | null;
}

/**
 * Handles successful payment completion
 *
 * Part 18B: Now creates subscriptions, upgrades users, and marks 3-day plan usage
 */
async function handlePaymentCompleted(
  payment: PaymentRecord,
  webhookData: DLocalWebhookPayload
): Promise<void> {
  logger.info('Processing payment completion', {
    paymentId: payment.id,
    userId: payment.userId,
    planType: payment.planType,
  });

  // Calculate subscription expiry based on plan type
  const now = new Date();
  const expiresAt =
    payment.planType === 'THREE_DAY'
      ? new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Actual USD amount for this plan (fixes hardcoded $29 for 3-day plans)
  const planAmountUsd =
    Number(payment.amountUSD) ||
    (payment.planType === 'THREE_DAY'
      ? PRICING.THREE_DAY_USD
      : PRICING.MONTHLY_USD);

  // Use a transaction to ensure all updates succeed or fail together
  await prisma.$transaction(async (tx) => {
    // 1. Update payment status
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        providerStatus: webhookData.status,
        updatedAt: new Date(),
      },
    });

    // 2. Upgrade user to PRO tier
    await tx.user.update({
      where: { id: payment.userId },
      data: { tier: 'PRO' },
    });

    // 3. Create or update subscription
    const existingSubscription = await tx.subscription.findUnique({
      where: { userId: payment.userId },
    });

    if (existingSubscription) {
      // Update existing subscription
      await tx.subscription.update({
        where: { userId: payment.userId },
        data: {
          status: 'ACTIVE',
          planType: payment.planType,
          dLocalPaymentId: payment.providerPaymentId,
          dLocalPaymentMethod: payment.paymentMethod,
          dLocalCountry: payment.country,
          dLocalCurrency: payment.currency,
          expiresAt,
          renewalReminderSent: false,
          amountUsd: planAmountUsd,
        },
      });
    } else {
      // Create new subscription
      await tx.subscription.create({
        data: {
          userId: payment.userId,
          status: 'ACTIVE',
          planType: payment.planType,
          dLocalPaymentId: payment.providerPaymentId,
          dLocalPaymentMethod: payment.paymentMethod,
          dLocalCountry: payment.country,
          dLocalCurrency: payment.currency,
          expiresAt,
          renewalReminderSent: false,
          amountUsd: planAmountUsd,
        },
      });
    }

    // 4. Link payment to subscription
    const subscription = await tx.subscription.findUnique({
      where: { userId: payment.userId },
    });

    if (subscription) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: subscription.id },
      });
    }
  });

  // 5. Mark 3-day plan as used if applicable (outside transaction for isolation)
  if (payment.planType === 'THREE_DAY') {
    await markThreeDayPlanUsed(payment.userId);
    logger.info('3-day plan marked as used', { userId: payment.userId });
  }

  // 5b. Process affiliate conversion if a discount code was used (Part 17 seam)
  // Mirrors the Stripe webhook path; idempotent on webhook retries.
  if (payment.discountCode && payment.planType === 'MONTHLY') {
    try {
      const linkedSubscription = await prisma.subscription.findUnique({
        where: { userId: payment.userId },
        select: { id: true },
      });

      const conversion = await processAffiliateConversion({
        code: payment.discountCode,
        userId: payment.userId,
        subscriptionId: linkedSubscription?.id ?? null,
        grossRevenueUsd: planAmountUsd,
        provider: 'DLOCAL',
      });

      if (conversion.processed) {
        logger.info('Affiliate commission created for dLocal payment', {
          paymentId: payment.id,
          commissionId: conversion.commissionId,
          commissionAmount: conversion.commissionAmount,
        });
      } else {
        logger.warn('Affiliate conversion not processed', {
          paymentId: payment.id,
          reason: conversion.reason,
        });
      }
    } catch (conversionError) {
      // Never fail the payment webhook because of commission bookkeeping
      logger.error('Affiliate conversion processing failed', {
        paymentId: payment.id,
        error:
          conversionError instanceof Error
            ? conversionError.message
            : 'Unknown error',
      });
    }
  }

  // 6. Create success notification
  await prisma.notification.create({
    data: {
      userId: payment.userId,
      type: 'SUBSCRIPTION',
      title: 'Welcome to PRO!',
      body: `Your ${payment.planType === 'THREE_DAY' ? '3-day' : 'monthly'} subscription is now active. Enjoy all PRO features!`,
      priority: 'HIGH',
    },
  });

  logger.info('Payment completed and subscription created', {
    paymentId: payment.id,
    userId: payment.userId,
    planType: payment.planType,
    expiresAt: expiresAt.toISOString(),
  });
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
      body: "Your payment was cancelled. You can try again whenever you're ready.",
      priority: 'MEDIUM',
    },
  });

  logger.info('Payment marked as cancelled', { paymentId: payment.id });
}
