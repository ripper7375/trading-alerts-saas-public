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

import { AffiliateCronService } from './affiliate.service';
import { CronsScheduler } from './crons.scheduler';
import { SubscriptionCronService } from './subscription.service';

@Module({
  providers: [
    // File 2/6
    AffiliateConfigService,
    CodeGeneratorService,
    SubscriptionCronService,
    AffiliateCronService,
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
  ],
})
export class CronsModule {}
