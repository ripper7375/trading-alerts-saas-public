import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndicatorStatisticDto } from '../gateway/dto/indicator-statistic.dto';

@Processor('indicator-statistics-sync')
export class IndicatorStatisticsProcessor {
  private readonly logger = new Logger(IndicatorStatisticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Concurrency 1, matching MarketDataProcessor: there is no throughput reason
  // to parallelise at ~160 rows/hour, and a single worker removes the race
  // where two jobs both try to create the same indicator_configs row.
  //
  // The name MUST match the job name the controller enqueues
  // (`queue.add('process', ...)`). An unnamed @Process() only handles unnamed
  // jobs — named jobs would sit failing with "Missing process handler for job
  // type process" while the gateway still returned 200 (the 2026-07-05 audit
  // finding; see MarketDataProcessor's own note).
  @Process({ name: 'process', concurrency: 1 })
  async process(job: Job<IndicatorStatisticDto>): Promise<{ success: true }> {
    const { config_hash, config_params, ...data } = job.data;
    const { symbol, timeframe, source, captured_at } = data;

    // The config row must exist before the statistic that references it —
    // indicator_statistics.config_hash is a real foreign key. Upsert with an
    // empty update: the parameters behind a given hash are immutable by
    // definition (the hash is derived from them), so re-seeing a hash is a
    // no-op rather than a rewrite.
    await this.prisma.indicatorConfig.upsert({
      where: { config_hash },
      create: {
        config_hash,
        source,
        params: config_params as object,
        first_seen: captured_at,
      },
      update: {},
    });

    // Idempotent on the append-only key. A push retry delivers byte-identical
    // content, so this never mutates history — it just absorbs the duplicate.
    // A genuine correction would arrive as a NEW row with a later captured_at.
    await this.prisma.indicatorStatistic.upsert({
      where: {
        symbol_timeframe_source_captured_at: {
          symbol,
          timeframe,
          source,
          captured_at,
        },
      },
      create: { ...data, config_hash },
      update: { ...data, config_hash },
    });

    return { success: true };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Failed: ${job.id} after ${job.attemptsMade} attempts`,
      error
    );
  }
}
