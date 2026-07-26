/**
 * Wise Module (Session 4A-W3a, File 8/10)
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
 */

import { Module } from '@nestjs/common';

import { WiseApiClient } from './wise-api.client';
import { WiseConfig } from './wise.config';
import { WiseRecipientService } from './wise-recipient.service';
import { WiseRecipientsController } from './wise-recipients.controller';

// WiseSignatureVerifier (File 6/10) isn't consumed by anything registered
// here — it's built for 4A-W5's webhook receiver, which will provide it in
// its own module scope (same convention as AdminModule/AffiliateModule
// each re-declaring what they need rather than sharing one instance).
@Module({
  controllers: [WiseRecipientsController],
  providers: [WiseConfig, WiseApiClient, WiseRecipientService],
})
export class WiseModule {}
