import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { gzipSync } from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import type { CycleRunResult } from './cycle-run-result';
import { EnvelopeValidator } from './envelope-validator';
import { slotToIso } from './inputs/stats-slot';
import type { SynthesisRefusal } from './synthesis-rows';
import { SynthesisWriter } from './synthesis.writer';
import { SynReadingValidator } from './syn-validator';

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
 * The cycle's SYN rows (build step 4 part 5: `synthesis_readings` and `entry_zones`) join the SAME transaction when the
 * result has a `synthesis` section, and only after `SynthesisWriter` has judged them (decision 3 of the part 4 hand-off,
 * option (a)): the database would refuse a row that breaks one of its 25 CHECKs and that would undo the sensors' rows
 * too, so a SYN row it cannot vouch for is left out, logged, and never offered to the transaction. With the `SYN` flag
 * `off` the transaction is exactly what it was before synthesis existed: three statements.
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
  /** Present only when the result had a `synthesis` section (the `SYN` flag was `shadow` or `live`). */
  synthesis?: SynthesisSummary;
}

/** What this call did with the cycle's SYN rows. */
export interface SynthesisSummary {
  /** Rows of `synthesis_readings` this call added (at most one per trader type). */
  readingsInserted: number;
  /** Readings that were ready to write and were already there (a re-delivery). */
  readingsExisting: number;
  /** Rows of `entry_zones` this call added, and those already there. */
  zonesInserted: number;
  zonesExisting: number;
  /** The profiles left out and why (each was also logged as SYN_READING_REFUSED). */
  refused: SynthesisRefusal[];
  /**
   * Why there are no SYN rows when the whole section failed: the engine's `SYNTHESIS_ERROR` (it raised), or the gateway's
   * `SYN_TABLES_MISSING` (the migration of the two tables is not applied, so the SYN rows were not offered to the transaction
   * and the sensors' rows were written as usual). Null otherwise.
   */
  error: string | null;
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

/** The gateway's own word for "the two SYN tables are not there" (see `McdOutputsWriter.synthesisTablesReady`). */
export const SYN_TABLES_MISSING = 'SYN_TABLES_MISSING';

@Injectable()
export class McdOutputsWriter {
  private readonly logger = new Logger(McdOutputsWriter.name);
  /** True once the two SYN tables have been seen; never reset (a table does not disappear under a running gateway). */
  private synthesisTablesSeen = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: EnvelopeValidator,
    // Registered in the module; the default is for a spec that builds the writer by hand with the first two.
    private readonly synthesis: SynthesisWriter = new SynthesisWriter(
      new SynReadingValidator()
    )
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

  /**
   * Whether `synthesis_readings` and `entry_zones` exist. A statement on a missing table fails the whole transaction and takes the
   * sensors' rows with it, and the migration that creates them is applied by a person, so a gateway deployed (or a `SYN` flag turned
   * on) before it would lose every cycle. One cheap catalogue query, asked only when there are SYN rows to write and only until the
   * answer is yes. A query that fails is a no: the SYN rows are left out and the sensors are written.
   */
  private async synthesisTablesReady(): Promise<boolean> {
    if (this.synthesisTablesSeen) return true;
    try {
      const found = await this.prisma.$queryRaw<
        Array<{ ready: boolean }>
      >`SELECT (to_regclass('synthesis_readings') IS NOT NULL AND to_regclass('entry_zones') IS NOT NULL) AS ready`;
      this.synthesisTablesSeen = found[0]?.ready === true;
    } catch (error) {
      this.logger.error(
        `SYN_TABLES_CHECK_FAILED could not ask whether the SYN tables exist: ${(error as Error).message}`
      );
    }
    return this.synthesisTablesSeen;
  }

  async writeCycle(write: CycleWrite): Promise<WriteSummary> {
    const problems = this.problems(write);
    if (problems.length > 0) throw new CycleWriteRefused(problems);

    const { result, slot, symbol, evaluatedAt } = write;
    // Judged BEFORE the transaction; never throws; logs what it leaves out.
    let syn = this.synthesis.prepare(write);
    if (syn.readings.length > 0 && !(await this.synthesisTablesReady())) {
      this.logger.error(
        `Slot ${slot}: ${SYN_TABLES_MISSING} the tables synthesis_readings and entry_zones are not there (migration 20261004000000_add_synthesis_tables is not applied); no SYN rows written, the sensors' rows are unaffected`
      );
      syn = { ...syn, readings: [], zones: [], error: SYN_TABLES_MISSING };
    }
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

    // One transaction: the statements commit together or not at all. The three of the sensors come first and are
    // the only ones with the SYN flag off; the SYN statements are appended when there is something to write.
    const statements = [
      this.prisma.mcdOutput.createMany({ data: rows, skipDuplicates: true }),
      this.prisma.marketCycleInput.createMany({
        data: inputs as Prisma.MarketCycleInputCreateManyInput[],
        skipDuplicates: true,
      }),
      this.prisma.marketCycleInput.deleteMany({
        where: { cycle_slot: { lt: cutoff } },
      }),
      ...(syn.readings.length > 0
        ? [
            this.prisma.synthesisReading.createMany({
              data: syn.readings as Prisma.SynthesisReadingCreateManyInput[],
              skipDuplicates: true,
            }),
          ]
        : []),
      ...(syn.zones.length > 0
        ? [
            this.prisma.entryZone.createMany({
              data: syn.zones as Prisma.EntryZoneCreateManyInput[],
              skipDuplicates: true,
            }),
          ]
        : []),
    ];
    const counts = await this.prisma.$transaction(statements);
    const [written, stored, deleted] = counts;
    let next = 3;
    const readingsInserted = syn.readings.length > 0 ? counts[next++].count : 0;
    const zonesInserted = syn.zones.length > 0 ? counts[next++].count : 0;

    return {
      outputsInserted: written.count,
      outputsExisting: rows.length - written.count,
      inputsInserted: stored.count > 0,
      inputsDeleted: deleted.count,
      ...(syn.ran
        ? {
            synthesis: {
              readingsInserted,
              readingsExisting: syn.readings.length - readingsInserted,
              zonesInserted,
              zonesExisting: syn.zones.length - zonesInserted,
              refused: syn.refused,
              error: syn.error,
            },
          }
        : {}),
    };
  }
}
