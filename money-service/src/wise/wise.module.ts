/**
 * Wise Module (Session 4A-W3a, File 8/10; extended 4A-W5, File 6/8)
 *
 * Wires the recipient controller together with every service it (directly
 * or transitively) depends on. `PrismaService` isn't listed here —
 * `PrismaModule` is `@Global()`, already available app-wide (same
 * convention as `DlocalModule`/`AffiliateModule`). `JwtAuthGuard`/
 * `AffiliateGuard`/`AdminGuard` aren't listed either — none has
 * constructor dependencies, so `@UseGuards()` instantiates them directly
 * (same convention as `AffiliateModule`).
 *
 * Unique base path (`/v1/wise/recipients*`, F16), not referenced by any
 * frontend surface yet (4A-W3b builds that next) — no live traffic risk
 * from registering this module.
 *
 * 4A-W5 additions: registers `money:wise-webhook` — money-service's FIRST
 * BullMQ queue (`BullModule.forRoot` with the `MONEY_QUEUE_PREFIX` has
 * existed since 4A-1, `app.module.ts` — no root config change needed here,
 * design §8) — plus the webhook receiver controller and every service it
 * depends on transitively. `WiseSignatureVerifier` (built 4A-W3a) is now
 * consumed for the first time.
 */

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { WiseWebhookController } from './controllers/wise-webhook.controller';
import { WISE_WEBHOOK_QUEUE } from './queue/wise-webhook.processor';
import { WiseWebhookProcessor } from './queue/wise-webhook.processor';
import { WiseApiClient } from './wise-api.client';
import { WiseConfig } from './wise.config';
import { WiseEventHandlers } from './services/wise-event-handlers';
import { WiseRecipientService } from './wise-recipient.service';
import { WiseRecipientsController } from './wise-recipients.controller';
import { WiseSignatureVerifier } from './wise-signature.verifier';
import { WiseStateMapper } from './services/wise-state.mapper';
import { WiseTransferStateReducer } from './services/wise-transfer-state.reducer';

@Module({
  imports: [BullModule.registerQueue({ name: WISE_WEBHOOK_QUEUE })],
  controllers: [WiseRecipientsController, WiseWebhookController],
  providers: [
    WiseConfig,
    WiseApiClient,
    WiseRecipientService,
    WiseSignatureVerifier,
    WiseStateMapper,
    WiseTransferStateReducer,
    WiseEventHandlers,
    WiseWebhookProcessor,
  ],
})
export class WiseModule {}
