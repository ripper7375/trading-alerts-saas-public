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

@Processor('market-data-sync')
export class MarketDataProcessor {
  private readonly logger = new Logger(MarketDataProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // Concurrency of 1 is deliberate: at this pipeline's volume there is no
  // throughput reason to process jobs in parallel, and doing so only adds a
  // class of ordering bugs (e.g. an M15 row processed before the M5 row it
  // depends on) that a single worker avoids by construction.
  @Process({ concurrency: 1 })
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

    return { success: true };
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
    this.logger.error(`Failed: ${job.id} after ${job.attemptsMade} attempts`, error);
  }
}
