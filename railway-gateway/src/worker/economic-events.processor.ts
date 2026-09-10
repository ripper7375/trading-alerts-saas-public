import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EconomicEventDto } from '../gateway/dto/economic-event.dto';

@Processor('economic-events-sync')
export class EconomicEventsProcessor {
  private readonly logger = new Logger(EconomicEventsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Concurrency 1, matching the other two processors. There is no throughput
  // reason to parallelise: after the first sync this stream carries only what
  // actually changed, typically a handful of rows per cycle.
  //
  // The name MUST match the job name the controller enqueues
  // (`queue.add('process', ...)`). An unnamed @Process() only handles unnamed
  // jobs — named jobs would sit failing with "Missing process handler for job
  // type process" while the gateway still returned 200 (the 2026-07-05 audit
  // finding; see MarketDataProcessor's own note).
  @Process({ name: 'process', concurrency: 1 })
  async process(job: Job<EconomicEventDto>): Promise<{ success: true }> {
    const data = job.data;
    const { value_id, captured_at } = data;

    // Idempotent on the append-only key. A push retry delivers byte-identical
    // content, so this absorbs the duplicate rather than mutating history.
    //
    // ⚠ The update branch exists ONLY to make a retry a no-op. It must never
    // become a way to correct a value: a revised forecast or a published
    // actual arrives as a NEW row with a later captured_at, which is a
    // different key and therefore a different row. Overwriting here would
    // erase what the market knew before the release — the loss
    // HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md records as unrecoverable
    // for market_data.
    await this.prisma.economicEvent.upsert({
      where: {
        value_id_captured_at: { value_id, captured_at },
      },
      create: data,
      update: data,
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
