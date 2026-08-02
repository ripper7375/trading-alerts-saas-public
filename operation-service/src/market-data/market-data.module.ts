import { Module } from '@nestjs/common';

import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

/**
 * Market-data channel proxy domain module (Session 4B-12). `PrismaModule`
 * is `@Global()` (established Session 4B-1/4B-2) — no explicit import
 * needed, matching every other domain module's own convention.
 *
 * @module market-data/market-data.module
 */
@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService],
})
export class MarketDataModule {}
