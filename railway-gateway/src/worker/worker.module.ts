import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataProcessor } from './market-data.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'market-data-sync',
    }),
  ],
  providers: [MarketDataProcessor],
})
export class WorkerModule {}
