import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseArrayPipe,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { IndicatorStatisticDto } from './dto/indicator-statistic.dto';

/**
 * Append-only indicator statistics ingest.
 *
 * Deliberately separate from MarketDataController in every respect — its own
 * route, queue, processor and outbox — so that a failure in this stream can
 * never affect market_data ingestion. Statistics are valuable but not
 * load-bearing; price data is.
 *
 * Unlike market-data, the body is an ARRAY: one collection cycle produces up
 * to 10 snapshots (one per statistic-emitting indicator) and the push worker
 * sends them together. One HTTP round trip, but still one queue job PER
 * ELEMENT, so per-row idempotency is unchanged.
 *
 * ThrottlerGuard is applied globally via APP_GUARD in app.module.ts; only the
 * API-key check is local to this controller.
 */
@Controller('api/v1/indicator-statistics')
@UseGuards(ApiKeyGuard)
export class IndicatorStatisticsController {
  private readonly logger = new Logger(IndicatorStatisticsController.name);

  constructor(
    @InjectQueue('indicator-statistics-sync') private readonly queue: Queue
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async publishStatistics(
    // whitelist/forbidNonWhitelisted must be passed EXPLICITLY here.
    // ParseArrayPipe builds its own internal ValidationPipe and does NOT
    // inherit the global one configured in main.ts — without these, an unknown
    // field is silently accepted and then reaches Prisma as an unknown column.
    @Body(
      new ParseArrayPipe({
        items: IndicatorStatisticDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    items: IndicatorStatisticDto[]
  ) {
    const startTime = Date.now();
    const jobIds: string[] = [];

    for (const data of items) {
      // Idempotency key matches the schema's unique key exactly — "which fit,
      // and when it was observed". captured_at is new every cycle, so a retry
      // re-delivers the same key with byte-identical content rather than
      // colliding with a different observation.
      const jobId = `${data.symbol}_${data.timeframe}_${data.source}_${data.captured_at}`;
      const job = await this.queue.add('process', data, { jobId });
      jobIds.push(String(job.id));
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Queued ${items.length} statistic snapshot(s) | Duration: ${duration}ms`
    );

    return { queued: items.length, jobIds };
  }
}
