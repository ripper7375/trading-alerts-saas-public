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
import { CurrencyGoldIndexDto } from './dto/currency-gold-index.dto';

/**
 * Lane 4: G8 Currency & Gold Index Suite ingest.
 *
 * Deliberately separate from every other lane in every respect -- its own
 * route, queue, processor and table -- so a failure here can never affect
 * market_data, indicator_statistics or economic_events ingestion. This lane
 * is display-only marketing/conversion data (the public landing page's
 * currency-strength widget), never an alert input.
 *
 * The sender (currency_gold_index_engine.py) is a fully separate VPS process
 * from the v6 alert pipeline's own collector/push-worker -- see that
 * script's module docstring for the isolation rationale.
 *
 * Like indicator-statistics, the body is an ARRAY: one push cycle produces up
 * to 9 rows (8 currency indices + XAUX) sent together. One HTTP round trip,
 * one queue job PER ELEMENT, so per-row idempotency is unchanged.
 */
@Controller('api/v1/currency-gold-indices')
@UseGuards(ApiKeyGuard)
export class CurrencyGoldIndicesController {
  private readonly logger = new Logger(CurrencyGoldIndicesController.name);

  constructor(
    @InjectQueue('currency-gold-indices-sync') private readonly queue: Queue
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async publishIndices(
    // whitelist/forbidNonWhitelisted must be passed EXPLICITLY here.
    // ParseArrayPipe builds its own internal ValidationPipe and does NOT
    // inherit the global one configured in main.ts -- the same real gap the
    // indicator-statistics lane's own comment documents (found during the
    // 2026-09-09 field-consistency audit): without these, an unknown field
    // is silently accepted and reaches Prisma as an unknown column.
    @Body(
      new ParseArrayPipe({
        items: CurrencyGoldIndexDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    items: CurrencyGoldIndexDto[]
  ) {
    const startTime = Date.now();
    const jobIds: string[] = [];

    for (const data of items) {
      // Idempotency key matches the schema's unique key: (index_name,
      // bar_time). A retry re-delivers the same key with byte-identical
      // content, since the value is a deterministic recomputation from the
      // same input bars -- see currency_gold_index_engine.py's index_value().
      const jobId = `${data.index_name}_${data.bar_time}`;
      const job = await this.queue.add('process', data, { jobId });
      jobIds.push(String(job.id));
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Queued ${items.length} index value(s) | Duration: ${duration}ms`
    );

    return { queued: items.length, jobIds };
  }
}
