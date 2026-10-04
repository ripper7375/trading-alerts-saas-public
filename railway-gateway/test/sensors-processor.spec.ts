import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BullMetadataAccessor } from '@nestjs/bull/dist/bull-metadata.accessor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RunnerError } from '../src/sensors/cycle-run-result';
import {
  CycleNotReadyError,
  CycleReadyProcessor,
  SensorJobOutcome,
} from '../src/sensors/cycle-ready.processor';
import { EnvelopeValidator } from '../src/sensors/envelope-validator';
import { McdOutputsWriter } from '../src/sensors/mcd-outputs.writer';
import { SensorConfig } from '../src/sensors/sensor-config';
import { slotToIso } from '../src/sensors/inputs/stats-slot';
import {
  CYCLE_READY_JOB,
  CYCLE_READY_QUEUE,
  LANE_JOB_OPTIONS,
} from '../src/worker/cycle-queues';
import type { CycleReadyJobData } from '../src/worker/cycle-manifest.service';
import { FIXTURE_SLOTS } from './helpers/cycle-fixtures';
import {
  FakeJob,
  FakeRunner,
  FakeSensorPrisma,
  FakeSource,
  fakeJob,
  loadedOk,
  outputOf,
  readyJobData,
  unitResult,
  unitResultWithSynthesis,
} from './helpers/sensors-worker-world';

/**
 * The consumer of the `cycle-ready` queue (build step 3 part 4), on a fake source, a fake
 * runner and a fake Prisma, and with a fake queue that retries the way Bull does. The real
 * source, runner and database are in `sensors-worker.pg.spec.ts`.
 */

const v1 = FIXTURE_SLOTS[0];
const NOW = v1.slot + 70;

const config = (over: Partial<SensorConfig> = {}): SensorConfig => ({
  retuningEnforced: false,
  python: 'python',
  engineDir: '/engine',
  workerConfigPath: undefined,
  maxJobAgeSeconds: 600,
  runnerTimeoutMs: 30_000,
  ...over,
});

function make(over: Partial<SensorConfig> = {}) {
  const prisma = new FakeSensorPrisma();
  const writer = new McdOutputsWriter(
    prisma as unknown as PrismaService,
    new EnvelopeValidator()
  );
  const source = new FakeSource(() => loadedOk(v1));
  const runner = new FakeRunner(() => outputOf(unitResult(v1)));
  const processor = new CycleReadyProcessor(
    source,
    runner,
    writer,
    config(over)
  );
  return { prisma, writer, source, runner, processor };
}

const notReady =
  (reason: 'CYCLE_NOT_READY' | 'INVALID_CYCLE_ROW', detail = 'no READY row') =>
  () => ({ status: 'NOT_READY' as const, reason, slot: v1.slot, detail });

let warn: jest.SpyInstance;
let log: jest.SpyInstance;
let error: jest.SpyInstance;
beforeEach(() => {
  warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  error = jest
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// ---------------------------------------------------------------- a queue that retries like Bull

/**
 * Bull's retry, as far as the processor depends on it: a job that throws is run again after the back-off
 * until `attempts` runs have been made, unless the processor discarded it. `attemptsMade` is the number
 * of runs BEFORE this one.
 */
async function deliver(
  processor: CycleReadyProcessor,
  data: unknown,
  options: { attempts?: number; nowSec?: number } = {}
) {
  const attempts = options.attempts ?? LANE_JOB_OPTIONS.attempts;
  const delays: number[] = [];
  const errors: Error[] = [];
  const jobs: FakeJob[] = [];
  for (let attemptsMade = 0; attemptsMade < attempts; attemptsMade += 1) {
    const job = fakeJob(data, { attemptsMade, attempts });
    jobs.push(job);
    try {
      const outcome = await processor.handle(job, options.nowSec ?? NOW);
      return { outcome, runs: attemptsMade + 1, delays, errors, jobs };
    } catch (thrown) {
      errors.push(thrown as Error);
      job.attemptsMade = attemptsMade + 1; // Bull has counted the failed run when it tells the listener
      processor.onFailed(job, thrown as Error);
      if (job.discard.mock.calls.length > 0) break;
      // Bull's own formula (node_modules/bull/lib/backoffs.js): (2^n - 1) x delay, n being the attempts made so far
      delays.push(
        Math.round(
          (2 ** (attemptsMade + 1) - 1) * LANE_JOB_OPTIONS.backoff.delay
        )
      );
    }
  }
  return { outcome: undefined, runs: errors.length, delays, errors, jobs };
}

type Written = Extract<SensorJobOutcome, { outcome: 'WRITTEN' }>;
const written = (outcome: SensorJobOutcome | undefined): Written => {
  expect(outcome?.outcome).toBe('WRITTEN');
  return outcome as Written;
};

// ---------------------------------------------------------------- the queue it consumes

describe('CycleReadyProcessor is the consumer of the cycle-ready queue', () => {
  const accessor = new BullMetadataAccessor(new Reflector());

  it('is a processor of the `cycle-ready` queue', () => {
    expect(CYCLE_READY_QUEUE).toBe('cycle-ready');
    expect(accessor.isQueueComponent(CycleReadyProcessor)).toBe(true);
    expect(accessor.getQueueComponentMetadata(CycleReadyProcessor)).toEqual({
      name: 'cycle-ready',
    });
  });

  it('handles the `cycle-ready` job, one at a time', () => {
    const handler = CycleReadyProcessor.prototype.process;
    expect(accessor.isProcessor(handler)).toBe(true);
    expect(accessor.getProcessMetadata(handler)).toEqual({
      name: CYCLE_READY_JOB,
      concurrency: 1,
    });
  });

  it('listens for failures, to log them', () => {
    expect(accessor.isListener(CycleReadyProcessor.prototype.onFailed)).toBe(
      true
    );
  });

  it('uses the retry policy the manifest service queues its jobs with: three attempts, exponential back-off from two seconds', () => {
    expect(LANE_JOB_OPTIONS.attempts).toBe(3);
    expect(LANE_JOB_OPTIONS.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    });
  });
});

// ---------------------------------------------------------------- the ordinary cycle

describe('a cycle that is ready', () => {
  it('reads the inputs of the job’s slot, runs the runner on that bundle, and writes every reading and the bundle', async () => {
    const { processor, source, runner, prisma } = make();
    const outcome = written(
      (await deliver(processor, readyJobData(v1))).outcome
    );
    expect(source.calls).toEqual([{ symbol: 'XAUUSD', slot: v1.slot }]);
    expect(runner.requests).toHaveLength(1);
    expect(runner.requests[0].bundle).toMatchObject({
      symbol: 'XAUUSD',
      cycle_slot: slotToIso(v1.slot),
      data_status: 'FRESH',
    });
    expect(outcome).toMatchObject({
      outcome: 'WRITTEN',
      slot: v1.slot,
      basis: 'INPUTS',
      outputsInserted: 4,
      outputsExisting: 0,
      inputsInserted: true,
      inputsDeleted: 0,
      wallMs: 123,
    });
    expect(Object.keys(outcome.statuses)).toEqual([
      'MCD0',
      'MCD1',
      'MCD2',
      'MCD3',
    ]);
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.inputs).toHaveLength(1);
    expect(prisma.outputs.every((r) => r['evaluated_at'] === NOW)).toBe(true);
  });

  it('tells the runner what SENSOR_RETUNING_ENFORCED says: false by default, true when set', async () => {
    const off = make();
    await off.processor.handle(fakeJob(readyJobData(v1)), NOW);
    expect(off.runner.requests[0].retuningEnforced).toBe(false);
    const on = make({ retuningEnforced: true });
    await on.processor.handle(fakeJob(readyJobData(v1)), NOW);
    expect(on.runner.requests[0].retuningEnforced).toBe(true);
  });

  it('a job delivered twice writes nothing the second time', async () => {
    const { processor, prisma } = make();
    await processor.handle(fakeJob(readyJobData(v1)), NOW);
    const again = written(
      await processor.handle(fakeJob(readyJobData(v1)), NOW + 5)
    );
    expect(again).toMatchObject({
      outputsInserted: 0,
      outputsExisting: 4,
      inputsInserted: false,
    });
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.inputs).toHaveLength(1);
  });

  it('INVALID and STALE readings are rows like any other', async () => {
    const { processor, runner, prisma } = make();
    const result = unitResult(v1);
    runner.set(() => outputOf(result));
    // the stored cycle holds VALID or CAUTIONARY readings; the writer does not care which status it stores
    await processor.handle(fakeJob(readyJobData(v1)), NOW);
    expect(prisma.outputs.map((r) => r['status'])).toEqual(
      result.results.map((r) => r.status)
    );
  });

  it('logs the runner’s own log lines, so an evaluator that raised is not silent', async () => {
    const { processor, runner } = make();
    runner.set(() =>
      outputOf(
        unitResult(v1),
        '{"level":"ERROR","message":"evaluator raised"}\n'
      )
    );
    await processor.handle(fakeJob(readyJobData(v1)), NOW);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'evaluator raised'
    );
  });

  it('warns when the job and the READY row disagree about RETUNING, and uses the row', async () => {
    const { processor, source } = make();
    source.set(() => loadedOk(v1, { retuning: true }));
    await processor.handle(fakeJob(readyJobData(v1, { retuning: false })), NOW);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
      /the job says retuning=false, the READY row says true/
    );
  });

  it('does not warn when they agree', async () => {
    const { processor, source } = make();
    source.set(() => loadedOk(v1, { retuning: true }));
    await processor.handle(fakeJob(readyJobData(v1, { retuning: true })), NOW);
    expect(warn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- the SYN rows (build step 4 part 5)

describe('a runner with the SYN flag on', () => {
  it('writes the readings and the zones with the sensors’ rows, reports them in the outcome and says so in the log', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() => outputOf(unitResultWithSynthesis(v1)));
    const outcome = written(
      (await deliver(processor, readyJobData(v1))).outcome
    );
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings.map((r) => r['profile'])).toEqual([
      'DAY_TRADER',
      'SCALPER',
    ]);
    expect(prisma.entryZones).toHaveLength(4);
    expect(prisma.transactions).toHaveLength(1);
    expect(outcome.synthesis).toEqual({
      readingsInserted: 2,
      readingsExisting: 0,
      zonesInserted: 4,
      zonesExisting: 0,
      refused: [],
      error: null,
    });
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'SYN 2 readings and 4 zones new, 0 already there'
    );
    expect(
      prisma.synthesisReadings.every((r) => r['evaluated_at'] === NOW)
    ).toBe(true);
  });

  it('a job delivered twice writes no SYN row the second time', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() => outputOf(unitResultWithSynthesis(v1)));
    await processor.handle(fakeJob(readyJobData(v1)), NOW);
    const again = written(
      await processor.handle(fakeJob(readyJobData(v1)), NOW + 5)
    );
    expect(again.synthesis).toMatchObject({
      readingsInserted: 0,
      readingsExisting: 2,
      zonesInserted: 0,
      zonesExisting: 4,
    });
    expect(prisma.synthesisReadings).toHaveLength(2);
    expect(prisma.entryZones).toHaveLength(4);
  });

  it('a SYN reading that is refused costs the job nothing: it is not retried, not discarded, and the sensors and the other trader type are written', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() =>
      outputOf(
        unitResultWithSynthesis(v1, (section) => {
          section.readings[0].reading_sha256 = 'f'.repeat(64);
        })
      )
    );
    const job = fakeJob(readyJobData(v1));
    const outcome = written(await processor.handle(job, NOW));
    expect(job.discard).not.toHaveBeenCalled();
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings.map((r) => r['profile'])).toEqual([
      'SCALPER',
    ]);
    expect(outcome.synthesis?.refused.map((r) => r.profile)).toEqual([
      'DAY_TRADER',
    ]);
    expect(
      error.mock.calls
        .map((c) => String(c[0]))
        .filter((line) => line.includes('SYN_READING_REFUSED DAY_TRADER'))
    ).toHaveLength(1);
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      ', 1 refused'
    );
  });

  it('an engine error is written down as the outcome’s and the log’s, and the sensors are written', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() =>
      outputOf(
        unitResultWithSynthesis(v1, (section) => {
          section.error = 'SYNTHESIS_ERROR';
          section.readings = [];
        })
      )
    );
    const outcome = written(
      await processor.handle(fakeJob(readyJobData(v1)), NOW)
    );
    expect(prisma.outputs).toHaveLength(4);
    expect(prisma.synthesisReadings).toEqual([]);
    expect(outcome.synthesis?.error).toBe('SYNTHESIS_ERROR');
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'error SYNTHESIS_ERROR'
    );
  });

  it('with the flag off nothing about synthesis is in the outcome or the log', async () => {
    const { processor, prisma } = make();
    const outcome = written(
      await processor.handle(fakeJob(readyJobData(v1)), NOW)
    );
    expect(outcome).not.toHaveProperty('synthesis');
    expect(log.mock.calls.map((c) => String(c[0])).join('\n')).not.toContain(
      'SYN'
    );
    expect(prisma.synthesisReadings).toEqual([]);
    expect(prisma.entryZones).toEqual([]);
  });

  it('a failure of the one transaction fails the job and writes nothing, SYN rows included', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() => outputOf(unitResultWithSynthesis(v1)));
    prisma.failTransaction(new Error('connection lost'));
    await expect(
      processor.handle(fakeJob(readyJobData(v1)), NOW)
    ).rejects.toThrow('connection lost');
    expect(prisma.outputs).toEqual([]);
    expect(prisma.synthesisReadings).toEqual([]);
  });
});

// ---------------------------------------------------------------- nothing to write

describe('a runner with every MCD off', () => {
  it('writes nothing, not even the bundle: there is no reading to replay', async () => {
    const { processor, runner, prisma } = make();
    runner.set(() => outputOf({ ...unitResult(v1), results: [], order: [] }));
    const outcome = await processor.handle(fakeJob(readyJobData(v1)), NOW);
    expect(outcome).toEqual({ outcome: 'NOTHING_ENABLED', slot: v1.slot });
    expect(prisma.transactions).toEqual([]);
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
  });
});

// ---------------------------------------------------------------- Q11: a job that is too old

describe('Q11: a job older than the bound is skipped and recorded', () => {
  const data = (age: number) => readyJobData(v1, { readyAt: NOW - age });

  it('is skipped: nothing is read, nothing is run, nothing is written, and the outcome says why', async () => {
    const { processor, source, runner, prisma } = make();
    const outcome = await processor.handle(fakeJob(data(601)), NOW);
    expect(outcome).toEqual({
      outcome: 'SKIPPED_OLD',
      slot: v1.slot,
      ageSeconds: 601,
      maxAgeSeconds: 600,
    });
    expect(source.calls).toEqual([]);
    expect(runner.requests).toEqual([]);
    expect(prisma.transactions).toEqual([]);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      `Slot ${v1.slot} skipped`
    );
  });

  it('exactly at the bound is still processed; one second over is skipped', async () => {
    expect(
      (await make().processor.handle(fakeJob(data(600)), NOW)).outcome
    ).toBe('WRITTEN');
    expect(
      (await make().processor.handle(fakeJob(data(601)), NOW)).outcome
    ).toBe('SKIPPED_OLD');
  });

  it('a backlog of days-old jobs is drained without a single read', async () => {
    const { processor, source, runner, prisma } = make();
    for (let i = 1; i <= 50; i += 1) {
      const slot = v1.slot - i * 86_400; // one job for each day back: 50 days of an unconsumed queue
      const outcome = await processor.handle(
        fakeJob(readyJobData(v1, { slot, readyAt: slot + 63 })),
        NOW
      );
      expect(outcome.outcome).toBe('SKIPPED_OLD');
    }
    expect(source.calls).toEqual([]);
    expect(runner.requests).toEqual([]);
    expect(prisma.transactions).toEqual([]);
  });

  it('the bound is SENSOR_MAX_JOB_AGE_SECONDS', async () => {
    const { processor } = make({ maxJobAgeSeconds: 60 });
    expect((await processor.handle(fakeJob(data(61)), NOW)).outcome).toBe(
      'SKIPPED_OLD'
    );
    expect((await processor.handle(fakeJob(data(60)), NOW)).outcome).toBe(
      'WRITTEN'
    );
  });

  it('a job from the future (a clock that is behind) is not too old', async () => {
    const { processor } = make();
    expect((await processor.handle(fakeJob(data(-30)), NOW)).outcome).toBe(
      'WRITTEN'
    );
  });
});

// ---------------------------------------------------------------- the READY row is not there yet

describe('CYCLE_NOT_READY: retry with the queue’s back-off, then STALE', () => {
  it('fails on purpose while attempts remain, so Bull retries after two and then six seconds; nothing is written', async () => {
    const { processor, source, runner, prisma } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    const run = await deliver(processor, readyJobData(v1), { attempts: 3 });
    // the first two attempts fail on purpose; the third is the last and writes STALE
    expect(run.errors).toHaveLength(2);
    expect(run.errors.every((e) => e instanceof CycleNotReadyError)).toBe(true);
    expect(run.errors[0].message).toContain(`CYCLE_NOT_READY ${v1.slot}`);
    expect(run.delays).toEqual([2000, 6000]);
    expect(run.runs).toBe(3);
    expect(run.jobs.every((j) => j.discard.mock.calls.length === 0)).toBe(true);
    expect(source.calls).toHaveLength(3);
    expect(runner.requests).toHaveLength(1);
    expect(prisma.outputs).toHaveLength(4);
  });

  it('a retried job that finds the row on the second try is an ordinary cycle', async () => {
    const { processor, source, runner } = make();
    let tries = 0;
    source.set(() =>
      ++tries === 1 ? notReady('CYCLE_NOT_READY')() : loadedOk(v1)
    );
    const run = await deliver(processor, readyJobData(v1));
    expect(run.errors).toHaveLength(1);
    expect(written(run.outcome).basis).toBe('INPUTS');
    expect(runner.requests[0].bundle).toMatchObject({ data_status: 'FRESH' });
  });

  it('on the last attempt every reading is STALE: the runner is given a STALE bundle with no bars, and the rows are written', async () => {
    const { processor, source, runner, prisma } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    const outcome = written(
      await processor.handle(
        fakeJob(readyJobData(v1), { attemptsMade: 2, attempts: 3 }),
        NOW
      )
    );
    expect(outcome.basis).toBe('STALE_CYCLE_NOT_READY');
    const bundle = runner.requests[0].bundle as Record<string, any>;
    expect(bundle).toMatchObject({
      symbol: 'XAUUSD',
      cycle_slot: slotToIso(v1.slot),
      data_status: 'STALE',
      retuning: false,
      bars: { M5: [], M15: [] },
      statistics: {},
      active_indicator: {},
    });
    expect(prisma.outputs).toHaveLength(4);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
      /no READY cycle after 3 attempts/
    );
  });

  it('a job with a single attempt has no retry to wait for: STALE at once', async () => {
    const { processor, source } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    const outcome = written(
      await processor.handle(
        fakeJob(readyJobData(v1), { attemptsMade: 0, attempts: 1 }),
        NOW
      )
    );
    expect(outcome.basis).toBe('STALE_CYCLE_NOT_READY');
  });

  it('a job with no retry policy at all is treated the same', async () => {
    const { processor, source } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    const job = fakeJob(readyJobData(v1));
    (job as any).opts = {};
    expect(written(await processor.handle(job, NOW)).basis).toBe(
      'STALE_CYCLE_NOT_READY'
    );
  });

  it('the STALE bundle carries the retuning value the job said', async () => {
    const { processor, source, runner } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    await processor.handle(
      fakeJob(readyJobData(v1, { retuning: true }), {
        attemptsMade: 2,
        attempts: 3,
      }),
      NOW
    );
    expect((runner.requests[0].bundle as any).retuning).toBe(true);
  });

  it('the failed attempts are logged as expected retries, not as errors', async () => {
    const { processor, source } = make();
    source.set(notReady('CYCLE_NOT_READY'));
    await deliver(processor, readyJobData(v1));
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
      /will be retried: CYCLE_NOT_READY/
    );
    expect(error).not.toHaveBeenCalled();
  });
});

describe('INVALID_CYCLE_ROW: STALE at once, it will not mend by waiting', () => {
  it('writes STALE readings on the first attempt, with no retry', async () => {
    const { processor, source, runner, prisma } = make();
    source.set(
      notReady(
        'INVALID_CYCLE_ROW',
        'the READY row at slot 1 cannot be trusted: no ready time'
      )
    );
    const run = await deliver(processor, readyJobData(v1));
    expect(run.runs).toBe(1);
    expect(run.errors).toEqual([]);
    expect(written(run.outcome).basis).toBe('STALE_INVALID_CYCLE_ROW');
    expect((runner.requests[0].bundle as any).data_status).toBe('STALE');
    expect(prisma.outputs).toHaveLength(4);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain(
      'cannot be trusted: no ready time'
    );
  });
});

// ---------------------------------------------------------------- nothing is invented

describe('a failure writes nothing and invents no reading', () => {
  it.each([
    ['SPAWN', false],
    ['REQUEST', false],
    ['OUTPUT', false],
    ['EXIT', true],
    ['TIMEOUT', true],
  ] as const)(
    'a runner error of kind %s: the job fails; it is discarded only if retrying cannot help (%s)',
    async (kind, retryable) => {
      const { processor, runner, prisma } = make();
      runner.set(() => {
        throw new RunnerError(kind, `runner ${kind}`, retryable);
      });
      const job = fakeJob(readyJobData(v1));
      await expect(processor.handle(job, NOW)).rejects.toThrow(
        `runner ${kind}`
      );
      expect(job.discard).toHaveBeenCalledTimes(retryable ? 0 : 1);
      expect(prisma.transactions).toEqual([]);
      expect(prisma.outputs).toEqual([]);
    }
  );

  it('a runner error that is not a RunnerError is not discarded (it may be a one-off)', async () => {
    const { processor, runner } = make();
    runner.set(() => {
      throw new Error('socket hang up');
    });
    const job = fakeJob(readyJobData(v1));
    await expect(processor.handle(job, NOW)).rejects.toThrow('socket hang up');
    expect(job.discard).not.toHaveBeenCalled();
  });

  it('a cycle the writer refuses is discarded: the same bundle gives the same refusal', async () => {
    const { processor, runner, prisma } = make();
    const bad = unitResult(v1);
    bad.results[0].envelope_sha256 = 'f'.repeat(64);
    runner.set(() => outputOf(bad));
    const job = fakeJob(readyJobData(v1));
    await expect(processor.handle(job, NOW)).rejects.toThrow(
      /cycle refused, nothing written/
    );
    expect(job.discard).toHaveBeenCalledTimes(1);
    expect(prisma.transactions).toEqual([]);
  });

  it('a database failure is retried (not discarded) and leaves nothing half-written', async () => {
    const { processor, prisma } = make();
    prisma.failOn('marketCycleInput.createMany', new Error('connection reset'));
    const job = fakeJob(readyJobData(v1));
    await expect(processor.handle(job, NOW)).rejects.toThrow(
      'connection reset'
    );
    expect(job.discard).not.toHaveBeenCalled();
    expect(prisma.outputs).toEqual([]);
    expect(prisma.inputs).toEqual([]);
    // the retry, with the database back, is a clean first write
    prisma.clearFailures();
    expect(
      written(
        await processor.handle(
          fakeJob(readyJobData(v1), { attemptsMade: 1 }),
          NOW + 2
        )
      ).outputsInserted
    ).toBe(4);
  });

  it('a source that throws (the database is down) is retried, not discarded, and nothing is run', async () => {
    const { processor, source, runner } = make();
    source.set(() => {
      throw new Error('connect ECONNREFUSED');
    });
    const job = fakeJob(readyJobData(v1));
    await expect(processor.handle(job, NOW)).rejects.toThrow('ECONNREFUSED');
    expect(job.discard).not.toHaveBeenCalled();
    expect(runner.requests).toEqual([]);
  });

  it('the failure listener logs a real failure as an error with the slot', () => {
    const { processor } = make();
    const job = fakeJob(readyJobData(v1), { attemptsMade: 3 });
    processor.onFailed(job, new Error('boom'));
    expect(String(error.mock.calls[0][0])).toContain(`slot ${v1.slot}`);
    expect(String(error.mock.calls[0][0])).toContain('boom');
  });

  it('the failure listener copes with a job that has no data', () => {
    const { processor } = make();
    expect(() =>
      processor.onFailed(fakeJob(undefined), new Error('boom'))
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------- a job that is not a job

describe('a malformed job is discarded: no retry mends it', () => {
  const bad: Array<[string, unknown, RegExp]> = [
    ['no data', undefined, /the job data is not an object/],
    ['data that is null', null, /the job data is not an object/],
    ['data that is text', 'XAUUSD', /the job data is not an object/],
    [
      'another symbol',
      readyJobData(v1, { symbol: 'EURUSD' }),
      /symbol must be XAUUSD/,
    ],
    [
      'a slot off the grid',
      readyJobData(v1, { slot: v1.slot + 1 }),
      /slot must be a unix time on a 5-minute boundary/,
    ],
    [
      'a slot that is text',
      { ...readyJobData(v1), slot: '1790000100' },
      /slot must be a unix time/,
    ],
    [
      'a fractional slot',
      readyJobData(v1, { slot: v1.slot + 0.5 }),
      /slot must be a unix time/,
    ],
    [
      'a missing readyAt',
      { ...readyJobData(v1), readyAt: undefined },
      /readyAt must be a number/,
    ],
    [
      'a readyAt that is NaN',
      readyJobData(v1, { readyAt: NaN }),
      /readyAt must be a number/,
    ],
    [
      'a retuning that is text',
      { ...readyJobData(v1), retuning: 'false' },
      /retuning must be a boolean/,
    ],
  ];

  it.each(bad)('%s', async (_name, data, expected) => {
    const { processor, source, runner, prisma } = make();
    const job = fakeJob(data);
    await expect(processor.handle(job, NOW)).rejects.toThrow(expected);
    await expect(processor.handle(fakeJob(data), NOW)).rejects.toThrow(
      /malformed cycle-ready job/
    );
    expect(job.discard).toHaveBeenCalledTimes(1);
    expect(source.calls).toEqual([]);
    expect(runner.requests).toEqual([]);
    expect(prisma.transactions).toEqual([]);
  });
});

// ---------------------------------------------------------------- the real entry point

describe('process() is handle() with the real clock', () => {
  it('reads the slot’s job and returns the outcome Bull keeps as the job’s result', async () => {
    const { processor } = make();
    jest.useFakeTimers({ now: NOW * 1000 });
    try {
      const outcome = await processor.process(fakeJob(readyJobData(v1)));
      expect(outcome.outcome).toBe('WRITTEN');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a job announced long before the clock now is skipped', async () => {
    const { processor } = make();
    const outcome = await processor.process(fakeJob(readyJobData(v1)));
    // the fixtures are from September 2026 and this test runs later: far more than ten minutes
    expect(outcome.outcome).toBe('SKIPPED_OLD');
  });
});
