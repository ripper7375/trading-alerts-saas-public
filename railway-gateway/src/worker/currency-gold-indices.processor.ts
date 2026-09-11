import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyGoldIndexDto } from '../gateway/dto/currency-gold-index.dto';

@Processor('currency-gold-indices-sync')
export class CurrencyGoldIndicesProcessor {
  private readonly logger = new Logger(CurrencyGoldIndicesProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Concurrency 1, matching every other lane's processor: no throughput
  // reason to parallelise at 9 rows/5min, and it removes any need to reason
  // about concurrent upserts to the same key.
  //
  // The name MUST match the job name the controller enqueues
  // (queue.add('process', ...)) -- an unnamed @Process() only handles
  // unnamed jobs (the 2026-07-05 audit finding every other processor's own
  // comment documents).
  @Process({ name: 'process', concurrency: 1 })
  async process(job: Job<CurrencyGoldIndexDto>): Promise<{ success: true }> {
    const {
      terminal_id,
      index_name,
      bar_time,
      value,
      change_pct,
      session_open_bar_time,
    } = job.data;

    // Upsert on the natural key. Unlike indicator_statistics/economic_events,
    // this is NOT a revision stream: (index_name, bar_time) has exactly one
    // correct value -- a deterministic, stateless recomputation -- so a
    // retry's upsert is a true no-op rather than an append. See
    // currency_gold_index_engine.py's own index_value() docstring.
    await this.prisma.currencyGoldIndex.upsert({
      where: {
        index_name_bar_time: { index_name, bar_time },
      },
      create: {
        terminal_id,
        index_name,
        bar_time,
        value,
        change_pct,
        session_open_bar_time,
      },
      update: { terminal_id, value, change_pct, session_open_bar_time },
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
