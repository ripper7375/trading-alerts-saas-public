import { SpineBar } from '../../src/cycle/closed-bars-digest';
import { CycleManifest } from '../../src/cycle/cycle-manifest.contract';
import { listTimeframes } from '../../src/cycle/manifest-decision';
import { Timeframe } from '../../src/cycle/slot';
import { STATISTIC_SOURCES } from '../../src/cycle/read/read-types';

/**
 * In-memory stand-ins for what CycleManifestService touches: three Prisma tables
 * and two Bull queues. They implement only the filters the service really uses,
 * with the semantics the real thing has where they matter to the tests:
 *
 *   - createMany({ skipDuplicates }) is INSERT ... ON CONFLICT DO NOTHING on
 *     (symbol, slot), and a plain createMany on an existing key fails;
 *   - updateMany reports how many rows it changed, so a conditional update that
 *     matches nothing reports 0, which is how the service knows it lost a race;
 *   - a queue refuses a second job with a job id it already knows, like Bull.
 *
 * Whether Prisma turns those calls into the right SQL is not tested here; it
 * was checked once against a real Postgres (see the part 4 hand-off).
 */

type Row = Record<string, unknown>;

export interface FakeBar extends SpineBar {
  symbol: string;
  timeframe: string;
  /** The collection cycle that promoted the row (market_data_v6.cycle_id). */
  cycle_id: number;
}

/** An indicator_statistics row; only the columns the tests care about are typed. */
export interface FakeStat {
  symbol: string;
  timeframe: string;
  captured_at: number;
  source?: string;
  [column: string]: unknown;
}

/** Prisma's `select`: only the named columns come back. Without it, the whole row. */
function project<T extends object>(
  row: T,
  select?: Record<string, boolean>
): Record<string, unknown> {
  if (!select) return { ...row } as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [column, wanted] of Object.entries(select)) {
    if (wanted) out[column] = (row as Record<string, unknown>)[column];
  }
  return out;
}

/** An active_indicator_settings row. */
export interface FakeSetting {
  id: string;
  timeframe: string;
  source: string;
  effective_slot: number;
  set_by: string;
  reason: string | null;
  createdAt: Date;
}

type OrderBy = Array<Record<string, 'asc' | 'desc'>>;

/** Prisma's array `orderBy`: the first key decides, the next ones break ties. */
function sortBy<T extends object>(rows: T[], orderBy: OrderBy): T[] {
  return [...rows].sort((a, b) => {
    for (const clause of orderBy) {
      const [[column, direction]] = Object.entries(clause);
      const x = (a as Record<string, unknown>)[column] as
        | number
        | string
        | Date;
      const y = (b as Record<string, unknown>)[column] as
        | number
        | string
        | Date;
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}

export interface LoggedQuery {
  model: string;
  op: string;
  args: any;
}

/** A cycle_events row as the fake keeps it: the columns the tests read. */
export interface FakeEvent {
  symbol: string;
  event_type: string;
  effective_slot: number;
  dedupe_key: string;
  terminal_id: string | null;
  config_hashes: unknown;
  source_modes: unknown;
  detail: unknown;
}

/** A Prisma filter on an integer column: equality, or a range. */
type IntFilter = number | { lt?: number; gt?: number };

function matchesInt(value: unknown, filter: IntFilter | undefined): boolean {
  if (filter === undefined) return true;
  if (typeof filter === 'number') return value === filter;
  const n = value as number;
  return (
    (filter.lt === undefined || n < filter.lt) &&
    (filter.gt === undefined || n > filter.gt)
  );
}

export class FakePrisma {
  cycles = new Map<string, Row>();
  bars: FakeBar[] = [];
  stats: FakeStat[] = [];

  /**
   * cycle_events rows, in insertion order. Append-only like the real table: the
   * fake offers `createMany` and nothing else, and `dedupe_key` is unique.
   */
  events: FakeEvent[] = [];

  /** active_indicator_settings rows, in insertion order. */
  settings: FakeSetting[] = [];
  private settingSeq = 0;
  /** What `createdAt` the next created setting gets: one second after the last, so ties are resolved by the clock. */
  private settingClockMs = 1_790_000_000_000;

  /** An empty settings table with the id counter and the write clock back at their start. */
  resetSettings(): void {
    this.settings = [];
    this.settingSeq = 0;
    this.settingClockMs = 1_790_000_000_000;
  }

  /** The two starting rows the migration seeds (ADR-010): M15 non_b, M5 best_fit_a, effective from slot 0. */
  seedActiveIndicators(): void {
    const createdAt = new Date(1_700_000_000_000);
    this.settings.push(
      {
        id: 'seed_active_indicator_m15_non_b',
        timeframe: 'M15',
        source: 'non_b',
        effective_slot: 0,
        set_by: 'migration',
        reason: 'ADR-010 starting value',
        createdAt,
      },
      {
        id: 'seed_active_indicator_m5_best_fit_a',
        timeframe: 'M5',
        source: 'best_fit_a',
        effective_slot: 0,
        set_by: 'migration',
        reason: 'ADR-010 starting value',
        createdAt,
      }
    );
  }

  /** Every query the code under test made, in order (model, operation, arguments). */
  queryLog: LoggedQuery[] = [];
  queries(model: string, op?: string): LoggedQuery[] {
    return this.queryLog.filter(
      (q) => q.model === model && (op === undefined || q.op === op)
    );
  }

  /** Make the next call of the named operation throw (a database that goes away). */
  failNext: Partial<
    Record<'createMany' | 'updateMany' | 'findMany' | 'eventCreateMany', Error>
  > = {};
  /** Make updateMany report this many changed rows regardless (a lost race). */
  updateManyReports?: number;

  calls = {
    createMany: 0,
    findUnique: 0,
    updateMany: 0,
    barCount: 0,
    barFindMany: 0,
    barFindUnique: 0,
    statCount: 0,
  };

  private take(
    op: 'createMany' | 'updateMany' | 'findMany' | 'eventCreateMany'
  ): void {
    const error = this.failNext[op];
    if (error) {
      delete this.failNext[op];
      throw error;
    }
  }

  private key(symbol: string, slot: number): string {
    return `${symbol}_${slot}`;
  }

  marketCycle = {
    createMany: async (args: {
      data: Row[];
      skipDuplicates?: boolean;
    }): Promise<{ count: number }> => {
      this.calls.createMany += 1;
      this.take('createMany');
      let count = 0;
      for (const row of args.data) {
        const k = this.key(row['symbol'] as string, row['slot'] as number);
        if (this.cycles.has(k)) {
          if (args.skipDuplicates) continue;
          throw new Error(`unique constraint failed on market_cycles ${k}`);
        }
        this.cycles.set(k, {
          retuning: false,
          data_status: null,
          ready_at: null,
          closed_bars_digest: null,
          check_detail: null,
          ...row,
        });
        count += 1;
      }
      return { count };
    },

    /**
     * Implements the filters the code uses (`symbol`, `state` equality, `slot`
     * as equality or `lt` / `gt`), an `orderBy` on slot, and `select` projection. A filter that is not in
     * `where` is not applied, which is what makes a forgotten `state: 'READY'`
     * visible: the non-READY row comes back.
     */
    findFirst: async (args: {
      where: {
        symbol?: string;
        slot?: IntFilter;
        state?: string;
      };
      orderBy?: { slot: 'asc' | 'desc' };
      select?: Record<string, boolean>;
    }): Promise<Row | null> => {
      this.queryLog.push({ model: 'marketCycle', op: 'findFirst', args });
      const { symbol, slot, state } = args.where;
      const direction = args.orderBy?.slot === 'asc' ? 1 : -1;
      const found = [...this.cycles.values()]
        .filter(
          (r) =>
            (symbol === undefined || r['symbol'] === symbol) &&
            matchesInt(r['slot'], slot) &&
            (state === undefined || r['state'] === state)
        )
        .sort(
          (a, b) => direction * ((a['slot'] as number) - (b['slot'] as number))
        );
      return found.length > 0 ? project(found[0], args.select) : null;
    },

    findUnique: async (args: {
      where: { symbol_slot: { symbol: string; slot: number } };
      select?: Record<string, boolean>;
    }): Promise<Row | null> => {
      this.calls.findUnique += 1;
      const { symbol, slot } = args.where.symbol_slot;
      const row = this.cycles.get(this.key(symbol, slot));
      return row ? { ...row } : null;
    },

    updateMany: async (args: {
      where: { symbol: string; slot: number; state: string };
      data: Row;
    }): Promise<{ count: number }> => {
      this.calls.updateMany += 1;
      this.take('updateMany');
      const row = this.cycles.get(this.key(args.where.symbol, args.where.slot));
      if (!row || row['state'] !== args.where.state) return { count: 0 };
      Object.assign(row, args.data);
      return { count: this.updateManyReports ?? 1 };
    },
  };

  /**
   * The events table is append-only: `createMany` and nothing else, so code that
   * tried to update or delete an event fails with a TypeError. A repeat of a
   * `dedupe_key` is skipped with `skipDuplicates` and an error without it, as the
   * unique index does.
   */
  cycleEvent = {
    createMany: async (args: {
      data: FakeEvent[];
      skipDuplicates?: boolean;
    }): Promise<{ count: number }> => {
      this.queryLog.push({ model: 'cycleEvent', op: 'createMany', args });
      this.take('eventCreateMany');
      let count = 0;
      for (const row of args.data) {
        if (this.events.some((e) => e.dedupe_key === row.dedupe_key)) {
          if (args.skipDuplicates) continue;
          throw new Error(
            `unique constraint failed on cycle_events ${row.dedupe_key}`
          );
        }
        this.events.push(JSON.parse(JSON.stringify(row)) as FakeEvent);
        count += 1;
      }
      return { count };
    },

    /**
     * The one read the service makes: the latest event of a type for a symbol at
     * or before a slot (`effective_slot` as `lte`), by `orderBy` on that column.
     * Filters that are not in `where` are not applied, so a forgotten `event_type`
     * returns an event of another type.
     */
    findFirst: async (args: {
      where: {
        symbol?: string;
        event_type?: string;
        effective_slot?: { lte?: number };
      };
      orderBy?: { effective_slot: 'asc' | 'desc' };
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null> => {
      this.queryLog.push({ model: 'cycleEvent', op: 'findFirst', args });
      const { symbol, event_type, effective_slot } = args.where;
      const direction = args.orderBy?.effective_slot === 'asc' ? 1 : -1;
      const found = this.events
        .filter(
          (e) =>
            (symbol === undefined || e.symbol === symbol) &&
            (event_type === undefined || e.event_type === event_type) &&
            (effective_slot?.lte === undefined ||
              e.effective_slot <= effective_slot.lte)
        )
        .sort((a, b) => direction * (a.effective_slot - b.effective_slot));
      return found.length > 0 ? project(found[0], args.select) : null;
    },
  };

  marketDataV6 = {
    /**
     * Counts rows by (symbol, timeframe, a timestamp range) and, when given, a
     * `cycle_id` below a bound: the filters the landed-row check and the RETUNING
     * window count use. A filter that is not in `where` is not applied.
     */
    count: async (args: {
      where: {
        symbol: string;
        timeframe: string;
        timestamp: { gte: number; lte: number };
        cycle_id?: { lt: number };
      };
    }): Promise<number> => {
      this.calls.barCount += 1;
      this.queryLog.push({ model: 'marketDataV6', op: 'count', args });
      const { symbol, timeframe, timestamp, cycle_id } = args.where;
      return this.bars.filter(
        (b) =>
          b.symbol === symbol &&
          b.timeframe === timeframe &&
          b.timestamp >= timestamp.gte &&
          b.timestamp <= timestamp.lte &&
          (cycle_id === undefined || b.cycle_id < cycle_id.lt)
      ).length;
    },

    findUnique: async (args: {
      where: {
        symbol_timeframe_timestamp: {
          symbol: string;
          timeframe: string;
          timestamp: number;
        };
      };
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null> => {
      this.calls.barFindUnique += 1;
      this.queryLog.push({ model: 'marketDataV6', op: 'findUnique', args });
      const { symbol, timeframe, timestamp } =
        args.where.symbol_timeframe_timestamp;
      const bar = this.bars.find(
        (b) =>
          b.symbol === symbol &&
          b.timeframe === timeframe &&
          b.timestamp === timestamp
      );
      return bar ? project(bar, args.select) : null;
    },

    findMany: async (args: {
      where: { symbol: string; timeframe: string; timestamp: { lte: number } };
      orderBy: { timestamp: 'asc' | 'desc' };
      take: number;
    }): Promise<SpineBar[]> => {
      this.calls.barFindMany += 1;
      this.queryLog.push({ model: 'marketDataV6', op: 'findMany', args });
      this.take('findMany');
      const { symbol, timeframe, timestamp } = args.where;
      // `take` applies AFTER the ordering, as in SQL: which bars are returned
      // depends on the direction, which is the point of asking for 'desc'.
      const direction = args.orderBy.timestamp === 'asc' ? 1 : -1;
      return this.bars
        .filter(
          (b) =>
            b.symbol === symbol &&
            b.timeframe === timeframe &&
            b.timestamp <= timestamp.lte
        )
        .sort((a, b) => direction * (a.timestamp - b.timestamp))
        .slice(0, args.take)
        .map(({ timestamp: ts, open, high, low, close, volume }) => ({
          timestamp: ts,
          open,
          high,
          low,
          close,
          volume,
        }));
    },
  };

  /**
   * The settings table is append-only, so this fake has `create`, `findFirst` and
   * `findMany` and NOTHING else: code that tried to update or delete a setting
   * fails with a TypeError.
   */
  activeIndicatorSetting = {
    findFirst: async (args: {
      where: { timeframe?: string; effective_slot?: { lte: number } };
      orderBy: OrderBy;
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null> => {
      this.queryLog.push({
        model: 'activeIndicatorSetting',
        op: 'findFirst',
        args,
      });
      const { timeframe, effective_slot } = args.where;
      const rows = sortBy(
        this.settings.filter(
          (r) =>
            (timeframe === undefined || r.timeframe === timeframe) &&
            (effective_slot === undefined ||
              r.effective_slot <= effective_slot.lte)
        ),
        args.orderBy
      );
      return rows.length > 0 ? project(rows[0], args.select) : null;
    },

    findMany: async (args: {
      where: { timeframe?: string };
      orderBy: OrderBy;
      take: number;
      select?: Record<string, boolean>;
    }): Promise<Array<Record<string, unknown>>> => {
      this.queryLog.push({
        model: 'activeIndicatorSetting',
        op: 'findMany',
        args,
      });
      const { timeframe } = args.where;
      return sortBy(
        this.settings.filter(
          (r) => timeframe === undefined || r.timeframe === timeframe
        ),
        args.orderBy
      )
        .slice(0, args.take)
        .map((r) => project(r, args.select));
    },

    create: async (args: {
      data: {
        timeframe: string;
        source: string;
        effective_slot: number;
        set_by: string;
        reason: string | null;
      };
      select?: Record<string, boolean>;
    }): Promise<Record<string, unknown>> => {
      this.queryLog.push({
        model: 'activeIndicatorSetting',
        op: 'create',
        args,
      });
      this.settingSeq += 1;
      this.settingClockMs += 1000;
      const row: FakeSetting = {
        id: `setting_${String(this.settingSeq).padStart(4, '0')}`,
        ...args.data,
        createdAt: new Date(this.settingClockMs),
      };
      this.settings.push(row);
      return project(row, args.select);
    },
  };

  indicatorStatistic = {
    /**
     * The ONLY row lookup this fake offers is by the full unique key. There is no
     * `findFirst` and no `findMany`, so code that tries to fetch "the latest"
     * statistics fails with a TypeError instead of quietly working.
     */
    findUnique: async (args: {
      where: {
        symbol_timeframe_source_captured_at: {
          symbol: string;
          timeframe: string;
          source: string;
          captured_at: number;
        };
      };
    }): Promise<FakeStat | null> => {
      this.queryLog.push({
        model: 'indicatorStatistic',
        op: 'findUnique',
        args,
      });
      const k = args.where.symbol_timeframe_source_captured_at;
      const row = this.stats.find(
        (r) =>
          r.symbol === k.symbol &&
          r.timeframe === k.timeframe &&
          r.source === k.source &&
          r.captured_at === k.captured_at
      );
      return row ? { ...row } : null;
    },

    count: async (args: {
      where: { symbol: string; timeframe: string; captured_at: number };
    }): Promise<number> => {
      this.calls.statCount += 1;
      const { symbol, timeframe, captured_at } = args.where;
      return this.stats.filter(
        (s) =>
          s.symbol === symbol &&
          s.timeframe === timeframe &&
          s.captured_at === captured_at
      ).length;
    },
  };

  /** The one market_cycles row for a slot, or undefined. */
  cycle(symbol: string, slot: number): Row | undefined {
    return this.cycles.get(this.key(symbol, slot));
  }

  /** What the gateway's upsert does: market_data_v6 is unique on (symbol, timeframe, timestamp). */
  upsertBar(bar: FakeBar): void {
    const existing = this.bars.find(
      (b) =>
        b.symbol === bar.symbol &&
        b.timeframe === bar.timeframe &&
        b.timestamp === bar.timestamp
    );
    if (existing) Object.assign(existing, bar);
    else this.bars.push(bar);
  }
}

export interface RecordedAdd {
  name: string;
  data: any;
  opts: any;
}

export class FakeQueue {
  adds: RecordedAdd[] = [];
  /** Throw on the next add (a Redis that goes away). */
  failNext?: Error;
  /** Bull ignores an add whose job id it already knows; set false to emulate a job that was removed. */
  dedupe = true;
  private known = new Set<string>();

  async add(name: string, data: unknown, opts: { jobId?: string } = {}) {
    if (this.failNext) {
      const error = this.failNext;
      this.failNext = undefined;
      throw error;
    }
    const id = opts.jobId;
    if (id !== undefined && this.dedupe && this.known.has(id)) {
      return { id };
    }
    if (id !== undefined) this.known.add(id);
    this.adds.push({ name, data, opts });
    return { id };
  }

  named(name: string): RecordedAdd[] {
    return this.adds.filter((a) => a.name === name);
  }
}

export const BAR_SECONDS: Record<Timeframe, number> = { M5: 300, M15: 900 };

/**
 * Land the bars a manifest describes: bar_count rows from oldest_bar_ts. `skip` /
 * `skipM15` leave those timestamps out (rows still in a retrying job); `older`
 * adds that many bars below the window.
 */
export function landBars(
  prisma: FakePrisma,
  manifest: CycleManifest,
  options: { skip?: number[]; skipM15?: number[]; older?: number } = {}
): void {
  for (const tf of listTimeframes(manifest)) {
    const s = manifest.timeframes[tf]!;
    const skip = new Set(tf === 'M5' ? options.skip : options.skipM15);
    const first = s.oldest_bar_ts - (options.older ?? 0) * BAR_SECONDS[tf];
    const count = s.bar_count + (options.older ?? 0);
    for (let i = 0; i < count; i += 1) {
      const timestamp = first + i * BAR_SECONDS[tf];
      if (skip.has(timestamp)) continue;
      prisma.upsertBar({
        symbol: manifest.symbol,
        timeframe: tf,
        timestamp,
        open: 2650 + (timestamp % 97) * 0.01,
        high: 2651 + (timestamp % 97) * 0.01,
        low: 2649 + (timestamp % 97) * 0.01,
        close: 2650.5 + (timestamp % 97) * 0.01,
        volume: 100 + (timestamp % 11),
        cycle_id: s.collection_cycle_id,
      });
    }
  }
}

/**
 * The M5 window the collector exports at a manifest: `bars` bars (3,000 by
 * default) ending at the manifest's newest bar, as open times in seconds.
 */
export function m5Window(
  manifest: CycleManifest,
  bars = 3000
): { first: number; last: number } {
  const last = manifest.timeframes.M5.newest_bar_ts;
  return { first: last - (bars - 1) * BAR_SECONDS.M5, last };
}

/**
 * The whole M5 window as the collector's first full push leaves it, all rows
 * carrying the manifest's M5 collection cycle id. By default it is 3,001 bars,
 * not 3,000: the window the gateway counts for RETUNING (`slot - 3000 * 300`)
 * is one bar wider than the collector's, and the bar just below the collector's
 * window is the oldest of the previous cycle's, which an oldest-first drain has
 * long since re-pushed. `older` adds that many bars further below (rows the
 * collector no longer exports). Existing rows are overwritten, as the gateway's
 * upsert does.
 */
export function landWindow(
  prisma: FakePrisma,
  manifest: CycleManifest,
  options: { bars?: number; older?: number } = {}
): void {
  const { first, last } = m5Window(manifest, options.bars ?? 3001);
  const cycleId = manifest.timeframes.M5.collection_cycle_id;
  for (
    let timestamp = first - (options.older ?? 0) * BAR_SECONDS.M5;
    timestamp <= last;
    timestamp += BAR_SECONDS.M5
  ) {
    prisma.upsertBar({
      symbol: manifest.symbol,
      timeframe: 'M5',
      timestamp,
      open: 2650 + (timestamp % 97) * 0.01,
      high: 2651 + (timestamp % 97) * 0.01,
      low: 2649 + (timestamp % 97) * 0.01,
      close: 2650.5 + (timestamp % 97) * 0.01,
      volume: 100 + (timestamp % 11),
      cycle_id: cycleId,
    });
  }
}

/**
 * The push worker sending bars again after a cycle's priority set: every M5 row
 * with an open time from `from` to `to` (inclusive) that exists now takes
 * `cycleId`, the way the gateway's upsert overwrites it. Returns how many rows.
 */
export function repushBars(
  prisma: FakePrisma,
  symbol: string,
  from: number,
  to: number,
  cycleId: number
): number {
  let changed = 0;
  for (const bar of prisma.bars) {
    if (
      bar.symbol === symbol &&
      bar.timeframe === 'M5' &&
      bar.timestamp >= from &&
      bar.timestamp <= to
    ) {
      bar.cycle_id = cycleId;
      changed += 1;
    }
  }
  return changed;
}

/** Land the statistics rows a manifest declares (what the statistics lane writes at the slot). */
export function landStatistics(
  prisma: FakePrisma,
  manifest: CycleManifest
): void {
  for (const tf of listTimeframes(manifest)) {
    for (let i = 0; i < manifest.timeframes[tf]!.statistics_count; i += 1) {
      prisma.stats.push({
        symbol: manifest.symbol,
        timeframe: tf,
        captured_at: manifest.slot,
        source: STATISTIC_SOURCES[i],
      });
    }
  }
}
