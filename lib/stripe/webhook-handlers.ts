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
import {
  sendUpgradeEmail,
  sendCancellationEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendSubscriptionCanceledEmail,
  sendAffiliateCommissionEmail,
} from '@/lib/email/subscription-emails';
import { sendSubscriptionConfirmationEmail } from '@/lib/email/email';
import { calculateFullBreakdown } from '@/lib/affiliate/commission-calculator';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

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

    // Send subscription confirmation email with correct tier features
    if (user.email) {
      await sendSubscriptionConfirmationEmail(
        user.email,
        user.name || 'User',
        'PRO',
        billingPeriod
      );
    }

    // Handle affiliate code commission if present
    const affiliateCode = session.metadata?.['affiliateCode'];
    if (affiliateCode) {
      await processAffiliateCommission(affiliateCode, userId, subscriptionId);
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
      include: { user: true },
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
      include: { user: true },
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
    if (dbSubscription.user?.email) {
      await sendSubscriptionCanceledEmail(
        dbSubscription.user.email,
        dbSubscription.user.name || 'User',
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
      include: { user: true },
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
    if (dbSubscription.user?.email) {
      await sendPaymentFailedEmail(
        dbSubscription.user.email,
        dbSubscription.user.name || 'User',
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
      include: { user: true },
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

    // Send payment receipt email
    if (dbSubscription.user?.email) {
      await sendPaymentReceiptEmail(
        dbSubscription.user.email,
        dbSubscription.user.name || 'User',
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
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
 * Process affiliate commission for a completed checkout
 *
 * - Validates affiliate code
 * - Marks code as used
 * - Creates commission record
 * - Updates affiliate balances
 *
 * @param code - Affiliate code string
 * @param userId - User who made the purchase
 * @param subscriptionId - Subscription created from purchase
 */
async function processAffiliateCommission(
  code: string,
  userId: string,
  subscriptionId: string
): Promise<void> {
  try {
    // Find the affiliate code
    const affiliateCode = await prisma.affiliateCode.findUnique({
      where: { code },
      include: { affiliateProfile: true },
    });

    if (!affiliateCode) {
      console.error('[Webhook] Affiliate code not found:', code);
      return;
    }

    // Skip if code is not active
    if (affiliateCode.status !== 'ACTIVE') {
      console.log(
        `[Webhook] Affiliate code ${code} is not active, skipping commission`
      );
      return;
    }

    // Calculate commission using percentage-based model
    const breakdown = calculateFullBreakdown(
      AFFILIATE_CONFIG.BASE_PRICE_USD,
      affiliateCode.discountPercent,
      affiliateCode.commissionPercent
    );

    // Mark code as used
    await prisma.affiliateCode.update({
      where: { id: affiliateCode.id },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedBy: userId,
        subscriptionId,
      },
    });

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

    // Update affiliate profile stats
    const updatedProfile = await prisma.affiliateProfile.update({
      where: { id: affiliateCode.affiliateProfileId },
      data: {
        totalCodesUsed: { increment: 1 },
        totalEarnings: { increment: breakdown.commissionAmount },
        pendingCommissions: { increment: breakdown.commissionAmount },
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    console.log(
      `[Webhook] Affiliate commission created: $${breakdown.commissionAmount} for code ${code}`
    );

    // Send commission notification email to affiliate
    if (updatedProfile.user?.email) {
      await sendAffiliateCommissionEmail(
        updatedProfile.user.email,
        updatedProfile.user.name || 'Affiliate',
        code,
        breakdown.commissionAmount,
        updatedProfile.totalEarnings
      );
    }
  } catch (error) {
    // Log but don't throw - we don't want to fail the checkout for affiliate issues
    console.error('[Webhook] Error processing affiliate commission:', error);
  }
}
