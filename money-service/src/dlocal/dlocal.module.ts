/**
 * dLocal Module (Session 4A-4, File 2/4)
 *
 * Wires the dLocal webhook controller together with every service it
 * (directly or transitively) depends on. `PrismaService` isn't listed here
 * — `PrismaModule` is `@Global()`, already available app-wide (same
 * convention as `CronsModule`).
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { OutboxService } from '../outbox/outbox.service';

import { DlocalWebhookController } from './dlocal-webhook.controller';
import { ThreeDayValidatorService } from './three-day-validator.service';

@Module({
  controllers: [DlocalWebhookController],
  providers: [
    ThreeDayValidatorService,
    ConversionProcessorService,
    AffiliateConfigService,
    OutboxService,
  ],
})
export class DlocalModule {}
