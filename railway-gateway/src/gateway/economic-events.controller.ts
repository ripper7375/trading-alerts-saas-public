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
import { EconomicEventDto } from './dto/economic-event.dto';

/**
 * Append-only economic-calendar ingest.
 *
 * A third stream, separate from MarketDataController and
 * IndicatorStatisticsController in every respect — its own route, queue,
 * processor and outbox — so a failure here can never affect price ingestion.
 *
 * The body is an ARRAY. The push worker batches deliberately: the first sync
 * after deployment carries the whole calendar window (~333 rows), and
 * market_data's one-POST-per-row shape is already under-provisioned for its
 * own volume. One HTTP round trip, but still one queue job PER ELEMENT, so
 * per-row idempotency is unchanged.
 *
 * ThrottlerGuard is applied globally via APP_GUARD in app.module.ts; only the
 * API-key check is local to this controller.
 */
@Controller('api/v1/economic-events')
@UseGuards(ApiKeyGuard)
export class EconomicEventsController {
  private readonly logger = new Logger(EconomicEventsController.name);

  constructor(
    @InjectQueue('economic-events-sync') private readonly queue: Queue
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async publishEvents(
    // whitelist/forbidNonWhitelisted must be passed EXPLICITLY here.
    // ParseArrayPipe builds its own internal ValidationPipe and does NOT
    // inherit the global one configured in main.ts — without these, an unknown
    // field is silently accepted and then reaches Prisma as an unknown column.
    // This is not hypothetical: it was a real 200-instead-of-400 gap found on
    // the indicator-statistics endpoint, and it is covered by a test below.
    @Body(
      new ParseArrayPipe({
        items: EconomicEventDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
    items: EconomicEventDto[]
  ) {
    const startTime = Date.now();
    const jobIds: string[] = [];

    for (const data of items) {
      // Idempotency key matches the append-only unique key exactly — "which
      // release, and when it was observed". captured_at differs on every new
      // observation, so a push retry re-delivers the same key with identical
      // content rather than colliding with a different observation, and a
      // revised forecast arrives as a genuinely different key.
      const jobId = `${data.value_id}_${data.captured_at}`;
      const job = await this.queue.add('process', data, { jobId });
      jobIds.push(String(job.id));
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Queued ${items.length} economic event(s) | Duration: ${duration}ms`
    );

    return { queued: items.length, jobIds };
  }
}
