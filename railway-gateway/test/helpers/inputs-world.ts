import { ActiveIndicatorService } from '../../src/cycle/active-indicator/active-indicator.service';
import {
  TIMEFRAMES,
  Timeframe,
  TIMEFRAME_SECONDS,
  formingBarOpen,
} from '../../src/cycle/slot';
import {
  BAR_COLUMNS,
  CycleInputsBundle,
  SR_COLUMNS,
  channelColumns,
  statisticsSourceOf,
} from '../../src/sensors/inputs/bundle-types';
import { CHANNEL_LENGTH_FIELDS } from '../../src/sensors/inputs/closed-channel';
import {
  LAST_PRICE_STATISTICS_FIELDS,
  LIVE_BAR_STATISTICS_FIELDS,
} from '../../src/sensors/inputs/statistics-fields';
import { isoToSlot, statsSlots } from '../../src/sensors/inputs/stats-slot';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * A database for the loader specs, built from a STORED bundle (`mcd_worker/fixtures/`):
 * the rows the gateway would hold if that cycle had arrived through the pipeline, plus
 * everything the loader must NOT read (the bar forming at the slot, bars after it,
 * statistics of other slots, the fields that describe the forming bar). Two appliers:
 * an in-memory stand-in for Prisma (unit specs) and the real client (the gated Postgres
 * spec). Both see the same plan, so what the unit specs prove is what the real database
 * is then asked.
 */

/** A value no real bar or statistic has: a leak of it into a bundle is recognisable. */
export const POISON = 424242.5;

type Row = Record<string, unknown>;

export interface SeedPlan {
  slot: number;
  bundle: CycleInputsBundle;
  configHashes: string[];
  cycles: Row[];
  bars: Row[];
  statistics: Row[];
  settings: Row[];
}

export interface SeedOptions {
  /** Add the bar forming at the slot and the bars after it, with POISON values (default true). */
  formingBars?: boolean;
  /** Add statistics rows of the previous and the next slot, with recognisable values (default true). */
  decoyStatistics?: boolean;
  /** Seed only the newest `n` closed bars of a timeframe (the rest of the bundle’s are left out of the table). */
  keepBars?: Partial<Record<Timeframe, number>>;
}

const SYMBOL = 'XAUUSD';

function cycleRow(
  slot: number,
  base: Row,
  hashes: Row,
  modes: Row,
  retuning: boolean
): Row {
  return {
    symbol: SYMBOL,
    slot,
    state: 'READY',
    data_status: base['data_status'],
    attempts: 1,
    manifest_received_at: slot + 61,
    ready_at: slot + 63,
    collector_started_at: slot + 5,
    collector_validated_at: slot + 20,
    m5_collection_cycle_id: 11,
    m15_collection_cycle_id: slot % 900 === 0 ? 12 : null,
    terminal_id: 'MT5-A',
    config_hashes: hashes,
    source_modes: modes,
    retuning,
    closed_bars_digest: null,
    check_detail: null,
    m5_export_at: slot - 1,
    m15_export_at: slot % 900 === 0 ? slot - 1 : null,
    ...base,
  };
}

/** The rows that make `bundle` the answer of the database loader, plus the traps. */
export function buildSeedPlan(
  bundle: CycleInputsBundle,
  options: SeedOptions = {}
): SeedPlan {
  const { formingBars = true, decoyStatistics = true } = options;
  const slot = isoToSlot(bundle.cycle_slot) as number;
  const collected = statsSlots(slot);

  // ---- the READY cycles: the one at the slot, and the one that collected M15 when it is an earlier slot
  const hashes: Record<Timeframe, Row> = { M5: {}, M15: {} };
  const modes: Record<Timeframe, Row> = { M5: {}, M15: {} };
  const configHashes = new Set<string>();
  for (const timeframe of TIMEFRAMES) {
    for (const [source, row] of Object.entries(
      bundle.statistics[timeframe] ?? {}
    )) {
      hashes[timeframe][source] = row['config_hash'];
      configHashes.add(row['config_hash'] as string);
      const mode = bundle.channel_mode[source];
      if (mode) modes[timeframe][source] = mode.toUpperCase();
    }
  }
  const cycles: Row[] = [];
  const atSlotTimeframes: Timeframe[] =
    collected.M15 === slot ? ['M5', 'M15'] : ['M5'];
  const section = (timeframes: Timeframe[], from: Record<Timeframe, Row>) =>
    Object.fromEntries(timeframes.map((tf) => [tf, from[tf]]));
  cycles.push(
    cycleRow(
      slot,
      { data_status: bundle.data_status },
      section(atSlotTimeframes, hashes),
      section(atSlotTimeframes, modes),
      bundle.retuning
    )
  );
  if (collected.M15 !== slot) {
    cycles.push(
      cycleRow(
        collected.M15,
        { data_status: 'FRESH' },
        section(['M15'], hashes),
        section(['M15'], modes),
        false
      )
    );
  }

  // ---- the bars: the stored closed bars, then the traps
  const bars: Row[] = [];
  const barRow = (timeframe: Timeframe, values: Row): Row => ({
    terminal_id: 'seed',
    symbol: SYMBOL,
    timeframe,
    open: values['close'],
    high: values['close'],
    low: values['close'],
    volume: 1,
    cycle_id: 11,
    collected_at: slot,
    ...Object.fromEntries(BAR_COLUMNS.map((c) => [c, null])),
    ...Object.fromEntries(SR_COLUMNS.map((c) => [c, null])),
    ...values,
  });
  for (const timeframe of TIMEFRAMES) {
    const keep = options.keepBars?.[timeframe];
    const stored = bundle.bars[timeframe];
    const kept = keep === undefined ? stored : stored.slice(-keep);
    kept.forEach((bar, index) => {
      // the stored bundle’s support and resistance levels belong to its last closed bar; every older bar holds none
      const levels =
        index === kept.length - 1
          ? (bundle.context_levels?.[timeframe] ?? {})
          : {};
      bars.push(barRow(timeframe, { ...bar, ...levels }));
    });
    if (formingBars) {
      const forming = formingBarOpen(timeframe, slot);
      const poisoned = Object.fromEntries(
        [...BAR_COLUMNS.filter((c) => c !== 'timestamp'), ...SR_COLUMNS].map(
          (c) => [c, POISON]
        )
      );
      for (const timestamp of [
        forming,
        forming + TIMEFRAME_SECONDS[timeframe],
      ]) {
        bars.push(barRow(timeframe, { ...poisoned, timestamp }));
      }
    }
  }

  // ---- the statistics: the stored rows at the slot each timeframe was last collected, then the traps
  const statistics: Row[] = [];
  const poisonedLive = Object.fromEntries(
    [...LIVE_BAR_STATISTICS_FIELDS, ...LAST_PRICE_STATISTICS_FIELDS].map(
      (field) => [field, POISON]
    )
  );
  const poisonedInts = {
    live_bar_ts: 4242,
    sr_dist_resistance_pts: 4242,
    sr_dist_support_pts: 4242,
  };
  for (const timeframe of TIMEFRAMES) {
    const capturedAt = collected[timeframe];
    for (const row of Object.values(bundle.statistics[timeframe] ?? {})) {
      statistics.push({
        ...row,
        ...poisonedLive,
        ...poisonedInts,
        terminal_id: 'seed',
        cycle_id: 11,
      });
      if (decoyStatistics) {
        for (const other of [
          capturedAt - TIMEFRAME_SECONDS[timeframe],
          capturedAt + TIMEFRAME_SECONDS[timeframe],
        ]) {
          statistics.push({
            ...row,
            ...poisonedLive,
            ...poisonedInts,
            captured_at: other,
            containment_rate: 1.25, // a value that would turn tier 4 into INVALID + CONTAINMENT_LOW if it were read
            terminal_id: 'seed',
            cycle_id: 11,
          });
        }
      }
    }
  }

  // ---- the setting: one row per timeframe, effective from slot 0 (as the migration seeds it)
  const settings = TIMEFRAMES.flatMap((timeframe) => {
    const indicator = bundle.active_indicator[timeframe];
    return indicator === undefined
      ? []
      : [
          {
            timeframe,
            source: statisticsSourceOf(indicator),
            effective_slot: 0,
            set_by: 'seed',
            reason: null,
          },
        ];
  });

  return {
    slot,
    bundle,
    configHashes: [...configHashes],
    cycles,
    bars,
    statistics,
    settings,
  };
}

// ---------------------------------------------------------------- shaping the world

/**
 * Make the active indicator’s channel on `timeframe` exactly `rows` closed rows long, the way
 * the replicas show a real channel (ADR-083): the statistics row at the slot says
 * `T_EDT = rows + 1` (the channel’s last row is the still-open bar), and the band and fit
 * columns are empty on every closed bar older than the newest `rows`. The table keeps the
 * older bars (they exist, they just carry no channel), so a loader that asks for `T_EDT`
 * bars gets one bar before the channel, which an evaluator at 2.0.1 never reads.
 */
export function shortenChannel(
  plan: SeedPlan,
  timeframe: Timeframe,
  rows: number
): void {
  const collected = statsSlots(plan.slot)[timeframe];
  const indicator = plan.bundle.active_indicator[timeframe] as string;
  const source = statisticsSourceOf(indicator);
  let changed = 0;
  for (const row of plan.statistics) {
    if (
      row['timeframe'] === timeframe &&
      row['source'] === source &&
      row['captured_at'] === collected
    ) {
      for (const field of CHANNEL_LENGTH_FIELDS) row[field] = rows + 1;
      changed += 1;
    }
  }
  if (changed !== 1)
    throw new Error(
      `expected one statistics row for ${timeframe} ${source}, found ${changed}`
    );
  const columns = Object.values(channelColumns(indicator));
  const closed = plan.bars
    .filter(
      (b) =>
        b['timeframe'] === timeframe &&
        (b['timestamp'] as number) + TIMEFRAME_SECONDS[timeframe] <= plan.slot
    )
    .sort((a, b) => (a['timestamp'] as number) - (b['timestamp'] as number));
  if (closed.length < rows)
    throw new Error(
      `the table holds ${closed.length} closed ${timeframe} bars, not ${rows}`
    );
  for (const bar of closed.slice(0, closed.length - rows)) {
    for (const column of columns) bar[column] = null;
  }
}

/**
 * Sources that M5 and M15 recorded under DIFFERENT hashes and that no timeframe uses. A
 * stored bundle keeps one hash per source (the kit’s provider took whichever row it read
 * last), the loader keeps none: no evaluator reads it, and neither chart’s hash is the
 * right one for the other (the plan’s S5). v3 and v4 hold one, `sr_levels`.
 */
export function ambiguousUnusedSources(stored: CycleInputsBundle): string[] {
  const used = new Set(
    Object.values(stored.active_indicator).map(statisticsSourceOf)
  );
  const hashes: Record<string, Set<string>> = {};
  for (const timeframe of TIMEFRAMES) {
    for (const [source, row] of Object.entries(
      stored.statistics[timeframe] ?? {}
    )) {
      (hashes[source] ??= new Set()).add(row['config_hash'] as string);
    }
  }
  return Object.entries(hashes)
    .filter(([source, set]) => set.size > 1 && !used.has(source))
    .map(([source]) => source)
    .sort();
}

/**
 * A stored bundle in the form the database loader writes it, which differs from it in
 * three documented ways and no other, and which is derived here independently of the loader:
 *   - bars carry what the evaluators read and no more: the last closed bar of a timeframe
 *     all 33 columns (null where that slot’s export had none; v3’s export had 17), every
 *     other bar only the open time, the close and the ACTIVE indicator’s four channel columns;
 *   - a source the two charts disagree on and nobody uses has no hash
 *     (`ambiguousUnusedSources`);
 *   - `context_levels` has all sixteen `sr_*` columns for every timeframe that has bars, null where the stored bundle has
 *     none (a replica workbook holds `sr_1` to `sr_8` only, and none on a timeframe it did not export), because that is
 *     what a table row holds; a stored bundle with no such section gets all-null levels.
 * The runner’s `inputs_sha256` of this form is the database bundle’s hash to the byte.
 */
export function loaderForm(stored: CycleInputsBundle): CycleInputsBundle {
  const out: CycleInputsBundle = JSON.parse(JSON.stringify(stored));
  for (const timeframe of TIMEFRAMES) {
    const active = stored.active_indicator[timeframe];
    const window = new Set([
      'timestamp',
      'close',
      ...(active === undefined ? [] : Object.values(channelColumns(active))),
    ]);
    const bars = stored.bars[timeframe];
    out.bars[timeframe] = bars.map((bar, index) => {
      const columns = index === bars.length - 1 ? BAR_COLUMNS : [...window];
      return Object.fromEntries(
        columns.map((column) => [column, bar[column] ?? null])
      ) as typeof bar;
    });
  }
  for (const source of ambiguousUnusedSources(stored))
    delete out.config_hash[source];
  const levels: NonNullable<CycleInputsBundle['context_levels']> = {};
  for (const timeframe of TIMEFRAMES) {
    if (stored.bars[timeframe].length === 0) continue;
    levels[timeframe] = Object.fromEntries(
      SR_COLUMNS.map((column) => [
        column,
        stored.context_levels?.[timeframe]?.[column] ?? null,
      ])
    );
  }
  if (Object.keys(levels).length > 0) out.context_levels = levels;
  else delete out.context_levels;
  return out;
}

// ---------------------------------------------------------------- comparing a loaded bundle with a stored one

/**
 * Every way `actual` (from the database loader) differs from `expected` (a fixture in the
 * loader’s form), as short sentences; empty means the same bundle. Key order does not
 * count; a missing key does, and so does a null where a number should be.
 */
export function bundleDifferences(
  actual: CycleInputsBundle,
  expected: CycleInputsBundle
): string[] {
  const stored = expected;
  const out: string[] = [];
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  for (const key of [
    'symbol',
    'cycle_slot',
    'data_status',
    'retuning',
    'statistics',
    'stats_slot',
    'active_indicator',
    'config_hash',
    'channel_mode',
    'context_levels',
  ] as const) {
    if (!same(actual[key], stored[key])) out.push(`${key} differs`);
  }
  for (const timeframe of TIMEFRAMES) {
    const a = actual.bars[timeframe];
    const s = stored.bars[timeframe];
    if (a.length !== s.length) {
      out.push(`bars.${timeframe}: ${a.length} bars, stored ${s.length}`);
      continue;
    }
    a.forEach((bar, index) => {
      for (const column of new Set([
        ...Object.keys(bar),
        ...Object.keys(s[index]),
      ])) {
        const x = column in bar ? bar[column] : '<absent>';
        const y = column in s[index] ? s[index][column] : '<absent>';
        if (x !== y)
          out.push(
            `bars.${timeframe}[${index}].${column}: ${String(x)} vs ${String(y)}`
          );
      }
    });
  }
  return out;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)])
    );
  }
  return value;
}

// ---------------------------------------------------------------- the in-memory stand-in

export interface LoggedQuery {
  /** `marketDataV6ContextLevels` is the one-row read of a bar's `sr_*` columns; `marketDataV6` is the bars read, so its counts are the bars queries'. */
  model:
    | 'marketCycle'
    | 'marketDataV6'
    | 'marketDataV6ContextLevels'
    | 'indicatorStatistic';
  op: string;
  args: Record<string, any>;
}

function project(row: Row, select: Record<string, boolean> | undefined): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [column, wanted] of Object.entries(select)) {
    if (wanted) out[column] = row[column];
  }
  return out;
}

/**
 * The reads the database source makes, and NOTHING else: no `findUnique` (so a changed query
 * fails loudly), no write of any kind, and `findFirst` only for the one bar whose `sr_*` columns
 * the bundle's `context_levels` hold. An unpinned statistics read throws, as the real rule 5
 * would want it to.
 */
export class FakeInputsPrisma {
  readonly queryLog: LoggedQuery[] = [];
  cycles: Row[] = [];
  bars: Row[] = [];
  statistics: Row[] = [];

  apply(plan: SeedPlan): this {
    this.cycles = plan.cycles.map((r) => ({ ...r }));
    this.bars = plan.bars.map((r) => ({ ...r }));
    this.statistics = plan.statistics.map((r) => ({ ...r }));
    return this;
  }

  marketCycle = {
    findMany: async (args: {
      where: { symbol: string; slot: { in: number[] }; state: string };
      select?: Record<string, boolean>;
    }) => {
      this.queryLog.push({ model: 'marketCycle', op: 'findMany', args });
      return this.cycles
        .filter(
          (r) =>
            r['symbol'] === args.where.symbol &&
            args.where.slot.in.includes(r['slot'] as number) &&
            r['state'] === args.where.state
        )
        .map((r) => project(r, args.select));
    },
  };

  marketDataV6 = {
    findMany: async (args: {
      where: { symbol: string; timeframe: string; timestamp: { lte: number } };
      orderBy: { timestamp: 'desc' };
      take: number;
      select: Record<string, boolean>;
    }) => {
      this.queryLog.push({ model: 'marketDataV6', op: 'findMany', args });
      return this.bars
        .filter(
          (r) =>
            r['symbol'] === args.where.symbol &&
            r['timeframe'] === args.where.timeframe &&
            (r['timestamp'] as number) <= args.where.timestamp.lte
        )
        .sort((a, b) => (b['timestamp'] as number) - (a['timestamp'] as number))
        .slice(0, args.take)
        .map((r) => project(r, args.select));
    },
    findFirst: async (args: {
      where: { symbol: string; timeframe: string; timestamp: number };
      select: Record<string, boolean>;
    }) => {
      this.queryLog.push({
        model: 'marketDataV6ContextLevels',
        op: 'findFirst',
        args,
      });
      if (typeof args.where.timestamp !== 'number') {
        throw new Error('the levels of ONE bar are read, by its open time');
      }
      const row = this.bars.find(
        (r) =>
          r['symbol'] === args.where.symbol &&
          r['timeframe'] === args.where.timeframe &&
          r['timestamp'] === args.where.timestamp
      );
      return row ? project(row, args.select) : null;
    },
  };

  indicatorStatistic = {
    findMany: async (args: {
      where: { symbol: string; timeframe: string; captured_at: number };
      orderBy: { source: 'asc' };
    }) => {
      this.queryLog.push({ model: 'indicatorStatistic', op: 'findMany', args });
      if (typeof args.where.captured_at !== 'number') {
        throw new Error('statistics must be read at ONE captured_at (rule 5)');
      }
      return this.statistics
        .filter(
          (r) =>
            r['symbol'] === args.where.symbol &&
            r['timeframe'] === args.where.timeframe &&
            r['captured_at'] === args.where.captured_at
        )
        .sort((a, b) => String(a['source']).localeCompare(String(b['source'])))
        .map((r) => ({
          // what Prisma adds to a stored row: its id and its creation time (both dropped from a bundle)
          ...r,
          createdAt: new Date(0),
          id: `stat_${String(r['source'])}_${String(r['captured_at'])}`,
        }));
    },
  };

  queries(model: LoggedQuery['model']): LoggedQuery[] {
    return this.queryLog.filter((q) => q.model === model);
  }

  asPrisma(): PrismaService {
    return this as unknown as PrismaService;
  }
}

/**
 * A stand-in for `ActiveIndicatorService.resolveAll`: the rows of `active_indicator_settings`
 * and the real resolution rule (the row with the greatest `effective_slot` at or before the
 * slot, the last written winning a tie), remembering what it was asked.
 */
export class FakeIndicators {
  readonly asked: number[] = [];

  constructor(public rows: Row[] = []) {}

  static fromPlan(plan: SeedPlan): FakeIndicators {
    return new FakeIndicators(plan.settings.map((s) => ({ ...s })));
  }

  /** Replace the setting by one source per timeframe, in force from slot 0; null or absent means no setting. */
  set settings(map: Partial<Record<Timeframe, string | null>>) {
    this.rows = TIMEFRAMES.flatMap((timeframe) =>
      map[timeframe]
        ? [
            {
              timeframe,
              source: map[timeframe],
              effective_slot: 0,
              set_by: 'test',
              reason: null,
            },
          ]
        : []
    );
  }

  async resolveAll(slot: number) {
    this.asked.push(slot);
    const out = {} as Record<Timeframe, unknown>;
    for (const timeframe of TIMEFRAMES) {
      const inForce = this.rows
        .filter(
          (r) =>
            r['timeframe'] === timeframe &&
            (r['effective_slot'] as number) <= slot
        )
        .reduce<Row | null>(
          (best, r) =>
            best === null ||
            (r['effective_slot'] as number) >=
              (best['effective_slot'] as number)
              ? r
              : best,
          null
        );
      out[timeframe] = inForce
        ? {
            settingId: `setting_${timeframe}`,
            timeframe,
            source: inForce['source'],
            effectiveSlot: inForce['effective_slot'],
            setBy: 'seed',
            reason: null,
            createdAt: 0,
          }
        : null;
    }
    return out;
  }

  asService(): ActiveIndicatorService {
    return this as unknown as ActiveIndicatorService;
  }
}
