import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { MarketDataDto } from './dto/market-data.dto';
import { ValidationService } from './validation.service';

// ThrottlerGuard is applied globally via APP_GUARD in app.module.ts (so its
// dependencies resolve regardless of which module a controller lives in);
// only the API-key check is local to this controller.
@Controller('api/v1/market-data')
@UseGuards(ApiKeyGuard)
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(
    @InjectQueue('market-data-sync') private readonly queue: Queue,
    private readonly validationService: ValidationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async publishMarketData(@Body() data: MarketDataDto) {
    const startTime = Date.now();

    try {
      await this.validationService.validate(data);

      // Idempotency key matches the schema's upsert key exactly.
      const jobId = `${data.symbol}_${data.timeframe}_${data.timestamp}`;
      const job = await this.queue.add('process', data, { jobId });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Queued: ${data.symbol} ${data.timeframe} @ ${data.timestamp} | Job ID: ${job.id} | Duration: ${duration}ms`
      );

      // The Push Worker uses this 200 to stamp market_data.synced_at locally.
      return {
        status: 'queued',
        jobId: job.id,
        processingTime: duration,
      };
    } catch (error) {
      this.logger.error(
        `Failed to queue: ${data.symbol} ${data.timeframe} @ ${data.timestamp}`,
        (error as Error).stack
      );
      throw error;
    }
  }
}
