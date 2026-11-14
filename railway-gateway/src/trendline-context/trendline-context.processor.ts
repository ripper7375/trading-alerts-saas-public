import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrendlinePolicySessionDto } from './dto/trendline-policy-session.dto';
import {
  TRENDLINE_POLICY_JOB,
  TRENDLINE_POLICY_QUEUE,
} from './trendline-context.keys';

export type TrendlinePolicyOutcome =
  | { outcome: 'RECORDED'; sessionId: string }
  | { outcome: 'DUPLICATE'; sessionId: string };

/** Prisma's "unique constraint failed" code, checked without importing its error classes. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Writes one Publish (TRENDLINE-CONTEXT-BLUEPRINT.md, Layer 1) as ONE
 * Prisma transaction: the session row and every one of its lines together,
 * or neither -- a reader must never see a session with only some of its
 * lines.
 *
 * Concurrency 1, like every other lane here (symbol-specs, the economic
 * calendar). Idempotent on (symbol, published_at): a retried POST is the
 * same session re-delivered, not a new one, so it is read back as
 * DUPLICATE rather than creating a second row for the same Publish.
 *
 * This writes Layer 1 only. Layer 2 (TrendlineContextReading, recomputed
 * every 5-minute cycle from the latest published session) is a SEPARATE
 * piece of work, not built yet (Blueprint §9) -- this processor never
 * touches that table.
 */
@Processor(TRENDLINE_POLICY_QUEUE)
export class TrendlineContextProcessor {
  private readonly logger = new Logger(TrendlineContextProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // The name MUST match the job name the controller enqueues
  // (TRENDLINE_POLICY_JOB) -- see trendline-context.keys.ts's own warning
  // (the 2026-07-05 audit finding: a name mismatch fails every job while
  // the endpoint still answers 200).
  @Process({ name: TRENDLINE_POLICY_JOB, concurrency: 1 })
  async process(
    job: Job<TrendlinePolicySessionDto>
  ): Promise<TrendlinePolicyOutcome> {
    const data = job.data;

    const already = await this.findSessionId(data.symbol, data.published_at);
    if (already !== null) {
      return { outcome: 'DUPLICATE', sessionId: already };
    }

    try {
      const session = await this.prisma.trendlinePolicySession.create({
        data: {
          symbol: data.symbol,
          published_at: data.published_at,
          overview_note: data.overview_note ?? null,
          regime_hint: data.regime_hint ?? null,
          source_charts: data.source_charts,
          lines: {
            create: data.lines.map((line) => ({
              slot_key: line.slot_key,
              slot: line.slot,
              source_timeframe: line.source_timeframe,
              anchor1_time: line.anchor1_time,
              anchor1_price: line.anchor1_price,
              anchor2_time: line.anchor2_time,
              anchor2_price: line.anchor2_price,
              ray_extends: line.ray_extends,
              label_raw: line.label_raw,
              role: line.role,
              bias_hint: line.bias_hint ?? null,
              note: line.note ?? null,
              parse_method: line.parse_method,
            })),
          },
        },
        select: { id: true },
      });

      this.logger.log(
        `Recorded trendline policy session ${data.symbol}@${data.published_at} ` +
          `(${data.lines.length} line(s)) | id=${session.id}`
      );
      return { outcome: 'RECORDED', sessionId: session.id };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A unique constraint refused the row. If the session is now there, a
      // replay beat this job to it: that is the idempotent outcome, not a
      // failure (same reasoning as symbol-specs.processor.ts).
      const raced = await this.findSessionId(data.symbol, data.published_at);
      if (raced !== null) return { outcome: 'DUPLICATE', sessionId: raced };
      throw error;
    }
  }

  private async findSessionId(
    symbol: string,
    publishedAt: number
  ): Promise<string | null> {
    const row = await this.prisma.trendlinePolicySession.findFirst({
      where: { symbol, published_at: publishedAt },
      select: { id: true },
    });
    return row ? row.id : null;
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Failed: ${job.id} after ${job.attemptsMade} attempts`,
      error
    );
  }
}
