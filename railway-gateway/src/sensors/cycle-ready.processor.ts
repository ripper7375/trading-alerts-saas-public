import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { READER_SYMBOL } from '../cycle/read/read-types';
import { isSlot } from '../cycle/slot';
import { CYCLE_READY_JOB, CYCLE_READY_QUEUE } from '../worker/cycle-queues';
import type { CycleReadyJobData } from '../worker/cycle-manifest.service';
import type { CycleInputsBundle } from './inputs/bundle-types';
import type { InputsSource } from './inputs/inputs-source';
import { RunnerError } from './cycle-run-result';
import { CYCLE_RUNNER, type CycleRunner } from './python-runner';
import {
  CycleWriteRefused,
  McdOutputsWriter,
  type WriteSummary,
} from './mcd-outputs.writer';
import { SENSOR_CONFIG, type SensorConfig } from './sensor-config';
import { staleBundle } from './stale-bundle';

/** Where the processor gets the inputs of a cycle: the database source in production, a stored bundle in tests. */
export const INPUTS_SOURCE = 'INPUTS_SOURCE';

/**
 * What the sensor worker did with one `cycle-ready` job. Bull keeps it as the completed job's
 * return value (the last 100 jobs, `LANE_JOB_OPTIONS`), which is where a skipped job is recorded.
 */
export type SensorJobOutcome =
  | ({
      outcome: 'WRITTEN';
      slot: number;
      /** `INPUTS`: the cycle was read. The STALE bases: it could not be, and every enabled MCD answered STALE (rule 7). */
      basis: 'INPUTS' | 'STALE_CYCLE_NOT_READY' | 'STALE_INVALID_CYCLE_ROW';
      /** The reading of each MCD written, by id. */
      statuses: Record<string, string>;
      wallMs: number;
    } & WriteSummary)
  | {
      /** The job was older than the bound (Q11): nothing was read and nothing was written. */
      outcome: 'SKIPPED_OLD';
      slot: number;
      ageSeconds: number;
      maxAgeSeconds: number;
    }
  | {
      /** The runner ran and every MCD is `off`: no reading exists, so nothing is written (not even the bundle). */
      outcome: 'NOTHING_ENABLED';
      slot: number;
    };

/** The READY row was not there yet. Thrown on purpose: Bull retries the job with its back-off (`LANE_JOB_OPTIONS`). */
export class CycleNotReadyError extends Error {
  constructor(slot: number, detail: string) {
    super(`CYCLE_NOT_READY ${slot}: ${detail}`);
    this.name = 'CycleNotReadyError';
  }
}

/**
 * The consumer of the `cycle-ready` queue (ADR-016): the one place a cycle's inputs are read,
 * handed to the Python runner and written. It is a provider ONLY of the dynamic `SensorsModule`
 * when `SENSOR_WORKER_ENABLED=true`: while the worker is disabled this class is not registered
 * anywhere, so the jobs wait in Redis exactly as they did before this part existed.
 *
 * One job, in this order:
 *
 *   1. Too old (Q11). A job announced more than `maxJobAgeSeconds` ago is SKIPPED and recorded:
 *      the indicator columns are refit by later cycles, so a late read would give a reading the
 *      cycle never had. This is also what drains the backlog that built up before the worker
 *      existed (about 288 jobs a day), without evaluating any of it.
 *   2. Load. No READY row yet (`CYCLE_NOT_READY`: the job is announced just before the row
 *      commits): the job fails on purpose and Bull retries it with its exponential back-off; on the
 *      last attempt the cycle is written as STALE. A row that cannot be trusted
 *      (`INVALID_CYCLE_ROW`) will not mend by waiting: STALE at once.
 *   3. Run the Python runner, then write every reading of the cycle in one transaction
 *      (`McdOutputsWriter`). A cycle that is delivered twice writes nothing the second time.
 *
 * A runner that gave no answer, or a cycle the writer refuses, fails the job and writes nothing:
 * no reading is invented. When the failure would be the same on every attempt, the job is
 * discarded so Bull does not repeat it.
 */
@Processor(CYCLE_READY_QUEUE)
export class CycleReadyProcessor {
  private readonly logger = new Logger(CycleReadyProcessor.name);

  constructor(
    @Inject(INPUTS_SOURCE) private readonly source: InputsSource,
    @Inject(CYCLE_RUNNER) private readonly runner: CycleRunner,
    private readonly writer: McdOutputsWriter,
    @Inject(SENSOR_CONFIG) private readonly config: SensorConfig
  ) {}

  // Concurrency 1: one cycle at a time, and one Python process at a time (the cycle budget is 30 s
  // and a slot comes every 300).
  @Process({ name: CYCLE_READY_JOB, concurrency: 1 })
  process(job: Job<CycleReadyJobData>): Promise<SensorJobOutcome> {
    return this.handle(job);
  }

  @OnQueueFailed()
  onFailed(job: Job<CycleReadyJobData>, error: Error): void {
    const slot = (job.data as Partial<CycleReadyJobData> | undefined)?.slot;
    if (error instanceof CycleNotReadyError) {
      this.logger.warn(
        `Job ${job.id} (slot ${String(slot)}) will be retried: ${error.message}`
      );
      return;
    }
    this.logger.error(
      `Job ${job.id} (slot ${String(slot)}) failed after attempt ${job.attemptsMade}: ${error.message}`
    );
  }

  /** `nowSec` is injectable so a spec can set the clock. */
  async handle(
    job: Job<CycleReadyJobData>,
    nowSec: number = Math.floor(Date.now() / 1000)
  ): Promise<SensorJobOutcome> {
    const data = this.checkedData(job);

    const ageSeconds = nowSec - data.readyAt;
    if (ageSeconds > this.config.maxJobAgeSeconds) {
      this.logger.warn(
        `Slot ${data.slot} skipped: announced ${ageSeconds} s ago, the limit is ${this.config.maxJobAgeSeconds} s`
      );
      return {
        outcome: 'SKIPPED_OLD',
        slot: data.slot,
        ageSeconds,
        maxAgeSeconds: this.config.maxJobAgeSeconds,
      };
    }

    const loaded = await this.source.loadCycleInputs(data.symbol, data.slot);
    if (loaded.status === 'NOT_READY') {
      if (loaded.reason === 'CYCLE_NOT_READY') {
        if (this.attemptsLeft(job)) {
          throw new CycleNotReadyError(data.slot, loaded.detail);
        }
        this.logger.warn(
          `Slot ${data.slot}: no READY cycle after ${job.attemptsMade + 1} attempts (${loaded.detail}); every reading is STALE`
        );
        return this.evaluate(
          job,
          data,
          staleBundle(data.symbol, data.slot, data.retuning),
          'STALE_CYCLE_NOT_READY',
          nowSec
        );
      }
      this.logger.warn(
        `Slot ${data.slot}: ${loaded.detail}; every reading is STALE`
      );
      return this.evaluate(
        job,
        data,
        staleBundle(data.symbol, data.slot, data.retuning),
        'STALE_INVALID_CYCLE_ROW',
        nowSec
      );
    }

    if (loaded.provenance.retuning !== data.retuning) {
      this.logger.warn(
        `Slot ${data.slot}: the job says retuning=${data.retuning}, the READY row says ${loaded.provenance.retuning}; the row is used`
      );
    }
    return this.evaluate(job, data, loaded.bundle, 'INPUTS', nowSec);
  }

  private async evaluate(
    job: Job<CycleReadyJobData>,
    data: CycleReadyJobData,
    bundle: CycleInputsBundle,
    basis: Extract<SensorJobOutcome, { outcome: 'WRITTEN' }>['basis'],
    nowSec: number
  ): Promise<SensorJobOutcome> {
    try {
      const output = await this.runner.run({
        bundle,
        retuningEnforced: this.config.retuningEnforced,
      });
      const lines = output.stderr.trim();
      if (lines !== '') {
        // the runner logs evaluator errors and guard failures here: a cycle with none is silent
        this.logger.warn(
          `Slot ${data.slot}: runner log: ${lines.slice(0, 2000)}`
        );
      }
      const { result } = output;
      if (result.results.length === 0) {
        this.logger.log(
          `Slot ${data.slot}: every MCD is off in the worker configuration; nothing written`
        );
        return { outcome: 'NOTHING_ENABLED', slot: data.slot };
      }
      const summary = await this.writer.writeCycle({
        symbol: data.symbol,
        slot: data.slot,
        result,
        evaluatedAt: nowSec,
      });
      const statuses = Object.fromEntries(
        result.results.map((reading) => [reading.mcd_id, reading.status])
      );
      this.logger.log(
        `Slot ${data.slot} written (${basis}): ${Object.entries(statuses)
          .map(([id, status]) => `${id} ${status}`)
          .join(
            ', '
          )}; ${summary.outputsInserted} new, ${summary.outputsExisting} already there, ${output.wallMs} ms`
      );
      return {
        outcome: 'WRITTEN',
        slot: data.slot,
        basis,
        statuses,
        wallMs: output.wallMs,
        ...summary,
      };
    } catch (error) {
      if (
        (error instanceof RunnerError && !error.retryable) ||
        error instanceof CycleWriteRefused
      ) {
        // the same bundle fails the same way: do not run it again
        job.discard();
      }
      throw error;
    }
  }

  /** More attempts remain after this one (Bull counts the attempts already made). */
  private attemptsLeft(job: Job<CycleReadyJobData>): boolean {
    return (job.attemptsMade ?? 0) + 1 < (job.opts?.attempts ?? 1);
  }

  /** The job payload as the manifest service wrote it, or a discarded failure: a malformed job is a bug upstream and no retry mends it. */
  private checkedData(job: Job<CycleReadyJobData>): CycleReadyJobData {
    const data = job.data as Partial<CycleReadyJobData> | null | undefined;
    const problems: string[] = [];
    if (data === null || typeof data !== 'object') {
      problems.push('the job data is not an object');
    } else {
      if (data.symbol !== READER_SYMBOL)
        problems.push(`symbol must be ${READER_SYMBOL}`);
      if (
        typeof data.slot !== 'number' ||
        !Number.isInteger(data.slot) ||
        !isSlot(data.slot)
      )
        problems.push('slot must be a unix time on a 5-minute boundary');
      if (typeof data.readyAt !== 'number' || !Number.isFinite(data.readyAt))
        problems.push('readyAt must be a number');
      if (typeof data.retuning !== 'boolean')
        problems.push('retuning must be a boolean');
    }
    if (problems.length > 0) {
      job.discard();
      throw new Error(`malformed cycle-ready job: ${problems.join('; ')}`);
    }
    return data as CycleReadyJobData;
  }
}
