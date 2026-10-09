import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import type {
  CycleRunResult,
  SynthesisRunResult,
} from '../../src/sensors/cycle-run-result';
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
  StoredSynthesis,
  StoredSynthesisProfile,
} from '../../src/sensors/replay';
import { zoneRowsOfText } from '../../src/sensors/synthesis-rows';
import { FIXTURE_SLOTS, FixtureSlot, readFixtureCycle } from './cycle-fixtures';
import {
  outputOf,
  sha256,
  storedSynthesis,
  unitResult,
} from './sensors-worker-world';

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
    synthesis: null,
    synthesisTablesMissing: false,
  };
}

/** The `synthesis` section of a runner result that equals these stored SYN rows (what a deterministic replay returns). */
export function sectionOf(
  synthesis: StoredSynthesis,
  over: Partial<SynthesisRunResult> = {}
): SynthesisRunResult {
  const first = synthesis.profiles[0];
  return {
    flag: first.flag,
    rules_version: first.rulesVersion,
    rules_sha256: first.rulesSha256,
    zones_version: first.zoneParamsVersion,
    zones_sha256: first.zoneParamsSha256,
    reference_price: first.referencePrice,
    error: synthesis.error,
    readings: synthesis.profiles.map((p) => ({
      profile: p.profile,
      reading_json: p.readingJson,
      reading_sha256: p.readingSha256,
      zones_json: p.zonesJson,
      zones_sha256: p.zonesSha256,
      zones_reason: p.zonesReason,
      guard_problems: p.guardProblems,
    })),
    ...over,
  };
}

/**
 * The same stored cycle with the SYN rows its fixture's `synthesis.json` holds (real readings, real hashes, real zones). In the
 * database form every profile also has its `entry_zones` rows, made from its own `zones_json`; in the fixture form it has none.
 */
export function withSynthesis(
  stored: StoredCycle,
  fixture: FixtureSlot = FIXTURE_SLOTS[0],
  form: 'database' | 'fixture' = 'database'
): StoredCycle {
  return withSynthesisSection(stored, storedSynthesis(fixture), form);
}

/** The same stored cycle with the SYN rows a runner's `synthesis` section makes (what the worker would have stored for it). */
export function withSynthesisSection(
  stored: StoredCycle,
  section: SynthesisRunResult,
  form: 'database' | 'fixture' = 'database'
): StoredCycle {
  const profiles = section.readings.map((entry): StoredSynthesisProfile => {
    const rows = zoneRowsOfText(entry.zones_json, {
      symbol: stored.symbol,
      slot: stored.slot,
      profile: entry.profile,
      zones_version: section.zones_version,
      zones_sha256: section.zones_sha256,
    }).rows;
    return {
      profile: entry.profile,
      flag: section.flag,
      rulesVersion: section.rules_version,
      rulesSha256: section.rules_sha256,
      zoneParamsVersion: section.zones_version,
      zoneParamsSha256: section.zones_sha256,
      readingJson: entry.reading_json,
      readingSha256: entry.reading_sha256,
      zonesJson: entry.zones_json,
      zonesSha256: entry.zones_sha256,
      zonesReason: entry.zones_reason,
      zoneCount: form === 'database' ? rows.length : null,
      referencePrice: section.reference_price,
      guardProblems: entry.guard_problems,
      inputsSha256: stored.bundle?.inputsSha256 ?? null,
      retuningApplied: stored.readings[0]?.retuningApplied ?? false,
      runnerVersion: stored.readings[0]?.runnerVersion ?? '1.0.0',
      zoneRows: form === 'database' ? rows : null,
    };
  });
  return {
    ...stored,
    synthesis: { error: section.error, profiles, orphanZones: [] },
  };
}

/** The same cycle with one trader type's stored SYN row changed. */
export function withProfile(
  stored: StoredCycle,
  profile: string,
  change: (row: StoredSynthesisProfile) => StoredSynthesisProfile
): StoredCycle {
  if (stored.synthesis === null) throw new Error('no stored SYN rows');
  return {
    ...stored,
    synthesis: {
      ...stored.synthesis,
      profiles: stored.synthesis.profiles.map((p) =>
        p.profile === profile ? change(p) : p
      ),
    },
  };
}

/** A stored SYN row rewritten the way an older rules file would have written it: text, hash and version column agree. */
export function profileAsWrittenByRules(
  row: StoredSynthesisProfile,
  rulesVersion: string
): StoredSynthesisProfile {
  const readingJson = (row.readingJson as string).replace(
    `"rules_version":"${row.rulesVersion}"`,
    `"rules_version":"${rulesVersion}"`
  );
  if (readingJson === row.readingJson)
    throw new Error('the reading has no rules_version to change');
  return {
    ...row,
    rulesVersion,
    readingJson,
    readingSha256: sha256(readingJson),
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
  const withSyn =
    stored.synthesis !== null && stored.synthesis.profiles.length > 0;
  const base = unitResult(fixture, {
    inputs_sha256: stored.bundle.inputsSha256,
    bundle_canonical_json: text,
    retuning: {
      observed: stored.bundle.retuningObserved,
      enforced: stored.readings[0]?.retuningApplied ?? false,
      applied: stored.readings[0]?.retuningApplied ?? false,
    },
    ...(withSyn
      ? { synthesis: sectionOf(stored.synthesis as StoredSynthesis) }
      : {}),
  });
  return {
    ...base,
    ...(withSyn ? { runtime: { ...base.runtime, synthesis_ms: 48.8 } } : {}),
    ...over,
  };
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
  /** `synthesis_readings` and `entry_zones`. */
  findSynthesis: jest.Mock;
  findZones: jest.Mock;
}

/** What the SYN tables hold, or the error a read of them fails with (a database without the migration, a lost connection). */
export interface FakeSynthesisTables {
  synthesis?: Row[];
  zones?: Row[];
  fail?: unknown;
}

/** The four tables a replay reads, as the replay's own `select` asks for them. It has no method that writes. */
export function fakeReplayDatabase(
  input: Row | null,
  outputs: Row[],
  tables: FakeSynthesisTables = {}
): FakeReplayDatabase {
  const findUnique = jest.fn(async () => input);
  const findMany = jest.fn(async () => outputs);
  const reads = (rows: Row[] | undefined) => async () => {
    if (tables.fail !== undefined) throw tables.fail;
    return rows ?? [];
  };
  const findSynthesis = jest.fn(reads(tables.synthesis));
  const findZones = jest.fn(reads(tables.zones));
  return {
    database: {
      marketCycleInput: { findUnique },
      mcdOutput: { findMany },
      synthesisReading: { findMany: findSynthesis },
      entryZone: { findMany: findZones },
    } as unknown as ReplayDatabase,
    findUnique,
    findMany,
    findSynthesis,
    findZones,
  };
}

/** The rows `loadStoredCycle` reads for a database-form stored cycle. */
export function rowsOf(stored: StoredCycle): {
  input: Row | null;
  outputs: Row[];
  /** The `synthesis_readings` and `entry_zones` rows of the stored SYN profiles (none for a cycle without). */
  synthesis: Row[];
  zones: Row[];
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
    synthesis: (stored.synthesis?.profiles ?? []).map((p) => ({
      profile: p.profile,
      flag: p.flag,
      rules_version: p.rulesVersion,
      rules_sha256: p.rulesSha256,
      zone_params_version: p.zoneParamsVersion,
      zone_params_sha256: p.zoneParamsSha256,
      reading_json: p.readingJson,
      reading_sha256: p.readingSha256,
      zones_json: p.zonesJson,
      zones_sha256: p.zonesSha256,
      zones_reason: p.zonesReason,
      zone_count: p.zoneCount,
      reference_price: p.referencePrice,
      guard_problems: p.guardProblems,
      inputs_sha256: p.inputsSha256,
      retuning_applied: p.retuningApplied,
      runner_version: p.runnerVersion,
    })),
    zones: (stored.synthesis?.profiles ?? []).flatMap((p) =>
      (p.zoneRows ?? []).map((z) => ({ ...z }))
    ),
  };
}
