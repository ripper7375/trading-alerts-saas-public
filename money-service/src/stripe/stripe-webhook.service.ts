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

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { logger } from '../common/logger.util';
import { isUniqueConstraintError } from '../common/prisma-errors.util';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';

import { invoicePlan } from './invoice-plan';
import { StripeService } from './stripe.service';
import { scheduleIdOf } from './subscription-actions';
import { tierForStripeStatus } from './tier-rule';

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
    private readonly outboxService: OutboxService,
    private readonly stripeService: StripeService,
    private readonly affiliateConfig: AffiliateConfigService
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
      // The PRO price checkout charged: the admin's SystemConfig price.
      const amountUsd =
        billingPeriod === 'yearly'
          ? await this.affiliateConfig.getAnnualPriceUsd()
          : await this.affiliateConfig.getBasePriceUsd();

      const nextBillingDate = new Date();
      if (billingPeriod === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
      }

      const planType = billingPeriod === 'yearly' ? 'YEARLY' : 'MONTHLY';

      // Reserve the affiliate code (if any) BEFORE writing the subscription
      // so its id can be stamped in the same write -- and so a stale id
      // from a prior, abandoned signup (this user re-subscribing without a
      // code this time) is explicitly cleared rather than left dangling to
      // wrongly attribute a later renewal to the old affiliate. Reserving
      // (marking the code USED) still happens now, at checkout completion
      // -- that's what stops the SAME code being redeemed twice; only the
      // commission itself is deferred to handleInvoiceSucceeded, once real
      // money is actually collected (davintrade commission-timing fix --
      // checkout.session.completed fires before any charge when a trial is
      // configured, so crediting here paid affiliates on signups that
      // later failed to pay or were cancelled during the trial).
      const affiliateCodeInput = session.metadata?.['affiliateCode'];
      let reservedAffiliateCodeId: string | null = null;
      if (affiliateCodeInput) {
        try {
          const reservation =
            await this.conversionProcessor.reserveAffiliateCode({
              code: affiliateCodeInput,
              userId,
              subscriptionId,
            });
          if (reservation.reserved) {
            reservedAffiliateCodeId = reservation.affiliateCodeId ?? null;
          } else {
            logger.warn('[Webhook] Affiliate code not reserved', {
              code: affiliateCodeInput,
              reason: reservation.reason,
            });
          }
        } catch (reservationError) {
          // Never fail checkout because of affiliate bookkeeping.
          logger.error('[Webhook] Error reserving affiliate code', {
            error:
              reservationError instanceof Error
                ? reservationError.message
                : 'Unknown error',
          });
        }
      }

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
            affiliateCodeId: reservedAffiliateCodeId,
            // A user who cancelled and subscribes again reuses this row: the
            // new subscription is not scheduled to end (S2).
            cancelAtPeriodEnd: false,
            cancelRequestedAt: null,
            cancellationReason: null,
            // ...and has no switch to monthly waiting on the old subscription
            // (S3).
            pendingPlanType: null,
            pendingPlanEffectiveAt: null,
            stripeScheduleId: null,
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
            affiliateCodeId: reservedAffiliateCodeId,
          },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: userId,
          eventType: 'TIER_UPGRADED',
          // priceUsd: what checkout charged per period, for the confirmation
          // e-mail (operation-service must not print a list price of its own).
          payload: {
            tier: 'PRO',
            provider: 'STRIPE',
            billingPeriod,
            priceUsd: amountUsd,
          },
        });
      });

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

      // `cancelAtPeriodEnd` follows Stripe (B9), so a cancellation scheduled or
      // undone outside the cancel and resume routes (Stripe's dashboard, a
      // repair) is mirrored; when it is off, the "when" and "why" of an earlier
      // request go with it.
      const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;

      // B9, the switch part (W5b): a scheduled switch to monthly has taken
      // effect when the subscription now bills monthly while the row still
      // holds the pending switch -- phase 2 of the schedule starting at the
      // renewal date (observed in test mode: this event carries the item moving
      // from the yearly to the monthly price). The pending fields are cleared
      // in the same transaction; the schedule, which stays attached through
      // phase 2 and makes Stripe refuse `cancel_at_period_end`, is released
      // afterwards. Mirrors lib/stripe/webhook-handlers.ts.
      const billsMonthly =
        subscription.items?.data?.[0]?.price?.recurring?.interval === 'month';
      const switchTookEffect =
        dbSubscription.pendingPlanType === 'MONTHLY' && billsMonthly;

      // Remediation Tier 2 §6.4 (4A-13 audit item b): the subscription row and
      // the user's tier change together or not at all. As two separate writes,
      // a failure between them left the subscription cancelled/unpaid while the
      // user kept PRO (and this event is not retried, see the controller).
      const downgraded = await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status,
            stripeCurrentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
            expiresAt: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd,
            ...(!cancelAtPeriodEnd && {
              cancelRequestedAt: null,
              cancellationReason: null,
            }),
            ...(switchTookEffect && {
              pendingPlanType: null,
              pendingPlanEffectiveAt: null,
              stripeScheduleId: null,
            }),
          },
        });

        // Remove PRO only when the tier rule says FREE (canceled, unpaid, ...).
        // `past_due` keeps PRO through Stripe's retry window (B1, decision
        // E1). PRO is never granted here: invoice.payment_succeeded restores
        // it, and a late `past_due` event must not undo
        // customer.subscription.deleted.
        if (tierForStripeStatus(subscription.status) === 'FREE') {
          await tx.user.update({
            where: { id: dbSubscription.userId },
            data: { tier: 'FREE' },
          });
          return true;
        }
        return false;
      });

      if (downgraded) {
        logger.info('[Webhook] User downgraded due to subscription status', {
          userId: dbSubscription.userId,
          stripeStatus: subscription.status,
        });
      }

      if (switchTookEffect) {
        const scheduleId =
          scheduleIdOf(subscription.schedule) ??
          dbSubscription.stripeScheduleId;
        if (scheduleId) {
          try {
            await this.stripeService.releaseSubscriptionSchedule(scheduleId);
          } catch (releaseError) {
            // Not fatal: the cancel flow releases any schedule it finds before
            // cancelling, so the user is never stuck. Logged to be seen.
            logger.error(
              '[Webhook] Could not release the finished switch schedule',
              {
                subscriptionId,
                error:
                  releaseError instanceof Error
                    ? releaseError.message
                    : 'Unknown error',
              }
            );
          }
        }
        logger.info('[Webhook] Subscription switched to monthly billing', {
          subscriptionId,
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

        // Recurring-commission follow-up: also clears affiliateCodeId
        // explicitly -- mirrors lib/stripe/webhook-handlers.ts.
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: 'CANCELED', affiliateCodeId: null },
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

      // This subscriber's own price and period (existing subscribers keep
      // theirs), as lib/stripe/webhook-handlers.ts passes to the e-mail.
      const billingPeriod =
        dbSubscription.planType === 'YEARLY' ? 'yearly' : 'monthly';
      const priceUsd =
        Number(dbSubscription.amountUsd) ||
        (billingPeriod === 'yearly'
          ? await this.affiliateConfig.getAnnualPriceUsd()
          : await this.affiliateConfig.getBasePriceUsd());

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: { status: 'PAST_DUE' },
        });

        await this.outboxService.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: dbSubscription.userId,
          eventType: 'PAYMENT_FAILED',
          payload: {
            provider: 'STRIPE',
            failureReason,
            billingPeriod,
            priceUsd,
          },
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

      // Billing period and list price from the invoice's own price line (not
      // from the amount paid: the PRO price is admin-editable)
      const amountPaid = invoice.amount_paid || 0;
      const { yearly: isYearly, listPriceUsd } = invoicePlan(invoice);

      const nextBillingDate = new Date();
      if (isYearly) {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
      }

      const taxRecord = this.extractInvoiceTaxRecord(invoice);

      await this.prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: dbSubscription.id },
          data: {
            status: 'ACTIVE',
            stripeCurrentPeriodEnd: nextBillingDate,
            expiresAt: nextBillingDate,
            renewalReminderSent: false,
            planType: isYearly ? 'YEARLY' : 'MONTHLY',
            ...(listPriceUsd !== null && { amountUsd: listPriceUsd }),
          },
        });

        await tx.user.update({
          where: { id: dbSubscription.userId },
          data: { tier: 'PRO' },
        });

        // Persist the tax breakdown for OSS filing / threshold monitoring
        // (davintrade-vat-stack, Nuance 1) -- mirrors
        // lib/stripe/webhook-handlers.ts's handleInvoiceSucceeded.
        await tx.invoice.upsert({
          where: { stripeInvoiceId: invoice.id },
          update: {
            invoicePdf: taxRecord.invoicePdf,
            hostedInvoiceUrl: taxRecord.hostedInvoiceUrl,
            amountTotal: taxRecord.amountTotal,
            taxAmount: taxRecord.taxAmount,
            taxRate: taxRecord.taxRate,
            taxCountry: taxRecord.taxCountry,
            customerTaxId: taxRecord.customerTaxId,
            reverseCharge: taxRecord.reverseCharge,
            paidAt: taxRecord.paidAt,
          },
          create: {
            userId: dbSubscription.userId,
            subscriptionId: dbSubscription.id,
            stripeInvoiceId: invoice.id,
            stripeCustomerId: customerId,
            ...taxRecord,
          },
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

      // Credit the referring affiliate's commission now that real money
      // has actually been collected (davintrade commission-timing fix) --
      // never at checkout completion. Recurring-commission follow-up:
      // fires on EVERY qualifying invoice, not just the first, up to
      // getMaxCommissionCycles (24 monthly or 2 annual invoices) --
      // creditAffiliateCommission is idempotent per invoice, and reports
      // capReached so this caller knows when to stop the attribution.
      if (dbSubscription.affiliateCodeId) {
        try {
          const conversion =
            await this.conversionProcessor.creditAffiliateCommission({
              affiliateCodeId: dbSubscription.affiliateCodeId,
              userId: dbSubscription.userId,
              subscriptionId: dbSubscription.stripeSubscriptionId,
              grossRevenueUsd: amountPaid / 100,
              stripeInvoiceId: invoice.id,
              interval: isYearly ? 'year' : 'month',
              // E4: months of lifetime covered, not invoices. Stripe is asked
              // only when an earlier commission exists; an invoice it cannot
              // resolve counts as the plan the row had before this invoice
              // (`dbSubscription` is the row as it was read above).
              resolvePriorInvoiceMonths: () =>
                this.stripeService.getInvoiceMonthsById(
                  dbSubscription.stripeSubscriptionId as string
                ),
              fallbackPriorMonths:
                dbSubscription.planType === 'YEARLY' ? 12 : 1,
            });

          if (conversion.processed) {
            logger.info('[Webhook] Affiliate commission credited', {
              userId: dbSubscription.userId,
              commissionId: conversion.commissionId,
              commissionAmount: conversion.commissionAmount,
            });
            // F50: aggregateId is the affiliate who earned the commission,
            // NOT the paying subscriber -- the outbox consumer resolves
            // the recipient from aggregateId.
            await this.emitOutboxEvent(
              conversion.affiliateUserId as string,
              'COMMISSION_CREDITED',
              {
                commissionId: conversion.commissionId,
                commissionAmount: conversion.commissionAmount,
                totalEarnings: conversion.totalEarnings,
                code: conversion.code,
                provider: 'STRIPE',
              }
            );
          } else {
            logger.warn('[Webhook] Affiliate commission not credited', {
              userId: dbSubscription.userId,
              reason: conversion.reason,
            });
          }

          // Only clear the attribution once the recurring-commission cap
          // is reached -- otherwise leave it in place so the next renewal
          // keeps crediting.
          if (conversion.capReached) {
            await this.prisma.subscription.update({
              where: { id: dbSubscription.id },
              data: { affiliateCodeId: null },
            });
          }
        } catch (conversionError) {
          // Never fail invoice processing because of commission
          // bookkeeping -- the subscription/tax/receipt work above already
          // succeeded and must not be rolled back over this.
          logger.error('[Webhook] Affiliate commission crediting failed', {
            userId: dbSubscription.userId,
            error:
              conversionError instanceof Error
                ? conversionError.message
                : 'Unknown error',
          });
        }
      }

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

  /**
   * Handle charge.refunded event.
   *
   * Cancels the affiliate commission tied to this customer's subscription
   * if it hasn't been paid out yet. Completes the commission-hold design
   * (davintrade-vat-stack follow-up): the hold window
   * (SystemConfig.affiliate_commission_approval_days) only delays payout --
   * this is what actually acts on a refund arriving during that window.
   * Mirrors lib/stripe/webhook-handlers.ts's handleChargeRefunded.
   */
  async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const customerId =
      typeof charge.customer === 'string'
        ? charge.customer
        : charge.customer?.id;
    const invoiceId =
      typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id;
    await this.cancelCommissionForRefundOrDispute(
      customerId ?? null,
      invoiceId ?? null,
      'refund'
    );
  }

  /**
   * Handle charge.dispute.created event.
   *
   * Same clawback as handleChargeRefunded, but for a cardholder dispute
   * (chargeback). The dispute payload only carries the charge id, not the
   * customer, so the charge is fetched via StripeService to resolve it.
   */
  async handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    try {
      const chargeId =
        typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
      const charge = await this.stripeService.retrieveCharge(chargeId);
      const customerId =
        typeof charge.customer === 'string'
          ? charge.customer
          : charge.customer?.id;
      const invoiceId =
        typeof charge.invoice === 'string'
          ? charge.invoice
          : charge.invoice?.id;
      await this.cancelCommissionForRefundOrDispute(
        customerId ?? null,
        invoiceId ?? null,
        'dispute'
      );
    } catch (error) {
      logger.error('[Webhook] Error resolving disputed charge', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Shared clawback logic for both events above.
   *
   * - PENDING or APPROVED (not yet disbursed): cancelled, and both the
   *   affiliate's pendingCommissions and totalEarnings are reversed --
   *   symmetric with how they were incremented when the commission was
   *   created.
   * - Already PAID: cannot be silently reversed (the money already left
   *   for the affiliate) -- logged prominently for manual recovery
   *   instead of attempted automatically.
   * - Already CANCELLED, or no commission at all for this customer: no-op
   *   (idempotent against webhook redelivery, and the common case of a
   *   refund with no affiliate code involved at all).
   */
  /**
   * Recurring-commission follow-up: a subscription can now have up to
   * getMaxCommissionCycles() separate Commission rows (one per
   * billing cycle), so this must claw back the ONE row tied to the
   * specific invoice that was actually refunded/disputed -- mirrors
   * lib/stripe/webhook-handlers.ts. Falls back to the subscription-wide
   * lookup only when the invoice id can't be resolved.
   */
  private async cancelCommissionForRefundOrDispute(
    customerId: string | null,
    invoiceId: string | null,
    reason: 'refund' | 'dispute'
  ): Promise<void> {
    if (!customerId) {
      logger.error(`[Webhook] No customer ID on ${reason} event`);
      return;
    }

    try {
      const dbSubscription = await this.prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (!dbSubscription?.stripeSubscriptionId) {
        logger.info(`[Webhook] No subscription found for ${reason} event`, {
          customerId,
        });
        return;
      }

      const commission = invoiceId
        ? await this.prisma.commission.findFirst({
            where: {
              subscriptionId: dbSubscription.stripeSubscriptionId,
              stripeInvoiceId: invoiceId,
            },
          })
        : await this.prisma.commission.findFirst({
            where: { subscriptionId: dbSubscription.stripeSubscriptionId },
          });

      if (!commission) {
        // The common case: most refunds/disputes involve no affiliate code.
        return;
      }

      if (commission.status === 'CANCELLED') {
        return;
      }

      if (commission.status === 'PAID') {
        // Money already left for the affiliate -- can't silently reverse a
        // disbursement that already happened. Net it against their NEXT
        // payout instead: a negative-amount Commission row referencing the
        // original, immediately APPROVED (a correction, not a new earning,
        // so no trial-safety hold needed). No changes needed to
        // CommissionAggregator -- it already just sums commissionAmount
        // across rows, so a negative row nets out automatically.
        const clawedBack = await this.prisma
          .$transaction(async (tx) => {
            await tx.commission.create({
              data: {
                affiliateProfileId: commission.affiliateProfileId,
                affiliateCodeId: commission.affiliateCodeId,
                userId: commission.userId,
                subscriptionId: commission.subscriptionId,
                grossRevenue: Number(commission.grossRevenue) * -1,
                discountAmount: Number(commission.discountAmount) * -1,
                netRevenue: Number(commission.netRevenue) * -1,
                commissionAmount: Number(commission.commissionAmount) * -1,
                status: 'APPROVED',
                approvedAt: new Date(),
                clawbackOfCommissionId: commission.id,
              },
            });

            await tx.affiliateProfile.update({
              where: { id: commission.affiliateProfileId },
              data: {
                totalEarnings: {
                  decrement: Number(commission.commissionAmount),
                },
                pendingCommissions: {
                  decrement: Number(commission.commissionAmount),
                },
              },
            });
            return true;
          })
          .catch((error: unknown) => {
            // Remediation Tier 2 §6.1: clawbackOfCommissionId is unique in the
            // database, so a redelivered refund / dispute (or the same event at
            // the monolith's endpoint too) cannot deduct a second time. The
            // loser's transaction -- row AND counters -- rolled back.
            if (isUniqueConstraintError(error)) return false;
            throw error;
          });

        if (!clawedBack) {
          logger.info(
            `[Webhook] Clawback already recorded for this commission -- skipping duplicate ${reason}`,
            { commissionId: commission.id }
          );
          return;
        }

        logger.info(
          `[Webhook] Commission already PAID -- created a clawback deduction for the next payout due to ${reason}`,
          {
            commissionId: commission.id,
            affiliateProfileId: commission.affiliateProfileId,
            amount: Number(commission.commissionAmount),
          }
        );
        return;
      }

      // PENDING or APPROVED -- cancel before it's ever (or further) disbursed.
      // Remediation Tier 2 §6.1: the status change is a conditional update in
      // the SAME transaction as the counter reversal. The read above holds no
      // lock, so two deliveries of one refund both saw PENDING; with an
      // unconditional update both cancelled it and both reversed the affiliate's
      // counters. Now exactly one delivery changes the row (count 1) and reverses
      // the counters; the other finds it no longer PENDING/APPROVED (count 0).
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.commission.updateMany({
          where: { id: commission.id, status: { in: ['PENDING', 'APPROVED'] } },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        if (changed.count === 0) return false;

        await tx.affiliateProfile.update({
          where: { id: commission.affiliateProfileId },
          data: {
            totalCodesUsed: { decrement: 1 },
            totalEarnings: { decrement: Number(commission.commissionAmount) },
            pendingCommissions: {
              decrement: Number(commission.commissionAmount),
            },
          },
        });
        return true;
      });

      if (!cancelled) {
        // Either a concurrent delivery cancelled it (fine), or it was paid out
        // between the read above and now (the clawback row for a PAID
        // commission was not written). Say so; a human can tell which.
        logger.warn(
          `[Webhook] Commission was no longer PENDING/APPROVED when the ${reason} arrived -- not cancelled again`,
          { commissionId: commission.id }
        );
        return;
      }

      logger.info(`[Webhook] Commission cancelled due to ${reason}`, {
        commissionId: commission.id,
        amount: Number(commission.commissionAmount),
      });
    } catch (error) {
      logger.error(`[Webhook] Error cancelling commission for ${reason}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extract the multi-jurisdiction tax breakdown from a finalized Stripe
   * invoice (davintrade-vat-stack, Section 4.1 "Nuance 1"). Mirrors
   * lib/stripe/webhook-handlers.ts's free-function version verbatim.
   */
  private extractInvoiceTaxRecord(invoice: Stripe.Invoice): {
    amountTotal: number;
    taxAmount: number;
    taxRate: number;
    currency: string;
    taxCountry: string;
    customerTaxId: string | null;
    reverseCharge: boolean;
    invoicePdf: string | null;
    hostedInvoiceUrl: string | null;
    paidAt: Date | null;
  } {
    const taxAmount = (invoice.tax ?? 0) / 100;
    const amountTotal = invoice.total / 100;

    const firstLineTaxRate = invoice.lines?.data?.[0]?.tax_rates?.[0];
    const taxRate = (firstLineTaxRate?.percentage ?? 0) / 100;

    const customerTaxId = invoice.customer_tax_ids?.[0]?.value || null;
    const paidAtEpoch = invoice.status_transitions?.paid_at;

    return {
      amountTotal,
      taxAmount,
      taxRate,
      currency: invoice.currency.toUpperCase(),
      taxCountry: invoice.customer_address?.country || 'UNKNOWN',
      customerTaxId,
      reverseCharge: taxRate === 0 && customerTaxId !== null,
      invoicePdf: invoice.invoice_pdf || null,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      paidAt: paidAtEpoch ? new Date(paidAtEpoch * 1000) : new Date(),
    };
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
