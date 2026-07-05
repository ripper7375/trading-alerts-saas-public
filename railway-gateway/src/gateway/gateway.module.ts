import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MarketDataController } from './market-data.controller';
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
  ],
  controllers: [MarketDataController],
  providers: [ValidationService],
})
export class GatewayModule {}
