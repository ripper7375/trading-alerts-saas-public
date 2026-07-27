/**
 * Disbursement Module (Session 4A-9, File 10/10)
 *
 * Wires `DisbursementBatchesController` (File 8/10) together with every
 * service it (directly or transitively) depends on. `PrismaService` isn't
 * listed — `PrismaModule` is `@Global()`. Mirrors `CronsModule`'s own
 * provider list for these same services (independent instances, not a
 * cross-module import -- same house convention documented there) plus
 * `imports: [WiseModule]` for the already-DI-constructed
 * `WisePaymentProvider` (its 8 collaborators resolved by Nest, not
 * hand-wired here).
 */

import { Module } from '@nestjs/common';

import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { WiseModule } from '../wise/wise.module';

import { BatchManagerService } from './batch-manager.service';
import { DisbursementBatchesController } from './controllers/disbursement-batches.controller';
import { PaymentOrchestratorService } from './payment-orchestrator.service';
import { RetryHandlerService } from './retry-handler.service';
import { TransactionLoggerService } from './transaction-logger.service';
import { TransactionService } from './transaction.service';

@Module({
  imports: [WiseModule],
  controllers: [DisbursementBatchesController],
  providers: [
    TransactionLoggerService,
    TransactionService,
    RetryHandlerService,
    BatchManagerService,
    PaymentOrchestratorService,
    IdempotencyInterceptor,
    IdempotencyStore,
  ],
})
export class DisbursementModule {}
