import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import type { CycleRunResult } from '../../src/sensors/cycle-run-result';
import { slotToIso } from '../../src/sensors/inputs/stats-slot';
import type {
  CycleRunner,
  RunnerRequest,
  RunnerSettings,
} from '../../src/sensors/python-runner';
import type { RunnerOutput } from '../../src/sensors/cycle-run-result';
import type {
  ReplayDatabase,
  ReplayHooks,
  StoredCycle,
  StoredReading,
} from '../../src/sensors/replay';
import { FIXTURE_SLOTS, FixtureSlot, readFixtureCycle } from './cycle-fixtures';
import { outputOf, sha256, unitResult } from './sensors-worker-world';

/**
 * Stand-ins for the replay specs (build step 3 part 5): a stored cycle in the database form, with a
 * stand-in bundle text (these specs do not run Python unless they say so), the runner result that
 * equals it, and a runner that records what it was asked and what configuration it was started with.
 */

export const ENGINE_MCD_IDS = ['MCD0', 'MCD1', 'MCD2', 'MCD3'];

/** A canonical-looking bundle text for a slot: JSON, the right symbol and slot, nothing the evaluators read. */
export const stubBundleText = (fixture: FixtureSlot): string =>
  JSON.stringify({
    cycle_slot: slotToIso(fixture.slot),
    data_status: 'FRESH',
    retuning: false,
    stub: 'the canonical bundle text',
    symbol: 'XAUUSD',
  });

/** The database form of a stored cycle: the stored fixture's readings, and a gzipped stand-in bundle. */
export function storedCycle(
  fixture: FixtureSlot = FIXTURE_SLOTS[0],
  text: string = stubBundleText(fixture)
): StoredCycle {
  const cycle = readFixtureCycle(fixture);
  const inputsSha256 = sha256(text);
  return {
    origin: 'database',
    symbol: 'XAUUSD',
    slot: fixture.slot,
    bundle: {
      form: 'gzip-text',
      gz: gzipSync(Buffer.from(text, 'utf8')),
      encoding: 'gzip',
      bytes: Buffer.byteLength(text, 'utf8'),
      inputsSha256,
      retuningObserved: cycle.retuning.observed,
    },
    readings: cycle.results.map(
      (r): StoredReading => ({
        mcdId: r.mcd_id,
        flag: r.flag,
        evaluatorVersion: r.evaluator_version,
        envelopeJson: r.envelope_json,
        envelopeSha256: r.envelope_sha256,
        inputsSha256,
        retuningApplied: cycle.retuning.applied,
        runnerVersion: cycle.runner_version,
      })
    ),
  };
}

/** The unzipped text of a database-form stored cycle. */
export function textOf(stored: StoredCycle): string {
  if (stored.bundle?.form !== 'gzip-text') throw new Error('not a stored text');
  return gunzipSync(stored.bundle.gz).toString('utf8');
}

/** The same cycle with another stored text, hash and length kept as they were (what tampering looks like). */
export function withTamperedText(
  stored: StoredCycle,
  change: (text: string) => string = (text) => text.replace('stub', 'stab')
): StoredCycle {
  if (stored.bundle?.form !== 'gzip-text') throw new Error('not a stored text');
  const changed = change(textOf(stored));
  return {
    ...stored,
    bundle: { ...stored.bundle, gz: gzipSync(Buffer.from(changed, 'utf8')) },
  };
}

/** The same cycle with one reading changed. */
export function withReading(
  stored: StoredCycle,
  mcdId: string,
  change: (reading: StoredReading) => StoredReading
): StoredCycle {
  return {
    ...stored,
    readings: stored.readings.map((r) => (r.mcdId === mcdId ? change(r) : r)),
  };
}

/** A stored reading rewritten the way an older evaluator would have written it: its text, its hash and its version column agree. */
export function asWrittenBy(
  reading: StoredReading,
  version: string
): StoredReading {
  const envelopeJson = reading.envelopeJson.replace(
    `"evaluator_version":"${reading.evaluatorVersion}"`,
    `"evaluator_version":"${version}"`
  );
  if (envelopeJson === reading.envelopeJson)
    throw new Error('the envelope has no evaluator_version to change');
  return {
    ...reading,
    evaluatorVersion: version,
    envelopeJson,
    envelopeSha256: sha256(envelopeJson),
  };
}

/** A stored reading whose envelope reads differently under the SAME version, hash and text consistent (a logic change nobody versioned). */
export function withChangedEnvelope(
  reading: StoredReading,
  from: string,
  to: string
): StoredReading {
  const envelopeJson = reading.envelopeJson.replace(from, to);
  if (envelopeJson === reading.envelopeJson)
    throw new Error(`the envelope has no ${from}`);
  return {
    ...reading,
    envelopeJson,
    envelopeSha256: sha256(envelopeJson),
  };
}

/** The runner result that equals a stored database-form cycle (what a deterministic replay returns). */
export function resultEqualTo(
  stored: StoredCycle,
  fixture: FixtureSlot = FIXTURE_SLOTS[0],
  over: Partial<CycleRunResult> = {}
): CycleRunResult {
  if (stored.bundle === null) throw new Error('no stored bundle');
  const text = stored.bundle.form === 'gzip-text' ? textOf(stored) : null;
  return unitResult(fixture, {
    inputs_sha256: stored.bundle.inputsSha256,
    bundle_canonical_json: text,
    retuning: {
      observed: stored.bundle.retuningObserved,
      enforced: stored.readings[0]?.retuningApplied ?? false,
      applied: stored.readings[0]?.retuningApplied ?? false,
    },
    ...over,
  });
}

/** A runner that answers what a spec says, and keeps what it was asked and the configuration it was started with. */
export class RecordingRunner implements CycleRunner {
  readonly requests: RunnerRequest[] = [];
  /** The settings of each start, and the worker configuration text read while the replay still holds it. */
  readonly starts: Array<{ settings: RunnerSettings; config: string }> = [];
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
  /** Hooks for a `CycleReplayer`: this runner, the four engine MCDs, and a private temporary folder. */
  hooks(tempRoot: string, over: Partial<ReplayHooks> = {}): ReplayHooks {
    return {
      makeRunner: (settings) => {
        this.starts.push({
          settings,
          config: fs.readFileSync(settings.workerConfigPath as string, 'utf8'),
        });
        return this;
      },
      engineMcdIds: () => ENGINE_MCD_IDS,
      tempRoot,
      ...over,
    };
  }
}

export const answering = (result: CycleRunResult): RecordingRunner =>
  new RecordingRunner(() => outputOf(result));

/** A folder of its own for the temporary configurations, to show that none is left behind. */
export function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'replay-spec-'));
}

// ---------------------------------------------------------------- a database that can only be read

type Row = Record<string, unknown>;

export interface FakeReplayDatabase {
  database: ReplayDatabase;
  findUnique: jest.Mock;
  findMany: jest.Mock;
}

/** The two tables a replay reads, as the replay's own `select` asks for them. It has no method that writes. */
export function fakeReplayDatabase(
  input: Row | null,
  outputs: Row[]
): FakeReplayDatabase {
  const findUnique = jest.fn(async () => input);
  const findMany = jest.fn(async () => outputs);
  return {
    database: {
      marketCycleInput: { findUnique },
      mcdOutput: { findMany },
    } as unknown as ReplayDatabase,
    findUnique,
    findMany,
  };
}

/** The rows `loadStoredCycle` reads for a database-form stored cycle. */
export function rowsOf(stored: StoredCycle): {
  input: Row | null;
  outputs: Row[];
} {
  const bundle = stored.bundle;
  return {
    input:
      bundle === null || bundle.form !== 'gzip-text'
        ? null
        : {
            bundle_gz: bundle.gz,
            bundle_encoding: bundle.encoding,
            bundle_bytes: bundle.bytes,
            inputs_sha256: bundle.inputsSha256,
            retuning_observed: bundle.retuningObserved,
          },
    outputs: stored.readings.map((r) => ({
      mcd_id: r.mcdId,
      flag: r.flag,
      evaluator_version: r.evaluatorVersion,
      envelope_json: r.envelopeJson,
      envelope_sha256: r.envelopeSha256,
      inputs_sha256: r.inputsSha256,
      retuning_applied: r.retuningApplied,
      runner_version: r.runnerVersion,
    })),
  };
}
