/**
 * Stripe Module (Session 4A-9, File 10/10)
 *
 * Wires the Stripe checkout/subscription/webhook controllers together with
 * every service they (directly or transitively) depend on. `PrismaService`
 * isn't listed — `PrismaModule` is `@Global()`. Follows this repo's
 * established convention of each module independently providing what it
 * needs (see `DlocalModule`/`AdminModule`/`CronsModule`, all of which
 * re-declare `ConversionProcessorService`/`AffiliateConfigService` rather
 * than sharing one exported instance).
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { OutboxService } from '../outbox/outbox.service';

import { StripeCheckoutController } from './stripe-checkout.controller';
import { StripeSubscriptionController } from './stripe-subscription.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';

@Module({
  controllers: [
    StripeCheckoutController,
    StripeSubscriptionController,
    StripeWebhookController,
  ],
  providers: [
    StripeService,
    StripeWebhookService,
    ConversionProcessorService,
    AffiliateConfigService,
    OutboxService,
    IdempotencyInterceptor,
    IdempotencyStore,
  ],
})
export class StripeModule {}
