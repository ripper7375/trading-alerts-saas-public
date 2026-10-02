import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SymbolSpecDto } from '../gateway/dto/symbol-spec.dto';
import {
  SYMBOL_SPECS_JOB,
  SYMBOL_SPECS_QUEUE,
} from '../symbol-specs/symbol-specs.keys';

export type SymbolSpecOutcome =
  | { outcome: 'RECORDED'; version: number }
  | { outcome: 'DUPLICATE'; version: number };

/** Prisma's "unique constraint failed" code, checked without importing its error classes. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * Writes the broker's symbol figures (ADR-066, section 6.9), append-only, with a
 * per-symbol version the gateway assigns.
 *
 * Concurrency 1, like every other lane here. That is also what makes the
 * version safe: the processor reads the symbol's highest version and writes the
 * next one, and with one job at a time no second writer takes that number in
 * between. If two gateway instances ever ran (they do not), the unique
 * constraint on (symbol, version) would refuse the loser, and Bull's retry would
 * read the new maximum and succeed; nothing here depends on luck.
 */
@Processor(SYMBOL_SPECS_QUEUE)
export class SymbolSpecsProcessor {
  private readonly logger = new Logger(SymbolSpecsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  // The name MUST match the job name the controller enqueues
  // (SYMBOL_SPECS_JOB, shared). An unnamed @Process() only handles unnamed jobs:
  // named jobs would sit failing with "Missing process handler for job type
  // process" while the gateway still returned 200 (the 2026-07-05 audit finding).
  @Process({ name: SYMBOL_SPECS_JOB, concurrency: 1 })
  async process(job: Job<SymbolSpecDto>): Promise<SymbolSpecOutcome> {
    const data = job.data;

    // Idempotent on (symbol, captured_at). A push retry delivers the very same
    // observation, and this absorbs the repeat instead of numbering it again.
    //
    // ⚠ A repeat is NEVER an update. The first write of an observation wins and
    // history is not edited: the version in a consent record must keep meaning
    // the figures it was shown. A genuinely different reading is a different
    // captured_at and therefore a different row.
    const already = await this.findVersion(data.symbol, data.captured_at);
    if (already !== null) {
      return { outcome: 'DUPLICATE', version: already };
    }

    // The next version is (the symbol's highest, or 0 for the first) + 1, in the
    // order observations are RECORDED. A late older observation therefore gets a
    // higher version than a newer one recorded before it: the version says when
    // the gateway learned of a row, captured_at says when the terminal was read,
    // and "the latest" (SymbolSpecsService) is decided by captured_at.
    const highest = await this.prisma.symbolSpec.aggregate({
      where: { symbol: data.symbol },
      _max: { version: true },
    });
    const version = (highest._max.version ?? 0) + 1;

    try {
      // Fields named one by one, so nothing but the contract can reach the table.
      await this.prisma.symbolSpec.create({
        data: {
          terminal_id: data.terminal_id,
          symbol: data.symbol,
          version,
          captured_at: data.captured_at,
          contract_size: data.contract_size,
          volume_min: data.volume_min,
          volume_step: data.volume_step,
          volume_max: data.volume_max,
          tick_size: data.tick_size,
          typical_spread: data.typical_spread,
          swap_long: data.swap_long,
          swap_short: data.swap_short,
          point: data.point,
          digits: data.digits,
          swap_mode: data.swap_mode,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // A unique constraint refused the row. If the observation is now there, a
      // replay beat this job to it: that is the idempotent outcome, not a
      // failure. If it is not, another writer took this VERSION: throw, so Bull
      // retries and the next attempt reads the new maximum.
      const raced = await this.findVersion(data.symbol, data.captured_at);
      if (raced !== null) return { outcome: 'DUPLICATE', version: raced };
      throw error;
    }

    this.logger.log(
      `Recorded ${data.symbol} v${version} (captured_at ${data.captured_at}, terminal ${data.terminal_id})`
    );
    return { outcome: 'RECORDED', version };
  }

  private async findVersion(
    symbol: string,
    capturedAt: number
  ): Promise<number | null> {
    const row = await this.prisma.symbolSpec.findUnique({
      where: { symbol_captured_at: { symbol, captured_at: capturedAt } },
      select: { version: true },
    });
    return row ? row.version : null;
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Failed: ${job.id} after ${job.attemptsMade} attempts`,
      error
    );
  }
}
