/**
 * Stripe Webhook API Route
 *
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription lifecycle.
 *
 * @module app/api/webhooks/stripe/route
 */

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

import { constructWebhookEvent } from '@/lib/stripe/stripe';
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoiceFailed,
  handleInvoiceSucceeded,
  handleChargeRefunded,
  handleChargeDisputeCreated,
} from '@/lib/stripe/webhook-handlers';
import {
  claimEvent,
  completeEvent,
  releaseEvent,
} from '@/lib/webhooks/processed-event';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disable body parsing - we need raw body for signature verification
 */
export const dynamic = 'force-dynamic';

const PROVIDER = 'stripe';

/** The handler for an event type, or null when this app ignores it. */
function resolveHandler(event: Stripe.Event): (() => Promise<void>) | null {
  switch (event.type) {
    case 'checkout.session.completed':
      return () =>
        handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    case 'customer.subscription.updated':
      return () =>
        handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
    case 'customer.subscription.deleted':
      return () =>
        handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
    case 'invoice.payment_failed':
      return () => handleInvoiceFailed(event.data.object as Stripe.Invoice);
    case 'invoice.payment_succeeded':
      return () => handleInvoiceSucceeded(event.data.object as Stripe.Invoice);
    case 'charge.refunded':
      return () => handleChargeRefunded(event.data.object as Stripe.Charge);
    case 'charge.dispute.created':
      return () =>
        handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
    default:
      return null;
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/webhooks/stripe
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle Stripe webhook events
 *
 * Verifies webhook signature and routes to appropriate handler
 * based on event type.
 *
 * Supported events:
 * - checkout.session.completed
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_failed
 * - invoice.payment_succeeded
 *
 * @param request - Next.js request object
 * @returns 200 OK on success, 400 on signature error, 500 on handler error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Get Stripe signature from headers
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature and construct event
    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Webhook] Signature verification failed:', errorMessage);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${errorMessage}` },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    // Route to appropriate handler based on event type
    const handle = resolveHandler(event);
    if (!handle) {
      // Log unhandled events but don't fail
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
      return NextResponse.json({ received: true });
    }

    // Remediation Tier 2 §6.1: claim the event before its handler runs, so a
    // redelivery -- or the same event arriving at money-service's endpoint too
    // (4A-13 dual delivery) -- does not repeat the handler's side effects.
    const claim = await claimEvent(PROVIDER, event.id);
    if (claim === 'duplicate') {
      console.log(
        `[Webhook] Duplicate event skipped: ${event.type} ${event.id}`
      );
      return NextResponse.json({ received: true, duplicate: true });
    }
    // 'unavailable': the claim table could not be used, so the handler still
    // runs (the Commission unique indexes are the money guard) and there is
    // nothing to complete or release.
    const claimed = claim === 'claimed';

    try {
      await handle();
      if (claimed) await completeEvent(PROVIDER, event.id);

      // Return 200 OK to acknowledge receipt
      return NextResponse.json({ received: true });
    } catch (handlerError) {
      // Free the claim first so Stripe's retry (or the other endpoint) runs it.
      if (claimed) await releaseEvent(PROVIDER, event.id);

      // Log handler error but still return 200 to prevent retries
      // for errors we can't recover from
      console.error(`[Webhook] Handler error for ${event.type}:`, handlerError);

      // For critical errors, return 500 to trigger Stripe retry
      // For non-critical, return 200 to prevent infinite retries
      const isCritical =
        event.type === 'checkout.session.completed' ||
        event.type === 'customer.subscription.deleted';

      if (isCritical) {
        return NextResponse.json(
          { error: 'Webhook handler failed' },
          { status: 500 }
        );
      }

      // Non-critical - acknowledge receipt to prevent retries
      return NextResponse.json({ received: true, warning: 'Handler error' });
    }
  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected webhook error' },
      { status: 500 }
    );
  }
}
