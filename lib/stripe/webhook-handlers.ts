/**
 * Stripe Webhook Event Handlers
 *
 * Handles Stripe webhook events for subscription lifecycle:
 * - checkout.session.completed - User completed payment
 * - customer.subscription.updated - Subscription details changed
 * - customer.subscription.deleted - Subscription cancelled
 * - invoice.payment_failed - Payment failed
 * - invoice.payment_succeeded - Payment successful
 *
 * @module lib/stripe/webhook-handlers
 */

import type Stripe from 'stripe';

import { prisma } from '@/lib/db/prisma';
import { getStripeClient } from '@/lib/stripe/stripe';
import {
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
  sendAffiliateCommissionEmail,
} from '@/lib/email/subscription-emails';
import { sendSubscriptionConfirmationEmail } from '@/lib/email/email';
import { calculateFullBreakdown } from '@/lib/affiliate/commission-calculator';

/**
 * Subscription/AffiliateProfile no longer carry a `user` relation (Session
 * 2-3 FK audit dropped it) — look the contact fields up separately by
 * `userId` instead of a relation include.
 */
async function getUserContact(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKOUT COMPLETED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle checkout.session.completed event
 *
 * Called when user successfully completes Stripe Checkout.
 * Creates subscription record and upgrades user to PRO tier.
 *
 * @param session - Stripe Checkout Session object
 */
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.['userId'];

  if (!userId) {
    console.error('[Webhook] No userId in checkout session metadata');
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!customerId || !subscriptionId) {
    console.error('[Webhook] Missing customer or subscription ID');
    return;
  }

  try {
    // Determine billing period from session metadata or line items
    const billingPeriod =
      session.metadata?.['billingPeriod'] === 'yearly' ? 'yearly' : 'monthly';
    const amountUsd = billingPeriod === 'yearly' ? 290 : 29;

    // Update user tier to PRO
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tier: 'PRO',
        hasUsedFreeTrial: true,
        trialStatus: 'CONVERTED',
        trialConvertedAt: new Date(),
      },
    });

    // Calculate next billing date based on billing period
    const nextBillingDate = new Date();
    if (billingPeriod === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setDate(nextBillingDate.getDate() + 30);
    }

    // Map billing period to plan type
    const planType = billingPeriod === 'yearly' ? 'YEARLY' : 'MONTHLY';

    // Reserve the affiliate code (if any) BEFORE writing the subscription so
    // its id can be stamped in the same write -- and so a stale id from a
    // prior, abandoned signup (this user re-subscribing without a code this
    // time) is explicitly cleared rather than left dangling to wrongly
    // attribute a later renewal to the old affiliate. Reserving (marking
    // the code USED) still happens now, at checkout completion -- that's
    // what stops the SAME code being redeemed twice; only the commission
    // itself is deferred (see processAffiliateCommission, called from
    // handleInvoiceSucceeded once real money is actually collected).
    const affiliateCodeInput = session.metadata?.['affiliateCode'];
    const reservedAffiliateCode = affiliateCodeInput
      ? await reserveAffiliateCode(affiliateCodeInput, userId, subscriptionId)
      : null;

    // Create or update subscription record
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'ACTIVE',
        amountUsd,
        planType,
        stripeCurrentPeriodEnd: nextBillingDate,
        expiresAt: nextBillingDate,
        affiliateCodeId: reservedAffiliateCode?.id ?? null,
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
        affiliateCodeId: reservedAffiliateCode?.id ?? null,
      },
    });

    // Send subscription confirmation email with correct tier features
    if (user.email) {
      await sendSubscriptionConfirmationEmail(
        user.email,
        user.name || 'User',
        'PRO',
        billingPeriod
      );
    }

    console.log(
      `[Webhook] User ${userId} upgraded to PRO (${billingPeriod} billing)`
    );
  } catch (error) {
    console.error('[Webhook] Error handling checkout completed:', error);
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIPTION UPDATED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle customer.subscription.updated event
 *
 * Called when subscription details change (payment method, status, etc.).
 * Syncs subscription status with database.
 *
 * @param subscription - Stripe Subscription object
 */
export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const subscriptionId = subscription.id;

  try {
    // Find subscription by Stripe subscription ID
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!dbSubscription) {
      console.error('[Webhook] Subscription not found:', subscriptionId);
      return;
    }

    // Map Stripe status to our SubscriptionStatus enum
    const status = mapStripeStatus(subscription.status);

    // Update subscription details
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status,
        stripeCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ),
        expiresAt: new Date(subscription.current_period_end * 1000),
      },
    });

    // If subscription became inactive, downgrade user to FREE
    if (
      subscription.status !== 'active' &&
      subscription.status !== 'trialing'
    ) {
      await prisma.user.update({
        where: { id: dbSubscription.userId },
        data: { tier: 'FREE' },
      });

      console.log(
        `[Webhook] User ${dbSubscription.userId} downgraded due to subscription status: ${subscription.status}`
      );
    }

    console.log(
      `[Webhook] Subscription ${subscriptionId} updated to status: ${status}`
    );
  } catch (error) {
    console.error('[Webhook] Error handling subscription updated:', error);
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBSCRIPTION DELETED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle customer.subscription.deleted event
 *
 * Called when subscription is cancelled or expires.
 * Downgrades user to FREE tier and sends cancellation email.
 *
 * @param subscription - Stripe Subscription object
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const subscriptionId = subscription.id;

  try {
    // Find subscription by Stripe subscription ID
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!dbSubscription) {
      console.error('[Webhook] Subscription not found:', subscriptionId);
      return;
    }

    // Get the cancel_at date from Stripe subscription (when access ends)
    const cancelAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : new Date(); // If no cancel_at, access ends immediately

    // Update user tier to FREE
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: {
        tier: 'FREE',
        trialStatus: 'CANCELLED',
        trialCancelledAt: new Date(),
      },
    });

    // Update subscription status to CANCELLED
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: { status: 'CANCELED' },
    });

    // Send subscription canceled email with access end date
    const cancelUser = await getUserContact(dbSubscription.userId);
    if (cancelUser?.email) {
      await sendSubscriptionCanceledEmail(
        cancelUser.email,
        cancelUser.name || 'User',
        'PRO',
        cancelAt
      );
    }

    console.log(
      `[Webhook] User ${dbSubscription.userId} subscription deleted, downgraded to FREE`
    );
  } catch (error) {
    console.error('[Webhook] Error handling subscription deleted:', error);
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVOICE PAYMENT FAILED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle invoice.payment_failed event
 *
 * Called when payment fails (expired card, insufficient funds, etc.).
 * Sends payment failure email. User keeps PRO for 3-day grace period.
 *
 * @param invoice - Stripe Invoice object
 */
export async function handleInvoiceFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;

  if (!customerId) {
    console.error('[Webhook] No customer ID in invoice');
    return;
  }

  try {
    // Find subscription by Stripe customer ID
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription) {
      console.error(
        '[Webhook] Subscription not found for customer:',
        customerId
      );
      return;
    }

    // Get failure reason
    const failureReason =
      invoice.last_finalization_error?.message || 'Payment method declined';

    // Send payment failed email
    const failedUser = await getUserContact(dbSubscription.userId);
    if (failedUser?.email) {
      await sendPaymentFailedEmail(
        failedUser.email,
        failedUser.name || 'User',
        failureReason
      );
    }

    // Update subscription status to PAST_DUE
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: { status: 'PAST_DUE' },
    });

    // Note: We don't immediately downgrade - Stripe will handle retries
    // and eventually send customer.subscription.deleted if all retries fail

    console.log(
      `[Webhook] Payment failed for user ${dbSubscription.userId}: ${failureReason}`
    );
  } catch (error) {
    console.error('[Webhook] Error handling invoice failed:', error);
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVOICE PAYMENT SUCCEEDED
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle invoice.payment_succeeded event
 *
 * Called when monthly payment is successful.
 * Updates billing date and sends receipt email.
 *
 * @param invoice - Stripe Invoice object
 */
export async function handleInvoiceSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId = invoice.customer as string;

  if (!customerId) {
    console.error('[Webhook] No customer ID in invoice');
    return;
  }

  // Skip if this is a $0 invoice (trial period)
  if ((invoice.amount_paid || 0) === 0) {
    console.log('[Webhook] Skipping $0 invoice (trial period)');
    return;
  }

  try {
    // Find subscription by Stripe customer ID
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription) {
      console.error(
        '[Webhook] Subscription not found for customer:',
        customerId
      );
      return;
    }

    // Determine billing period based on amount paid
    // $29 (2900 cents) = monthly, $290 (29000 cents) = yearly
    const amountPaid = invoice.amount_paid || 0;
    const isYearly = amountPaid >= 28000; // Allow some flexibility for rounding
    const billingPeriod = isYearly ? 'yearly' : 'monthly';

    // Calculate next billing date based on billing period
    const nextBillingDate = new Date();
    if (isYearly) {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setDate(nextBillingDate.getDate() + 30);
    }

    // Update subscription with new billing period
    await prisma.subscription.update({
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

    // Ensure user is PRO (in case they were past_due)
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: { tier: 'PRO' },
    });

    // Credit the referring affiliate's commission now that real money has
    // actually been collected -- deferred from checkout.session.completed
    // (davintrade-vat-stack follow-up fix) because the 7-day trial means no
    // charge happens there yet; crediting it that early paid affiliates on
    // signups that later failed to pay or were cancelled during the trial.
    if (dbSubscription.affiliateCodeId) {
      await processAffiliateCommission(
        dbSubscription.id,
        dbSubscription.affiliateCodeId,
        dbSubscription.userId,
        dbSubscription.stripeSubscriptionId,
        amountPaid / 100
      );
    }

    // Persist the tax breakdown for OSS filing / threshold monitoring
    // (davintrade-vat-stack, Nuance 1: invoice_pdf/hosted_invoice_url and
    // the finalized tax_rate only exist on this event, never on
    // checkout.session.completed). Upserted on stripeInvoiceId so Stripe's
    // at-least-once webhook delivery stays idempotent.
    const taxRecord = extractInvoiceTaxRecord(invoice);
    await prisma.invoice.upsert({
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

    // Send payment receipt email
    const receiptUser = await getUserContact(dbSubscription.userId);
    if (receiptUser?.email) {
      await sendPaymentReceiptEmail(
        receiptUser.email,
        receiptUser.name || 'User',
        amountPaid / 100, // Convert cents to dollars
        nextBillingDate,
        invoice.invoice_pdf || undefined
      );
    }

    console.log(
      `[Webhook] Payment succeeded for user ${dbSubscription.userId}, amount: $${amountPaid / 100} (${billingPeriod})`
    );
  } catch (error) {
    console.error('[Webhook] Error handling invoice succeeded:', error);
    throw error;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHARGE REFUNDED / DISPUTED (affiliate commission clawback)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle charge.refunded event
 *
 * Cancels the affiliate commission tied to this customer's subscription
 * if it hasn't been paid out yet. Completes the commission-hold design
 * (davintrade-vat-stack follow-up): the hold window
 * (SystemConfig.affiliate_commission_approval_days) only delays payout --
 * this is what actually acts on a refund arriving during that window,
 * instead of letting a refunded sale's commission auto-approve regardless.
 *
 * @param charge - Stripe Charge object (refunded, full or partial)
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge
): Promise<void> {
  const customerId =
    typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  await cancelCommissionForRefundOrDispute(customerId ?? null, 'refund');
}

/**
 * Handle charge.dispute.created event
 *
 * Same clawback as handleChargeRefunded, but for a cardholder dispute
 * (chargeback) rather than a merchant-initiated refund. The dispute
 * payload only carries the charge id, not the customer, so the charge is
 * fetched to resolve it.
 *
 * @param dispute - Stripe Dispute object
 */
export async function handleChargeDisputeCreated(
  dispute: Stripe.Dispute
): Promise<void> {
  try {
    const chargeId =
      typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
    const charge = await getStripeClient().charges.retrieve(chargeId);
    const customerId =
      typeof charge.customer === 'string'
        ? charge.customer
        : charge.customer?.id;
    await cancelCommissionForRefundOrDispute(customerId ?? null, 'dispute');
  } catch (error) {
    console.error('[Webhook] Error resolving disputed charge:', error);
  }
}

/**
 * Shared clawback logic for both events above.
 *
 * - PENDING or APPROVED (not yet disbursed): cancelled, and both the
 *   affiliate's pendingCommissions and totalEarnings are reversed --
 *   symmetric with how they were incremented when the commission was
 *   created.
 * - Already PAID: cannot be silently reversed (the money already left for
 *   the affiliate) -- logged prominently for manual recovery instead of
 *   attempted automatically.
 * - Already CANCELLED, or no commission at all for this customer: no-op
 *   (idempotent against webhook redelivery, and the common case of a
 *   refund with no affiliate code involved at all).
 */
async function cancelCommissionForRefundOrDispute(
  customerId: string | null,
  reason: 'refund' | 'dispute'
): Promise<void> {
  if (!customerId) {
    console.error(`[Webhook] No customer ID on ${reason} event`);
    return;
  }

  try {
    const dbSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!dbSubscription?.stripeSubscriptionId) {
      console.log(
        `[Webhook] No subscription found for ${reason} event customer:`,
        customerId
      );
      return;
    }

    const commission = await prisma.commission.findFirst({
      where: { subscriptionId: dbSubscription.stripeSubscriptionId },
    });

    if (!commission) {
      // The common case: most refunds/disputes involve no affiliate code at all.
      return;
    }

    if (commission.status === 'CANCELLED') {
      return;
    }

    if (commission.status === 'PAID') {
      console.error(
        `[Webhook] ALERT: commission already PAID but underlying charge was ${reason} -- manual recovery needed`,
        {
          commissionId: commission.id,
          affiliateProfileId: commission.affiliateProfileId,
          amount: Number(commission.commissionAmount),
        }
      );
      return;
    }

    // PENDING or APPROVED -- cancel before it's ever (or further) disbursed.
    await prisma.commission.update({
      where: { id: commission.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await prisma.affiliateProfile.update({
      where: { id: commission.affiliateProfileId },
      data: {
        totalCodesUsed: { decrement: 1 },
        totalEarnings: { decrement: Number(commission.commissionAmount) },
        pendingCommissions: { decrement: Number(commission.commissionAmount) },
      },
    });

    console.log(`[Webhook] Commission cancelled due to ${reason}:`, {
      commissionId: commission.id,
      amount: Number(commission.commissionAmount),
    });
  } catch (error) {
    console.error(
      `[Webhook] Error cancelling commission for ${reason}:`,
      error
    );
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract the multi-jurisdiction tax breakdown from a finalized Stripe
 * invoice (davintrade-vat-stack, Section 4.1 "Nuance 1"). Pure/no I/O so
 * both the upsert `update` and `create` branches in handleInvoiceSucceeded
 * can share one source of truth for the field values.
 *
 * `reverseCharge` is a derived reporting flag (true when 0% tax was
 * applied to a customer with a validated VAT/tax ID on file) -- it does
 * not itself alter the Stripe-rendered invoice PDF, which is annotated via
 * the Stripe Dashboard invoice template memo (Section 6.2), not this code.
 */
function extractInvoiceTaxRecord(invoice: Stripe.Invoice): {
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

/**
 * Map Stripe subscription status to our SubscriptionStatus enum
 *
 * @param stripeStatus - Stripe subscription status string
 * @returns SubscriptionStatus enum value
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'ACTIVE' | 'INACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' {
  const statusMap: Record<
    Stripe.Subscription.Status,
    'ACTIVE' | 'INACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING'
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AFFILIATE COMMISSION PROCESSING
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Reserve an affiliate code at checkout time (davintrade commission-timing
 * fix). Validates the code, then marks it USED so the SAME code can never
 * be redeemed twice -- this is a reservation, not a payout: no Commission
 * is created here. That's deliberate: at checkout.session.completed, a
 * 7-day trial means no money has actually been charged yet, so paying the
 * affiliate here would credit them before knowing whether the signup ever
 * converts. See processAffiliateCommission, called from
 * handleInvoiceSucceeded once the first real charge actually succeeds.
 *
 * @param code - Affiliate code string
 * @param userId - User who is redeeming the code
 * @param subscriptionId - Stripe subscription id created by this checkout
 * @returns The reserved AffiliateCode row, or null if not reservable
 */
async function reserveAffiliateCode(
  code: string,
  userId: string,
  subscriptionId: string
): Promise<{ id: string } | null> {
  try {
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!affiliateCode) {
      console.error('[Webhook] Affiliate code not found:', code);
      return null;
    }

    if (affiliateCode.status !== 'ACTIVE') {
      console.log(
        `[Webhook] Affiliate code ${code} is not active, skipping attribution`
      );
      return null;
    }

    await prisma.affiliateCode.update({
      where: { id: affiliateCode.id },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedBy: userId,
        subscriptionId,
      },
    });

    return { id: affiliateCode.id };
  } catch (error) {
    // Log but don't throw - we don't want to fail the checkout for affiliate issues
    console.error('[Webhook] Error reserving affiliate code:', error);
    return null;
  }
}

/**
 * Credit the referring affiliate's commission for a code reserved earlier
 * at checkout (davintrade commission-timing fix). Called from
 * handleInvoiceSucceeded, only once real money has actually been
 * collected -- never from checkout completion, and never for a later
 * renewal (idempotent: clears Subscription.affiliateCodeId on success, and
 * a defensive existing-Commission check covers webhook redelivery too).
 *
 * @param dbSubscriptionId - DB Subscription row id (to clear affiliateCodeId)
 * @param affiliateCodeId - The AffiliateCode reserved at checkout
 * @param userId - User who made the purchase
 * @param subscriptionId - Stripe subscription id (nullable to match the
 *   Subscription model's own stripeSubscriptionId type)
 * @param grossRevenueUsd - Actual amount collected on this invoice, in USD
 */
async function processAffiliateCommission(
  dbSubscriptionId: string,
  affiliateCodeId: string,
  userId: string,
  subscriptionId: string | null,
  grossRevenueUsd: number
): Promise<void> {
  try {
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { id: affiliateCodeId },
    });

    if (!affiliateCode) {
      console.error(
        '[Webhook] Reserved affiliate code no longer exists:',
        affiliateCodeId
      );
      return;
    }

    // Idempotency guard: a redelivered invoice.payment_succeeded (Stripe is
    // at-least-once) must never pay the same code's commission twice.
    const alreadyCredited = await prisma.commission.findFirst({
      where: { affiliateCodeId: affiliateCode.id },
    });
    if (alreadyCredited) {
      console.log(
        '[Webhook] Commission already credited for this code, skipping duplicate:',
        affiliateCode.code
      );
      return;
    }

    const breakdown = calculateFullBreakdown(
      grossRevenueUsd,
      affiliateCode.discountPercent,
      affiliateCode.commissionPercent
    );

    // Create commission record
    await prisma.commission.create({
      data: {
        affiliateProfileId: affiliateCode.affiliateProfileId,
        affiliateCodeId: affiliateCode.id,
        userId,
        subscriptionId,
        grossRevenue: breakdown.grossRevenue,
        discountAmount: breakdown.discountAmount,
        netRevenue: breakdown.netRevenue,
        commissionAmount: breakdown.commissionAmount,
        status: 'PENDING',
        earnedAt: new Date(),
      },
    });

    // Clear the pending attribution now that it has been realized as an
    // actual commission -- prevents a later renewal from re-triggering
    // this same code's payout.
    await prisma.subscription.update({
      where: { id: dbSubscriptionId },
      data: { affiliateCodeId: null },
    });

    // Update affiliate profile stats
    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: affiliateCode.affiliateProfileId },
      data: {
        totalCodesUsed: { increment: 1 },
        totalEarnings: { increment: breakdown.commissionAmount },
        pendingCommissions: { increment: breakdown.commissionAmount },
      },
    });

    console.log(
      `[Webhook] Affiliate commission created: $${breakdown.commissionAmount} for code ${affiliateCode.code}`
    );

    // Send commission notification email to affiliate
    const affiliateUser = await getUserContact(updatedProfile.userId);
    if (affiliateUser?.email) {
      await sendAffiliateCommissionEmail(
        affiliateUser.email,
        affiliateUser.name || 'Affiliate',
        affiliateCode.code,
        breakdown.commissionAmount,
        Number(updatedProfile.totalEarnings)
      );
    }
  } catch (error) {
    // Log but don't throw - we don't want to fail invoice processing for
    // affiliate issues (the subscription/tax/receipt work above already
    // succeeded and must not be rolled back over this).
    console.error('[Webhook] Error processing affiliate commission:', error);
  }
}
