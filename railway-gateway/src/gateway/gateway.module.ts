import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataController } from './market-data.controller';
import { IndicatorStatisticsController } from './indicator-statistics.controller';
import { EconomicEventsController } from './economic-events.controller';
import { CurrencyGoldIndicesController } from './currency-gold-indices.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [
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
  ],
  controllers: [
    MarketDataController,
    IndicatorStatisticsController,
    EconomicEventsController,
    CurrencyGoldIndicesController,
  ],
  providers: [ValidationService],
})
export class GatewayModule {}
