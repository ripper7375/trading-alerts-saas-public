import { createHash } from 'crypto';
import type { Job } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import type {
  CycleRunResult,
  McdRunResult,
  RunnerOutput,
  SynthesisRunResult,
} from '../../src/sensors/cycle-run-result';
import type { CycleReadyJobData } from '../../src/worker/cycle-manifest.service';
import type {
  InputsProvenance,
  InputsSource,
  LoadedInputs,
} from '../../src/sensors/inputs/inputs-source';
import type {
  CycleRunner,
  RunnerRequest,
} from '../../src/sensors/python-runner';
import {
  FIXTURES_DIR,
  FIXTURE_SLOTS,
  FixtureSlot,
  readFixtureBundle,
  readFixtureCycle,
} from './cycle-fixtures';

/**
 * Stand-ins for the sensor worker's unit specs (build step 3 part 4): a Bull job, a runner
 * result built from the STORED cycles (real envelopes, so the writer's checks are real), a
 * source and a runner that answer what a spec says, and a Prisma that behaves like Prisma where
 * the writer depends on it (operations are lazy and run together inside `$transaction`, which
 * undoes them all when one fails). The real runner, the real database and the real loader are
 * in the gated specs.
 */

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

// ---------------------------------------------------------------- a Bull job

export interface FakeJob extends Job<CycleReadyJobData> {
  discard: jest.Mock;
}

export function readyJobData(
  fixture: FixtureSlot,
  over: Partial<CycleReadyJobData> = {}
): CycleReadyJobData {
  return {
    symbol: 'XAUUSD',
    slot: fixture.slot,
    readyAt: fixture.slot + 63,
    attempts: 1,
    dataStatus: 'FRESH',
    closedBarsDigest: 'd'.repeat(64),
    retuning: false,
    ...over,
  };
}

/** `attemptsMade` is the number of attempts BEFORE this run (Bull's meaning); `attempts` the job's limit. */
export function fakeJob(
  data: unknown,
  {
    attemptsMade = 0,
    attempts = 3,
  }: { attemptsMade?: number; attempts?: number } = {}
): FakeJob {
  return {
    id: `job-${attemptsMade}`,
    data,
    attemptsMade,
    opts: { attempts },
    discard: jest.fn(),
  } as unknown as FakeJob;
}

// ---------------------------------------------------------------- a runner result

export const STUB_BUNDLE_TEXT = '{"stub":"the canonical bundle text"}';

/**
 * A `mcd-cycle-result/1` made from the stored cycle of a fixture: its envelopes are the real ones
 * (schema-valid, hashed), the bundle text is a stand-in (these specs do not run Python).
 */
export function unitResult(
  fixture: FixtureSlot = FIXTURE_SLOTS[0],
  over: Partial<CycleRunResult> = {}
): CycleRunResult {
  const stored = readFixtureCycle(fixture);
  const timings: Record<string, number> = {};
  stored.results.forEach((r, index) => (timings[r.mcd_id] = 1.5 + index));
  return {
    schema_version: 'mcd-cycle-result/1',
    runner_version: stored.runner_version,
    symbol: stored.symbol,
    cycle_slot: stored.cycle_slot,
    inputs_sha256: sha256(STUB_BUNDLE_TEXT),
    bundle_canonical_json: STUB_BUNDLE_TEXT,
    retuning: stored.retuning,
    flags: stored.flags,
    order: stored.order,
    gate: null,
    results: stored.results.map((r) => ({ ...r })) as McdRunResult[],
    runtime: { python: '3.11.9', timings_ms: timings },
    ...over,
  };
}

/**
 * The `synthesis` section a runner returns with `SYN` at `shadow`, as the engine stored it for a fixture
 * (`mcd_worker/fixtures/<slot>.synthesis.json`): real readings, real hashes, real zones.
 */
export function storedSynthesis(fixture: FixtureSlot): SynthesisRunResult {
  return JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES_DIR, `${fixture.stem}.synthesis.json`),
      'utf8'
    )
  );
}

/**
 * `unitResult` with the stored `synthesis` section (and a synthesis time), the result of a runner
 * whose `SYN` flag is `shadow`. `change` may damage the section before it is returned.
 */
export function unitResultWithSynthesis(
  fixture: FixtureSlot = FIXTURE_SLOTS[0],
  change: (section: SynthesisRunResult) => void = () => undefined
): CycleRunResult {
  const result = unitResult(fixture);
  const section = storedSynthesis(fixture);
  change(section);
  return {
    ...result,
    runtime: { ...result.runtime, synthesis_ms: 48.8 },
    synthesis: section,
  };
}

export const outputOf = (
  result: CycleRunResult,
  stderr = ''
): RunnerOutput => ({ result, stderr, wallMs: 123 });

// ---------------------------------------------------------------- a source and a runner

export function provenance(
  fixture: FixtureSlot,
  over: Partial<InputsProvenance> = {}
): InputsProvenance {
  return {
    origin: 'database',
    slot: fixture.slot,
    dataStatus: 'FRESH',
    retuning: false,
    statsSlot: { M5: fixture.slot, M15: fixture.slot },
    barCounts: { M5: 1, M15: 1 },
    barsRequested: { M5: 1, M15: 1 },
    collected: { M5: true, M15: true },
    refusals: [],
    notes: [],
    ...over,
  };
}

export const loadedOk = (
  fixture: FixtureSlot,
  over: Partial<InputsProvenance> = {}
): LoadedInputs => ({
  status: 'OK',
  bundle: readFixtureBundle(fixture),
  provenance: provenance(fixture, over),
});

export class FakeSource implements InputsSource {
  readonly calls: Array<{ symbol: string; slot: number }> = [];
  constructor(private answer: () => LoadedInputs | Promise<LoadedInputs>) {}
  set(answer: () => LoadedInputs | Promise<LoadedInputs>): void {
    this.answer = answer;
  }
  async loadCycleInputs(symbol: string, slot: number): Promise<LoadedInputs> {
    this.calls.push({ symbol, slot });
    return this.answer();
  }
}

export class FakeRunner implements CycleRunner {
  readonly requests: RunnerRequest[] = [];
  constructor(
    private answer: (
      request: RunnerRequest
    ) => RunnerOutput | Promise<RunnerOutput>
  ) {}
  set(
    answer: (request: RunnerRequest) => RunnerOutput | Promise<RunnerOutput>
  ): void {
    this.answer = answer;
  }
  async run(request: RunnerRequest): Promise<RunnerOutput> {
    this.requests.push(request);
    return this.answer(request);
  }
}

// ---------------------------------------------------------------- a Prisma that is lazy and transactional

type Row = Record<string, unknown>;

/** What the writer asks of Prisma, as a lazy operation: nothing happens until a transaction runs it. */
class LazyOp<T> implements PromiseLike<T> {
  constructor(
    readonly name: string,
    private readonly run: () => T,
    private readonly onAutocommit: (name: string) => void
  ) {}
  execute(): T {
    return this.run();
  }
  // Awaited by itself, Prisma would run it at once and commit it alone: the fake runs it and says so.
  then<A = T, B = never>(
    onfulfilled?: ((value: T) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    this.onAutocommit(this.name);
    try {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }
}

export class FakeSensorPrisma {
  outputs: Row[] = [];
  inputs: Row[] = [];
  /** What `to_regclass` finds: false for a database where the SYN migration is not applied (a spec sets it). */
  synthesisTablesExist = true;
  /** How many times the writer asked, and an error to throw instead of answering. */
  tableChecks = 0;
  tableCheckError: Error | undefined;
  /** The existence check of the two SYN tables (a tagged-template call; the fake ignores the text). */
  $queryRaw = async (): Promise<Array<{ ready: boolean }>> => {
    this.tableChecks += 1;
    if (this.tableCheckError) throw this.tableCheckError;
    return [{ ready: this.synthesisTablesExist }];
  };
  /** `synthesis_readings` and `entry_zones` (build step 4 part 5): written in the same transaction as the sensors' rows. */
  synthesisReadings: Row[] = [];
  entryZones: Row[] = [];
  /** Operations that ran outside `$transaction` (the writer must have none). */
  readonly autocommitted: string[] = [];
  /** Each `$transaction` call: the names of its operations, and whether it committed. */
  readonly transactions: Array<{ ops: string[]; committed: boolean }> = [];
  /** `{ op: 'marketCycleInput.createMany', error }`: that operation throws when it runs. */
  private failing: { op: string; error: Error } | undefined;
  /** Throws for the whole `$transaction` call before any operation runs (a lost connection). */
  private transactionError: Error | undefined;

  failOn(op: string, error: Error = new Error('injected failure')): void {
    this.failing = { op, error };
  }
  failTransaction(error: Error = new Error('connection lost')): void {
    this.transactionError = error;
  }
  clearFailures(): void {
    this.failing = undefined;
    this.transactionError = undefined;
  }

  private op<T>(name: string, run: () => T): LazyOp<T> {
    return new LazyOp(
      name,
      () => {
        if (this.failing?.op === name) throw this.failing.error;
        return run();
      },
      (n) => this.autocommitted.push(n)
    );
  }

  private createMany(
    table: Row[],
    key: (row: Row) => string,
    args: { data: Row[]; skipDuplicates?: boolean }
  ): { count: number } {
    let count = 0;
    for (const row of args.data) {
      if (table.some((existing) => key(existing) === key(row))) {
        if (args.skipDuplicates) continue;
        throw new Error(`unique constraint on ${key(row)}`);
      }
      table.push({ ...row });
      count += 1;
    }
    return { count };
  }

  readonly mcdOutput = {
    createMany: (args: { data: Row[]; skipDuplicates?: boolean }) =>
      this.op('mcdOutput.createMany', () =>
        this.createMany(
          this.outputs,
          (r) =>
            `${String(r['symbol'])}|${String(r['cycle_slot'])}|${String(r['mcd_id'])}`,
          args
        )
      ),
  };

  readonly marketCycleInput = {
    createMany: (args: { data: Row[]; skipDuplicates?: boolean }) =>
      this.op('marketCycleInput.createMany', () =>
        this.createMany(
          this.inputs,
          (r) => `${String(r['symbol'])}|${String(r['cycle_slot'])}`,
          args
        )
      ),
    deleteMany: (args: { where: { cycle_slot: { lt: number } } }) =>
      this.op('marketCycleInput.deleteMany', () => {
        const before = this.inputs.length;
        this.inputs = this.inputs.filter(
          (r) => !((r['cycle_slot'] as number) < args.where.cycle_slot.lt)
        );
        return { count: before - this.inputs.length };
      }),
  };

  readonly synthesisReading = {
    createMany: (args: { data: Row[]; skipDuplicates?: boolean }) =>
      this.op('synthesisReading.createMany', () =>
        this.createMany(
          this.synthesisReadings,
          (r) =>
            `${String(r['symbol'])}|${String(r['cycle_slot'])}|${String(r['profile'])}`,
          args
        )
      ),
  };

  readonly entryZone = {
    createMany: (args: { data: Row[]; skipDuplicates?: boolean }) =>
      this.op('entryZone.createMany', () =>
        this.createMany(
          this.entryZones,
          (r) =>
            `${String(r['symbol'])}|${String(r['cycle_slot'])}|${String(r['profile'])}|${String(r['zone_id'])}`,
          args
        )
      ),
  };

  /** Array form only, as the writer uses it: every operation runs, in order, or none of them is kept. */
  async $transaction(ops: Array<LazyOp<unknown>>): Promise<unknown[]> {
    const record = { ops: ops.map((o) => o.name), committed: false };
    this.transactions.push(record);
    if (this.transactionError) throw this.transactionError;
    const saved = {
      outputs: this.outputs.map((r) => ({ ...r })),
      inputs: this.inputs.map((r) => ({ ...r })),
      synthesisReadings: this.synthesisReadings.map((r) => ({ ...r })),
      entryZones: this.entryZones.map((r) => ({ ...r })),
    };
    try {
      const results = ops.map((o) => o.execute());
      record.committed = true;
      return results;
    } catch (error) {
      this.outputs = saved.outputs;
      this.inputs = saved.inputs;
      this.synthesisReadings = saved.synthesisReadings;
      this.entryZones = saved.entryZones;
      throw error;
    }
  }
}
