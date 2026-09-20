import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataDto } from '../gateway/dto/market-data.dto';
import { buildSnapshot } from './point-in-time-snapshot';

@Processor('market-data-sync')
export class MarketDataProcessor {
  private readonly logger = new Logger(MarketDataProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Concurrency of 1 is deliberate: at this pipeline's volume there is no
  // throughput reason to process jobs in parallel, and doing so only adds a
  // class of ordering bugs (e.g. an M15 row processed before the M5 row it
  // depends on) that a single worker avoids by construction.
  //
  // The name MUST match the job name the controller enqueues
  // (`queue.add('process', ...)` in market-data.controller.ts). An unnamed
  // @Process() only handles unnamed jobs — named jobs would sit in the queue
  // failing with "Missing process handler for job type process" while the
  // gateway still returns 200 "queued" (found in the 2026-07-05 system audit).
  @Process({ name: 'process', concurrency: 1 })
  async process(job: Job<MarketDataDto>): Promise<{ success: true }> {
    const data = job.data;
    const { symbol, timeframe, timestamp } = data;

    // Idempotent upsert on (symbol, timeframe, timestamp) — the same key the
    // controller uses as the Bull jobId. Duplicate delivery is expected (the
    // Push Worker retries by design) and must never create a second row.
    await this.prisma.marketDataV6.upsert({
      where: { symbol_timeframe_timestamp: { symbol, timeframe, timestamp } },
      create: data,
      update: data,
    });

    await this.writePointInTimeSnapshot(data);

    return { success: true };
  }

  /**
   * Freeze this bar's indicator values the first time we see it after it closed.
   *
   * The upsert above is the LIVE zone and must keep updating in place — alerts
   * and the terminal chart depend on the newest fit. That is also why stored
   * history is not point-in-time honest: a bar's row keeps being rewritten for
   * ~3000 bars with a fitting window that has moved past it. Measured on two
   * real captures 12 days apart, `*_uoedt` moved on 100% of comparable bars by
   * a mean of 14% of the EDT channel width, and `*_crossing` flipped on 0.71%.
   *
   * So this writes a second, immutable row instead of changing the first.
   *
   * THREE PROPERTIES THAT MATTER, each enforced rather than intended:
   *
   * 1. WRITE-ONCE. `createMany({ skipDuplicates: true })` against the unique
   *    `(symbol, timeframe, timestamp)` key is an INSERT ... ON CONFLICT DO
   *    NOTHING. Re-delivery is expected — the Push Worker retries by design and
   *    every in-window bar is re-queued every cycle — so this runs thousands of
   *    times per bar and must be a no-op after the first.
   *
   * 2. IT CANNOT BREAK INGESTION. Wrapped and logged, never rethrown. A
   *    snapshot is valuable telemetry; `market_data_v6` is load-bearing for
   *    live alerting. The same ordering the collector uses for its own
   *    statistics capture, and the same reason.
   *
   * 3. NEVER THE FORMING BAR. `buildSnapshot()` returns null while the bar is
   *    still open. Every export ends at shift 0 by design (the completeness
   *    check requires it), so the newest row in every payload is a partial
   *    candle — freezing that would enshrine a half-formed bar as the truth.
   */
  private async writePointInTimeSnapshot(data: MarketDataDto): Promise<void> {
    const snapshot = buildSnapshot(data, Math.floor(Date.now() / 1000));
    if (!snapshot) return;

    try {
      await this.prisma.marketDataPointInTime.createMany({
        data: [snapshot as never],
        skipDuplicates: true,
      });
    } catch (error) {
      // Deliberately swallowed. Most likely cause by far is the migration not
      // having been applied yet, which is loud in the logs and harmless to the
      // live lane — but a bar missed here is gone for good, because the honest
      // value exists exactly once.
      this.logger.warn(
        `Point-in-time snapshot skipped for ${data.symbol} ${data.timeframe} ` +
          `@ ${data.timestamp}: ${(error as Error).message}`
      );
    }
  }

  @OnQueueActive()
  onActive(job: Job): void {
    this.logger.debug(`Processing: ${job.id}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.debug(`Completed: ${job.id}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Failed: ${job.id} after ${job.attemptsMade} attempts`,
      error
    );
  }
}
