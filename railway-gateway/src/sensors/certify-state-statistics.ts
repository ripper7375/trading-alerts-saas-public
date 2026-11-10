import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { READER_SYMBOL } from '../cycle/read/read-types';
import { CycleRow, invalidCycleRow } from '../cycle/read/ready-cycle';
import {
  TIMEFRAMES,
  TIMEFRAME_SECONDS,
  Timeframe,
  isClosedBar,
  isSlot,
  lastClosedBarOpen,
} from '../cycle/slot';
import type { PrismaService } from '../prisma/prisma.service';
import { RunnerError } from './cycle-run-result';
import {
  BAR_COLUMNS,
  BarRecord,
  CENTROID_INDICATORS,
  CycleInputsBundle,
  REFUSED_DATA_STATUS,
  StatisticsRecord,
  channelColumns,
  kitIndicatorOf,
  statisticsSourceOf,
  windowBarColumns,
} from './inputs/bundle-types';
import { closedBarsToSupply } from './inputs/closed-channel';
import { isoToSlot, slotToIso, statsSlots } from './inputs/stats-slot';
import { bundleStatisticsRow, jsonValue } from './inputs/statistics-fields';
import { TimeframeTuning, mergeTuning, readTuning } from './inputs/tuning';
import {
  CycleRunner,
  MAX_STDERR_BYTES,
  MAX_STDOUT_BYTES,
  PythonCycleRunner,
} from './python-runner';
import { DEFAULT_ENGINE_DIR, readSensorConfig } from './sensor-config';
import {
  HORIZON_HOURS,
  MIN_SAMPLE,
  StateStatisticsRow,
  configHashKeyOf,
  evaluatorSeriesOf,
} from './state-statistics.series';
import { StateStatisticsWriter } from './state-statistics.writer';

/**
 * Stage B4 Certification Kit (`docs/runbooks/deploy-stack-d-step3.md` §0 and §6;
 * `docs/handoffs/2026-10-03-1000-step3-part6.md` §5.2).
 *
 * Bridges the two missing pieces listed in the Step 3 deployment runbook:
 *   1. A runner and CLI for the Python statistics engine (`mcd_worker.tools.compute_statistics`
 *      -> `mcd_worker.statistics.compute_state_statistics`), wired into `StateStatisticsWriter.writeRows`.
 *   2. A point-in-time loader (`loadPointInTimeCycleBundle`) and forming-bar / refit drift
 *      comparator (`measurePointInTimeDrift`) over `market_data_point_in_time` (`snapshot_age_bars = 1`)
 *      and `market_data_v6`.
 *
 * By default the command is READ-ONLY (dry-run): it computes the rows, checks them against
 * `StateStatisticsWriter.problems(rows)`, and prints the counts and figures. Passing `--write`
 * with `--db` writes the batch in one transaction through `StateStatisticsWriter.writeRows`.
 */

export const STATISTICS_REQUEST_VERSION = 'mcd-statistics-request/1';
export const STATISTICS_RESULT_VERSION = 'mcd-statistics-result/1';
export const DEFAULT_CERTIFY_LAST_CYCLES = 1440; // 5 trading days of M5 cycles

export interface StateOccurrenceInput {
  mcd_id: string;
  evaluator_version_series: string;
  config_hash_key: string;
  state_code: string;
  bias: string;
  slot: number;
}

export interface ClosedM5BarInput {
  timestamp: number;
  high: number;
  low: number;
  close: number;
}

export interface StatisticsEngineResult {
  rows: StateStatisticsRow[];
  occurrences: number;
  unavailable: Record<string, number>;
}

export interface StatisticsRunner {
  compute(request: {
    occurrences: StateOccurrenceInput[];
    bars: ClosedM5BarInput[];
    horizons?: readonly number[];
  }): Promise<StatisticsEngineResult>;
}

export interface StoredOutputForStats {
  cycle_slot: number;
  mcd_id: string;
  evaluator_version: string;
  status: string;
  state_code: string | null;
  bias: string | null;
  retuning_observed: boolean;
  retuning_applied: boolean;
  envelope_json: string;
}

export interface OccurrenceFilterOptions {
  /** Allowed reading statuses. Default: `['VALID', 'CAUTIONARY']`. */
  statuses?: readonly string[];
  /** Exclude rows where `retuning_observed` or `retuning_applied` is true. Default: `false`. */
  excludeRetuning?: boolean;
  /** `cycles` (ADR-022 default: every cycle occurrence) or `episodes` (collapse consecutive 5-min slots in the same state). */
  mode?: 'cycles' | 'episodes';
}

export interface DriftColumnSummary {
  column: string;
  comparedBars: number;
  changedBars: number;
  maxAbsDiff: number;
  meanAbsDiff: number;
}

export interface TimeframeDriftReport {
  timeframe: Timeframe;
  snapshotBars: number;
  matchedBars: number;
  columns: DriftColumnSummary[];
}

export interface CertifyReport {
  mode: 'cycles' | 'episodes';
  source: 'stored' | 'point-in-time' | 'file';
  statuses: string[];
  excludeRetuning: boolean;
  slotsEvaluated: number;
  firstSlot: number | null;
  lastSlot: number | null;
  occurrencesTotal: number;
  barsCount: number;
  unavailable: Record<string, number>;
  rows: StateStatisticsRow[];
  measuredRows: number;
  provisionalRows: number;
  writerProblems: string[];
  written: boolean;
  writtenRows: number;
  drift: TimeframeDriftReport[] | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/**
 * Resolve the engine directory that holds `mcd_worker/tools/compute_statistics.py`.
 * If `configuredDir` is the 45-file runtime copy (`railway-gateway/sensors`), fall back to
 * `DEFAULT_ENGINE_DIR` (`davintrade-stack-d-and-e/engine-1-5-new`) when present.
 */
export function resolveStatisticsEngineDir(configuredDir: string): string {
  const toolRel = path.join('mcd_worker', 'tools', 'compute_statistics.py');
  if (fs.existsSync(path.join(configuredDir, toolRel))) {
    return configuredDir;
  }
  if (fs.existsSync(path.join(DEFAULT_ENGINE_DIR, toolRel))) {
    return DEFAULT_ENGINE_DIR;
  }
  return configuredDir;
}

// ---------------------------------------------------------------------------
// 1. Python statistics runner (`python -B -m mcd_worker.tools.compute_statistics`)
// ---------------------------------------------------------------------------

export interface StatisticsRunnerSettings {
  python: string;
  engineDir: string;
  timeoutMs: number;
}

export class PythonStatisticsRunner implements StatisticsRunner {
  constructor(
    private readonly settings: StatisticsRunnerSettings,
    private readonly spawnProcess: typeof spawn = spawn
  ) {}

  args(): string[] {
    return ['-B', '-m', 'mcd_worker.tools.compute_statistics'];
  }

  compute(request: {
    occurrences: StateOccurrenceInput[];
    bars: ClosedM5BarInput[];
    horizons?: readonly number[];
  }): Promise<StatisticsEngineResult> {
    const python = this.settings.python;
    const engineDir = resolveStatisticsEngineDir(this.settings.engineDir);
    const timeoutMs = this.settings.timeoutMs;
    const body = JSON.stringify({
      request_version: STATISTICS_REQUEST_VERSION,
      occurrences: request.occurrences,
      bars: request.bars,
      horizons: request.horizons ?? [...HORIZON_HOURS],
    });

    return new Promise<StatisticsEngineResult>((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawnProcess(python, this.args(), {
          cwd: engineDir,
          env: {
            ...process.env,
            PYTHONDONTWRITEBYTECODE: '1',
            PYTHONIOENCODING: 'utf-8',
          },
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (error) {
        reject(
          new RunnerError(
            'SPAWN',
            `cannot start "${python}" (${(error as Error).message})`,
            false
          )
        );
        return;
      }

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let tooLarge = false;
      let settled = false;

      const settle = (finish: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finish();
      };
      const log = (): string => Buffer.concat(stderr).toString('utf8');

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        settle(() =>
          reject(
            new RunnerError(
              'TIMEOUT',
              `the statistics runner took more than ${timeoutMs} ms and was killed`,
              true,
              { stderr: log() }
            )
          )
        );
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          tooLarge = true;
          child.kill('SIGKILL');
          return;
        }
        stdout.push(chunk);
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderrBytes >= MAX_STDERR_BYTES) return;
        const room = MAX_STDERR_BYTES - stderrBytes;
        stderr.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
        stderrBytes += Math.min(chunk.length, room);
      });
      child.on('error', (error) =>
        settle(() =>
          reject(
            new RunnerError(
              'SPAWN',
              `cannot start "${python}" (${error.message})`,
              false
            )
          )
        )
      );
      child.stdin?.on('error', () => undefined);
      child.on('close', (code, signal) =>
        settle(() => {
          if (tooLarge) {
            reject(
              new RunnerError(
                'OUTPUT',
                `the statistics runner wrote more than ${MAX_STDOUT_BYTES} bytes`,
                false,
                { exitCode: code, stderr: log() }
              )
            );
            return;
          }
          if (code === 0) {
            try {
              const raw = Buffer.concat(stdout).toString('utf8').trim();
              const parsed = JSON.parse(raw) as unknown;
              if (
                !isRecord(parsed) ||
                parsed['result_version'] !== STATISTICS_RESULT_VERSION ||
                !Array.isArray(parsed['rows']) ||
                typeof parsed['occurrences'] !== 'number' ||
                !isRecord(parsed['unavailable'])
              ) {
                throw new RunnerError(
                  'OUTPUT',
                  'the statistics runner returned an invalid result payload',
                  false
                );
              }
              resolve({
                rows: parsed['rows'] as StateStatisticsRow[],
                occurrences: parsed['occurrences'],
                unavailable: parsed['unavailable'] as Record<string, number>,
              });
            } catch (error) {
              reject(
                error instanceof RunnerError
                  ? error
                  : new RunnerError(
                      'OUTPUT',
                      `cannot parse statistics runner output (${(error as Error).message})`,
                      false,
                      { exitCode: code, stderr: log() }
                    )
              );
            }
            return;
          }
          const firstLine =
            log()
              .split('\n')
              .find((l) => l.trim() !== '') ?? 'no message on stderr';
          if (code === 2) {
            reject(
              new RunnerError(
                'REQUEST',
                `the statistics runner refused the input (exit 2): ${firstLine}`,
                false,
                { exitCode: code, stderr: log() }
              )
            );
            return;
          }
          reject(
            new RunnerError(
              'EXIT',
              `the statistics runner failed (${code === null ? `signal ${String(signal)}` : `exit ${code}`}): ${firstLine}`,
              true,
              { exitCode: code, stderr: log() }
            )
          );
        })
      );

      child.stdin?.end(body);
    });
  }
}

// ---------------------------------------------------------------------------
// 2. Occurrence extraction & episode collapsing
// ---------------------------------------------------------------------------

/**
 * Extract `config_hash` from a canonical `mcd-output/1` envelope JSON string.
 * Returns `{}` when the envelope has no `config_hash` object (e.g. MCD0 gate).
 */
export function configHashFromEnvelopeJson(
  envelopeJson: string
): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelopeJson);
  } catch {
    throw new Error('envelope_json is not valid JSON');
  }
  if (!isRecord(parsed)) {
    throw new Error('envelope_json is not a JSON object');
  }
  const rawHash = parsed['config_hash'];
  if (rawHash === undefined || rawHash === null) {
    return {};
  }
  if (!isRecord(rawHash)) {
    throw new Error('envelope config_hash is not an object');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHash)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/**
 * Convert stored or replayed sensor rows into `StateOccurrenceInput[]` according to
 * the chosen filter options (`statuses`, `excludeRetuning`, `mode`).
 */
export function occurrencesFromSensorRows(
  rows: readonly StoredOutputForStats[],
  options: OccurrenceFilterOptions = {}
): StateOccurrenceInput[] {
  const allowedStatuses = new Set(options.statuses ?? ['VALID', 'CAUTIONARY']);
  const excludeRetuning = options.excludeRetuning ?? false;
  const mode = options.mode ?? 'cycles';

  const ordered = [...rows].sort(
    (a, b) =>
      a.cycle_slot - b.cycle_slot ||
      a.mcd_id.localeCompare(b.mcd_id, 'en', { numeric: true })
  );

  const occurrences: StateOccurrenceInput[] = [];
  for (const row of ordered) {
    if (!allowedStatuses.has(row.status)) continue;
    if (excludeRetuning && (row.retuning_observed || row.retuning_applied)) {
      continue;
    }
    if (
      typeof row.state_code !== 'string' ||
      row.state_code === '' ||
      typeof row.bias !== 'string' ||
      row.bias === ''
    ) {
      continue;
    }
    const configHash = configHashFromEnvelopeJson(row.envelope_json);
    occurrences.push({
      mcd_id: row.mcd_id,
      evaluator_version_series: evaluatorSeriesOf(row.evaluator_version),
      config_hash_key: configHashKeyOf(configHash),
      state_code: row.state_code,
      bias: row.bias,
      slot: row.cycle_slot,
    });
  }

  return mode === 'episodes' ? collapseToEpisodes(occurrences) : occurrences;
}

/**
 * Collapse consecutive 5-minute cycle occurrences of the same `(mcd_id, series, config_hash_key, state_code)`
 * into a single episode occurrence at the first slot of each contiguous run (Handoff part 6 §6 decision 2).
 */
export function collapseToEpisodes(
  occurrences: readonly StateOccurrenceInput[]
): StateOccurrenceInput[] {
  const bySeries = new Map<string, StateOccurrenceInput[]>();
  for (const occ of occurrences) {
    const key = `${occ.mcd_id}|${occ.evaluator_version_series}|${occ.config_hash_key}`;
    const list = bySeries.get(key);
    if (list) list.push(occ);
    else bySeries.set(key, [occ]);
  }

  const out: StateOccurrenceInput[] = [];
  for (const list of bySeries.values()) {
    const sorted = [...list].sort((a, b) => a.slot - b.slot);
    let prev: StateOccurrenceInput | null = null;
    for (const occ of sorted) {
      const isContinuation =
        prev !== null &&
        prev.state_code === occ.state_code &&
        occ.slot - prev.slot === TIMEFRAME_SECONDS.M5;
      if (!isContinuation) {
        out.push(occ);
      }
      prev = occ;
    }
  }
  return out.sort(
    (a, b) =>
      a.slot - b.slot ||
      a.mcd_id.localeCompare(b.mcd_id, 'en', { numeric: true })
  );
}

// ---------------------------------------------------------------------------
// 3. Forming-bar / refit drift check (`market_data_point_in_time` vs `market_data_v6`)
// ---------------------------------------------------------------------------

const CHANNEL_VALUE_COLUMNS: readonly string[] = Object.freeze(
  BAR_COLUMNS.filter((c) => c !== 'timestamp' && c !== 'close')
);

/**
 * Compare `market_data_point_in_time` rows (`snapshot_age_bars = 1`, each bar frozen at its close)
 * with `market_data_v6` rows (refitted by later cycles) over the same `(symbol, timeframe, timestamp)`.
 * Answers `deploy-stack-d-step3.md` §6 Step 1.
 */
export function computeTimeframeDrift(
  timeframe: Timeframe,
  snapshots: ReadonlyArray<Record<string, unknown>>,
  liveBars: ReadonlyArray<Record<string, unknown>>,
  columns: readonly string[] = CHANNEL_VALUE_COLUMNS
): TimeframeDriftReport {
  const liveByTs = new Map<number, Record<string, unknown>>();
  for (const row of liveBars) {
    if (isFiniteNumber(row['timestamp'])) {
      liveByTs.set(row['timestamp'], row);
    }
  }

  let matchedBars = 0;
  const stats = new Map<
    string,
    { compared: number; changed: number; maxAbs: number; sumAbs: number }
  >();
  for (const col of columns) {
    stats.set(col, { compared: 0, changed: 0, maxAbs: 0, sumAbs: 0 });
  }

  for (const snap of snapshots) {
    const ts = snap['timestamp'];
    if (!isFiniteNumber(ts)) continue;
    const live = liveByTs.get(ts);
    if (!live) continue;
    matchedBars += 1;

    for (const col of columns) {
      const a = snap[col];
      const b = live[col];
      if (!isFiniteNumber(a) || !isFiniteNumber(b)) continue;
      const diff = Math.abs(a - b);
      const entry = stats.get(col)!;
      entry.compared += 1;
      if (diff > 0) entry.changed += 1;
      if (diff > entry.maxAbs) entry.maxAbs = diff;
      entry.sumAbs += diff;
    }
  }

  const summaries: DriftColumnSummary[] = [];
  for (const col of columns) {
    const entry = stats.get(col)!;
    if (entry.compared === 0) continue;
    summaries.push({
      column: col,
      comparedBars: entry.compared,
      changedBars: entry.changed,
      maxAbsDiff: Number(entry.maxAbs.toFixed(6)),
      meanAbsDiff: Number((entry.sumAbs / entry.compared).toFixed(6)),
    });
  }

  return {
    timeframe,
    snapshotBars: snapshots.length,
    matchedBars,
    columns: summaries,
  };
}

// ---------------------------------------------------------------------------
// 4. Point-in-time bundle builder & replay (`market_data_point_in_time` + `market_data_v6`)
// ---------------------------------------------------------------------------

/**
 * Overlay point-in-time channel columns (`snapshot_age_bars <= maxSnapshotAgeBars`) onto the
 * immutable `(timestamp, close)` spine of `market_data_v6`. When a bar has a qualifying
 * `market_data_point_in_time` snapshot, its channel columns come from that snapshot; otherwise
 * they fall back to the `market_data_v6` row (for historical bars recorded before the snapshot
 * migration).
 */
export function mergePointInTimeBars(
  spineBars: ReadonlyArray<Record<string, unknown>>,
  snapshots: ReadonlyArray<Record<string, unknown>>,
  maxSnapshotAgeBars = 1
): Array<Record<string, number | null>> {
  const snapByTs = new Map<number, Record<string, unknown>>();
  for (const snap of snapshots) {
    const ts = snap['timestamp'];
    const age = snap['snapshot_age_bars'];
    if (
      isFiniteNumber(ts) &&
      (age === undefined ||
        (isFiniteNumber(age) && age >= 1 && age <= maxSnapshotAgeBars))
    ) {
      snapByTs.set(ts, snap);
    }
  }

  const ordered = [...spineBars].sort(
    (a, b) => (a['timestamp'] as number) - (b['timestamp'] as number)
  );
  return ordered.map((bar) => {
    const ts = bar['timestamp'] as number;
    const snap = snapByTs.get(ts);
    const merged: Record<string, number | null> = {
      timestamp: ts,
      close: jsonValue(bar['close'], 'bar column close') as number,
    };
    for (const col of CHANNEL_VALUE_COLUMNS) {
      const raw = snap !== undefined && col in snap ? snap[col] : bar[col];
      merged[col] = jsonValue(raw, `bar column ${col}`) as number | null;
    }
    return merged;
  });
}

// ---------------------------------------------------------------------------
// 5. Database interface and loaders
// ---------------------------------------------------------------------------

export type CertifyDatabase = Pick<
  PrismaClient,
  | 'mcdOutput'
  | 'marketDataV6'
  | 'marketDataPointInTime'
  | 'marketCycle'
  | 'indicatorStatistic'
  | 'activeIndicatorSetting'
>;

const CYCLE_COLUMNS = {
  slot: true,
  data_status: true,
  ready_at: true,
  attempts: true,
  retuning: true,
  closed_bars_digest: true,
  check_detail: true,
  m5_export_at: true,
  m15_export_at: true,
  m5_collection_cycle_id: true,
  manifest_received_at: true,
  collector_started_at: true,
  collector_validated_at: true,
  config_hashes: true,
  source_modes: true,
} as const;

type ReadyRow = CycleRow & { config_hashes: unknown; source_modes: unknown };

/**
 * Build a `CycleInputsBundle` for `slot` whose channel columns come from `market_data_point_in_time`
 * (`snapshot_age_bars = 1`) joined with the `(timestamp, close)` spine of `market_data_v6`.
 */
export async function loadPointInTimeCycleBundle(
  prisma: CertifyDatabase,
  symbol: string,
  slot: number
): Promise<CycleInputsBundle | null> {
  if (!isSlot(slot)) return null;
  const collectedAt = statsSlots(slot);
  const cycleRows = (await prisma.marketCycle.findMany({
    where: {
      symbol,
      slot: { in: [...new Set([collectedAt.M5, collectedAt.M15])] },
      state: 'READY',
    },
    select: CYCLE_COLUMNS,
  })) as unknown as ReadyRow[];

  const m5Cycle = cycleRows.find((r) => r.slot === collectedAt.M5);
  if (!m5Cycle || invalidCycleRow(m5Cycle) !== null) return null;
  const m5Tuning = readTuning(m5Cycle);
  if (!m5Tuning.ok) return null;

  const m15Cycle = cycleRows.find((r) => r.slot === collectedAt.M15);
  const m15Tuning =
    m15Cycle && invalidCycleRow(m15Cycle) === null
      ? readTuning(m15Cycle)
      : { ok: false as const, detail: 'not ready' };
  const collected: Record<Timeframe, boolean> = {
    M5: true,
    M15: Boolean(m15Cycle && m15Tuning.ok),
  };

  // Resolve active indicator at slot: check history first, fall back to current setting
  const currentSettings = await prisma.activeIndicatorSetting.findMany({
    where: { timeframe: { in: [...TIMEFRAMES] } },
  });
  const active: Partial<Record<Timeframe, string>> = {};
  for (const row of currentSettings) {
    const tf = row.timeframe as Timeframe;
    if (TIMEFRAMES.includes(tf)) {
      active[tf] = kitIndicatorOf(row.source);
    }
  }

  // Load indicator_statistics at exact statsSlots(slot)
  const statistics: CycleInputsBundle['statistics'] = {};
  for (const tf of TIMEFRAMES) {
    if (!collected[tf]) continue;
    const statRows = await prisma.indicatorStatistic.findMany({
      where: { symbol, timeframe: tf, captured_at: collectedAt[tf] },
      orderBy: { source: 'asc' },
    });
    const bySource: Record<string, StatisticsRecord> = {};
    for (const r of statRows) {
      bySource[r.source] = bundleStatisticsRow(r);
    }
    if (Object.keys(bySource).length > 0) statistics[tf] = bySource;
  }

  const activeRows: Partial<Record<Timeframe, StatisticsRecord | undefined>> =
    {};
  for (const tf of TIMEFRAMES) {
    const ind = active[tf];
    activeRows[tf] =
      ind === undefined ? undefined : statistics[tf]?.[statisticsSourceOf(ind)];
  }
  const wanted = closedBarsToSupply(activeRows);

  const barSelect = Object.fromEntries(BAR_COLUMNS.map((c) => [c, true]));
  const pitSelect = Object.fromEntries([
    ['timestamp', true],
    ['snapshot_age_bars', true],
    ...CHANNEL_VALUE_COLUMNS.map((c) => [c, true]),
  ]);

  const bars: Record<Timeframe, BarRecord[]> = { M5: [], M15: [] };
  for (const tf of TIMEFRAMES) {
    if (!collected[tf] || wanted[tf] <= 0) continue;
    const maxOpen = lastClosedBarOpen(tf, slot);
    const spine = (await prisma.marketDataV6.findMany({
      where: { symbol, timeframe: tf, timestamp: { lte: maxOpen } },
      orderBy: { timestamp: 'desc' },
      take: wanted[tf],
      select: barSelect,
    })) as unknown as Array<Record<string, unknown>>;
    if (spine.length === 0) continue;
    const minOpen = Math.min(...spine.map((r) => r['timestamp'] as number));
    const snaps = (await prisma.marketDataPointInTime.findMany({
      where: {
        symbol,
        timeframe: tf,
        timestamp: { gte: minOpen, lte: maxOpen },
        snapshot_age_bars: 1,
      },
      select: pitSelect,
    })) as unknown as Array<Record<string, unknown>>;

    const merged = mergePointInTimeBars(spine, snaps, 1);
    const windowCols = windowBarColumns(active[tf]);
    bars[tf] = merged
      .filter((b) => isClosedBar(b['timestamp'] as number, tf, slot))
      .map((row, idx, arr) => {
        const cols = idx === arr.length - 1 ? BAR_COLUMNS : windowCols;
        const out: Record<string, number | null> = {};
        for (const col of cols) out[col] = row[col] ?? null;
        return out as BarRecord;
      });
  }

  const usedSources: Partial<Record<Timeframe, string>> = {};
  const perTimeframe: Partial<Record<Timeframe, TimeframeTuning>> = {};
  for (const tf of TIMEFRAMES) {
    const ind = active[tf];
    if (ind !== undefined) usedSources[tf] = statisticsSourceOf(ind);
    if (tf === 'M5' && m5Tuning.ok && m5Tuning.tuning.M5) {
      perTimeframe.M5 = m5Tuning.tuning.M5;
    }
    if (tf === 'M15' && m15Tuning.ok && m15Tuning.tuning.M15) {
      perTimeframe.M15 = m15Tuning.tuning.M15;
    }
  }
  const mergedTuning = mergeTuning(usedSources, perTimeframe);

  return {
    symbol,
    cycle_slot: slotToIso(slot),
    data_status:
      mergedTuning.refusals.length > 0
        ? REFUSED_DATA_STATUS
        : (m5Cycle.data_status as string),
    retuning: m5Cycle.retuning,
    bars,
    statistics,
    stats_slot: {
      M5: slotToIso(collectedAt.M5),
      M15: slotToIso(collectedAt.M15),
    },
    active_indicator: active,
    config_hash: mergedTuning.config_hash,
    channel_mode: mergedTuning.channel_mode,
  };
}

// ---------------------------------------------------------------------------
// 6. Command-line options & execution
// ---------------------------------------------------------------------------

export interface CertifyCommandOptions {
  help: boolean;
  error: string | null;
  db: boolean;
  file: string | null;
  source: 'stored' | 'point-in-time';
  last: number | null;
  since: number | null;
  until: number | null;
  validOnly: boolean;
  excludeRetuning: boolean;
  mode: 'cycles' | 'episodes';
  compareDrift: boolean;
  write: boolean;
  json: boolean;
}

export const CERTIFY_USAGE = `Usage:
  node scripts/certify-state-statistics.js --db   [--source stored|point-in-time] [--last 1440] [--since <ISO|unix>] [--until <ISO|unix>]
                                                  [--valid-only] [--exclude-retuning] [--mode cycles|episodes] [--compare-drift] [--write] [--json]
  node scripts/certify-state-statistics.js --file <occurrences-and-bars.json> [--mode cycles|episodes] [--json]

Options:
  --db                         Read occurrences and closed M5 bars from DATABASE_URL
  --file <path>                Read { occurrences, bars } (or a golden state-statistics file) from disk
  --source stored|point-in-time  'stored' (default): read mcd_outputs accumulated in B3;
                               'point-in-time': rebuild bundles from market_data_point_in_time (snapshot_age_bars = 1)
                               and evaluate them through PythonCycleRunner
  --last <N>                   Limit to the newest N cycle slots (default: 1440 when --since/--until are omitted)
  --since <ISO|unix>           First cycle slot (inclusive)
  --until <ISO|unix>           Last cycle slot (inclusive)
  --valid-only                 Count VALID readings only (default counts VALID and CAUTIONARY)
  --exclude-retuning           Exclude readings where retuning_observed or retuning_applied is true
  --mode cycles|episodes       'cycles' (default, ADR-022) or 'episodes' (collapse consecutive 5m slots in the same state)
  --compare-drift              Compare market_data_point_in_time (snapshot_age_bars = 1) against market_data_v6 refit values
  --write                      Upsert computed rows into state_statistics via StateStatisticsWriter (default is dry-run)
  --json                       Print the certification report as JSON
  --help                       Print this usage`;

function parseSlotArg(raw: string, flag: string): number | string {
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return isSlot(n)
      ? n
      : `${flag} must be a 5-minute slot boundary, got ${raw}`;
  }
  const iso = isoToSlot(raw);
  if (iso !== null) return iso;
  const ms = Date.parse(raw);
  if (!Number.isNaN(ms)) {
    const sec = Math.floor(ms / 1000);
    if (isSlot(sec)) return sec;
  }
  return `${flag} must be an ISO 8601 UTC slot or unix seconds on a 5-minute grid, got ${raw}`;
}

export function parseCertifyArgs(
  argv: readonly string[]
): CertifyCommandOptions {
  const out: CertifyCommandOptions = {
    help: false,
    error: null,
    db: false,
    file: null,
    source: 'stored',
    last: null,
    since: null,
    until: null,
    validOnly: false,
    excludeRetuning: false,
    mode: 'cycles',
    compareDrift: false,
    write: false,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      return out;
    }
    if (arg === '--db') {
      out.db = true;
    } else if (arg === '--file') {
      const val = argv[i + 1];
      if (!val || val.startsWith('--')) {
        out.error = '--file needs a path';
        return out;
      }
      out.file = val;
      i += 1;
    } else if (arg === '--source') {
      const val = argv[i + 1];
      if (val !== 'stored' && val !== 'point-in-time') {
        out.error = '--source must be stored or point-in-time';
        return out;
      }
      out.source = val;
      i += 1;
    } else if (arg === '--last') {
      const val = argv[i + 1];
      if (!val || !/^[1-9]\d*$/.test(val)) {
        out.error = '--last must be a positive whole number';
        return out;
      }
      out.last = Number(val);
      i += 1;
    } else if (arg === '--since' || arg === '--until') {
      const val = argv[i + 1];
      if (!val) {
        out.error = `${arg} needs a slot`;
        return out;
      }
      const parsed = parseSlotArg(val, arg);
      if (typeof parsed === 'string') {
        out.error = parsed;
        return out;
      }
      if (arg === '--since') out.since = parsed;
      else out.until = parsed;
      i += 1;
    } else if (arg === '--valid-only') {
      out.validOnly = true;
    } else if (arg === '--exclude-retuning') {
      out.excludeRetuning = true;
    } else if (arg === '--mode') {
      const val = argv[i + 1];
      if (val !== 'cycles' && val !== 'episodes') {
        out.error = '--mode must be cycles or episodes';
        return out;
      }
      out.mode = val;
      i += 1;
    } else if (arg === '--compare-drift') {
      out.compareDrift = true;
    } else if (arg === '--write') {
      out.write = true;
    } else if (arg === '--json') {
      out.json = true;
    } else {
      out.error = `unknown argument ${arg}`;
      return out;
    }
  }

  if (!out.db && out.file === null) {
    out.error = 'choose one of --db or --file <path>';
    return out;
  }
  if (out.db && out.file !== null) {
    out.error = '--db and --file cannot be used together';
    return out;
  }
  if (out.write && !out.db) {
    out.error = '--write requires --db';
    return out;
  }
  if (out.since !== null && out.until !== null && out.since > out.until) {
    out.error = '--since must not be after --until';
    return out;
  }
  return out;
}

export function formatCertifyReport(report: CertifyReport): string {
  const lines: string[] = [];
  const span =
    report.firstSlot !== null && report.lastSlot !== null
      ? `, slots ${slotToIso(report.firstSlot)} to ${slotToIso(report.lastSlot)}`
      : '';
  lines.push(
    `State statistics certification (${report.source}, mode=${report.mode}, statuses=${report.statuses.join(',')}, excludeRetuning=${report.excludeRetuning})`
  );
  lines.push(
    `Evaluated: ${report.slotsEvaluated} slot(s)${span} | occurrences=${report.occurrencesTotal} | closed M5 bars=${report.barsCount}`
  );
  const unavail = Object.entries(report.unavailable)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  lines.push(`Unavailable outcomes: ${unavail || 'none'}`);
  lines.push(
    `Rows computed: ${report.rows.length} (${report.measuredRows} MEASURED n >= ${MIN_SAMPLE}, ${report.provisionalRows} PROVISIONAL n < ${MIN_SAMPLE})`
  );

  if (report.drift && report.drift.length > 0) {
    lines.push('');
    lines.push(
      'Forming-bar / refit drift check (market_data_point_in_time age=1 vs market_data_v6):'
    );
    for (const tfReport of report.drift) {
      lines.push(
        `  ${tfReport.timeframe}: ${tfReport.matchedBars} matched bar(s) of ${tfReport.snapshotBars} age-1 snapshot(s)`
      );
      for (const col of tfReport.columns.slice(0, 12)) {
        lines.push(
          `    ${col.column.padEnd(28)} compared=${String(col.comparedBars).padStart(4)} changed=${String(col.changedBars).padStart(4)} maxAbs=${col.maxAbsDiff.toFixed(4)} meanAbs=${col.meanAbsDiff.toFixed(4)}`
        );
      }
    }
  }

  if (report.rows.length > 0) {
    lines.push('');
    lines.push(
      'MCD   Series  Horizon  State                          n      Gate         Median       Q1       Q3  AdvMed    AdvQ3'
    );
    for (const r of report.rows) {
      const gate = r.n >= MIN_SAMPLE ? 'MEASURED   ' : 'PROVISIONAL';
      const fmt = (v: number | null) =>
        v === null ? '       -' : v.toFixed(2).padStart(8);
      lines.push(
        `${r.mcd_id.padEnd(5)} ${r.evaluator_version_series.padEnd(7)} ${String(r.horizon_hours).padStart(5)}h  ${r.state_code.padEnd(28)} ${String(r.n).padStart(5)}  ${gate} ${fmt(r.forward_move_median)} ${fmt(r.forward_move_q1)} ${fmt(r.forward_move_q3)} ${fmt(r.adverse_excursion_median)} ${fmt(r.adverse_excursion_q3)}`
      );
    }
  }

  if (report.writerProblems.length > 0) {
    lines.push('');
    lines.push(`Writer gate problems (${report.writerProblems.length}):`);
    for (const p of report.writerProblems) lines.push(`  - ${p}`);
  } else {
    lines.push('');
    lines.push(
      report.written
        ? `WRITE COMPLETE: ${report.writtenRows} row(s) upserted via StateStatisticsWriter.`
        : `DRY RUN: all ${report.rows.length} row(s) pass StateStatisticsWriter checks (pass --write to store).`
    );
  }
  return lines.join('\n');
}

export interface CertifyDependencies {
  openDatabase?: () => Promise<{
    database: CertifyDatabase;
    close: () => Promise<void>;
  }>;
  readFile?: (filePath: string) => string;
  statisticsRunner?: StatisticsRunner;
  cycleRunner?: CycleRunner;
}

export async function runCertifyCommand(
  options: CertifyCommandOptions,
  deps: CertifyDependencies = {}
): Promise<{ text: string; report: CertifyReport; exitCode: number }> {
  const sensorConfig = readSensorConfig(process.env);
  const statsRunner =
    deps.statisticsRunner ??
    new PythonStatisticsRunner({
      python: sensorConfig.python,
      engineDir: sensorConfig.engineDir,
      timeoutMs: sensorConfig.runnerTimeoutMs,
    });
  const statuses = options.validOnly ? ['VALID'] : ['VALID', 'CAUTIONARY'];

  if (options.file !== null) {
    const read = deps.readFile ?? ((p: string) => fs.readFileSync(p, 'utf8'));
    const raw = JSON.parse(read(options.file)) as unknown;
    if (!isRecord(raw)) {
      throw new Error(`${options.file} must contain a JSON object`);
    }
    let occurrences: StateOccurrenceInput[];
    let bars: ClosedM5BarInput[];
    let engineResult: StatisticsEngineResult;

    if (Array.isArray(raw['occurrences']) && Array.isArray(raw['bars'])) {
      occurrences = raw['occurrences'] as StateOccurrenceInput[];
      if (options.mode === 'episodes') {
        occurrences = collapseToEpisodes(occurrences);
      }
      bars = raw['bars'] as ClosedM5BarInput[];
      engineResult = await statsRunner.compute({ occurrences, bars });
    } else if (
      isRecord(raw['result']) &&
      Array.isArray(raw['result']['rows'])
    ) {
      // Supports verifying a golden state-statistics.rows.json file directly
      const res = raw['result'];
      occurrences = [];
      bars = [];
      engineResult = {
        rows: res['rows'] as StateStatisticsRow[],
        occurrences:
          typeof res['occurrences'] === 'number' ? res['occurrences'] : 0,
        unavailable: isRecord(res['unavailable'])
          ? (res['unavailable'] as Record<string, number>)
          : {},
      };
    } else {
      throw new Error(
        `${options.file} must hold { occurrences, bars } or { result: { rows, occurrences, unavailable } }`
      );
    }

    const writer = new StateStatisticsWriter({} as unknown as PrismaService);
    const writerProblems = writer.problems(engineResult.rows);
    const slots = [...new Set(occurrences.map((o) => o.slot))].sort(
      (a, b) => a - b
    );
    const report: CertifyReport = {
      mode: options.mode,
      source: 'file',
      statuses,
      excludeRetuning: options.excludeRetuning,
      slotsEvaluated: slots.length,
      firstSlot: slots[0] ?? null,
      lastSlot: slots[slots.length - 1] ?? null,
      occurrencesTotal: engineResult.occurrences,
      barsCount: bars.length,
      unavailable: engineResult.unavailable,
      rows: engineResult.rows,
      measuredRows: engineResult.rows.filter((r) => r.n >= MIN_SAMPLE).length,
      provisionalRows: engineResult.rows.filter((r) => r.n < MIN_SAMPLE).length,
      writerProblems,
      written: false,
      writtenRows: 0,
      drift: null,
    };
    return {
      text: options.json
        ? JSON.stringify(report, null, 2)
        : formatCertifyReport(report),
      report,
      exitCode: writerProblems.length > 0 ? 1 : 0,
    };
  }

  if (!deps.openDatabase) {
    throw new Error('openDatabase dependency is required for --db');
  }
  const { database, close } = await deps.openDatabase();
  try {
    const slotFilter: { gte?: number; lte?: number } = {};
    if (options.since !== null) slotFilter.gte = options.since;
    if (options.until !== null) slotFilter.lte = options.until;
    const cap =
      options.last ??
      (options.since === null && options.until === null
        ? DEFAULT_CERTIFY_LAST_CYCLES
        : null);

    let sensorRows: StoredOutputForStats[] = [];
    let evaluatedSlots: number[] = [];

    if (options.source === 'stored') {
      const allRows = await database.mcdOutput.findMany({
        where: {
          symbol: READER_SYMBOL,
          ...(Object.keys(slotFilter).length > 0
            ? { cycle_slot: slotFilter }
            : {}),
        },
        orderBy: [{ cycle_slot: 'desc' }, { mcd_id: 'asc' }],
        select: {
          cycle_slot: true,
          mcd_id: true,
          evaluator_version: true,
          status: true,
          state_code: true,
          bias: true,
          retuning_observed: true,
          retuning_applied: true,
          envelope_json: true,
        },
      });
      const distinctSlots = [...new Set(allRows.map((r) => r.cycle_slot))].sort(
        (a, b) => b - a
      );
      const keptSlots = new Set(
        cap !== null ? distinctSlots.slice(0, cap) : distinctSlots
      );
      sensorRows = allRows.filter((r) => keptSlots.has(r.cycle_slot));
      evaluatedSlots = [...keptSlots].sort((a, b) => a - b);
    } else {
      // Point-in-time replay over READY market_cycles
      const readyCycles = await database.marketCycle.findMany({
        where: {
          symbol: READER_SYMBOL,
          state: 'READY',
          ...(Object.keys(slotFilter).length > 0 ? { slot: slotFilter } : {}),
        },
        orderBy: { slot: 'desc' },
        ...(cap !== null ? { take: cap } : {}),
        select: { slot: true },
      });
      evaluatedSlots = readyCycles.map((r) => r.slot).sort((a, b) => a - b);

      const cycleRunner =
        deps.cycleRunner ??
        new PythonCycleRunner({
          python: sensorConfig.python,
          engineDir: sensorConfig.engineDir,
          workerConfigPath: sensorConfig.workerConfigPath,
          runnerTimeoutMs: sensorConfig.runnerTimeoutMs,
        });

      for (const slot of evaluatedSlots) {
        const bundle = await loadPointInTimeCycleBundle(
          database,
          READER_SYMBOL,
          slot
        );
        if (!bundle) continue;
        const output = await cycleRunner.run({
          bundle,
          retuningEnforced: options.excludeRetuning,
        });
        for (const res of output.result.results) {
          sensorRows.push({
            cycle_slot: slot,
            mcd_id: res.mcd_id,
            evaluator_version: res.evaluator_version,
            status: res.status,
            state_code: res.state_code,
            bias: res.bias,
            retuning_observed: output.result.retuning.observed,
            retuning_applied: output.result.retuning.applied,
            envelope_json: res.envelope_json,
          });
        }
      }
    }

    const occurrences = occurrencesFromSensorRows(sensorRows, {
      statuses,
      excludeRetuning: options.excludeRetuning,
      mode: options.mode,
    });

    let bars: ClosedM5BarInput[] = [];
    if (evaluatedSlots.length > 0) {
      const minTs = evaluatedSlots[0] - TIMEFRAME_SECONDS.M5;
      const maxTs =
        evaluatedSlots[evaluatedSlots.length - 1] + 144 * TIMEFRAME_SECONDS.M5;
      const rawBars = await database.marketDataV6.findMany({
        where: {
          symbol: READER_SYMBOL,
          timeframe: 'M5',
          timestamp: { gte: minTs, lte: maxTs },
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          high: true,
          low: true,
          close: true,
        },
      });
      bars = rawBars.filter(
        (b): b is ClosedM5BarInput =>
          isFiniteNumber(b.timestamp) &&
          b.timestamp % TIMEFRAME_SECONDS.M5 === 0 &&
          isFiniteNumber(b.high) &&
          isFiniteNumber(b.low) &&
          isFiniteNumber(b.close) &&
          b.low > 0 &&
          b.low <= b.close &&
          b.close <= b.high
      );
    }

    const engineResult = await statsRunner.compute({ occurrences, bars });
    const writer = new StateStatisticsWriter(
      database as unknown as PrismaService
    );
    const writerProblems = writer.problems(engineResult.rows);

    let drift: TimeframeDriftReport[] | null = null;
    if (options.compareDrift) {
      drift = [];
      for (const tf of TIMEFRAMES) {
        const snaps = (await database.marketDataPointInTime.findMany({
          where: {
            symbol: READER_SYMBOL,
            timeframe: tf,
            snapshot_age_bars: 1,
          },
          orderBy: { timestamp: 'desc' },
          take: 300,
        })) as unknown as Array<Record<string, unknown>>;
        const timestamps = snaps
          .map((s) => s['timestamp'])
          .filter(isFiniteNumber);
        const live =
          timestamps.length > 0
            ? ((await database.marketDataV6.findMany({
                where: {
                  symbol: READER_SYMBOL,
                  timeframe: tf,
                  timestamp: { in: timestamps },
                },
              })) as unknown as Array<Record<string, unknown>>)
            : [];
        const activeCols = CENTROID_INDICATORS.flatMap((ind) =>
          Object.values(channelColumns(ind))
        );
        drift.push(computeTimeframeDrift(tf, snaps, live, activeCols));
      }
    }

    let written = false;
    let writtenRows = 0;
    if (options.write && writerProblems.length === 0) {
      const summary = await writer.writeRows(engineResult.rows);
      written = true;
      writtenRows = summary.rows;
    }

    const report: CertifyReport = {
      mode: options.mode,
      source: options.source,
      statuses,
      excludeRetuning: options.excludeRetuning,
      slotsEvaluated: evaluatedSlots.length,
      firstSlot: evaluatedSlots[0] ?? null,
      lastSlot: evaluatedSlots[evaluatedSlots.length - 1] ?? null,
      occurrencesTotal: engineResult.occurrences,
      barsCount: bars.length,
      unavailable: engineResult.unavailable,
      rows: engineResult.rows,
      measuredRows: engineResult.rows.filter((r) => r.n >= MIN_SAMPLE).length,
      provisionalRows: engineResult.rows.filter((r) => r.n < MIN_SAMPLE).length,
      writerProblems,
      written,
      writtenRows,
      drift,
    };

    return {
      text: options.json
        ? JSON.stringify(report, null, 2)
        : formatCertifyReport(report),
      report,
      exitCode: writerProblems.length > 0 ? 1 : 0,
    };
  } finally {
    await close();
  }
}
