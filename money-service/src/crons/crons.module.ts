/**
 * Crons Module (Session 4A-2, File 4/6)
 *
 * Wires the cron scheduler together with every service it (directly or
 * transitively) depends on from Files 2/6 and 3/6. `PrismaService` isn't
 * listed here — `PrismaModule` is `@Global()` (see prisma.module.ts), so
 * it's already available app-wide. `ScheduleModule.forRoot()` itself is
 * registered once in `AppModule`, not here, per Nest's own convention for
 * a whole-app-scoped scheduling registry.
 */

import { Module } from '@nestjs/common';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { CodeGeneratorService } from '../affiliate/code-generator.service';
import { BatchManagerService } from '../disbursement/batch-manager.service';
import { CommissionAggregatorService } from '../disbursement/commission-aggregator.service';
import { DisbursementProcessorService } from '../disbursement/disbursement-processor.service';
import { PaymentOrchestratorService } from '../disbursement/payment-orchestrator.service';
import { RetryHandlerService } from '../disbursement/retry-handler.service';
import { TransactionLoggerService } from '../disbursement/transaction-logger.service';
import { TransactionService } from '../disbursement/transaction.service';
import { OutboxService } from '../outbox/outbox.service';

import { WiseStateMapper } from '../wise/services/wise-state.mapper';
import { WiseTransferStateReducer } from '../wise/services/wise-transfer-state.reducer';
import { WiseApiClient } from '../wise/wise-api.client';
import { WiseConfig } from '../wise/wise.config';
import { WiseModule } from '../wise/wise.module';

import { AffiliateCronService } from './affiliate.service';
import { CronSecretGuard } from './cron-secret.guard';
import { CronTriggerController } from './cron-trigger.controller';
import { CronsScheduler } from './crons.scheduler';
import { SubscriptionCronService } from './subscription.service';
import { WiseReconciliationService } from './wise-reconciliation.service';

@Module({
  // Session 4A-W7: WiseModule already exports a fully DI-constructed
  // WisePaymentProvider (its 8 collaborators resolved by Nest, not
  // hand-wired) -- imported here rather than duplicating that whole
  // subtree the way WiseConfig/WiseApiClient/etc. are duplicated below,
  // since NestJS de-dupes a shared module import across the app (WiseModule
  // is already imported once in AppModule; this doesn't re-register its
  // BullMQ queue).
  imports: [WiseModule],
  controllers: [CronTriggerController],
  providers: [
    // File 2/6
    AffiliateConfigService,
    CodeGeneratorService,
    SubscriptionCronService,
    AffiliateCronService,
    // Session 4A-8, Step 2 (F14) -- SubscriptionCronService's downgrade
    // path now writes an OutboxEvent atomically with the tier change.
    OutboxService,
    // File 3/6
    TransactionLoggerService,
    TransactionService,
    RetryHandlerService,
    BatchManagerService,
    CommissionAggregatorService,
    PaymentOrchestratorService,
    DisbursementProcessorService,
    // File 4/6
    CronsScheduler,
    // File 5/6
    CronSecretGuard,
    // Session 4A-W6, File 7/8 -- same house convention as the rest of this
    // module (own provider instances, not a cross-module import of
    // WiseModule, matching how TransactionService et al. are duplicated
    // here rather than imported).
    WiseConfig,
    WiseApiClient,
    WiseStateMapper,
    WiseTransferStateReducer,
    WiseReconciliationService,
  ],
})
export class CronsModule {}
