import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataController } from './market-data.controller';
import { IndicatorStatisticsController } from './indicator-statistics.controller';
import { EconomicEventsController } from './economic-events.controller';
import { CurrencyGoldIndicesController } from './currency-gold-indices.controller';
import { CycleManifestController } from './cycle-manifest.controller';
import { CyclesController } from './cycles.controller';
import { ActiveIndicatorController } from './active-indicator.controller';
import { SymbolSpecsController } from './symbol-specs.controller';
import { CycleReadModule } from '../cycle/read/cycle-read.module';
import { SYMBOL_SPECS_QUEUE } from '../symbol-specs/symbol-specs.keys';
import { ValidationService } from './validation.service';

@Module({
  imports: [
    // The readers and the active-indicator setting behind the cycle endpoints.
    CycleReadModule,
    BullModule.registerQueue({
      name: 'market-data-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    // Separate queue so a statistics backlog or failure can never delay or
    // fail market-data ingestion. Same retry policy; statistics are lower
    // volume (~160 rows/hour vs. thousands), so the same retention is ample.
    BullModule.registerQueue({
      name: 'indicator-statistics-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    // A third queue, isolated for the same reason: the calendar stream must
    // never share a failure domain with price ingestion. Lower volume still
    // than statistics -- after the first sync it carries only what changed.
    BullModule.registerQueue({
      name: 'economic-events-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    // A fourth isolated queue: Lane 4 (currency & gold indices). The sender
    // is a fully separate VPS process from the v6 alert pipeline's own
    // collector/push-worker, so this queue's isolation is belt-and-braces on
    // top of that -- a failure here must never touch the other three lanes
    // any more than they touch each other.
    BullModule.registerQueue({
      name: 'currency-gold-indices-sync',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    // A fifth isolated queue: the broker's symbol figures (build step 2 part 8,
    // ADR-066). About one job a day, so the retention is ample; isolated for the
    // same reason as the others: a failure here must never touch price ingestion.
    BullModule.registerQueue({
      name: SYMBOL_SPECS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [
    MarketDataController,
    IndicatorStatisticsController,
    EconomicEventsController,
    CurrencyGoldIndicesController,
    SymbolSpecsController,
    // The cycle manifest (ADR-009): validated and queued on market-data-sync,
    // behind the row jobs. Its checking happens in the worker.
    CycleManifestController,
    // Rule 6 and 7 reads and the audited active-indicator setter (build step 2 part 6).
    CyclesController,
    ActiveIndicatorController,
  ],
  providers: [ValidationService],
})
export class GatewayModule {}
