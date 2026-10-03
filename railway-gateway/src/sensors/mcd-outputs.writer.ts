import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { gzipSync } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import type { CycleRunResult } from './cycle-run-result';
import { EnvelopeValidator } from './envelope-validator';
import { slotToIso } from './inputs/stats-slot';

/**
 * Writes one cycle's readings (STACK-D-ARCHITECTURE.md section 2.2, "write"; build step 3 part 4).
 *
 * ONE transaction per cycle holds everything: the `mcd_outputs` rows (one per MCD the runner ran,
 * INVALID and STALE included), the `market_cycle_inputs` row (the bundle's exact canonical text,
 * gzipped, for replay), and the 90-day cleanup of older bundles (Davin, part 2 decision D3). Either
 * all of it commits or none of it does, so a half-written cycle never exists. The rows are append-
 * only by their unique keys: a cycle delivered twice adds nothing the second time (`skipDuplicates`),
 * and one MCD enabled later adds just its own row.
 *
 * It is also the last gate: nothing is written until every envelope has passed the schema (Ajv),
 * carries the MCD and the slot it is stored under, and hashes to the hash the runner reported, and
 * the bundle text hashes to `inputs_sha256`. A cycle that fails any of that is refused whole
 * (`CycleWriteRefused`), because storing the readings that happen to be fine would leave a cycle
 * the replay cannot trust.
 *
 * The bundle text is the one the runner wrote (`bundle_canonical_json`): JavaScript and Python write
 * a float differently, so the worker never rebuilds it (Davin, part 3 decision 3, option a).
 */

/** How long a stored bundle is kept (Davin, part 2 decision D3). `mcd_outputs` has no retention. */
export const INPUTS_RETENTION_DAYS = 90;
const DAY_SECONDS = 86_400;

export interface CycleWrite {
  symbol: string;
  /** The cycle, unix UTC (a multiple of 300): the key the rows are stored under. */
  slot: number;
  result: CycleRunResult;
  /** The worker's clock when the cycle was evaluated, unix seconds: `evaluated_at`, and the point the 90 days are counted back from. */
  evaluatedAt: number;
}

export interface WriteSummary {
  /** Rows of `mcd_outputs` this call added. */
  outputsInserted: number;
  /** Rows of this cycle that were already there (a re-delivery) and were left as they were. */
  outputsExisting: number;
  /** Whether this call added the cycle's bundle (false: it was already stored, or there is no bundle text to store). */
  inputsInserted: boolean;
  /** Stored bundles older than 90 days that this call deleted. */
  inputsDeleted: number;
}

/** The cycle was not written: what is wrong with it, one line each. Nothing was changed in the database. */
export class CycleWriteRefused extends Error {
  constructor(readonly problems: string[]) {
    super(`cycle refused, nothing written: ${problems.join('; ')}`);
    this.name = 'CycleWriteRefused';
  }
}

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

@Injectable()
export class McdOutputsWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: EnvelopeValidator
  ) {}

  /** Everything wrong with `write` that can be seen without the database. Empty list = it may be written. */
  problems(write: CycleWrite): string[] {
    const { result, slot, symbol } = write;
    const problems: string[] = [];
    const isoSlot = slotToIso(slot);
    if (result.symbol !== symbol)
      problems.push(`the runner answered for ${result.symbol}, not ${symbol}`);
    if (result.cycle_slot !== isoSlot)
      problems.push(
        `the runner answered for slot ${result.cycle_slot}, not ${isoSlot}`
      );
    if (result.bundle_canonical_json !== null) {
      if (sha256(result.bundle_canonical_json) !== result.inputs_sha256)
        problems.push('bundle_canonical_json does not hash to inputs_sha256');
    }
    for (const reading of result.results) {
      const where = reading.mcd_id;
      if (sha256(reading.envelope_json) !== reading.envelope_sha256)
        problems.push(
          `${where}: envelope_json does not hash to envelope_sha256`
        );
      const check = this.validator.check(reading.envelope_json);
      if (!check.ok) {
        for (const problem of check.problems)
          problems.push(`${where}: envelope breaks mcd-output/1: ${problem}`);
        continue;
      }
      const envelope = check.envelope;
      if (envelope['mcd_id'] !== reading.mcd_id)
        problems.push(
          `${where}: the envelope is MCD ${String(envelope['mcd_id'])}`
        );
      if (envelope['cycle_slot'] !== isoSlot)
        problems.push(
          `${where}: the envelope is for slot ${String(envelope['cycle_slot'])}, not ${isoSlot}`
        );
      if (envelope['evaluator_version'] !== reading.evaluator_version)
        problems.push(
          `${where}: evaluator_version differs from the envelope's`
        );
      if (envelope['status'] !== reading.status)
        problems.push(`${where}: status differs from the envelope's`);
      if ((envelope['state_code'] ?? null) !== reading.state_code)
        problems.push(`${where}: state_code differs from the envelope's`);
      if ((envelope['bias'] ?? null) !== reading.bias)
        problems.push(`${where}: bias differs from the envelope's`);
    }
    return problems;
  }

  async writeCycle(write: CycleWrite): Promise<WriteSummary> {
    const problems = this.problems(write);
    if (problems.length > 0) throw new CycleWriteRefused(problems);

    const { result, slot, symbol, evaluatedAt } = write;
    const rows = result.results.map((reading) => ({
      symbol,
      cycle_slot: slot,
      mcd_id: reading.mcd_id,
      flag: reading.flag,
      evaluator_version: reading.evaluator_version,
      status: reading.status,
      state_code: reading.state_code,
      bias: reading.bias,
      envelope_json: reading.envelope_json,
      envelope: JSON.parse(reading.envelope_json) as Prisma.InputJsonValue,
      envelope_sha256: reading.envelope_sha256,
      evaluator_envelope_sha256: reading.evaluator_envelope_sha256,
      inputs_sha256: result.inputs_sha256,
      inherited_reasons: reading.inherited_reasons,
      guard_problems: reading.guard_problems,
      retuning_observed: result.retuning.observed,
      retuning_applied: result.retuning.applied,
      runner_version: result.runner_version,
      python_version: result.runtime.python,
      duration_ms: result.runtime.timings_ms[reading.mcd_id],
      evaluated_at: evaluatedAt,
    }));

    const text = result.bundle_canonical_json;
    const inputs =
      text === null || result.inputs_sha256 === null
        ? []
        : [
            {
              symbol,
              cycle_slot: slot,
              bundle_gz: gzipSync(Buffer.from(text, 'utf8')),
              bundle_encoding: 'gzip',
              bundle_bytes: Buffer.byteLength(text, 'utf8'),
              inputs_sha256: result.inputs_sha256,
              retuning_observed: result.retuning.observed,
            },
          ];
    const cutoff = evaluatedAt - INPUTS_RETENTION_DAYS * DAY_SECONDS;

    // One transaction: the three statements commit together or not at all.
    const [written, stored, deleted] = await this.prisma.$transaction([
      this.prisma.mcdOutput.createMany({ data: rows, skipDuplicates: true }),
      this.prisma.marketCycleInput.createMany({
        data: inputs as Prisma.MarketCycleInputCreateManyInput[],
        skipDuplicates: true,
      }),
      this.prisma.marketCycleInput.deleteMany({
        where: { cycle_slot: { lt: cutoff } },
      }),
    ]);

    return {
      outputsInserted: written.count,
      outputsExisting: rows.length - written.count,
      inputsInserted: stored.count > 0,
      inputsDeleted: deleted.count,
    };
  }
}
