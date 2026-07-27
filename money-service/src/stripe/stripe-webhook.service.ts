/**
 * Stripe Webhook Service (Session 4A-9, File 4/10)
 *
 * Ports lib/stripe/webhook-handlers.ts's five event handlers (a SOURCE the
 * 4A-9 order originally omitted entirely -- the cited route.ts is a thin
 * dispatcher only; this file holds all the real tier/subscription business
 * logic). Two deliberate deviations from the SOURCE, both signed off by
 * Davin this session:
 *
 * 1. Affiliate commission crediting reuses `ConversionProcessorService`
 *    (built 4A-4, already used by the live dLocal webhook) instead of
 *    reimplementing `processAffiliateCommission` -- that service's own
 *    version is additionally atomic ($transaction), which the monolith's
 *    free-function original is not.
 * 2. No email is sent from money-service (no such capability exists here).
 *    Following the established dLocal (Slice 2, 4A-5) precedent: write
 *    domain state synchronously, and emit an OutboxEvent in the SAME
 *    transaction as the state write for operation-service to eventually
 *    consume (Slice 5 / 4A-11-12) and send the email from.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type Stripe from 'stripe';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { logger } from '../common/logger.util';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

type SubscriptionStatusValue =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CANCELED'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'TRIALING';

@Injectable()
export class StripeWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversionProcessor: ConversionProcessorService,
    private readonly outboxService: OutboxService
  ) {}

  private async emitOutboxEvent(
    aggregateId: string,
    eventType: string,
    payload: Prisma.InputJsonValue
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.recordInTransaction(tx, {
        aggregateType: 'User',
        aggregateId,
        eventType,
        payload,
      });
    });
  }

  async handleCheckoutCompleted(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const userId = session.metadata?.['userId'];

    if (!userId) {
      logger.error('[Webhook] No userId in checkout session metadata');
      return;
    }

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    if (!customerId || !subscriptionId) {
      logger.error('[Webhook] Missing customer or subscription ID');
      return;
    }

    try {
      const billingPeriod =
        session.metadata?.['billingPeriod'] === 'yearly' ? 'yearly' : 'monthly';
      const amountUsd = billingPeriod === 'yearly' ? 290 : 29;

      const nextBillingDate = new Date();
      if (billingPeriod === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
      }

      const planType = billingPeriod === 'yearly' ? 'YEARLY' : 'MONTHLY';

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            tier: 'PRO',
            hasUsedFreeTrial: true,
            trialStatus: 'CONVERTED',
            trialConvertedAt: new Date(),
          },
        });

        await tx.subscription.upsert({
          where: { userId },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: 'ACTIVE',
            amountUsd,
            planType,
            stripeCurrentPeriodEnd: nextBillingDate,
            expiresAt: nextBillingDate,
          },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: 'ACTIVE',
            amountUsd,
            planType,
            stripeCurrentPeriodEnd: nextBillingDate,
            expiresAt: nextBillingDate,
          },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: userId,
          eventType: 'TIER_UPGRADED',
          payload: { tier: 'PRO', provider: 'STRIPE', billingPeriod },
        });
      });

      const affiliateCode = session.metadata?.['affiliateCode'];
      if (affiliateCode) {
        try {
          const conversion =
            await this.conversionProcessor.processAffiliateConversion({
              code: affiliateCode,
              userId,
              subscriptionId,
              grossRevenueUsd: amountUsd,
              provider: 'STRIPE',
            });

          if (conversion.processed) {
            logger.info('[Webhook] Affiliate commission created', {
              userId,
              commissionId: conversion.commissionId,
              commissionAmount: conversion.commissionAmount,
            });
            await this.emitOutboxEvent(userId, 'COMMISSION_CREDITED', {
              commissionId: conversion.commissionId,
              commissionAmount: conversion.commissionAmount,
              provider: 'STRIPE',
            });
          } else {
            logger.warn('[Webhook] Affiliate conversion not processed', {
              userId,
              reason: conversion.reason,
            });
          }
        } catch (conversionError) {
          // Never fail the webhook because of commission bookkeeping.
          logger.error('[Webhook] Affiliate conversion processing failed', {
            userId,
            error:
              conversionError instanceof Error
                ? conversionError.message
                : 'Unknown error',
          });
        }
      }

      logger.info('[Webhook] User upgraded to PRO', {
        userId,
        billingPeriod,
      });
    } catch (error) {
      logger.error('[Webhook] Error handling checkout completed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleSubscriptionUpdated(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const subscriptionId = subscription.id;

    try {
      const dbSubscription = await this.prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (!dbSubscription) {
        logger.error('[Webhook] Subscription not found', { subscriptionId });
        return;
      }

      const status = this.mapStripeStatus(subscription.status);

      await this.prisma.subscription.update({
        where: { id: dbSubscription.id },
        data: {
          status,
          stripeCurrentPeriodEnd: new Date(
            subscription.current_period_end * 1000
          ),
          expiresAt: new Date(subscription.current_period_end * 1000),
        },
      });

      if (
        subscription.status !== 'active' &&
        subscription.status !== 'trialing'
      ) {
        await this.prisma.user.update({
          where: { id: dbSubscription.userId },
          data: { tier: 'FREE' },
        });

        logger.info('[Webhook] User downgraded due to subscription status', {
          userId: dbSubscription.userId,
          stripeStatus: subscription.status,
        });
      }

      logger.info('[Webhook] Subscription updated', {
        subscriptionId,
        status,
      });
    } catch (error) {
      logger.error('[Webhook] Error handling subscription updated', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    const subscriptionId = subscription.id;

    try {
      const dbSubscription = await this.prisma.subscription.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (!dbSubscription) {
        logger.error('[Webhook] Subscription not found', { subscriptionId });
        return;
      }

      const cancelAt = subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000)
        : new Date();

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: dbSubscription.userId },
          data: {
            tier: 'FREE',
            trialStatus: 'CANCELLED',
            trialCancelledAt: new Date(),
          },
        });

        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: 'CANCELED' },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: dbSubscription.userId,
          eventType: 'SUBSCRIPTION_CANCELLED',
          payload: {
            tier: 'FREE',
            subscriptionId: dbSubscription.id,
            provider: 'STRIPE',
            cancelAt: cancelAt.toISOString(),
          },
        });
      });

      logger.info('[Webhook] User subscription deleted, downgraded to FREE', {
        userId: dbSubscription.userId,
      });
    } catch (error) {
      logger.error('[Webhook] Error handling subscription deleted', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    if (!customerId) {
      logger.error('[Webhook] No customer ID in invoice');
      return;
    }

    try {
      const dbSubscription = await this.prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (!dbSubscription) {
        logger.error('[Webhook] Subscription not found for customer', {
          customerId,
        });
        return;
      }

      const failureReason =
        invoice.last_finalization_error?.message || 'Payment method declined';

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: 'PAST_DUE' },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: dbSubscription.userId,
          eventType: 'PAYMENT_FAILED',
          payload: { provider: 'STRIPE', failureReason },
        });
      });

      // Note: we don't immediately downgrade -- Stripe handles retries and
      // eventually sends customer.subscription.deleted if all retries fail.

      logger.info('[Webhook] Payment failed', {
        userId: dbSubscription.userId,
        failureReason,
      });
    } catch (error) {
      logger.error('[Webhook] Error handling invoice failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async handleInvoiceSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    if (!customerId) {
      logger.error('[Webhook] No customer ID in invoice');
      return;
    }

    if ((invoice.amount_paid || 0) === 0) {
      logger.info('[Webhook] Skipping $0 invoice (trial period)');
      return;
    }

    try {
      const dbSubscription = await this.prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (!dbSubscription) {
        logger.error('[Webhook] Subscription not found for customer', {
          customerId,
        });
        return;
      }

      const amountPaid = invoice.amount_paid || 0;
      const isYearly = amountPaid >= 28000;

      const nextBillingDate = new Date();
      if (isYearly) {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: 'ACTIVE',
            stripeCurrentPeriodEnd: nextBillingDate,
            expiresAt: nextBillingDate,
            renewalReminderSent: false,
            planType: isYearly ? 'YEARLY' : 'MONTHLY',
            amountUsd: isYearly ? 290 : 29,
          },
        });

        await tx.user.update({
          where: { id: dbSubscription.userId },
          data: { tier: 'PRO' },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: dbSubscription.userId,
          eventType: 'PAYMENT_SUCCEEDED',
          payload: {
            provider: 'STRIPE',
            amountPaidUsd: amountPaid / 100,
            nextBillingDate: nextBillingDate.toISOString(),
          },
        });
      });

      logger.info('[Webhook] Payment succeeded', {
        userId: dbSubscription.userId,
        amountUsd: amountPaid / 100,
      });
    } catch (error) {
      logger.error('[Webhook] Error handling invoice succeeded', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private mapStripeStatus(
    stripeStatus: Stripe.Subscription.Status
  ): SubscriptionStatusValue {
    const statusMap: Record<
      Stripe.Subscription.Status,
      SubscriptionStatusValue
    > = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'UNPAID',
      incomplete: 'INACTIVE',
      incomplete_expired: 'INACTIVE',
      paused: 'INACTIVE',
    };

    return statusMap[stripeStatus] || 'INACTIVE';
  }
}
