/**
 * dLocal Webhook Controller (Session 4A-4, File 2/4)
 *
 * Maps app/api/webhooks/dlocal/route.ts to a NestJS controller. Route path
 * is `/v1/webhooks/dlocal` (main.ts's global `/v1` prefix, F16) — a unique
 * path the dLocal provider dashboard isn't pointed at yet (Safety Gate,
 * this order's own scope note); no live traffic until Session 4A-5 flips
 * the dashboard URL.
 *
 * Handles dLocal payment webhooks with full subscription lifecycle:
 * - Creates subscriptions on successful payment
 * - Upgrades user to PRO tier
 * - Marks 3-day plan as used (anti-abuse)
 * - Creates notifications
 *
 * Headers:
 * - x-signature: HMAC signature for verification
 */

import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { logger } from '../common/logger.util';
import { PrismaService } from '../prisma/prisma.service';

import {
  verifyWebhookSignature,
  mapDLocalStatus,
} from './dlocal-payment.service';
import { PRICING } from './dlocal.constants';
import type { DLocalWebhookPayload } from './dlocal.types';
import { ThreeDayValidatorService } from './three-day-validator.service';

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

@Controller('webhooks/dlocal')
export class DlocalWebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threeDayValidator: ThreeDayValidatorService,
    private readonly conversionProcessor: ConversionProcessorService
  ) {}

  @Post()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response
  ): Promise<void> {
    try {
      // Get raw payload for signature verification
      const payload = request.rawBody?.toString('utf-8') ?? '';
      const signature = (request.headers['x-signature'] as string) || '';

      // Verify webhook signature
      if (!verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid webhook signature', {
          signaturePrefix: signature.substring(0, 10),
        });
        response.status(400).json({ error: 'Invalid signature' });
        return;
      }

      // Parse webhook payload
      let webhookData: DLocalWebhookPayload;
      try {
        webhookData = JSON.parse(payload);
      } catch {
        logger.error('Invalid webhook payload', {
          payload: payload.substring(0, 100),
        });
        response.status(400).json({ error: 'Invalid JSON payload' });
        return;
      }

      logger.info('dLocal webhook received', {
        paymentId: webhookData.id,
        status: webhookData.status,
        orderId: webhookData.order_id,
      });

      // Map dLocal status to our internal status
      const internalStatus = mapDLocalStatus(webhookData.status);

      // Find the payment record
      const payment = await this.prisma.payment.findFirst({
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
        response
          .status(200)
          .json({ received: true, warning: 'Payment not found' });
        return;
      }

      // Process based on status
      if (internalStatus === 'COMPLETED') {
        await this.handlePaymentCompleted(payment, webhookData);
      } else if (internalStatus === 'FAILED') {
        await this.handlePaymentFailed(payment, webhookData);
      } else if (internalStatus === 'CANCELLED') {
        await this.handlePaymentCancelled(payment, webhookData);
      }

      logger.info('Webhook processed successfully', {
        paymentId: webhookData.id,
        status: internalStatus,
      });

      response.status(200).json({ received: true });
    } catch (error) {
      logger.error('Webhook processing error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return 500 to trigger retry
      response.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handles successful payment completion
   */
  private async handlePaymentCompleted(
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
    await this.prisma.$transaction(async (tx) => {
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
      await this.threeDayValidator.markThreeDayPlanUsed(payment.userId);
      logger.info('3-day plan marked as used', { userId: payment.userId });
    }

    // 5b. Process affiliate conversion if a discount code was used (Part 17 seam)
    // Mirrors the Stripe webhook path; idempotent on webhook retries.
    if (payment.discountCode && payment.planType === 'MONTHLY') {
      try {
        const linkedSubscription = await this.prisma.subscription.findUnique({
          where: { userId: payment.userId },
          select: { id: true },
        });

        const conversion =
          await this.conversionProcessor.processAffiliateConversion({
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
    await this.prisma.notification.create({
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
  private async handlePaymentFailed(
    payment: { id: string; userId: string },
    webhookData: DLocalWebhookPayload
  ): Promise<void> {
    logger.warn('Processing payment failure', {
      paymentId: payment.id,
      userId: payment.userId,
      reason: webhookData.failure_reason,
    });

    // Update payment status
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerStatus: webhookData.status,
        failureReason: webhookData.failure_reason || 'Payment was rejected',
        updatedAt: new Date(),
      },
    });

    // Create notification for user
    await this.prisma.notification.create({
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
  private async handlePaymentCancelled(
    payment: { id: string; userId: string },
    webhookData: DLocalWebhookPayload
  ): Promise<void> {
    logger.info('Processing payment cancellation', {
      paymentId: payment.id,
      userId: payment.userId,
    });

    // Update payment status
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CANCELLED',
        providerStatus: webhookData.status,
        updatedAt: new Date(),
      },
    });

    // Create notification for user
    await this.prisma.notification.create({
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
}
