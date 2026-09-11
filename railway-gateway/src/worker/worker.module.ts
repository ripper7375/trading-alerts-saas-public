import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataProcessor } from './market-data.processor';
import { IndicatorStatisticsProcessor } from './indicator-statistics.processor';
import { EconomicEventsProcessor } from './economic-events.processor';
import { CurrencyGoldIndicesProcessor } from './currency-gold-indices.processor';

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
  ],
  providers: [
    MarketDataProcessor,
    IndicatorStatisticsProcessor,
    EconomicEventsProcessor,
    CurrencyGoldIndicesProcessor,
  ],
})
export class WorkerModule {}
