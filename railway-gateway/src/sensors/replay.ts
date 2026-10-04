import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { gunzipSync } from 'zlib';
import { READER_SYMBOL } from '../cycle/read/read-types';
import { isSlot } from '../cycle/slot';
import { McdRunResult, RunnerError, RunnerOutput } from './cycle-run-result';
import { FixtureInputsSource } from './inputs/fixture-inputs.source';
import { isoToSlot, slotToIso } from './inputs/stats-slot';
import {
  CycleRunner,
  PythonCycleRunner,
  RunnerSettings,
} from './python-runner';
import { readSensorConfig, SensorConfig } from './sensor-config';

/**
 * Replay and determinism (STACK-D-ARCHITECTURE.md section 2.2 point 6, build step 3 part 5).
 *
 * A stored cycle is run again from its stored bundle, and the readings it gives are compared with the
 * stored ones, byte for byte: the envelope text and its SHA-256, for every MCD that was run. The
 * answer is one of four things, because "it differs" is not one finding:
 *
 *   VERIFIED          every envelope is equal. The cycle is deterministic.
 *   TAMPERED_BUNDLE   the stored inputs are not what they claim to be (the unzipped bundle does not hash to the
 *                     `inputs_sha256` stored beside it, or a reading names other inputs). Nothing is run: a
 *                     reading cannot be checked against inputs nobody can vouch for.
 *   VERSION_MISMATCH  an evaluator that answers now is not the version that wrote the stored row. The envelopes
 *                     are expected to differ, and they say so (the version is inside them). Not a defect.
 *   LOGIC_DIVERGENCE  the same evaluator version, inputs that hash as stored, and the envelope still differs. The
 *                     evaluator, the kit or the runner is not deterministic, or was changed without a version.
 *
 * Two more answers exist because they are not the same as any of these: STORED_READING_CORRUPT (a stored row
 * disagrees with itself: its text does not hash to its own hash) and NOT_REPLAYABLE (nothing to replay, or the
 * runner gave no answer, with the cause named). A replay never decides which side is right: it reports.
 *
 * What this file does NOT do: write. It reads two tables with a `select` (`loadStoredCycle`), starts the same
 * `python -m mcd_worker.cli` the worker starts (`PythonCycleRunner`), and writes one temporary worker
 * configuration, outside the repository, which it deletes. The flags in it are the ones stored on the rows
 * (`mcd_outputs.flag`), not the committed `worker_config.yaml`, which has every MCD `off` until a person turns
 * one on; and the runner is told `retuning_enforced` equal to the stored `retuning_applied` (the rows' own
 * words, `schema.prisma`), so a cycle replays under the rule it was made under.
 *
 * Two stored forms are replayed. A DATABASE cycle (`market_cycle_inputs.bundle_gz`) is the exact canonical text the
 * runner hashed, so its text is hashed again. A FIXTURE cycle (`mcd_worker/fixtures/<slot>.bundle.json` and
 * `.cycle.json`) is a bundle file that is not in canonical text form; the only check on it is the hash the runner
 * computes from the bundle it parsed against the `inputs_sha256` stored in `.cycle.json`, so for a fixture a
 * changed bundle and a changed canonical form cannot be told apart (both are reported as TAMPERED_BUNDLE, and
 * the finding says so).
 *
 * The command line is `scripts/replay-cycle.js`; it only wires the arguments to `runReplayCommand` (the way
 * `scripts/measure-cycles.js` does).
 */

// ---------------------------------------------------------------- the stored cycle

/** One `mcd_outputs` row, as a replay needs it (the JSONB copy of the envelope is not read). */
export interface StoredReading {
  mcdId: string;
  flag: string;
  evaluatorVersion: string;
  /** The canonical envelope text, byte for byte. */
  envelopeJson: string;
  envelopeSha256: string;
  /** The hash of the bundle the reading was made from; null only when that bundle could not be written as JSON. */
  inputsSha256: string | null;
  retuningApplied: boolean;
  runnerVersion: string;
}

/** What is stored of the inputs: a gzipped canonical text (the database), or a parsed file (a fixture). */
export type StoredBundle =
  | {
      form: 'gzip-text';
      gz: Uint8Array;
      encoding: string;
      /** The length of the canonical text in bytes, before compression. */
      bytes: number;
      inputsSha256: string;
      retuningObserved: boolean;
    }
  | {
      form: 'parsed';
      bundle: unknown;
      inputsSha256: string;
      retuningObserved: boolean;
    };

export interface StoredCycle {
  origin: 'database' | 'fixture';
  symbol: string;
  /** Unix seconds, a multiple of 300. */
  slot: number;
  bundle: StoredBundle | null;
  readings: StoredReading[];
}

// ---------------------------------------------------------------- the report

export type ReplayVerdict =
  | 'VERIFIED'
  | 'TAMPERED_BUNDLE'
  | 'STORED_READING_CORRUPT'
  | 'VERSION_MISMATCH'
  | 'LOGIC_DIVERGENCE'
  | 'NOT_REPLAYABLE';

export type McdReplayVerdict =
  | 'VERIFIED'
  | 'STORED_READING_CORRUPT'
  | 'VERSION_MISMATCH'
  | 'LOGIC_DIVERGENCE';

export type NotReplayableCause =
  /** Neither a bundle nor a reading is stored for the slot. */
  | 'NOTHING_STORED'
  /** Readings are stored and the bundle is not (the bundle is kept 90 days; the readings are kept for good). */
  | 'NO_STORED_BUNDLE'
  /** A bundle is stored and no reading is. */
  | 'NO_STORED_READINGS'
  /** The readings of the slot were made under different RETUNING enforcement: one run cannot reproduce both. */
  | 'MIXED_RETUNING'
  /** The engine's `worker_config.yaml` could not be read for the list of MCDs. */
  | 'NO_WORKER_CONFIG'
  /** The runner did not give a result (no Python, a timeout, a refused request or configuration, a crash). */
  | 'RUNNER_FAILED';

export type TamperReason =
  | 'ENCODING'
  | 'UNREADABLE'
  | 'HASH'
  | 'LENGTH'
  | 'NOT_JSON'
  | 'OTHER_CYCLE'
  | 'READINGS_NAME_OTHER_INPUTS'
  | 'REPLAYED_HASH_DIFFERS';

export interface TextDifference {
  /** Position of the first character that differs (UTF-16 code units; the envelopes are ASCII). */
  offset: number;
  stored: string;
  replayed: string;
}

export interface McdReplay {
  mcdId: string;
  verdict: McdReplayVerdict;
  storedEvaluatorVersion: string;
  /** null when the replay produced no reading for this MCD. */
  replayedEvaluatorVersion: string | null;
  storedEnvelopeSha256: string;
  /** SHA-256 of the replayed envelope text, computed here (the runner's own claim is compared with it, not trusted). */
  replayedEnvelopeSha256: string | null;
  textEqual: boolean | null;
  hashEqual: boolean | null;
  detail: string;
  difference: TextDifference | null;
}

export interface CycleReplayReport {
  origin: StoredCycle['origin'];
  symbol: string;
  slot: number;
  slotIso: string;
  verdict: ReplayVerdict;
  /** Only for NOT_REPLAYABLE. */
  cause: NotReplayableCause | null;
  /** Only for TAMPERED_BUNDLE. */
  tamperReason: TamperReason | null;
  /** One line: what was found. */
  summary: string;
  inputs: {
    /** The hash stored beside the bundle. */
    storedSha256: string | null;
    /** The hash of the unzipped stored text, computed here; null for a fixture (no stored text) or when nothing was unzipped. */
    textSha256: string | null;
    /** The hash the runner computed from the bundle it was sent; null when it was not run. */
    replayedSha256: string | null;
  };
  retuning: {
    /** What the runner was told. null when it was not run. */
    enforcedForReplay: boolean | null;
    storedApplied: boolean | null;
    replayedApplied: boolean | null;
    storedObserved: boolean | null;
    replayedObserved: boolean | null;
  };
  mcds: McdReplay[];
  /** Anything else worth reading, one line each (a changed runner version, an MCD nobody asked for, a refused run). */
  findings: string[];
  runner: {
    storedVersions: string[];
    replayedVersion: string | null;
    wallMs: number | null;
  };
}

// ---------------------------------------------------------------- small helpers

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** MCD0, MCD1, ... MCD10: by the number, so MCD10 is after MCD9. */
const byMcd = (a: string, b: string): number =>
  a.localeCompare(b, 'en', { numeric: true });

/** Where two texts first differ, with some of what is around it; null when they are equal. */
export function firstDifference(
  stored: string,
  replayed: string
): TextDifference | null {
  if (stored === replayed) return null;
  const common = Math.min(stored.length, replayed.length);
  let offset = 0;
  while (offset < common && stored[offset] === replayed[offset]) offset += 1;
  const from = Math.max(0, offset - 30);
  return {
    offset,
    stored: stored.slice(from, offset + 30),
    replayed: replayed.slice(from, offset + 30),
  };
}

// ---------------------------------------------------------------- loading what is stored

/**
 * The two tables a replay reads. A plain Prisma client fits; the replay calls `findUnique` and `findMany` with a
 * `select` and nothing else (a spec holds a fake to that).
 */
export type ReplayDatabase = Pick<
  PrismaClient,
  'marketCycleInput' | 'mcdOutput'
>;

const INPUT_COLUMNS = {
  bundle_gz: true,
  bundle_encoding: true,
  bundle_bytes: true,
  inputs_sha256: true,
  retuning_observed: true,
} as const;

const OUTPUT_COLUMNS = {
  mcd_id: true,
  flag: true,
  evaluator_version: true,
  envelope_json: true,
  envelope_sha256: true,
  inputs_sha256: true,
  retuning_applied: true,
  runner_version: true,
} as const;

/**
 * Everything the database holds of one cycle: its stored bundle and its readings. READ ONLY (two reads with a
 * `select`; not in one transaction, which only matters for a slot that is being written this second: the worker
 * writes both in one, so a slot read after its commit is whole). A slot with nothing stored gives a cycle with no
 * bundle and no readings, which the replay answers NOT_REPLAYABLE.
 */
export async function loadStoredCycle(
  prisma: ReplayDatabase,
  symbol: string,
  slot: number
): Promise<StoredCycle> {
  const [input, outputs] = await Promise.all([
    prisma.marketCycleInput.findUnique({
      where: { symbol_cycle_slot: { symbol, cycle_slot: slot } },
      select: INPUT_COLUMNS,
    }),
    prisma.mcdOutput.findMany({
      where: { symbol, cycle_slot: slot },
      select: OUTPUT_COLUMNS,
    }),
  ]);
  return {
    origin: 'database',
    symbol,
    slot,
    bundle:
      input === null
        ? null
        : {
            form: 'gzip-text',
            gz: input.bundle_gz,
            encoding: input.bundle_encoding,
            bytes: input.bundle_bytes,
            inputsSha256: input.inputs_sha256,
            retuningObserved: input.retuning_observed,
          },
    readings: outputs
      .map(
        (row): StoredReading => ({
          mcdId: row.mcd_id,
          flag: row.flag,
          evaluatorVersion: row.evaluator_version,
          envelopeJson: row.envelope_json,
          envelopeSha256: row.envelope_sha256,
          inputsSha256: row.inputs_sha256,
          retuningApplied: row.retuning_applied,
          runnerVersion: row.runner_version,
        })
      )
      .sort((a, b) => byMcd(a.mcdId, b.mcdId)),
  };
}

/** The slots that have a stored fixture cycle (both `<slot>.bundle.json` and `<slot>.cycle.json`), oldest first. */
export function listFixtureSlots(directory: string): number[] {
  let names: string[];
  try {
    names = fs.readdirSync(directory);
  } catch {
    return [];
  }
  const slots: number[] = [];
  for (const name of names) {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2})(\d{2}Z)\.cycle\.json$/.exec(name);
    if (!match) continue;
    const slot = isoToSlot(`${match[1]}:${match[2]}`);
    if (
      slot !== null &&
      names.includes(`${FixtureInputsSource.stem(slot)}.bundle.json`)
    ) {
      slots.push(slot);
    }
  }
  return slots.sort((a, b) => a - b);
}

/**
 * One stored fixture cycle of the Python runner (`mcd_worker/fixtures/`): the bundle it was run on and what the
 * runner made of it. A file that is not there gives a cycle with nothing stored; a file that is not what it
 * should be throws (a broken fixture is not a finding about a cycle).
 */
export function loadFixtureCycle(directory: string, slot: number): StoredCycle {
  const stem = FixtureInputsSource.stem(slot);
  const bundleFile = path.join(directory, `${stem}.bundle.json`);
  const cycleFile = path.join(directory, `${stem}.cycle.json`);
  if (!fs.existsSync(bundleFile) || !fs.existsSync(cycleFile)) {
    return {
      origin: 'fixture',
      symbol: READER_SYMBOL,
      slot,
      bundle: null,
      readings: [],
    };
  }
  const read = (file: string): unknown => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(
        `${path.basename(file)} is not JSON (${(error as Error).message})`
      );
    }
  };
  const bundle = read(bundleFile);
  const cycle = read(cycleFile);
  if (
    !isRecord(cycle) ||
    typeof cycle['symbol'] !== 'string' ||
    typeof cycle['inputs_sha256'] !== 'string' ||
    typeof cycle['runner_version'] !== 'string' ||
    !isRecord(cycle['retuning']) ||
    typeof cycle['retuning']['observed'] !== 'boolean' ||
    typeof cycle['retuning']['applied'] !== 'boolean' ||
    !Array.isArray(cycle['results'])
  ) {
    throw new Error(`${path.basename(cycleFile)} is not a stored cycle`);
  }
  const inputsSha256 = cycle['inputs_sha256'];
  const runnerVersion = cycle['runner_version'];
  const retuning = cycle['retuning'];
  const readings = (cycle['results'] as unknown[]).map(
    (entry, index): StoredReading => {
      if (
        !isRecord(entry) ||
        typeof entry['mcd_id'] !== 'string' ||
        typeof entry['flag'] !== 'string' ||
        typeof entry['evaluator_version'] !== 'string' ||
        typeof entry['envelope_json'] !== 'string' ||
        typeof entry['envelope_sha256'] !== 'string'
      ) {
        throw new Error(
          `${path.basename(cycleFile)}: results[${index}] is not a stored reading`
        );
      }
      return {
        mcdId: entry['mcd_id'],
        flag: entry['flag'],
        evaluatorVersion: entry['evaluator_version'],
        envelopeJson: entry['envelope_json'],
        envelopeSha256: entry['envelope_sha256'],
        inputsSha256,
        retuningApplied: retuning['applied'] as boolean,
        runnerVersion,
      };
    }
  );
  return {
    origin: 'fixture',
    symbol: cycle['symbol'],
    slot,
    bundle: {
      form: 'parsed',
      bundle,
      inputsSha256,
      retuningObserved: retuning['observed'] as boolean,
    },
    readings: readings.sort((a, b) => byMcd(a.mcdId, b.mcdId)),
  };
}

// ---------------------------------------------------------------- is the stored input what it claims to be

export type BundleInspection =
  | {
      ok: true;
      /** The stored canonical text; null for a fixture (a parsed file, no stored text). */
      text: string | null;
      /** The hash of that text, computed here; null with it. */
      textSha256: string | null;
      /** The stored bundle, parsed: what the runner is sent. */
      bundle: unknown;
    }
  | {
      ok: false;
      reason: TamperReason;
      detail: string;
      textSha256: string | null;
    };

/**
 * Whether the stored inputs can be vouched for, before anything is run on them. Cheapest first: the encoding,
 * the unzip, the hash of the text (the check the part 5 order names), the recorded length, that it is JSON,
 * that it is the cycle it is stored under, and that every reading names these inputs. A fixture has no text,
 * so only the last two apply to it (its hash is checked after the run, `CycleReplayer.replay`).
 */
export function inspectStoredBundle(stored: StoredCycle): BundleInspection {
  const bundle = stored.bundle;
  if (bundle === null) {
    throw new RangeError('inspectStoredBundle needs a stored bundle');
  }
  let text: string | null = null;
  let textSha256: string | null = null;
  let parsed: unknown;
  if (bundle.form === 'gzip-text') {
    if (bundle.encoding !== 'gzip') {
      return {
        ok: false,
        reason: 'ENCODING',
        detail: `the bundle is stored as "${bundle.encoding}", which a replay cannot read (gzip only)`,
        textSha256,
      };
    }
    let bytes: Buffer;
    try {
      bytes = gunzipSync(bundle.gz);
    } catch (error) {
      return {
        ok: false,
        reason: 'UNREADABLE',
        detail: `the stored bundle does not unzip (${(error as Error).message})`,
        textSha256,
      };
    }
    textSha256 = sha256(bytes);
    if (textSha256 !== bundle.inputsSha256) {
      return {
        ok: false,
        reason: 'HASH',
        detail: `the unzipped bundle hashes to ${textSha256}, the stored inputs_sha256 is ${bundle.inputsSha256}`,
        textSha256,
      };
    }
    if (bytes.length !== bundle.bytes) {
      return {
        ok: false,
        reason: 'LENGTH',
        detail: `the unzipped bundle is ${bytes.length} bytes, the stored bundle_bytes is ${bundle.bytes}`,
        textSha256,
      };
    }
    text = bytes.toString('utf8');
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        reason: 'NOT_JSON',
        detail: `the stored bundle text is not JSON (${(error as Error).message})`,
        textSha256,
      };
    }
  } else {
    parsed = bundle.bundle;
  }

  const isoSlot = slotToIso(stored.slot);
  if (
    !isRecord(parsed) ||
    parsed['cycle_slot'] !== isoSlot ||
    parsed['symbol'] !== stored.symbol
  ) {
    return {
      ok: false,
      reason: 'OTHER_CYCLE',
      detail: `the bundle stored for ${stored.symbol} at ${isoSlot} holds ${
        isRecord(parsed)
          ? `${String(parsed['symbol'])} at ${String(parsed['cycle_slot'])}`
          : 'something that is not a bundle'
      }`,
      textSha256,
    };
  }
  const others = stored.readings.filter(
    (reading) => reading.inputsSha256 !== bundle.inputsSha256
  );
  if (others.length > 0) {
    return {
      ok: false,
      reason: 'READINGS_NAME_OTHER_INPUTS',
      detail:
        `${others.map((r) => r.mcdId).join(', ')} ` +
        `${others.length === 1 ? 'was' : 'were'} made from inputs ` +
        `${others.map((r) => String(r.inputsSha256)).join(', ')}, ` +
        `not the stored bundle ${bundle.inputsSha256} ` +
        '(the bundle those readings were made from is not the one that was kept)',
      textSha256,
    };
  }
  return { ok: true, text, textSha256, bundle: parsed };
}

// ---------------------------------------------------------------- one MCD

/** What is wrong with a stored row on its own, apart from any replay. Empty list = it agrees with itself. */
export function storedReadingProblems(
  reading: StoredReading,
  slot: number
): string[] {
  const problems: string[] = [];
  if (sha256(reading.envelopeJson) !== reading.envelopeSha256) {
    problems.push('envelope_json does not hash to the stored envelope_sha256');
  }
  let envelope: unknown;
  try {
    envelope = JSON.parse(reading.envelopeJson);
  } catch {
    problems.push('envelope_json is not JSON');
    return problems;
  }
  if (!isRecord(envelope)) {
    problems.push('envelope_json is not an object');
    return problems;
  }
  if (envelope['mcd_id'] !== reading.mcdId)
    problems.push(`the envelope is MCD ${String(envelope['mcd_id'])}`);
  if (envelope['cycle_slot'] !== slotToIso(slot))
    problems.push(`the envelope is for slot ${String(envelope['cycle_slot'])}`);
  if (envelope['evaluator_version'] !== reading.evaluatorVersion)
    problems.push(
      `evaluator_version ${reading.evaluatorVersion} is not the envelope's ${String(envelope['evaluator_version'])}`
    );
  return problems;
}

/**
 * One stored reading against what the replay gave for the same MCD. The order matters: a stored row that
 * disagrees with itself is not evidence about anything; a changed version explains a changed envelope; only
 * the same version with a different envelope is a divergence.
 */
export function compareReading(
  stored: StoredReading,
  slot: number,
  replayed: McdRunResult | undefined
): McdReplay {
  const base = {
    mcdId: stored.mcdId,
    storedEvaluatorVersion: stored.evaluatorVersion,
    storedEnvelopeSha256: stored.envelopeSha256,
  };
  const corrupt = storedReadingProblems(stored, slot);
  if (corrupt.length > 0) {
    return {
      ...base,
      verdict: 'STORED_READING_CORRUPT',
      replayedEvaluatorVersion: replayed?.evaluator_version ?? null,
      replayedEnvelopeSha256:
        replayed === undefined ? null : sha256(replayed.envelope_json),
      textEqual: null,
      hashEqual: null,
      detail: `the stored row disagrees with itself: ${corrupt.join('; ')}`,
      difference: null,
    };
  }
  if (replayed === undefined) {
    return {
      ...base,
      verdict: 'LOGIC_DIVERGENCE',
      replayedEvaluatorVersion: null,
      replayedEnvelopeSha256: null,
      textEqual: null,
      hashEqual: null,
      detail: `the replay produced no reading for ${stored.mcdId}, which has a stored one`,
      difference: null,
    };
  }
  const replayedSha256 = sha256(replayed.envelope_json);
  const textEqual = replayed.envelope_json === stored.envelopeJson;
  const hashEqual = replayedSha256 === stored.envelopeSha256;
  const common = {
    ...base,
    replayedEvaluatorVersion: replayed.evaluator_version,
    replayedEnvelopeSha256: replayedSha256,
    textEqual,
    hashEqual,
    difference: firstDifference(stored.envelopeJson, replayed.envelope_json),
  };
  if (replayed.evaluator_version !== stored.evaluatorVersion) {
    return {
      ...common,
      verdict: 'VERSION_MISMATCH',
      detail: `the evaluator is ${replayed.evaluator_version} now, the row was written by ${stored.evaluatorVersion}`,
    };
  }
  if (replayed.envelope_sha256 !== replayedSha256) {
    return {
      ...common,
      verdict: 'LOGIC_DIVERGENCE',
      detail: `the runner reports envelope_sha256 ${replayed.envelope_sha256}, its own text hashes to ${replayedSha256}`,
    };
  }
  if (textEqual && hashEqual) {
    return {
      ...common,
      verdict: 'VERIFIED',
      detail: `envelope text and SHA-256 equal (${stored.envelopeJson.length} characters)`,
    };
  }
  return {
    ...common,
    verdict: 'LOGIC_DIVERGENCE',
    detail:
      `the same evaluator version ${stored.evaluatorVersion} gave another envelope: ` +
      `${textEqual ? 'the text is equal' : 'the text differs'}, ` +
      `${hashEqual ? 'the hash is equal' : `the hash is ${replayedSha256}, stored ${stored.envelopeSha256}`}`,
  };
}

// ---------------------------------------------------------------- the worker configuration of a replay

/**
 * The MCD ids a worker configuration file lists under `flags:` (the kit's own two-level format, one key per line).
 * Only `MCD<n>` keys count: `SYN`, the synthesis flag (build step 4), sits in the same mapping but is not an MCD, has no
 * stored `mcd_outputs` row and is never part of a replay (a replay configuration leaves it out, so synthesis stays off).
 */
export function mcdIdsInWorkerConfig(yamlText: string): string[] {
  const ids: string[] = [];
  let inFlags = false;
  for (const line of yamlText.split(/\r?\n/)) {
    if (/^flags\s*:\s*$/.test(line)) {
      inFlags = true;
      continue;
    }
    if (!inFlags) continue;
    if (/^\S/.test(line)) break; // the next top-level key
    const key = /^\s+(MCD[0-9]+)\s*:/.exec(line);
    if (key) ids.push(key[1]);
  }
  return ids;
}

/**
 * A worker configuration (`mcd-worker-config/1`) in which every MCD of the engine is `off` except the ones that
 * have a stored reading, which have the flag they were written under. The values are quoted: YAML 1.1 reads an
 * unquoted `off` as false, and the runner refuses that.
 */
export function replayWorkerConfig(
  engineMcdIds: string[],
  storedFlags: ReadonlyMap<string, string>
): string {
  const ids = [...new Set([...engineMcdIds, ...storedFlags.keys()])].sort(
    byMcd
  );
  const lines = ids.map((id) => `  ${id}: '${storedFlags.get(id) ?? 'off'}'`);
  return ['schema: mcd-worker-config/1', 'flags:', ...lines, ''].join('\n');
}

// ---------------------------------------------------------------- the replay

export type ReplaySettings = Pick<
  SensorConfig,
  'python' | 'engineDir' | 'runnerTimeoutMs'
>;

export interface ReplayHooks {
  /** The runner for one replay, started with the given settings (a spec gives a fake). Default: the real one. */
  makeRunner?: (settings: RunnerSettings) => CycleRunner;
  /** The MCD ids of the engine. Default: the keys of `<engineDir>/mcd_worker/worker_config.yaml`. */
  engineMcdIds?: () => string[];
  /** Where the temporary configuration goes. Default: the operating system's temporary folder, never the repository. */
  tempRoot?: string;
}

export class CycleReplayer {
  constructor(
    private readonly settings: ReplaySettings,
    private readonly hooks: ReplayHooks = {}
  ) {}

  private engineMcdIds(): string[] {
    if (this.hooks.engineMcdIds) return this.hooks.engineMcdIds();
    const file = path.join(
      this.settings.engineDir,
      'mcd_worker',
      'worker_config.yaml'
    );
    return mcdIdsInWorkerConfig(fs.readFileSync(file, 'utf8'));
  }

  async replay(stored: StoredCycle): Promise<CycleReplayReport> {
    const slotIso = slotToIso(stored.slot);
    const report: CycleReplayReport = {
      origin: stored.origin,
      symbol: stored.symbol,
      slot: stored.slot,
      slotIso,
      verdict: 'NOT_REPLAYABLE',
      cause: null,
      tamperReason: null,
      summary: '',
      inputs: {
        storedSha256: stored.bundle?.inputsSha256 ?? null,
        textSha256: null,
        replayedSha256: null,
      },
      retuning: {
        enforcedForReplay: null,
        storedApplied: null,
        replayedApplied: null,
        storedObserved: stored.bundle?.retuningObserved ?? null,
        replayedObserved: null,
      },
      mcds: [],
      findings: [],
      runner: {
        storedVersions: [
          ...new Set(stored.readings.map((r) => r.runnerVersion)),
        ].sort(),
        replayedVersion: null,
        wallMs: null,
      },
    };
    const notReplayable = (
      cause: NotReplayableCause,
      summary: string
    ): CycleReplayReport => ({
      ...report,
      verdict: 'NOT_REPLAYABLE',
      cause,
      summary,
    });

    // 1. is there anything to replay
    const where = `${stored.symbol} at ${slotIso}`;
    if (stored.bundle === null && stored.readings.length === 0) {
      return notReplayable(
        'NOTHING_STORED',
        `nothing is stored for ${where}: no bundle and no reading`
      );
    }
    if (stored.bundle === null) {
      return notReplayable(
        'NO_STORED_BUNDLE',
        `${stored.readings.length} reading(s) are stored for ${where} and no bundle (bundles are kept 90 days, readings are not deleted)`
      );
    }
    if (stored.readings.length === 0) {
      return notReplayable(
        'NO_STORED_READINGS',
        `a bundle is stored for ${where} and no reading to compare with`
      );
    }

    // 2. can the stored inputs be vouched for (nothing is run on inputs that cannot)
    const inspection = inspectStoredBundle(stored);
    report.inputs.textSha256 = inspection.textSha256;
    if (!inspection.ok) {
      return {
        ...report,
        verdict: 'TAMPERED_BUNDLE',
        tamperReason: inspection.reason,
        summary: `${inspection.detail}; nothing was run`,
      };
    }

    // 3. under which rule were the readings made
    const applied = new Set(stored.readings.map((r) => r.retuningApplied));
    if (applied.size > 1) {
      return notReplayable(
        'MIXED_RETUNING',
        `the readings of ${where} were made under different RETUNING enforcement (${stored.readings
          .map((r) => `${r.mcdId} applied ${String(r.retuningApplied)}`)
          .join(', ')}): one run cannot reproduce both`
      );
    }
    const enforced = stored.readings[0].retuningApplied;
    report.retuning.storedApplied = enforced;
    report.retuning.enforcedForReplay = enforced;

    // 4. the flags the readings were made under
    let engineIds: string[];
    try {
      engineIds = this.engineMcdIds();
    } catch (error) {
      return notReplayable(
        'NO_WORKER_CONFIG',
        `the engine's worker_config.yaml could not be read (${(error as Error).message})`
      );
    }
    if (engineIds.length === 0) {
      return notReplayable(
        'NO_WORKER_CONFIG',
        "the engine's worker_config.yaml lists no MCD"
      );
    }
    const flags = new Map(stored.readings.map((r) => [r.mcdId, r.flag]));
    const dir = fs.mkdtempSync(
      path.join(this.hooks.tempRoot ?? os.tmpdir(), 'mcd-replay-')
    );

    // 5. run it again, as it was run
    let output: RunnerOutput;
    try {
      const configPath = path.join(dir, 'worker_config.yaml');
      fs.writeFileSync(
        configPath,
        replayWorkerConfig(engineIds, flags),
        'utf8'
      );
      const runnerSettings: RunnerSettings = {
        python: this.settings.python,
        engineDir: this.settings.engineDir,
        runnerTimeoutMs: this.settings.runnerTimeoutMs,
        workerConfigPath: configPath,
      };
      const runner =
        this.hooks.makeRunner?.(runnerSettings) ??
        new PythonCycleRunner(runnerSettings);
      output = await runner.run({
        bundle: inspection.bundle,
        retuningEnforced: enforced,
      });
    } catch (error) {
      if (error instanceof RunnerError) {
        const failed = notReplayable(
          'RUNNER_FAILED',
          `the runner gave no result (${error.kind}): ${error.message}`
        );
        failed.findings.push(
          `runner failure ${error.kind}, ${error.retryable ? 'a retry may help' : 'it will fail the same way again'}`
        );
        return failed;
      }
      throw error;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const result = output.result;
    report.runner.replayedVersion = result.runner_version;
    report.runner.wallMs = output.wallMs;
    report.inputs.replayedSha256 = result.inputs_sha256;
    report.retuning.replayedApplied = result.retuning.applied;
    report.retuning.replayedObserved = result.retuning.observed;

    // 6. compare
    const replayedBy = new Map(result.results.map((r) => [r.mcd_id, r]));
    report.mcds = stored.readings.map((reading) =>
      compareReading(reading, stored.slot, replayedBy.get(reading.mcdId))
    );
    const unexpected = result.results
      .map((r) => r.mcd_id)
      .filter((id) => !flags.has(id));
    const findings = report.findings;
    let inputsTampered = false;
    let divergent = false;

    if (result.inputs_sha256 !== stored.bundle.inputsSha256) {
      if (stored.bundle.form === 'parsed') {
        inputsTampered = true;
        findings.push(
          `the runner hashes the stored fixture bundle to ${String(result.inputs_sha256)}, the stored cycle says ${stored.bundle.inputsSha256}; ` +
            'a fixture has no stored text, so a changed bundle and a changed canonical form cannot be told apart'
        );
      } else {
        divergent = true;
        findings.push(
          `the stored text hashes as stored, and the runner now writes the same bundle as other text (${String(result.inputs_sha256)}, stored ${stored.bundle.inputsSha256}): ` +
            'the canonical form of a bundle changed'
        );
      }
    }
    if (result.retuning.applied !== enforced) {
      divergent = true;
      findings.push(
        `the readings say RETUNING was applied (${String(enforced)}) and replaying the stored bundle applies ${String(result.retuning.applied)}: ` +
          `the bundle's own retuning field is ${String(result.retuning.observed)}`
      );
    }
    if (result.retuning.observed !== stored.bundle.retuningObserved) {
      divergent = true;
      findings.push(
        `the stored retuning_observed is ${String(stored.bundle.retuningObserved)} and the stored bundle says ${String(result.retuning.observed)}`
      );
    }
    if (unexpected.length > 0) {
      divergent = true;
      findings.push(
        `the replay also produced ${unexpected.join(', ')}, which have no stored reading`
      );
    }

    // 7. the verdict: the worst finding, in the order the diagnosis needs
    const verdictOf = (verdict: McdReplayVerdict): boolean =>
      report.mcds.some((m) => m.verdict === verdict);
    let verdict: ReplayVerdict;
    let summary: string;
    if (inputsTampered) {
      verdict = 'TAMPERED_BUNDLE';
      report.tamperReason = 'REPLAYED_HASH_DIFFERS';
      summary =
        'the stored bundle does not hash to the stored inputs_sha256 when the runner reads it';
    } else if (verdictOf('STORED_READING_CORRUPT')) {
      verdict = 'STORED_READING_CORRUPT';
      summary = explain(report.mcds, 'STORED_READING_CORRUPT');
    } else if (verdictOf('VERSION_MISMATCH')) {
      verdict = 'VERSION_MISMATCH';
      summary = explain(report.mcds, 'VERSION_MISMATCH');
    } else if (verdictOf('LOGIC_DIVERGENCE') || divergent) {
      verdict = 'LOGIC_DIVERGENCE';
      summary = report.mcds.some((m) => m.verdict === 'LOGIC_DIVERGENCE')
        ? explain(report.mcds, 'LOGIC_DIVERGENCE')
        : findings[0];
    } else {
      verdict = 'VERIFIED';
      summary = `${report.mcds.length} of ${report.mcds.length} readings equal the stored ones, envelope text and SHA-256, byte for byte`;
    }
    if (
      (verdict === 'LOGIC_DIVERGENCE' || verdict === 'VERSION_MISMATCH') &&
      !report.runner.storedVersions.includes(result.runner_version)
    ) {
      findings.push(
        `the runner is ${result.runner_version} now, the rows were written by ${report.runner.storedVersions.join(', ')}`
      );
    }
    return { ...report, verdict, summary };
  }
}

function explain(mcds: McdReplay[], verdict: McdReplayVerdict): string {
  const mine = mcds.filter((m) => m.verdict === verdict);
  return mine.map((m) => `${m.mcdId}: ${m.detail}`).join('; ');
}

// ---------------------------------------------------------------- the command

export const REPLAY_USAGE = `Usage: node scripts/replay-cycle.js (--db | --fixtures) [options]

Runs a stored cycle again from its stored bundle and compares what it gives with the stored readings,
byte for byte (envelope text and SHA-256 of every MCD). READ ONLY: it never writes to a database.

Where the stored cycle comes from (exactly one):
  --db                 market_cycle_inputs and mcd_outputs, from the database named by DATABASE_URL
                       (from a laptop that is the public URL, never railway run's private one)
  --fixtures           the stored fixture cycles of the Python runner (v1, v3 and v4: 2026-09-18T20:55Z,
                       2026-09-28T14:15Z, 2026-09-28T23:15Z), all of them in one command

Options:
  --slot <time>        the cycle: ISO 8601 UTC ("2026-09-18T20:55Z") or unix seconds on a 5-minute boundary.
                       May be repeated. Required with --db; with --fixtures it narrows them to these slots.
  --symbol <name>      default ${READER_SYMBOL}
  --python <command>   the interpreter (default SENSOR_PYTHON, else python)
  --engine-dir <dir>   the folder holding mcd_common, mcd0.. and mcd_worker (default SENSOR_ENGINE_DIR, else this checkout's)
  --fixtures-dir <dir> where the fixtures are (default <engine-dir>/mcd_worker/fixtures)
  --json               print the reports as JSON
  --help               this text

Each cycle ends in one verdict:
  VERIFIED               every envelope is equal: the cycle replays byte for byte
  TAMPERED_BUNDLE        the stored inputs do not hash to the stored inputs_sha256 (nothing is run)
  STORED_READING_CORRUPT a stored row does not hash to its own envelope_sha256
  VERSION_MISMATCH       an evaluator is not the version that wrote the row (the envelopes are expected to differ)
  LOGIC_DIVERGENCE       the same version, inputs as stored, and another envelope
  NOT_REPLAYABLE         nothing stored, the bundle was deleted, or the runner gave no result

Exit status: 0 every cycle VERIFIED; 1 a difference was found; 2 a cycle could not be replayed, or the arguments are wrong.`;

export interface ReplayCliOptions {
  db: boolean;
  fixtures: boolean;
  slots: number[];
  symbol: string;
  python: string | null;
  engineDir: string | null;
  fixturesDir: string | null;
  json: boolean;
  help: boolean;
}

/** A slot as the command line writes it: an ISO slot text or unix seconds; null when it is neither. */
export function parseSlotArgument(text: string): number | null {
  const iso = isoToSlot(text);
  if (iso !== null) return iso;
  if (/^\d+$/.test(text)) {
    const seconds = Number(text);
    return Number.isSafeInteger(seconds) && isSlot(seconds) ? seconds : null;
  }
  return null;
}

export function parseReplayArgs(
  argv: string[]
): ReplayCliOptions | { error: string } {
  const options: ReplayCliOptions = {
    db: false,
    fixtures: false,
    slots: [],
    symbol: READER_SYMBOL,
    python: null,
    engineDir: null,
    fixturesDir: null,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = (): string | null => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) return null;
      i += 1;
      return next;
    };
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--db':
        options.db = true;
        break;
      case '--fixtures':
        options.fixtures = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--slot': {
        const v = value();
        const slot = v === null ? null : parseSlotArgument(v);
        if (slot === null) {
          return {
            error:
              '--slot needs an ISO 8601 UTC slot ("2026-09-18T20:55Z") or unix seconds on a 5-minute boundary',
          };
        }
        if (!options.slots.includes(slot)) options.slots.push(slot);
        break;
      }
      case '--symbol':
      case '--python':
      case '--engine-dir':
      case '--fixtures-dir': {
        const v = value();
        if (v === null || v === '') return { error: `${arg} needs a value` };
        if (arg === '--symbol') options.symbol = v;
        else if (arg === '--python') options.python = v;
        else if (arg === '--engine-dir') options.engineDir = v;
        else options.fixturesDir = v;
        break;
      }
      default:
        return { error: `unknown argument ${arg}` };
    }
  }
  if (options.help) return options;
  if (options.db === options.fixtures) {
    return { error: 'give exactly one of --db and --fixtures' };
  }
  if (options.db && options.slots.length === 0) {
    return { error: '--db needs at least one --slot' };
  }
  return options;
}

export interface ReplayCommandDeps {
  /** The environment the settings are read from. Default: `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Opens the database named by DATABASE_URL (the script wires Prisma); only called for --db. */
  openDatabase?: () => Promise<{
    database: ReplayDatabase;
    close: () => Promise<void>;
  }>;
  hooks?: ReplayHooks;
}

export interface ReplayCommandResult {
  reports: CycleReplayReport[];
  /** What the command prints. */
  text: string;
  exitCode: 0 | 1 | 2;
}

export function exitCodeFor(reports: CycleReplayReport[]): 0 | 1 | 2 {
  if (
    reports.some(
      (r) => r.verdict !== 'VERIFIED' && r.verdict !== 'NOT_REPLAYABLE'
    )
  ) {
    return 1;
  }
  if (
    reports.length === 0 ||
    reports.some((r) => r.verdict === 'NOT_REPLAYABLE')
  ) {
    return 2;
  }
  return 0;
}

/** Replays what the options ask for, in slot order, and says what it found. */
export async function runReplayCommand(
  options: ReplayCliOptions,
  deps: ReplayCommandDeps = {}
): Promise<ReplayCommandResult> {
  const base = readSensorConfig(deps.env ?? process.env);
  const settings: ReplaySettings = {
    python: options.python ?? base.python,
    engineDir: options.engineDir ?? base.engineDir,
    runnerTimeoutMs: base.runnerTimeoutMs,
  };
  const replayer = new CycleReplayer(settings, deps.hooks);
  const reports: CycleReplayReport[] = [];

  if (options.fixtures) {
    const directory =
      options.fixturesDir ??
      path.join(settings.engineDir, 'mcd_worker', 'fixtures');
    const slots =
      options.slots.length > 0
        ? [...options.slots].sort((a, b) => a - b)
        : listFixtureSlots(directory);
    for (const slot of slots) {
      reports.push(await replayer.replay(loadFixtureCycle(directory, slot)));
    }
  } else {
    if (deps.openDatabase === undefined) {
      throw new Error('no database to read (openDatabase is not wired)');
    }
    const { database, close } = await deps.openDatabase();
    try {
      for (const slot of [...options.slots].sort((a, b) => a - b)) {
        reports.push(
          await replayer.replay(
            await loadStoredCycle(database, options.symbol, slot)
          )
        );
      }
    } finally {
      await close();
    }
  }
  return {
    reports,
    exitCode: exitCodeFor(reports),
    text: options.json
      ? JSON.stringify(reports, null, 2)
      : formatReplayReports(reports),
  };
}

// ---------------------------------------------------------------- the text report

const short = (hash: string | null): string =>
  hash === null ? 'none' : `${hash.slice(0, 16)}…`;

export function formatReplayReport(report: CycleReplayReport): string {
  const lines: string[] = [];
  lines.push(
    `Replay of ${report.symbol} at ${report.slotIso} (slot ${report.slot}, from ${report.origin === 'fixture' ? 'a stored fixture' : 'the database'})`
  );
  lines.push(
    `  ${report.verdict}${report.cause ? ` (${report.cause})` : ''}${report.tamperReason ? ` (${report.tamperReason})` : ''}: ${report.summary}`
  );
  if (report.inputs.storedSha256 !== null) {
    lines.push(
      `  inputs  stored ${short(report.inputs.storedSha256)}  unzipped text ${report.origin === 'fixture' ? 'n/a (a fixture has no stored text)' : short(report.inputs.textSha256)}  replayed ${short(report.inputs.replayedSha256)}`
    );
  }
  if (report.retuning.enforcedForReplay !== null) {
    lines.push(
      `  retuning  enforced for the replay ${String(report.retuning.enforcedForReplay)} (stored applied ${String(report.retuning.storedApplied)}, observed ${String(report.retuning.storedObserved)})`
    );
  }
  for (const mcd of report.mcds) {
    lines.push(
      `  ${mcd.mcdId.padEnd(5)} ${mcd.verdict.padEnd(22)} evaluator ${mcd.storedEvaluatorVersion}${
        mcd.replayedEvaluatorVersion !== null &&
        mcd.replayedEvaluatorVersion !== mcd.storedEvaluatorVersion
          ? ` -> ${mcd.replayedEvaluatorVersion}`
          : ''
      }  sha256 stored ${short(mcd.storedEnvelopeSha256)} replayed ${short(mcd.replayedEnvelopeSha256)}`
    );
    if (mcd.verdict !== 'VERIFIED') {
      lines.push(`        ${mcd.detail}`);
      if (mcd.difference !== null) {
        lines.push(
          `        first difference at character ${mcd.difference.offset}: stored "${mcd.difference.stored}" replayed "${mcd.difference.replayed}"`
        );
      }
    }
  }
  for (const finding of report.findings) lines.push(`  note: ${finding}`);
  if (report.runner.wallMs !== null) {
    lines.push(
      `  runner ${report.runner.replayedVersion ?? '?'} (stored ${report.runner.storedVersions.join(', ') || 'none'}), ${Math.round(report.runner.wallMs)} ms`
    );
  }
  return lines.join('\n');
}

export function formatReplayReports(reports: CycleReplayReport[]): string {
  const blocks = reports.map(formatReplayReport);
  const counts = new Map<ReplayVerdict, number>();
  for (const report of reports)
    counts.set(report.verdict, (counts.get(report.verdict) ?? 0) + 1);
  const tally =
    reports.length === 0
      ? 'no cycle to replay'
      : [...counts.entries()].map(([v, n]) => `${n} ${v}`).join(', ');
  return [...blocks, `${reports.length} cycle(s): ${tally}`].join('\n\n');
}
