import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataProcessor } from './market-data.processor';
import { IndicatorStatisticsProcessor } from './indicator-statistics.processor';
import { EconomicEventsProcessor } from './economic-events.processor';
import { CurrencyGoldIndicesProcessor } from './currency-gold-indices.processor';
import { CurrencyIndexCorridorAggregatorService } from './currency-index-corridor-aggregator.service';
import { CycleManifestService } from './cycle-manifest.service';
import { SymbolSpecsProcessor } from './symbol-specs.processor';
import { CYCLE_READY_QUEUE } from './cycle-queues';
import { SYMBOL_SPECS_QUEUE } from '../symbol-specs/symbol-specs.keys';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'market-data-sync',
    }),
    // Separate queue from market-data: statistics are append-only telemetry and
    // must never share a failure domain with price ingestion.
    BullModule.registerQueue({
      name: 'indicator-statistics-sync',
    }),
    // Third isolated queue -- see gateway.module.ts.
    BullModule.registerQueue({
      name: 'economic-events-sync',
    }),
    // Fourth isolated queue: Lane 4 (currency & gold indices) -- see
    // gateway.module.ts.
    BullModule.registerQueue({
      name: 'currency-gold-indices-sync',
    }),
    // The cycle-ready signal for build step 3's sensor worker (ADR-016). The
    // manifest service is the only producer; nothing consumes it yet.
    BullModule.registerQueue({
      name: CYCLE_READY_QUEUE,
    }),
    // The broker's symbol figures (build step 2 part 8) -- see gateway.module.ts.
    BullModule.registerQueue({
      name: SYMBOL_SPECS_QUEUE,
    }),
  ],
  providers: [
    MarketDataProcessor,
    IndicatorStatisticsProcessor,
    EconomicEventsProcessor,
    CurrencyGoldIndicesProcessor,
    // Appends the broker's symbol figures with a per-symbol version (ADR-066).
    SymbolSpecsProcessor,
    // Currency Index PRO plan (Phase 1): reads CurrencyGoldIndex, writes
    // DailyCurrencyIndexMetrics/DailyVolatilityCorridor. Not a queue
    // consumer -- ticks on its own @Cron schedule instead.
    CurrencyIndexCorridorAggregatorService,
    // Handles the cycle manifest job that shares market-data-sync's single
    // loop (see MarketDataProcessor), and announces ready cycles.
    CycleManifestService,
  ],
})
export class WorkerModule {}
