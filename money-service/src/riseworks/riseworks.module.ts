/**
 * RiseWorks Module (Session 4A-4, File 3/4)
 *
 * Wires the RiseWorks webhook controller together with every service it
 * (directly or transitively) depends on. `PrismaService` isn't listed here
 * — `PrismaModule` is `@Global()`, already available app-wide (same
 * convention as `CronsModule`/`DlocalModule`).
 */

import { Module } from '@nestjs/common';

import { TransactionLoggerService } from '../disbursement/transaction-logger.service';
import { WebhookEventProcessorService } from '../disbursement/webhook-event-processor.service';

import { RiseworksWebhookController } from './riseworks-webhook.controller';

@Module({
  controllers: [RiseworksWebhookController],
  providers: [TransactionLoggerService, WebhookEventProcessorService],
})
export class RiseworksModule {}
