import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataProcessor } from './market-data.processor';
import { IndicatorStatisticsProcessor } from './indicator-statistics.processor';

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
  ],
  providers: [MarketDataProcessor, IndicatorStatisticsProcessor],
})
export class WorkerModule {}
