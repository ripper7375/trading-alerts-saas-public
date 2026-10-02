import { SLOT_SECONDS } from './slot';
import { FRESHNESS_THRESHOLDS, FreshnessThresholds } from './thresholds';

/**
 * The measurement kit for real cycles (STACK-D-ARCHITECTURE.md section 1.8, "One
 * real cycle, measured"; ADR-012; build step 2 part 10).
 *
 * Reads rows of `market_cycles` and says how the pipeline really behaves: how long
 * a cycle took from its slot to READY, how long the manifest took to arrive, how
 * long the gateway took to verify it, how old the newest bar was at the slot (the
 * open question of waiting-on.md: is the newest row the new-bar stub or the bar
 * about to close), and how the cycles split into FRESH, DELAYED, INCOMPLETE and
 * RETUNING. It decides nothing: confirming or replacing the ADR-012 thresholds is
 * Davin's call, made on these numbers and recorded as a new decision.
 *
 * This file is pure (rows in, numbers and text out) apart from `loadRows`, which
 * takes the one Prisma method it needs from the caller and only ever READS. The
 * command line lives in scripts/measure-cycles.js.
 *
 * PERCENTILES are nearest-rank: the p-th percentile of n sorted values is the value
 * at rank ceil(p / 100 * n), counting from 1 (never below 1). The data are whole
 * seconds, so an interpolated "12.4 s" would claim precision the data do not have,
 * and every percentile is a value that really occurred.
 *
 * CLOCKS. `slot` is a UTC slot, `manifest_received_at` and `ready_at` are the
 * gateway's clock, `collector_validated_at` and `*_export_at` are the VPS clock. A
 * difference across two clocks carries any skew between them: it is reported (a
 * negative value is how skew shows) but should be read with that in mind.
 */

/** The columns of a market_cycles row the kit reads. */
export interface CycleSample {
  symbol?: string | null;
  slot: number;
  state: string;
  data_status: string | null;
  attempts: number | null;
  manifest_received_at: number | null;
  ready_at: number | null;
  collector_started_at: number | null;
  collector_validated_at: number | null;
  m5_newest_bar_ts: number | null;
  m15_newest_bar_ts: number | null;
  m5_export_at: number | null;
  m15_export_at: number | null;
  retuning: boolean;
  backlog_rows: number | null;
  repush_rows_unsent: number | null;
  terminal_id: string | null;
}

/** The columns `loadRows` asks the database for: exactly the ones above. */
export const CYCLE_SAMPLE_COLUMNS = {
  symbol: true,
  slot: true,
  state: true,
  data_status: true,
  attempts: true,
  manifest_received_at: true,
  ready_at: true,
  collector_started_at: true,
  collector_validated_at: true,
  m5_newest_bar_ts: true,
  m15_newest_bar_ts: true,
  m5_export_at: true,
  m15_export_at: true,
  retuning: true,
  backlog_rows: true,
  repush_rows_unsent: true,
  terminal_id: true,
} as const;

export interface Distribution {
  count: number;
  min: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  mean: number;
  /** Values below 0: a negative duration means clock skew (or an export written before the slot). */
  negative: number;
}

/** Nearest-rank percentile of an ascending array; null for an empty one. */
export function percentile(
  sortedAscending: number[],
  p: number
): number | null {
  const n = sortedAscending.length;
  if (n === 0) return null;
  const rank = Math.min(n, Math.max(1, Math.ceil((p / 100) * n)));
  return sortedAscending[rank - 1];
}

export function distribution(values: number[]): Distribution | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, v) => total + v, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 50)!,
    p90: percentile(sorted, 90)!,
    p99: percentile(sorted, 99)!,
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    negative: sorted.filter((v) => v < 0).length,
  };
}

/** How many READY cycles met the ADR-012 deadline that applies to them. */
export interface DeadlineCheck {
  deadlineSec: number;
  count: number;
  within: number;
  over: number;
  /** within / count, or null when there were no such cycles. */
  shareWithin: number | null;
}

export interface ValueCount {
  value: number;
  count: number;
}

export interface MeasureReport {
  /** Rows measured (rows without a usable slot are not). */
  cycles: number;
  skipped: number;
  firstSlot: number | null;
  lastSlot: number | null;
  /**
   * Cycles by outcome. `RETUNING` overlaps the others: a FRESH cycle can be
   * RETUNING too (rule 9: RETUNING overlays a status, it does not replace one).
   * PENDING is a cycle whose manifest never reached a decision (a job that
   * exhausted its retries).
   */
  status: {
    FRESH: number;
    DELAYED: number;
    INCOMPLETE: number;
    PENDING: number;
    RETUNING: number;
  };
  /** ready_at - slot, READY cycles. The "slot to ready" time of section 1.8. */
  slotToReady: Distribution | null;
  /** manifest_received_at - slot, every cycle: how long until the manifest arrived. */
  ingestionDelay: Distribution | null;
  /** ready_at - manifest_received_at, READY cycles: the gateway's own time. */
  gatewayProcessing: Distribution | null;
  /**
   * slot - newest bar's open time. 0: the newest row is the stub of the bar that
   * just opened. 300 (M5) or 900 (M15): it is the bar that closes at the slot.
   */
  newestBarAge: { M5: Distribution | null; M15: Distribution | null };
  /** The same ages as a table of (value, count), most common first, at most 8. */
  newestBarAgeValues: { M5: ValueCount[]; M15: ValueCount[] };
  /** m5_export_at - slot: when the export the cycle was read from was written (negative: before the slot). */
  exportLag: Distribution | null;
  collector: {
    /** collector_validated_at - slot (VPS clock). */
    validatedAfterSlot: Distribution | null;
    /** manifest_received_at - collector_validated_at (two clocks). */
    manifestAfterValidated: Distribution | null;
  };
  /** ADR-012 as it is in force: READY cycles against the ready deadline. */
  deadlines: { firstTry: DeadlineCheck; retried: DeadlineCheck };
  retuning: {
    /** Cycles flagged RETUNING. */
    cycles: number;
    /** Runs of consecutive flagged cycles (in slot order). */
    episodes: number;
    /** Length of each run in seconds: last slot - first slot + one slot. */
    episodeSeconds: Distribution | null;
    /** The newest cycle is still RETUNING. */
    open: boolean;
  };
  terminals: Record<string, number>;
}

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** a - b for two values that may be missing; absent when either is. */
function gap(a: number | null, b: number | null): number | null {
  return isNumber(a) && isNumber(b) ? a - b : null;
}

function collect(rows: CycleSample[], pick: (r: CycleSample) => number | null) {
  const out: number[] = [];
  for (const row of rows) {
    const v = pick(row);
    if (v !== null) out.push(v);
  }
  return out;
}

function valueCounts(values: number[]): ValueCount[] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value - b.value)
    .slice(0, 8);
}

function deadlineCheck(values: number[], deadlineSec: number): DeadlineCheck {
  const within = values.filter((v) => v <= deadlineSec).length;
  return {
    deadlineSec,
    count: values.length,
    within,
    over: values.length - within,
    shareWithin: values.length > 0 ? within / values.length : null,
  };
}

/** Runs of consecutive RETUNING cycles, each as its length in seconds. */
function retuningEpisodes(sorted: CycleSample[]): number[] {
  const lengths: number[] = [];
  let startSlot: number | null = null;
  let lastSlot = 0;
  for (const row of sorted) {
    if (row.retuning) {
      if (startSlot === null) startSlot = row.slot;
      lastSlot = row.slot;
    } else if (startSlot !== null) {
      lengths.push(lastSlot - startSlot + SLOT_SECONDS);
      startSlot = null;
    }
  }
  if (startSlot !== null) lengths.push(lastSlot - startSlot + SLOT_SECONDS);
  return lengths;
}

export function measureCycles(
  input: CycleSample[],
  thresholds: FreshnessThresholds = FRESHNESS_THRESHOLDS
): MeasureReport {
  const rows = input
    .filter((r) => isNumber(r.slot))
    .sort((a, b) => a.slot - b.slot);
  const ready = rows.filter((r) => r.state === 'READY' && isNumber(r.ready_at));

  const slotToReady = collect(ready, (r) => gap(r.ready_at, r.slot));
  const firstTry = collect(
    ready.filter((r) => r.attempts === 1),
    (r) => gap(r.ready_at, r.slot)
  );
  const retried = collect(
    ready.filter((r) => isNumber(r.attempts) && r.attempts > 1),
    (r) => gap(r.ready_at, r.slot)
  );
  const ageM5 = collect(rows, (r) => gap(r.slot, r.m5_newest_bar_ts));
  const ageM15 = collect(rows, (r) => gap(r.slot, r.m15_newest_bar_ts));

  const terminals: Record<string, number> = {};
  for (const r of rows) {
    const key = r.terminal_id ?? 'unknown';
    terminals[key] = (terminals[key] ?? 0) + 1;
  }
  const episodes = retuningEpisodes(rows);

  return {
    cycles: rows.length,
    skipped: input.length - rows.length,
    firstSlot: rows.length > 0 ? rows[0].slot : null,
    lastSlot: rows.length > 0 ? rows[rows.length - 1].slot : null,
    status: {
      FRESH: ready.filter((r) => r.data_status === 'FRESH').length,
      DELAYED: ready.filter((r) => r.data_status === 'DELAYED').length,
      INCOMPLETE: rows.filter((r) => r.state === 'INCOMPLETE').length,
      PENDING: rows.filter((r) => r.state === 'PENDING').length,
      RETUNING: rows.filter((r) => r.retuning).length,
    },
    slotToReady: distribution(slotToReady),
    ingestionDelay: distribution(
      collect(rows, (r) => gap(r.manifest_received_at, r.slot))
    ),
    gatewayProcessing: distribution(
      collect(ready, (r) => gap(r.ready_at, r.manifest_received_at))
    ),
    newestBarAge: { M5: distribution(ageM5), M15: distribution(ageM15) },
    newestBarAgeValues: { M5: valueCounts(ageM5), M15: valueCounts(ageM15) },
    exportLag: distribution(collect(rows, (r) => gap(r.m5_export_at, r.slot))),
    collector: {
      validatedAfterSlot: distribution(
        collect(rows, (r) => gap(r.collector_validated_at, r.slot))
      ),
      manifestAfterValidated: distribution(
        collect(rows, (r) =>
          gap(r.manifest_received_at, r.collector_validated_at)
        )
      ),
    },
    deadlines: {
      firstTry: deadlineCheck(firstTry, thresholds.readyDeadlineSec),
      retried: deadlineCheck(retried, thresholds.readyDeadlineWithRetriesSec),
    },
    retuning: {
      cycles: rows.filter((r) => r.retuning).length,
      episodes: episodes.length,
      episodeSeconds: distribution(episodes),
      open: rows.length > 0 && rows[rows.length - 1].retuning,
    },
    terminals,
  };
}

// ---------------------------------------------------------------------------
// Text report
// ---------------------------------------------------------------------------

const isoOf = (unixSec: number | null): string =>
  unixSec === null
    ? 'n/a'
    : new Date(unixSec * 1000).toISOString().replace('.000Z', 'Z');

const num = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(1);

function row(label: string, d: Distribution | null): string {
  const cells = (
    d
      ? [d.count, d.min, d.p50, d.p90, d.p99, d.max, d.mean].map(num)
      : ['0', '-', '-', '-', '-', '-', '-']
  ).map((c) => c.padStart(8));
  const skew = d && d.negative > 0 ? `   (${d.negative} below 0)` : '';
  return `${label.padEnd(34)}${cells.join('')}${skew}`;
}

function deadlineLine(label: string, d: DeadlineCheck): string {
  const share =
    d.shareWithin === null ? 'n/a' : `${(d.shareWithin * 100).toFixed(1)}%`;
  return (
    `${label.padEnd(34)}deadline ${d.deadlineSec} s: ` +
    `${d.within} of ${d.count} within (${share}), ${d.over} over`
  );
}

function valuesLine(label: string, values: ValueCount[]): string {
  const body =
    values.length === 0
      ? 'none'
      : values.map((v) => `${v.value} s x ${v.count}`).join(', ');
  return `${label.padEnd(34)}${body}`;
}

/** The report as plain text, for a terminal or a saved file. */
export function formatReport(report: MeasureReport): string {
  const s = report.status;
  const lines: string[] = [
    `Cycle measurement: ${report.cycles} cycles` +
      (report.skipped > 0
        ? ` (${report.skipped} rows without a slot skipped)`
        : '') +
      `, slots ${isoOf(report.firstSlot)} to ${isoOf(report.lastSlot)}`,
    `Status: FRESH ${s.FRESH}, DELAYED ${s.DELAYED}, INCOMPLETE ${s.INCOMPLETE}, ` +
      `PENDING ${s.PENDING}; RETUNING ${s.RETUNING} (overlaps the others)`,
    '',
    `${'Seconds (nearest-rank percentiles)'.padEnd(34)}${[
      'count',
      'min',
      'p50',
      'p90',
      'p99',
      'max',
      'mean',
    ]
      .map((h) => h.padStart(8))
      .join('')}`,
    row('slot to ready (READY)', report.slotToReady),
    row('slot to manifest received', report.ingestionDelay),
    row('gateway: received to ready', report.gatewayProcessing),
    row('collector validated, after slot', report.collector.validatedAfterSlot),
    row(
      'manifest after validated (2 clocks)',
      report.collector.manifestAfterValidated
    ),
    row('M5 export written, vs slot', report.exportLag),
    row('newest M5 bar age at the slot', report.newestBarAge.M5),
    row('newest M15 bar age at the slot', report.newestBarAge.M15),
    '',
    valuesLine('newest M5 bar age, by value', report.newestBarAgeValues.M5),
    valuesLine('newest M15 bar age, by value', report.newestBarAgeValues.M15),
    '  (0 s: the newest row is the stub of the bar that just opened; 300 s (M5) or 900 s (M15):',
    '   it is the bar that closes at the slot)',
    '',
    'ADR-012 ready deadlines as they stand (starting values, not confirmed):',
    deadlineLine('  first try (1 attempt)', report.deadlines.firstTry),
    deadlineLine('  retried (more attempts)', report.deadlines.retried),
    '',
    `RETUNING: ${report.retuning.cycles} cycles in ${report.retuning.episodes} episodes` +
      (report.retuning.open ? ', the newest cycle is still RETUNING' : ''),
    row('  episode length', report.retuning.episodeSeconds),
    '',
    'Cycles by terminal: ' +
      (Object.keys(report.terminals).length === 0
        ? 'none'
        : Object.entries(report.terminals)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([t, n]) => `${t} ${n}`)
            .join(', ')),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Input: a file, or the database (read only), and the command line
// ---------------------------------------------------------------------------

const asNumber = (v: unknown): number | null => (isNumber(v) ? v : null);

/** A raw JSON object as a CycleSample, or null when it has no numeric slot. */
export function normalizeRow(raw: unknown): CycleSample | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isNumber(r['slot'])) return null;
  const text = (v: unknown): string | null =>
    typeof v === 'string' ? v : null;
  return {
    symbol: text(r['symbol']),
    slot: r['slot'],
    state: text(r['state']) ?? 'UNKNOWN',
    data_status: text(r['data_status']),
    attempts: asNumber(r['attempts']),
    manifest_received_at: asNumber(r['manifest_received_at']),
    ready_at: asNumber(r['ready_at']),
    collector_started_at: asNumber(r['collector_started_at']),
    collector_validated_at: asNumber(r['collector_validated_at']),
    m5_newest_bar_ts: asNumber(r['m5_newest_bar_ts']),
    m15_newest_bar_ts: asNumber(r['m15_newest_bar_ts']),
    m5_export_at: asNumber(r['m5_export_at']),
    m15_export_at: asNumber(r['m15_export_at']),
    retuning: r['retuning'] === true,
    backlog_rows: asNumber(r['backlog_rows']),
    repush_rows_unsent: asNumber(r['repush_rows_unsent']),
    terminal_id: text(r['terminal_id']),
  };
}

/**
 * Rows from a JSON text: an array of objects, or `{ "rows": [...] }`. Rows with no
 * numeric `slot` are dropped (and counted by the caller from the lengths).
 */
export function parseRowsJson(text: string): CycleSample[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`not valid JSON: ${(error as Error).message}`);
  }
  const wrapped =
    typeof data === 'object' && data !== null
      ? (data as { rows?: unknown }).rows
      : undefined;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(wrapped)
      ? wrapped
      : null;
  if (list === null) {
    throw new Error('expected a JSON array of market_cycles rows');
  }
  return list
    .map(normalizeRow)
    .filter((row): row is CycleSample => row !== null);
}

export interface CliOptions {
  help: boolean;
  /** Read rows from this JSON file instead of the database. */
  file: string | null;
  /** Read rows from the database (DATABASE_URL). */
  db: boolean;
  symbol: string;
  /** Unix seconds. */
  since: number | null;
  until: number | null;
  /** The newest N cycles (default 576, two days of slots) when neither bound is given. */
  last: number | null;
  json: boolean;
}

export const DEFAULT_LAST_CYCLES = 576;

export const USAGE = `Usage:
  node scripts/measure-cycles.js --db   [--symbol XAUUSD] [--last 576 | --since T --until T] [--json]
  node scripts/measure-cycles.js --file cycles.json [--symbol XAUUSD] [--json]

  --db       read market_cycles from the database in DATABASE_URL (read only: one SELECT)
  --file     read rows from a JSON file (an array of market_cycles rows, see the runbook)
  --since/--until  unix seconds or an ISO date (2026-10-03T00:00:00Z), on the slot
  --last     the newest N cycles (default ${DEFAULT_LAST_CYCLES}, two days of slots)
  --json     print the report as JSON instead of text`;

function parseTime(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** Command-line arguments (without `node` and the script) as options, or an error text. */
export function parseArgs(argv: string[]): CliOptions | { error: string } {
  const options: CliOptions = {
    help: false,
    file: null,
    db: false,
    symbol: 'XAUUSD',
    since: null,
    until: null,
    last: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = (): string | null => {
      i += 1;
      return i < argv.length ? argv[i] : null;
    };
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--db':
        options.db = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--file': {
        const v = value();
        if (v === null) return { error: '--file needs a path' };
        options.file = v;
        break;
      }
      case '--symbol': {
        const v = value();
        if (v === null || v === '') return { error: '--symbol needs a symbol' };
        options.symbol = v;
        break;
      }
      case '--since':
      case '--until': {
        const v = value();
        const t = v === null ? null : parseTime(v);
        if (t === null) {
          return { error: `${arg} needs unix seconds or an ISO date` };
        }
        if (arg === '--since') options.since = t;
        else options.until = t;
        break;
      }
      case '--last': {
        const v = value();
        if (v === null || !/^[1-9]\d*$/.test(v)) {
          return { error: '--last needs a positive whole number' };
        }
        options.last = Number(v);
        break;
      }
      default:
        return { error: `unknown argument ${arg}` };
    }
  }
  if (options.help) return options;
  if (options.db === (options.file !== null)) {
    return { error: 'give exactly one of --db and --file' };
  }
  if (
    options.since !== null &&
    options.until !== null &&
    options.since > options.until
  ) {
    return { error: '--since is after --until' };
  }
  return options;
}

/** The one Prisma method `loadRows` uses, so a caller cannot hand it anything that writes. */
export interface CycleRowSource {
  marketCycle: {
    findMany(args: {
      where: { symbol: string; slot?: { gte?: number; lte?: number } };
      orderBy: { slot: 'asc' | 'desc' };
      take?: number;
      select: typeof CYCLE_SAMPLE_COLUMNS;
    }): Promise<unknown[]>;
  };
}

/**
 * The cycles to measure, oldest first. With `since` or `until` the whole range
 * (capped by `last` when it is given too); with neither, the newest `last`.
 * READ ONLY: one `findMany` with a `select`.
 */
export async function loadRows(
  source: CycleRowSource,
  options: Pick<CliOptions, 'symbol' | 'since' | 'until' | 'last'>
): Promise<CycleSample[]> {
  const slot: { gte?: number; lte?: number } = {};
  if (options.since !== null) slot.gte = options.since;
  if (options.until !== null) slot.lte = options.until;
  const bounded = options.since !== null || options.until !== null;
  const take =
    options.last !== null
      ? options.last
      : bounded
        ? undefined
        : DEFAULT_LAST_CYCLES;
  const found = await source.marketCycle.findMany({
    where: { symbol: options.symbol, ...(bounded ? { slot } : {}) },
    orderBy: { slot: 'desc' },
    ...(take !== undefined ? { take } : {}),
    select: CYCLE_SAMPLE_COLUMNS,
  });
  return found
    .map(normalizeRow)
    .filter((r): r is CycleSample => r !== null)
    .reverse();
}
