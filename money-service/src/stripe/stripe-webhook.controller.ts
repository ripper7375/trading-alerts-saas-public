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
 */

import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';

import { logger } from '../common/logger.util';

import { StripeService } from './stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookService: StripeWebhookService
  ) {}

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

      try {
        switch (event.type) {
          case 'checkout.session.completed':
            await this.webhookService.handleCheckoutCompleted(
              event.data.object as Stripe.Checkout.Session
            );
            break;

          case 'customer.subscription.updated':
            await this.webhookService.handleSubscriptionUpdated(
              event.data.object as Stripe.Subscription
            );
            break;

          case 'customer.subscription.deleted':
            await this.webhookService.handleSubscriptionDeleted(
              event.data.object as Stripe.Subscription
            );
            break;

          case 'invoice.payment_failed':
            await this.webhookService.handleInvoiceFailed(
              event.data.object as Stripe.Invoice
            );
            break;

          case 'invoice.payment_succeeded':
            await this.webhookService.handleInvoiceSucceeded(
              event.data.object as Stripe.Invoice
            );
            break;

          case 'charge.refunded':
            await this.webhookService.handleChargeRefunded(
              event.data.object as Stripe.Charge
            );
            break;

          case 'charge.dispute.created':
            await this.webhookService.handleChargeDisputeCreated(
              event.data.object as Stripe.Dispute
            );
            break;

          default:
            logger.info('[Webhook] Unhandled event type', {
              type: event.type,
            });
        }

        response.status(200).json({ received: true });
      } catch (handlerError) {
        logger.error('[Webhook] Handler error', {
          type: event.type,
          error:
            handlerError instanceof Error
              ? handlerError.message
              : 'Unknown error',
        });

        const isCritical =
          event.type === 'checkout.session.completed' ||
          event.type === 'customer.subscription.deleted';

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
