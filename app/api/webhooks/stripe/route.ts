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
} from '@/lib/stripe/webhook-handlers';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disable body parsing - we need raw body for signature verification
 */
export const dynamic = 'force-dynamic';

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
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
          break;

        case 'invoice.payment_failed':
          await handleInvoiceFailed(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_succeeded':
          await handleInvoiceSucceeded(event.data.object as Stripe.Invoice);
          break;

        default:
          // Log unhandled events but don't fail
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      // Return 200 OK to acknowledge receipt
      return NextResponse.json({ received: true });
    } catch (handlerError) {
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
