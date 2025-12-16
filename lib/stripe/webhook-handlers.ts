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
} from '@/lib/email/subscription-emails';

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

    // Calculate next billing date (30 days from now for trial, or from current period end)
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    // Create or update subscription record
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'ACTIVE',
        amountUsd: 29,
        stripeCurrentPeriodEnd: nextBillingDate,
        expiresAt: nextBillingDate,
      },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'ACTIVE',
        amountUsd: 29,
        planType: 'MONTHLY',
        stripeCurrentPeriodEnd: nextBillingDate,
        expiresAt: nextBillingDate,
      },
    });

    // Send upgrade confirmation email
    if (user.email) {
      await sendUpgradeEmail(user.email, user.name || 'User', nextBillingDate);
    }

    console.log(`[Webhook] User ${userId} upgraded to PRO`);
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

    // Send cancellation email
    if (dbSubscription.user.email) {
      await sendCancellationEmail(
        dbSubscription.user.email,
        dbSubscription.user.name || 'User'
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
    if (dbSubscription.user.email) {
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

    // Calculate next billing date
    const nextBillingDate = new Date();
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    // Update subscription with new billing period
    await prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        status: 'ACTIVE',
        stripeCurrentPeriodEnd: nextBillingDate,
        expiresAt: nextBillingDate,
        renewalReminderSent: false,
      },
    });

    // Ensure user is PRO (in case they were past_due)
    await prisma.user.update({
      where: { id: dbSubscription.userId },
      data: { tier: 'PRO' },
    });

    // Send payment receipt email
    if (dbSubscription.user.email) {
      await sendPaymentReceiptEmail(
        dbSubscription.user.email,
        dbSubscription.user.name || 'User',
        (invoice.amount_paid || 0) / 100, // Convert cents to dollars
        nextBillingDate,
        invoice.invoice_pdf || undefined
      );
    }

    console.log(
      `[Webhook] Payment succeeded for user ${dbSubscription.userId}, amount: $${(invoice.amount_paid || 0) / 100}`
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
