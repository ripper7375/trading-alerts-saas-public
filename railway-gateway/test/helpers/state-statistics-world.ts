import * as fs from 'fs';
import * as path from 'path';
import { ENGINE_DIR } from './cycle-fixtures';
import {
  SERIES_NOTES,
  StateStatisticsRow,
} from '../../src/sensors/state-statistics.series';

/**
 * What the state statistics specs share (build step 3 part 6): rows in the shape the Python engine
 * returns them, that engine's own golden rows, and a Prisma that is lazy and transactional like the
 * real one and refuses what the database's CHECK refuses.
 */

export type Row = Record<string, unknown>;

/** The rows `mcd_worker.statistics.compute_state_statistics` returns for the engine's synthetic scenario (`WRITE_FIXTURES=yes` regenerates the file there). */
export const GOLDEN_PATH = path.join(
  ENGINE_DIR,
  'mcd_worker',
  'tests',
  'data',
  'state-statistics.rows.json'
);

export interface GoldenFile {
  schema: string;
  result: {
    rows: StateStatisticsRow[];
    occurrences: number;
    unavailable: Record<string, number>;
  };
}

export function readGolden(): GoldenFile {
  return JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')) as GoldenFile;
}

export const CONFIG_KEY = '{"best_fit_a":"h1"}';

/** A row of 30 outcomes of MCD2's up state at 2 hours: the smallest sample that carries numbers. */
export function row(
  over: Partial<StateStatisticsRow> = {}
): StateStatisticsRow {
  return {
    mcd_id: 'MCD2',
    evaluator_version_series: '2.0',
    config_hash_key: CONFIG_KEY,
    state_code: 'MCD2_CHANNEL_UP',
    horizon_hours: 2,
    n: 30,
    forward_move_median: 1.25,
    forward_move_q1: -0.5,
    forward_move_q3: 3,
    opposing_level_rate: null,
    adverse_excursion_median: 2.5,
    adverse_excursion_q3: 4,
    ...over,
  };
}

/** A row below the gate: a count and no number. */
export function provisionalRow(
  n = 12,
  over: Partial<StateStatisticsRow> = {}
): StateStatisticsRow {
  return row({
    n,
    forward_move_median: null,
    forward_move_q1: null,
    forward_move_q3: null,
    adverse_excursion_median: null,
    adverse_excursion_q3: null,
    ...over,
  });
}

export const FIGURES = [
  'forward_move_median',
  'forward_move_q1',
  'forward_move_q3',
  'adverse_excursion_median',
  'adverse_excursion_q3',
] as const;

const GATE_CONSTRAINT = 'state_statistics_n_gate';
const MEASURED = [...FIGURES, 'opposing_level_rate'] as const;

const keyOf = (r: Row): string =>
  [
    r['mcd_id'],
    r['evaluator_version_series'],
    r['config_hash_key'],
    r['state_code'],
    r['horizon_hours'],
  ].join('|');

type CompoundKey = Record<string, unknown>;

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

/**
 * A `stateStatistic` delegate and a `$transaction`, in memory. Like the real ones: an upsert runs
 * when a transaction runs it; an `undefined` field of an update leaves the stored value alone and a
 * `null` clears it; the unique key is the five series columns; and a row left with n below 30 and a
 * number in it is refused with the constraint's name, as Postgres does. A failing statement rolls
 * the whole transaction back.
 */
export class FakeStatsPrisma {
  rows = new Map<string, Row>();
  /** Operations that ran outside `$transaction` (the writer must have none). */
  readonly autocommitted: string[] = [];
  readonly transactions: Array<{ ops: string[]; committed: boolean }> = [];
  /** What each upsert did, in order: `created` or `updated`, and the key. */
  readonly log: Array<{ op: 'created' | 'updated'; key: string }> = [];
  /** Every `findUnique`: the compound key it asked for. */
  readonly reads: CompoundKey[] = [];
  private failingAt: number | undefined;
  private executed = 0;

  /** The nth statement (0-based, counted across the whole test) throws when it runs. */
  failStatement(n: number): void {
    this.failingAt = n;
  }

  private op<T>(name: string, run: () => T): LazyOp<T> {
    return new LazyOp(
      name,
      () => {
        const index = this.executed;
        this.executed += 1;
        if (this.failingAt === index) throw new Error('injected failure');
        return run();
      },
      (n) => this.autocommitted.push(n)
    );
  }

  private static check(r: Row): void {
    const n = r['n'] as number;
    if (
      n < 30 &&
      MEASURED.some((field) => r[field] !== null && r[field] !== undefined)
    )
      throw new Error(
        `new row for relation "state_statistics" violates check constraint "${GATE_CONSTRAINT}"`
      );
  }

  readonly stateStatistic = {
    upsert: (args: {
      where: Record<string, CompoundKey>;
      create: Row;
      update: Row;
    }) =>
      this.op('stateStatistic.upsert', () => {
        const compound = Object.values(args.where)[0] as CompoundKey;
        const key = keyOf(compound);
        const existing = this.rows.get(key);
        if (existing) {
          const next: Row = { ...existing };
          for (const [field, value] of Object.entries(args.update)) {
            if (value !== undefined) next[field] = value;
          }
          FakeStatsPrisma.check(next);
          this.rows.set(key, next);
          this.log.push({ op: 'updated', key });
          return next;
        }
        const created: Row = {};
        for (const field of MEASURED) created[field] = null;
        for (const [field, value] of Object.entries(args.create)) {
          if (value !== undefined) created[field] = value;
        }
        FakeStatsPrisma.check(created);
        this.rows.set(key, created);
        this.log.push({ op: 'created', key });
        return created;
      }),

    findUnique: async (args: { where: Record<string, CompoundKey> }) => {
      const compound = Object.values(args.where)[0] as CompoundKey;
      this.reads.push({ ...compound });
      const found = this.rows.get(keyOf(compound));
      return found ? { ...found } : null;
    },
  };

  /** Array form only, as the writer uses it. */
  async $transaction(ops: Array<LazyOp<unknown>>): Promise<unknown[]> {
    const record = { ops: ops.map((o) => o.name), committed: false };
    this.transactions.push(record);
    const saved = new Map([...this.rows].map(([k, v]) => [k, { ...v }]));
    const savedLog = this.log.length;
    try {
      const results = ops.map((o) => o.execute());
      record.committed = true;
      return results;
    } catch (error) {
      this.rows = saved;
      this.log.length = savedLog;
      throw error;
    }
  }

  /** The stored row of a key, or undefined. */
  stored(
    r: Pick<
      StateStatisticsRow,
      | 'mcd_id'
      | 'evaluator_version_series'
      | 'config_hash_key'
      | 'state_code'
      | 'horizon_hours'
    >
  ): Row | undefined {
    return this.rows.get(keyOf(r));
  }
}

export { SERIES_NOTES };

/**
 * A reader's database: it has `findUnique` and NOTHING else, so a reader that calls any other
 * method of the model fails the spec with "is not a function".
 */
export function readOnlyPrisma(rows: Row[]) {
  const reads: CompoundKey[] = [];
  const prisma = {
    stateStatistic: {
      findUnique: async (args: { where: Record<string, CompoundKey> }) => {
        const compound = Object.values(args.where)[0] as CompoundKey;
        reads.push({ ...compound });
        const found = rows.find((r) => keyOf(r) === keyOf(compound));
        return found ? { ...found } : null;
      },
    },
  };
  return { prisma, reads };
}
