/**
 * Stripe Webhook Controller (Session 4A-9, File 4/10)
 *
 * Ports app/api/webhooks/stripe/route.ts. Route path is `/v1/webhooks/stripe`
 * (main.ts's global `/v1` prefix, F16) -- not wired to Stripe's dashboard
 * yet, no live traffic until Session 4A-10 flips the flag.
 *
 * Throttle override mirrors the standing policy established for all
 * payment-provider webhooks (4A-W4 Defect 2, applied here to Stripe too):
 * an explicit route-level ceiling instead of the bare global default, so a
 * legitimate Stripe retry burst can't get 429'd and read as a permanent
 * delivery failure.
 *
 * Remediation Tier 2 §6.1: each handled event is claimed in
 * `ProcessedWebhookEvent` before its handler runs, so a redelivery -- or the
 * same event arriving at the monolith's endpoint too (4A-13 dual delivery) --
 * does not repeat the handler's side effects. See ProcessedWebhookEventService
 * for the claim / complete / release protocol and its fail-open rule.
 */

import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

import { logger } from '../common/logger.util';
import { ProcessedWebhookEventService } from '../webhooks/processed-webhook-event.service';

import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

const PROVIDER = 'stripe';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: StripeWebhookService,
    private readonly eventClaims: ProcessedWebhookEventService
  ) {}

  /** The handler for an event type, or null when this service ignores it. */
  private resolveHandler(event: Stripe.Event): (() => Promise<void>) | null {
    switch (event.type) {
      case 'checkout.session.completed':
        return () =>
          this.webhookService.handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
      case 'customer.subscription.updated':
        return () =>
          this.webhookService.handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
      case 'customer.subscription.deleted':
        return () =>
          this.webhookService.handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
      case 'invoice.payment_failed':
        return () =>
          this.webhookService.handleInvoiceFailed(
            event.data.object as Stripe.Invoice
          );
      case 'invoice.payment_succeeded':
        return () =>
          this.webhookService.handleInvoiceSucceeded(
            event.data.object as Stripe.Invoice
          );
      case 'charge.refunded':
        return () =>
          this.webhookService.handleChargeRefunded(
            event.data.object as Stripe.Charge
          );
      case 'charge.dispute.created':
        return () =>
          this.webhookService.handleChargeDisputeCreated(
            event.data.object as Stripe.Dispute
          );
      default:
        return null;
    }
  }

  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @Post()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response
  ): Promise<void> {
    try {
      const payload = request.rawBody ?? Buffer.from('');
      const signature = request.headers['stripe-signature'] as
        | string
        | undefined;

      if (!signature) {
        logger.error('[Webhook] Missing stripe-signature header');
        response.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      let event: Stripe.Event;
      try {
        event = this.stripeService.constructEvent(payload, signature);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        logger.error('[Webhook] Signature verification failed', {
          errorMessage,
        });
        response.status(400).json({
          error: `Webhook signature verification failed: ${errorMessage}`,
        });
        return;
      }

      logger.info('[Webhook] Received event', { type: event.type });

      const handle = this.resolveHandler(event);
      if (!handle) {
        logger.info('[Webhook] Unhandled event type', { type: event.type });
        response.status(200).json({ received: true });
        return;
      }

      const claim = await this.eventClaims.claim(PROVIDER, event.id);
      if (claim === 'duplicate') {
        logger.info('[Webhook] Duplicate event skipped', {
          type: event.type,
          eventId: event.id,
        });
        response.status(200).json({ received: true, duplicate: true });
        return;
      }
      // 'unavailable' means the claim table could not be used: the handler
      // still runs (the commission indexes are the money guard), and there is
      // nothing to complete or release.
      const claimed = claim === 'claimed';

      try {
        await handle();
        if (claimed) await this.eventClaims.complete(PROVIDER, event.id);

        response.status(200).json({ received: true });
      } catch (handlerError) {
        if (claimed) await this.eventClaims.release(PROVIDER, event.id);

        logger.error('[Webhook] Handler error', {
          type: event.type,
          error:
            handlerError instanceof Error
              ? handlerError.message
              : 'Unknown error',
        });

        // Critical = answer 5xx so Stripe retries. Remediation Tier 2 §6.4
        // (4A-13 audit item c): invoice.payment_succeeded is critical too. It
        // answered 200 on a failure, so a renewal that failed to write (the
        // subscription period, the PRO tier, the tax record, the receipt) was
        // never retried. Safe to retry: the renewal's main write is one
        // transaction (nothing partial is left behind), the claim above is
        // released, and the commission credit is idempotent per invoice.
        const isCritical =
          event.type === 'checkout.session.completed' ||
          event.type === 'customer.subscription.deleted' ||
          event.type === 'invoice.payment_succeeded';

        if (isCritical) {
          response.status(500).json({ error: 'Webhook handler failed' });
          return;
        }

        response.status(200).json({ received: true, warning: 'Handler error' });
      }
    } catch (error) {
      logger.error('[Webhook] Unexpected error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      response.status(500).json({ error: 'Unexpected webhook error' });
    }
  }
}
