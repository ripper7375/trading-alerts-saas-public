/**
 * dLocal Module (Session 4A-4, File 2/4; extended Session 4A-9, File 10/10)
 *
 * Wires the dLocal webhook controller together with every service it
 * (directly or transitively) depends on. `PrismaService` isn't listed here
 * — `PrismaModule` is `@Global()`, already available app-wide (same
 * convention as `CronsModule`).
 *
 * 4A-9 adds `DlocalPaymentController` (payment creation, File 6/10) and
 * `IdempotencyInterceptor`/`IdempotencyStore` for its
 * `@UseInterceptors(IdempotencyInterceptor)` route.
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { OutboxService } from '../outbox/outbox.service';

import { DlocalPaymentController } from './dlocal-payment.controller';
import { DlocalWebhookController } from './dlocal-webhook.controller';
import { ThreeDayValidatorService } from './three-day-validator.service';

@Module({
  controllers: [DlocalWebhookController, DlocalPaymentController],
  providers: [
    ThreeDayValidatorService,
    ConversionProcessorService,
    AffiliateConfigService,
    OutboxService,
    IdempotencyInterceptor,
    IdempotencyStore,
  ],
})
export class DlocalModule {}
