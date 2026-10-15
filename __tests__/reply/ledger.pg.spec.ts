/**
 * @jest-environment node
 */

/**
 * The quota ledger against a REAL PostgreSQL (build step 7 part 6): ai_quota_periods and
 * ai_usage_reservations, as created by
 * prisma/migrations/20261014010000_add_ai_metering_tables/migration.sql.
 *
 * The unit tests (`__tests__/lib/platform/metering/`) run the scenarios on an in-memory MODEL of the
 * two tables. This spec runs the SAME scenarios (`../lib/platform/helpers/ledger-scenarios.ts`)
 * through the real generated Prisma client against the real database, which is what shows that
 * the model is faithful and that the design holds: that the reservation is one atomic statement and
 * eight requests racing for the last units get exactly one, that a settlement is idempotent and a
 * late one still charges, that the CHECK constraints refuse what they are there to refuse (one at a
 * time) and accept the value on their line, that the trigger lets exactly the legal changes of
 * state through, that DELETING A User removes the balance, and that a long interleaving of
 * reservations, settlements, releases and the reaper leaves the books balanced. And it runs
 * `prisma migrate diff` against the database and expects no drift (with a control that drift is seen).
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of the two tables, and the users it creates
 *                        (email lg-*@example.test), in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and create
 *      an empty database;
 *   2. build the NON-MARKET schema as it was BEFORE this migration:
 *        prisma migrate diff --config <scratch config outside the repo> --from-empty \
 *          --to-schema <prisma/non-market-data/schema.prisma at the commit before this part> --script
 *      (keep the text from the first "-- CreateEnum", ASCII, no BOM) and apply it with
 *      `psql -v ON_ERROR_STOP=1 -f ...`; then apply the MIGRATION FILE itself, not a diff of the
 *      schema (a diff has no CHECK constraints and no trigger, and the first tests below fail if
 *      they are missing):
 *        psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261014010000_add_ai_metering_tables/migration.sql
 *      The database must hold the non-market tables and nothing else, or the drift test sees the
 *      extra tables;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/reply/ledger.pg.spec.ts' --coverage=false
 *      (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs this
 *      file);
 *   4. stop and remove the instance.
 */

import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { Client as PgClient } from 'pg';

import {
  auditPeriod,
  isForeignKeyViolation,
  isUniqueViolation,
  readPeriod,
  releaseReservation,
  reserveUnits,
  settleReservation,
} from '@/lib/platform/metering/ledger-store';
import { reapExpired } from '@/lib/platform/metering/reaper';

import {
  MIN,
  OCT,
  SCENARIOS,
  T0,
  requestId,
  type ScenarioEnv,
} from '../lib/platform/helpers/ledger-scenarios';

// the stores import the database client at load time; this spec passes its own
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

const ROOT = resolve(__dirname, '..', '..');
const MIGRATION = readFileSync(
  resolve(
    ROOT,
    'prisma/migrations/20261014010000_add_ai_metering_tables/migration.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n');

const T_PERIODS = 'ai_quota_periods';
const T_RESERVATIONS = 'ai_usage_reservations';

interface Refusal {
  code: string | undefined;
  constraint: string | undefined;
  message: string;
}

type Row = Record<string, unknown>;

let counter = 0;
const next = (): number => (counter += 1);
const userIdOf = (n: number): string =>
  `cm0lguser${String(n).padStart(16, '0')}`;

function insertSql(
  table: string,
  row: Row
): { sql: string; params: unknown[] } {
  const keys = Object.keys(row);
  return {
    sql: `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys
      .map((_, i) => `$${i + 1}`)
      .join(', ')})`,
    params: keys.map((k) => row[k]),
  };
}

/** Run one statement on a savepoint; null when it worked (and is undone), else why it did not. */
async function refusal(
  c: PgClient,
  sql: string,
  params: unknown[] = []
): Promise<Refusal | null> {
  await c.query('SAVEPOINT attempt');
  try {
    await c.query(sql, params);
    return null;
  } catch (error) {
    const e = error as { code?: string; constraint?: string; message?: string };
    return {
      code: e.code,
      constraint: e.constraint,
      message: String(e.message),
    };
  } finally {
    await c.query('ROLLBACK TO SAVEPOINT attempt');
  }
}

const NOW = '2026-10-15 10:00:00';
const LATER = '2026-10-15 10:10:00';

suite('the quota ledger on a real Postgres', () => {
  jest.setTimeout(180_000);

  let prisma: any;
  let db: PgClient;

  async function user(c: PgClient, n = next()): Promise<string> {
    const id = userIdOf(n);
    await c.query(
      `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
      [id, `lg-${id}@example.test`]
    );
    return id;
  }

  async function wipe(): Promise<void> {
    await db.query(`DELETE FROM "${T_RESERVATIONS}"`);
    await db.query(`DELETE FROM "${T_PERIODS}"`);
    await db.query(`DELETE FROM "User" WHERE "email" LIKE 'lg-%@example.test'`);
  }

  /** BEGIN, run, and ROLLBACK: nothing of it survives. */
  async function rolledBack<T>(fn: (c: PgClient) => Promise<T>): Promise<T> {
    await db.query('BEGIN');
    try {
      return await fn(db);
    } finally {
      await db.query('ROLLBACK');
    }
  }

  async function period(
    c: PgClient,
    userId: string,
    over: Row = {}
  ): Promise<string> {
    const row: Row = {
      id: `p-${next()}`,
      user_id: userId,
      month: OCT,
      limit: 1_000,
      used: 0,
      reserved: 0,
      updated_at: NOW,
      ...over,
    };
    const { sql, params } = insertSql(T_PERIODS, row);
    await c.query(sql, params);
    return row['id'] as string;
  }

  function reservationRow(
    userId: string,
    periodId: string,
    over: Row = {}
  ): Row {
    return {
      request_id: `r-${next()}`,
      user_id: userId,
      period_id: periodId,
      reserved_units: 10,
      status: 'RESERVED',
      created_at: NOW,
      updated_at: NOW,
      expires_at: LATER,
      ...over,
    };
  }

  async function reservation(c: PgClient, row: Row): Promise<void> {
    const { sql, params } = insertSql(T_RESERVATIONS, row);
    await c.query(sql, params);
  }

  beforeAll(async () => {
    const { Client } = require('pg') as typeof import('pg');
    db = new Client({ connectionString: URL });
    await db.connect();
    const { PrismaClient } = require('.prisma/non-market-client');
    const { PrismaPg } = require('@prisma/adapter-pg');
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: URL }),
    });
    await prisma.$connect();
    await wipe();
  });

  afterAll(async () => {
    try {
      await wipe();
    } finally {
      await prisma?.$disconnect();
      await db?.end();
    }
  });

  // -------------------------------------------------------------------------
  describe('what the migration created', () => {
    test('the CHECK constraints are the migration’s, no more and no fewer', async () => {
      const wanted = [
        ...MIGRATION.matchAll(/ADD CONSTRAINT "([a-z0-9_]+)" CHECK/g),
      ]
        .map((m) => m[1]!)
        .sort();
      expect(wanted).toHaveLength(12);
      const { rows } = await db.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE contype = 'c' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PERIODS}"`, `"${T_RESERVATIONS}"`]]
      );
      expect(rows.map((r) => r.conname)).toEqual(wanted);
    });

    test('keys: a primary key on each table, the unique month and the unique pair the reservations reference', async () => {
      const { rows } = await db.query<{ conname: string; def: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE contype IN ('p', 'u') AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PERIODS}"`, `"${T_RESERVATIONS}"`]]
      );
      expect(rows.map((r) => r.def).sort()).toEqual(
        ['PRIMARY KEY (id)', 'PRIMARY KEY (request_id)'].sort()
      );
      const { rows: indexes } = await db.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = ANY ($1) ORDER BY indexname`,
        [[T_PERIODS, T_RESERVATIONS]]
      );
      expect(indexes.map((i) => i.indexname)).toEqual([
        'ai_quota_periods_id_user_id_key',
        'ai_quota_periods_pkey',
        'ai_quota_periods_user_id_month_key',
        'ai_usage_reservations_period_id_idx',
        'ai_usage_reservations_pkey',
        'ai_usage_reservations_status_expires_at_idx',
        'ai_usage_reservations_user_id_created_at_idx',
      ]);
    });

    test('foreign keys: the user cascades, and a reservation and its period are one user’s', async () => {
      const { rows } = await db.query<{ conname: string; def: string }>(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE contype = 'f' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PERIODS}"`, `"${T_RESERVATIONS}"`]]
      );
      expect(Object.fromEntries(rows.map((r) => [r.conname, r.def]))).toEqual({
        ai_quota_periods_user_id_fkey:
          'FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE',
        ai_usage_reservations_user_id_fkey:
          'FOREIGN KEY (user_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE',
        ai_usage_reservations_period_id_user_id_fkey:
          'FOREIGN KEY (period_id, user_id) REFERENCES ai_quota_periods(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE',
      });
    });

    test('the guard is on ai_usage_reservations and fires on UPDATE only', async () => {
      const { rows } = await db.query<{ tgname: string; def: string }>(
        `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger
          WHERE NOT tgisinternal AND tgrelid = $1::regclass`,
        [`"${T_RESERVATIONS}"`]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tgname).toBe('ai_usage_reservations_guard_rows');
      expect(rows[0]!.def).toMatch(/BEFORE UPDATE ON/);
      expect(rows[0]!.def).toMatch(/FOR EACH ROW/);
    });
  });

  // -------------------------------------------------------------------------
  describe('ai_quota_periods: each CHECK refuses its violation and nothing else, and accepts the value on its line', () => {
    const cases: [string | string[], Row, Row?][] = [
      [
        'ai_quota_periods_month_is_a_month',
        { month: '2026-13' },
        { month: '2026-12' },
      ],
      ['ai_quota_periods_month_is_a_month', { month: '2026-1' }],
      ['ai_quota_periods_month_is_a_month', { month: '2026-10-01' }],
      // a negative limit also breaks used + reserved <= limit: PostgreSQL names the first by name
      [
        [
          'ai_quota_periods_balance_fits_the_limit',
          'ai_quota_periods_limit_is_bounded',
        ],
        { limit: -1 },
        { limit: 0 },
      ],
      [
        'ai_quota_periods_limit_is_bounded',
        { limit: 2_000_000_001 },
        { limit: 2_000_000_000 },
      ],
      ['ai_quota_periods_used_is_not_negative', { used: -1 }, { used: 0 }],
      [
        'ai_quota_periods_reserved_is_not_negative',
        { reserved: -1 },
        { reserved: 0 },
      ],
      [
        'ai_quota_periods_balance_fits_the_limit',
        { used: 600, reserved: 401 },
        { used: 600, reserved: 400 },
      ],
      [
        'ai_quota_periods_balance_fits_the_limit',
        { used: 1_001 },
        { used: 1_000 },
      ],
      [
        'ai_quota_periods_balance_fits_the_limit',
        { reserved: 1_001 },
        { reserved: 1_000 },
      ],
    ];

    // every case has three entries: a test.each callback that declares a third parameter would otherwise
    // be handed Jest's `done` for a case of two, and wait for it forever
    test.each(cases.map(([n, b, g]) => [n, b, g ?? null] as const))(
      '%s refuses %j',
      async (name, bad, good) => {
        await rolledBack(async (c) => {
          const u = await user(c);
          const row: Row = {
            id: `p-${next()}`,
            user_id: u,
            month: OCT,
            limit: 1_000,
            used: 0,
            reserved: 0,
            updated_at: NOW,
          };
          const { sql, params } = insertSql(T_PERIODS, { ...row, ...bad });
          const refused = await refusal(c, sql, params);
          expect(refused?.code).toBe('23514');
          expect(refused?.constraint).toEqual(
            Array.isArray(name) ? expect.stringMatching(name.join('|')) : name
          );
          if (good !== null) {
            const ok = insertSql(T_PERIODS, { ...row, ...good });
            expect(await refusal(c, ok.sql, ok.params)).toBeNull();
          }
        });
      }
    );

    test('the sum of used and reserved is made in 64 bits: two numbers near the 32-bit limit are refused, not wrapped', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const { sql, params } = insertSql(T_PERIODS, {
          id: `p-${next()}`,
          user_id: u,
          month: OCT,
          limit: 2_000_000_000,
          used: 2_000_000_000,
          reserved: 2_000_000_000,
          updated_at: NOW,
        });
        const refused = await refusal(c, sql, params);
        expect(refused?.constraint).toBe(
          'ai_quota_periods_balance_fits_the_limit'
        );
      });
    });

    test('one row a month per trader, and two traders may have the same month', async () => {
      await rolledBack(async (c) => {
        const a = await user(c);
        const b = await user(c);
        await period(c, a);
        const again = insertSql(T_PERIODS, {
          id: `p-${next()}`,
          user_id: a,
          month: OCT,
          limit: 1,
          used: 0,
          reserved: 0,
          updated_at: NOW,
        });
        expect((await refusal(c, again.sql, again.params))?.code).toBe('23505');
        await period(c, b);
        await period(c, a, { month: '2026-11' });
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('ai_usage_reservations: each CHECK refuses its violation and nothing else', () => {
    const settled = { status: 'SETTLED', actual_units: 5 };
    const cases: [string | string[], Row, Row?][] = [
      [
        'ai_usage_reservations_request_id_is_an_id',
        { request_id: 'has space' },
        { request_id: 'A_b-9' },
      ],
      [
        'ai_usage_reservations_request_id_is_an_id',
        { request_id: 'x'.repeat(65) },
        { request_id: 'x'.repeat(64) },
      ],
      [
        'ai_usage_reservations_reserved_is_positive',
        { reserved_units: 0 },
        { reserved_units: 1 },
      ],
      [
        'ai_usage_reservations_reserved_is_positive',
        { reserved_units: 2_000_000_001 },
        { reserved_units: 2_000_000_000 },
      ],
      // an unknown status also breaks the shape of every state: PostgreSQL names the first by name
      [
        [
          'ai_usage_reservations_state_fits_the_fields',
          'ai_usage_reservations_status_is_known',
        ],
        { status: 'DONE' },
      ],
      [
        'ai_usage_reservations_figures_are_in_range',
        { ...settled, actual_units: -1 },
        settled,
      ],
      [
        'ai_usage_reservations_figures_are_in_range',
        { ...settled, cost_micro_usd: -1 },
        { ...settled, cost_micro_usd: 0 },
      ],
      [
        'ai_usage_reservations_figures_are_in_range',
        { ...settled, prompt_tokens: 2_000_000_001 },
        { ...settled, prompt_tokens: 2_000_000_000 },
      ],
      [
        'ai_usage_reservations_figures_are_in_range',
        { ...settled, completion_tokens: -1 },
        { ...settled, completion_tokens: 0 },
      ],
      [
        'ai_usage_reservations_figures_are_in_range',
        { ...settled, completion_tokens: 2_000_000_001 },
        { ...settled, completion_tokens: 2_000_000_000 },
      ],
      // the state machine as the shape of each state
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'RESERVED', actual_units: 5 },
        { status: 'RESERVED' },
      ],
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'SETTLED' },
        settled,
      ],
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'RELEASED', cost_micro_usd: 5 },
        { status: 'RELEASED' },
      ],
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'EXPIRED', model: 'a/b' },
        { status: 'EXPIRED' },
      ],
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'RESERVED', prompt_tokens: 1 },
      ],
      [
        'ai_usage_reservations_state_fits_the_fields',
        { status: 'RELEASED', completion_tokens: 1 },
      ],
      [
        'ai_usage_reservations_model_is_a_slug',
        { ...settled, model: 'bad slug' },
        { ...settled, model: 'google/gemini-3.6-flash' },
      ],
      ['ai_usage_reservations_model_is_a_slug', { ...settled, model: '-a/b' }],
      [
        'ai_usage_reservations_model_is_a_slug',
        { ...settled, model: 'a'.repeat(121) },
        { ...settled, model: 'a'.repeat(120) },
      ],
      [
        'ai_usage_reservations_expires_after_it_began',
        { expires_at: NOW },
        { expires_at: '2026-10-15 10:00:00.001' },
      ],
      [
        'ai_usage_reservations_expires_after_it_began',
        { expires_at: '2026-10-15 09:00:00' },
      ],
    ];

    test.each(cases.map(([n, b, g]) => [n, b, g ?? null] as const))(
      '%j refuses %j',
      async (names, bad, good) => {
        await rolledBack(async (c) => {
          const u = await user(c);
          const p = await period(c, u);
          const { sql, params } = insertSql(T_RESERVATIONS, {
            ...reservationRow(u, p),
            ...bad,
          });
          const refused = await refusal(c, sql, params);
          expect(refused?.code).toBe('23514');
          expect(refused?.constraint).toEqual(
            Array.isArray(names)
              ? expect.stringMatching(names.join('|'))
              : names
          );
          if (good !== null) {
            const ok = insertSql(T_RESERVATIONS, {
              ...reservationRow(u, p),
              ...good,
            });
            expect(await refusal(c, ok.sql, ok.params)).toBeNull();
          }
        });
      }
    );

    test('a reservation cannot point at another trader’s period (the composite key)', async () => {
      await rolledBack(async (c) => {
        const a = await user(c);
        const b = await user(c);
        const periodOfA = await period(c, a);
        const { sql, params } = insertSql(
          T_RESERVATIONS,
          reservationRow(b, periodOfA)
        );
        const refused = await refusal(c, sql, params);
        expect(refused?.code).toBe('23503');
        expect(refused?.constraint).toBe(
          'ai_usage_reservations_period_id_user_id_fkey'
        );
      });
    });

    test('a request id is the key: a second row with it is refused', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const row = reservationRow(u, p);
        await reservation(c, row);
        const { sql, params } = insertSql(T_RESERVATIONS, row);
        expect((await refusal(c, sql, params))?.code).toBe('23505');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('the trigger on ai_usage_reservations', () => {
    const STATES: Record<string, Row> = {
      RESERVED: { status: 'RESERVED' },
      SETTLED: {
        status: 'SETTLED',
        actual_units: 5,
        cost_micro_usd: 5,
        model: 'a/b',
        prompt_tokens: 1,
        completion_tokens: 1,
      },
      RELEASED: { status: 'RELEASED' },
      EXPIRED: { status: 'EXPIRED' },
    };
    const CLEARED = {
      actual_units: null,
      cost_micro_usd: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
    };
    const ALLOWED = new Set([
      'RESERVED>SETTLED',
      'RESERVED>RELEASED',
      'RESERVED>EXPIRED',
      'EXPIRED>SETTLED',
    ]);

    /** The UPDATE that moves a row to a state, with the figures that state has. */
    function moveTo(to: string): { set: string; params: unknown[] } {
      const row = { ...CLEARED, ...STATES[to] };
      const keys = Object.keys(row);
      return {
        set: keys.map((k, i) => `"${k}" = $${i + 2}`).join(', '),
        params: keys.map((k) => row[k as keyof typeof row]),
      };
    }

    const PAIRS = Object.keys(STATES).flatMap((from) =>
      Object.keys(STATES)
        .filter((to) => to !== from)
        .map((to) => [from, to] as const)
    );

    test.each(PAIRS)('%s to %s', async (from, to) => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const row = { ...reservationRow(u, p), ...STATES[from] };
        await reservation(c, row);
        const move = moveTo(to);
        const result = await refusal(
          c,
          `UPDATE "${T_RESERVATIONS}" SET ${move.set} WHERE "request_id" = $1`,
          [row['request_id'], ...move.params]
        );
        if (ALLOWED.has(`${from}>${to}`)) {
          expect(result).toBeNull();
        } else {
          expect(result?.code).toBe('23001');
          expect(result?.message).toMatch(
            /is not a transition of a reservation/
          );
        }
      });
    });

    test.each([
      ['reserved_units', 11],
      ['created_at', '2026-10-15 09:59:00'],
      ['expires_at', '2026-10-15 10:30:00'],
    ])('the sealed column %s never changes', async (column, value) => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const row = reservationRow(u, p);
        await reservation(c, row);
        const result = await refusal(
          c,
          `UPDATE "${T_RESERVATIONS}" SET "${column}" = $2 WHERE "request_id" = $1`,
          [row['request_id'], value]
        );
        expect(result?.code).toBe('23001');
        expect(result?.message).toMatch(/sealed column/);
      });
    });

    test('the sealed period_id and request_id never change', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const other = await period(c, u, { month: '2026-11' });
        const row = reservationRow(u, p);
        await reservation(c, row);
        const toOther = await refusal(
          c,
          `UPDATE "${T_RESERVATIONS}" SET "period_id" = $2 WHERE "request_id" = $1`,
          [row['request_id'], other]
        );
        expect(toOther?.code).toBe('23001');
        const rename = await refusal(
          c,
          `UPDATE "${T_RESERVATIONS}" SET "request_id" = $2 WHERE "request_id" = $1`,
          [row['request_id'], 'renamed']
        );
        expect(rename?.code).toBe('23001');
      });
    });

    test('a row that keeps its state keeps its figures, and may only touch updated_at', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const row = { ...reservationRow(u, p), ...STATES['SETTLED'] };
        await reservation(c, row);
        for (const [column, value] of [
          ['actual_units', 6],
          ['cost_micro_usd', 6],
          ['model', 'c/d'],
          ['prompt_tokens', 2],
          ['completion_tokens', 2],
        ] as const) {
          const result = await refusal(
            c,
            `UPDATE "${T_RESERVATIONS}" SET "${column}" = $2 WHERE "request_id" = $1`,
            [row['request_id'], value]
          );
          expect({ column, code: result?.code }).toEqual({
            column,
            code: '23001',
          });
        }
        expect(
          await refusal(
            c,
            `UPDATE "${T_RESERVATIONS}" SET "updated_at" = $2 WHERE "request_id" = $1`,
            [row['request_id'], LATER]
          )
        ).toBeNull();
      });
    });

    test('a DELETE is not stopped (it is what ON DELETE CASCADE does)', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const p = await period(c, u);
        const row = { ...reservationRow(u, p), ...STATES['SETTLED'] };
        await reservation(c, row);
        const { rowCount } = await c.query(
          `DELETE FROM "${T_RESERVATIONS}" WHERE "request_id" = $1`,
          [row['request_id']]
        );
        expect(rowCount).toBe(1);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('the scenarios, through the real Prisma client', () => {
    beforeEach(wipe);

    function envOf(): ScenarioEnv {
      return {
        client: prisma,
        newUser: () => user(db),
        deleteUser: async (id) => {
          await db.query(`DELETE FROM "User" WHERE "id" = $1`, [id]);
        },
        countRows: async (id) => {
          const periods = await db.query(
            `SELECT count(*)::int AS n FROM "${T_PERIODS}" WHERE "user_id" = $1`,
            [id]
          );
          const reservations = await db.query(
            `SELECT count(*)::int AS n FROM "${T_RESERVATIONS}" WHERE "user_id" = $1`,
            [id]
          );
          return {
            periods: periods.rows[0].n as number,
            reservations: reservations.rows[0].n as number,
          };
        },
      };
    }

    test.each(SCENARIOS.map((s) => [s.name, s] as const))(
      '%s',
      async (_n, s) => {
        await s.run(envOf());
      }
    );

    test('deleting a User removes its periods and reservations in the database, and no other trader’s', async () => {
      const env = envOf();
      const a = await env.newUser();
      const b = await env.newUser();
      const { reserve, settle } = await import(
        '../lib/platform/helpers/ledger-scenarios'
      );
      const idA = requestId();
      const idB = requestId();
      await reserve(env, a, idA, 100);
      await settle(env, a, idA, 50);
      await reserve(env, b, idB, 100);
      await env.deleteUser(a);
      expect(await env.countRows(a)).toEqual({ periods: 0, reservations: 0 });
      expect(await env.countRows(b)).toEqual({ periods: 1, reservations: 1 });
    });
  });

  // -------------------------------------------------------------------------
  describe('what the store relies on in the driver', () => {
    beforeEach(wipe);

    test('a unique violation and a foreign-key violation are recognised in the error the Prisma client throws', async () => {
      const u = await user(db);
      const p = await period(db, u);
      const row = reservationRow(u, p);
      await reservation(db, row);
      const duplicate = insertSql(T_RESERVATIONS, row);
      let unique: unknown;
      try {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "${T_RESERVATIONS}" ("request_id","user_id","period_id","reserved_units","status","created_at","updated_at","expires_at") VALUES ($1,$2,$3,$4,$5,$6::timestamp,$6::timestamp,$7::timestamp) RETURNING "request_id"`,
          row['request_id'],
          u,
          p,
          10,
          'RESERVED',
          NOW,
          LATER
        );
      } catch (error) {
        unique = error;
      }
      expect(duplicate.sql).toContain('INSERT');
      expect(isUniqueViolation(unique)).toBe(true);
      expect(isForeignKeyViolation(unique)).toBe(false);

      let foreign: unknown;
      try {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "${T_PERIODS}" ("id","user_id","month","limit","used","reserved","updated_at") VALUES ($1,$2,$3,$4,0,0,$5::timestamp)`,
          'p-orphan',
          'no-such-user',
          OCT,
          10,
          NOW
        );
      } catch (error) {
        foreign = error;
      }
      expect(isForeignKeyViolation(foreign)).toBe(true);
      expect(isUniqueViolation(foreign)).toBe(false);
    });

    test('integers come back as numbers and timestamps as ISO text in UTC, whatever the session time zone', async () => {
      const u = await user(db);
      const result = await reserveUnits(
        {
          requestId: requestId(),
          userId: u,
          month: OCT,
          limit: 1_000,
          units: 10,
          nowMs: T0,
          expiresAtMs: T0 + 10 * MIN,
        },
        { client: prisma }
      );
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.reservation.created_at.toISOString()).toBe(
        '2026-10-15T10:00:00.000Z'
      );
      expect(result.reservation.expires_at.toISOString()).toBe(
        '2026-10-15T10:10:00.000Z'
      );
      expect(typeof result.reservation.reserved_units).toBe('number');
      // a session in another zone does not move it
      await db.query(`SET TIME ZONE 'Asia/Tokyo'`);
      try {
        const again = await readPeriod(u, OCT, { client: prisma });
        expect(again?.created_at.toISOString()).toBe(
          '2026-10-15T10:00:00.000Z'
        );
      } finally {
        await db.query(`RESET TIME ZONE`);
      }
    });

    test('a value in the SQL never comes from a string built by the store: a hostile request id is refused before the database', async () => {
      const u = await user(db);
      for (const evil of [`x'; DROP TABLE "${T_PERIODS}"; --`, 'a b', '']) {
        expect(
          await reserveUnits(
            {
              requestId: evil,
              userId: u,
              month: OCT,
              limit: 100,
              units: 1,
              nowMs: T0,
              expiresAtMs: T0 + MIN,
            },
            { client: prisma }
          )
        ).toMatchObject({ ok: false, code: 'BAD_INPUT' });
      }
      // and a hostile user id is only ever a parameter: it matches nothing
      expect(
        await readPeriod(`x' OR '1'='1`, OCT, { client: prisma })
      ).toBeNull();
      expect(
        (await db.query(`SELECT to_regclass('"${T_PERIODS}"') AS t`)).rows[0].t
      ).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('a long interleaving leaves the books balanced', () => {
    beforeEach(wipe);

    /** A small deterministic generator, so a failure repeats. */
    function lcg(seed: number): () => number {
      let state = seed >>> 0;
      return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    }

    test('120 requests of 4 traders, reserved, settled, released and reaped in parallel waves', async () => {
      // LEDGER_SEED repeats a run with another interleaving (the default is the one the report names)
      const random = lcg(Number(process.env['LEDGER_SEED'] ?? 20261015));
      const traders = [
        await user(db),
        await user(db),
        await user(db),
        await user(db),
      ];
      const LIMIT = 3_000;
      const clock = { ms: T0 };
      const outcomes: {
        trader: string;
        id: string;
        granted: boolean;
        units: number;
      }[] = [];

      for (let wave = 0; wave < 15; wave += 1) {
        const jobs = Array.from({ length: 8 }, async () => {
          const trader = traders[Math.floor(random() * traders.length)]!;
          const id = requestId('mix');
          const units = 50 + Math.floor(random() * 500);
          const fate = random();
          const ttl = fate < 0.2 ? MIN : 10 * MIN;
          const held = await reserveUnits(
            {
              requestId: id,
              userId: trader,
              month: OCT,
              limit: LIMIT,
              units,
              nowMs: clock.ms,
              expiresAtMs: clock.ms + ttl,
            },
            { client: prisma }
          );
          outcomes.push({ trader, id, granted: held.ok, units });
          if (!held.ok) return;
          if (fate < 0.45) {
            await settleReservation(
              {
                requestId: id,
                userId: trader,
                actualUnits: Math.floor(random() * (units + 200)),
                costMicroUsd: 1,
                model: 'a/b',
                promptTokens: 1,
                completionTokens: 1,
                nowMs: clock.ms + 1,
              },
              { client: prisma }
            );
          } else if (fate < 0.6) {
            await releaseReservation(
              { requestId: id, userId: trader, nowMs: clock.ms + 1 },
              { client: prisma }
            );
          } else if (fate < 0.7) {
            await settleReservation(
              {
                requestId: id,
                userId: trader,
                actualUnits: null,
                costMicroUsd: null,
                model: null,
                promptTokens: null,
                completionTokens: null,
                nowMs: clock.ms + 1,
              },
              { client: prisma }
            );
          }
          // otherwise it is left held, for the reaper
        });
        jobs.push(
          reapExpired(clock.ms + 2 * MIN, { client: prisma }).then(
            () => undefined
          )
        );
        await Promise.all(jobs);
        clock.ms += 3 * MIN;
        for (const trader of traders) {
          const audit = await auditPeriod(trader, OCT, { client: prisma });
          if (audit !== null) {
            expect({ wave, trader, problems: audit.problems }).toEqual({
              wave,
              trader,
              problems: [],
            });
          }
        }
      }

      // everything left held is past its deadline in the end: the reaper gives it all back
      await reapExpired(clock.ms + 60 * MIN, { client: prisma });
      for (const trader of traders) {
        const audit = await auditPeriod(trader, OCT, { client: prisma });
        expect(audit?.problems).toEqual([]);
        expect(audit?.reserved).toBe(0);
        expect(audit!.used).toBeLessThanOrEqual(LIMIT);
        const { rows } = await db.query(
          `SELECT count(*)::int AS n FROM "${T_RESERVATIONS}" WHERE "user_id" = $1 AND "status" = 'RESERVED'`,
          [trader]
        );
        expect(rows[0].n).toBe(0);
      }
      // the run did what it was meant to: some were granted, and some were refused for want of room
      expect(outcomes.filter((o) => o.granted).length).toBeGreaterThan(30);
      expect(outcomes.filter((o) => !o.granted).length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('the row locks do what they are there for', () => {
    beforeEach(wipe);

    let other: PgClient;
    beforeAll(async () => {
      const { Client } = require('pg') as typeof import('pg');
      other = new Client({ connectionString: URL });
      await other.connect();
    });
    afterAll(async () => {
      await other?.end();
    });

    /** DONE if the promise settles within `ms`, PENDING if it is still waiting. */
    const state = (promise: Promise<unknown>, ms: number): Promise<string> =>
      Promise.race([
        promise.then(
          () => 'DONE',
          () => 'DONE'
        ),
        new Promise<string>((resolveTimer) =>
          setTimeout(() => resolveTimer('PENDING'), ms)
        ),
      ]);

    test('a settlement waits for another transaction that holds the period, and charges against what that transaction left', async () => {
      const u = await user(db);
      const mine = requestId('lock-mine');
      await reserveUnits(
        {
          requestId: mine,
          userId: u,
          month: OCT,
          limit: 1_000,
          units: 400,
          nowMs: T0,
          expiresAtMs: T0 + 10 * MIN,
        },
        { client: prisma }
      );
      const period = (await readPeriod(u, OCT, { client: prisma }))!;

      // another request settles 500 and has not committed yet
      await other.query('BEGIN');
      try {
        await other.query(
          `UPDATE "${T_PERIODS}" SET "used" = "used" + 500 WHERE "id" = $1`,
          [period.id]
        );
        await other.query(
          `INSERT INTO "${T_RESERVATIONS}" ("request_id", "user_id", "period_id", "reserved_units", "status", "actual_units", "created_at", "updated_at", "expires_at")
           VALUES ($1, $2, $3, 500, 'SETTLED', 500, now(), now(), now() + interval '1 hour')`,
          [requestId('lock-other'), u, period.id]
        );
        const settling = settleReservation(
          {
            requestId: mine,
            userId: u,
            actualUnits: 800,
            costMicroUsd: 800,
            model: null,
            promptTokens: null,
            completionTokens: null,
            nowMs: T0 + MIN,
          },
          { client: prisma }
        );
        // it must wait for the period, not read the old numbers and go ahead
        expect(await state(settling, 800)).toBe('PENDING');
        await other.query('COMMIT');
        const result = await settling;
        // the room is what the other settlement left: 1,000 - 500 = 500 of the 800
        expect(result).toMatchObject({
          ok: true,
          absorbedUnits: 300,
          reservation: { status: 'SETTLED', actual_units: 500 },
          balance: { used: 1_000, reserved: 0 },
        });
      } finally {
        await other.query('ROLLBACK').catch(() => undefined);
      }
      const audit = await auditPeriod(u, OCT, { client: prisma });
      expect(audit?.problems).toEqual([]);
    });

    test('a settlement whose period changed while it waited for its own row is charged what the newest numbers allow, and does not fail', async () => {
      // PostgreSQL checks a CHECK constraint on the row version the statement's snapshot sees, BEFORE it
      // follows the update chain to the newest version. A charge worked out from the newest numbers can
      // overshoot the limit on that first, older version. The statement caps the charge by the version it
      // updates, so the first attempt passes and the retry on the newest version charges the full amount.
      const u = await user(db);
      const mine = requestId('stale-mine');
      const theirs = requestId('stale-theirs');
      const hold = (requestId: string, units: number) =>
        reserveUnits(
          {
            requestId,
            userId: u,
            month: OCT,
            limit: 1_000,
            units,
            nowMs: T0,
            expiresAtMs: T0 + 10 * MIN,
          },
          { client: prisma }
        );
      // the trader already has 200 units charged (so the sign of `used` in the cap matters), then holds
      // 300 (mine) and 400 (the other request): 200 used + 700 held of 1,000
      const prior = requestId('stale-prior');
      expect(await hold(prior, 200)).toMatchObject({ ok: true });
      expect(
        await settleReservation(
          {
            requestId: prior,
            userId: u,
            actualUnits: 200,
            costMicroUsd: 200,
            model: null,
            promptTokens: null,
            completionTokens: null,
            nowMs: T0 + MIN,
          },
          { client: prisma }
        )
      ).toMatchObject({ ok: true });
      expect(await hold(mine, 300)).toMatchObject({ ok: true });
      expect(await hold(theirs, 400)).toMatchObject({ ok: true });

      // somebody holds MY reservation row, so my settlement starts (and takes its snapshot) and then waits
      await other.query('BEGIN');
      try {
        await other.query(
          `SELECT 1 FROM "${T_RESERVATIONS}" WHERE "request_id" = $1 FOR UPDATE`,
          [mine]
        );
        const settling = settleReservation(
          {
            requestId: mine,
            userId: u,
            actualUnits: 600,
            costMicroUsd: 600,
            model: null,
            promptTokens: null,
            completionTokens: null,
            nowMs: T0 + MIN,
          },
          { client: prisma }
        );
        expect(await state(settling, 800)).toBe('PENDING');

        // meanwhile the other request is released: 400 units come back to the period, and it commits
        expect(
          await releaseReservation(
            { requestId: theirs, userId: u, nowMs: T0 + MIN },
            { client: prisma }
          )
        ).toMatchObject({ ok: true });

        await other.query('COMMIT');
        // 600 fits now: 1,000 - 200 used - 0 held by others = 800 of room. On the older numbers (400 held
        // by the other request) only 400 would fit, and an uncapped 600 would break used + reserved <= limit
        // (200 + 600 used + 400 held = 1,200).
        expect(await settling).toMatchObject({
          ok: true,
          absorbedUnits: 0,
          reservation: { status: 'SETTLED', actual_units: 600 },
          balance: { used: 800, reserved: 0 },
        });
      } finally {
        await other.query('ROLLBACK').catch(() => undefined);
      }
      const audit = await auditPeriod(u, OCT, { client: prisma });
      expect(audit?.problems).toEqual([]);
    });

    test('the reaper does not wait for a row somebody else holds: it skips it, and takes it on the next run', async () => {
      const u = await user(db);
      const id = requestId('lock-reaper');
      await reserveUnits(
        {
          requestId: id,
          userId: u,
          month: OCT,
          limit: 1_000,
          units: 300,
          nowMs: T0,
          expiresAtMs: T0 + MIN,
        },
        { client: prisma }
      );
      await other.query('BEGIN');
      try {
        await other.query(
          `SELECT 1 FROM "${T_RESERVATIONS}" WHERE "request_id" = $1 FOR UPDATE`,
          [id]
        );
        const reaping = reapExpired(T0 + 5 * MIN, { client: prisma });
        expect(await state(reaping, 2_500)).toBe('DONE');
        expect(await reaping).toMatchObject({ ok: true, expired: 0 });
        await other.query('COMMIT');
      } finally {
        await other.query('ROLLBACK').catch(() => undefined);
      }
      expect(await reapExpired(T0 + 5 * MIN, { client: prisma })).toMatchObject(
        {
          ok: true,
          expired: 1,
          unitsReturned: 300,
        }
      );
      const audit = await auditPeriod(u, OCT, { client: prisma });
      expect(audit?.problems).toEqual([]);
    });

    test('the oldest due row is held by somebody else: the run goes on to the next period instead of stopping', async () => {
      // `first_due` skips a row that is locked, so the period it picks is one the run can really work on.
      // If it picked the held row's period, that period would have nothing for the run to take and the
      // run would stop with another trader's due row left over.
      const a = await user(db);
      const b = await user(db);
      const oldest = requestId('held-oldest');
      const later = requestId('later-other');
      const hold = (requestId: string, userId: string, expiresAtMs: number) =>
        reserveUnits(
          {
            requestId,
            userId,
            month: OCT,
            limit: 1_000,
            units: 100,
            nowMs: T0,
            expiresAtMs,
          },
          { client: prisma }
        );
      // trader a's row is the older one, trader b's row is due a minute later
      expect(await hold(oldest, a, T0 + MIN)).toMatchObject({ ok: true });
      expect(await hold(later, b, T0 + 2 * MIN)).toMatchObject({ ok: true });
      await other.query('BEGIN');
      try {
        await other.query(
          `SELECT 1 FROM "${T_RESERVATIONS}" WHERE "request_id" = $1 FOR UPDATE`,
          [oldest]
        );
        expect(await reapExpired(T0 + 5 * MIN, { client: prisma })).toEqual({
          ok: true,
          expired: 1,
          unitsReturned: 100,
        });
        const rows = await db.query(
          `SELECT "request_id", "status" FROM "${T_RESERVATIONS}" WHERE "request_id" IN ($1, $2) ORDER BY 1`,
          [oldest, later]
        );
        expect(
          Object.fromEntries(rows.rows.map((r) => [r.request_id, r.status]))
        ).toEqual({ [oldest]: 'RESERVED', [later]: 'EXPIRED' });
        await other.query('COMMIT');
      } finally {
        await other.query('ROLLBACK').catch(() => undefined);
      }
      expect(await reapExpired(T0 + 5 * MIN, { client: prisma })).toEqual({
        ok: true,
        expired: 1,
        unitsReturned: 100,
      });
      for (const t of [a, b]) {
        const audit = await auditPeriod(t, OCT, { client: prisma });
        expect(audit?.problems).toEqual([]);
        expect(audit?.reserved).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('the reaper spends a small batch oldest deadline first', () => {
    beforeEach(wipe);

    test('one row at a time: the oldest deadline, then the next oldest of any period', async () => {
      const a = await user(db);
      const b = await user(db);
      const ids = {
        a1: requestId('order-a1'),
        a2: requestId('order-a2'),
        b1: requestId('order-b1'),
      };
      const hold = (requestId: string, userId: string, minutes: number) =>
        reserveUnits(
          {
            requestId,
            userId,
            month: OCT,
            limit: 1_000,
            units: 100,
            nowMs: T0,
            expiresAtMs: T0 + minutes * MIN,
          },
          { client: prisma }
        );
      // deadlines: a1 at +1 minute, b1 at +2, a2 at +3
      expect(await hold(ids.a1, a, 1)).toMatchObject({ ok: true });
      expect(await hold(ids.b1, b, 2)).toMatchObject({ ok: true });
      expect(await hold(ids.a2, a, 3)).toMatchObject({ ok: true });
      const statuses = async () => {
        const rows = await db.query(
          `SELECT "request_id", "status" FROM "${T_RESERVATIONS}" WHERE "request_id" = ANY($1)`,
          [Object.values(ids)]
        );
        const byId = Object.fromEntries(
          rows.rows.map((r) => [r.request_id, r.status])
        );
        return {
          a1: byId[ids.a1],
          b1: byId[ids.b1],
          a2: byId[ids.a2],
        };
      };
      const reapOne = () =>
        reapExpired(T0 + 10 * MIN, { client: prisma, batch: 1 });
      expect(await reapOne()).toMatchObject({ ok: true, expired: 1 });
      expect(await statuses()).toEqual({
        a1: 'EXPIRED',
        b1: 'RESERVED',
        a2: 'RESERVED',
      });
      expect(await reapOne()).toMatchObject({ ok: true, expired: 1 });
      expect(await statuses()).toEqual({
        a1: 'EXPIRED',
        b1: 'EXPIRED',
        a2: 'RESERVED',
      });
      expect(await reapOne()).toMatchObject({ ok: true, expired: 1 });
      expect(await statuses()).toEqual({
        a1: 'EXPIRED',
        b1: 'EXPIRED',
        a2: 'EXPIRED',
      });
      expect(await reapOne()).toEqual({
        ok: true,
        expired: 0,
        unitsReturned: 0,
      });
      for (const t of [a, b]) {
        const audit = await auditPeriod(t, OCT, { client: prisma });
        expect(audit?.problems).toEqual([]);
        expect(audit?.reserved).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('the reaper loses no period update while reservations race it', () => {
    beforeEach(wipe);

    test('several periods, busy periods, the planner pushed to a nested loop: every round the books balance', async () => {
      // PostgreSQL 18.1 lost the period update of a reaper statement that took SEVERAL periods and had to
      // follow a concurrent change of one of them: the rows became EXPIRED and the units never went back
      // (about half of the updates, under load, with a nested-loop plan). The reaper now expires one period
      // per statement. Here the session is pushed to nested loops and every round repeats the race: the
      // reaper against reservations that change the same periods.
      const { Client } = require('pg') as typeof import('pg');
      const forced = new Client({ connectionString: URL });
      await forced.connect();
      await forced.query('SET enable_hashjoin = off');
      await forced.query('SET enable_mergejoin = off');
      const reaperClient = {
        async $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]) {
          const result = await forced.query(sql, values as any[]);
          return result.rows as unknown as T;
        },
      };
      try {
        const traders = [await user(db), await user(db), await user(db)];
        for (let round = 0; round < 40; round += 1) {
          await db.query(`DELETE FROM "${T_RESERVATIONS}"`);
          await db.query(`DELETE FROM "${T_PERIODS}"`);
          // each trader: a period with 40 reservations of 10 units, all past their deadline
          for (const t of traders) {
            const p = await period(db, t, { limit: 1_000_000, reserved: 400 });
            for (let i = 0; i < 40; i += 1) {
              await reservation(
                db,
                reservationRow(t, p, { expires_at: '2026-10-15 10:01:00' })
              );
            }
          }
          const racers = Array.from({ length: 9 }, (_unused, i) =>
            reserveUnits(
              {
                requestId: requestId(`race-${round}-${i}`),
                userId: traders[i % traders.length]!,
                month: OCT,
                limit: 1_000_000,
                units: 25,
                nowMs: T0 + 2 * MIN,
                expiresAtMs: T0 + 60 * MIN,
              },
              { client: prisma }
            )
          );
          const [reaped] = await Promise.all([
            reapExpired(T0 + 5 * MIN, { client: reaperClient }),
            ...racers,
          ]);
          expect(reaped).toEqual({
            ok: true,
            expired: 120,
            unitsReturned: 1_200,
          });
          for (const t of traders) {
            const audit = await auditPeriod(t, OCT, { client: prisma });
            expect({ round, trader: t, problems: audit?.problems }).toEqual({
              round,
              trader: t,
              problems: [],
            });
            // the 400 units of the expired rows are gone; what the racers hold (3 x 25) is left
            expect(audit?.reserved).toBe(75);
          }
        }
      } finally {
        await forced.end();
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('no drift', () => {
    function diff(): { status: number; output: string } {
      const dir = mkdtempSync(join(tmpdir(), 'lg-drift-'));
      try {
        const schema = resolve(
          ROOT,
          'prisma/non-market-data/schema.prisma'
        ).replace(/\\/g, '/');
        const config = join(dir, 'prisma.config.mjs');
        writeFileSync(
          config,
          `export default { schema: ${JSON.stringify(schema)}, datasource: { url: ${JSON.stringify(URL)} } };\n`
        );
        try {
          const output = execFileSync(
            process.execPath,
            [
              resolve(ROOT, 'node_modules/prisma/build/index.js'),
              'migrate',
              'diff',
              '--config',
              config,
              '--from-config-datasource',
              '--to-schema',
              schema,
              '--exit-code',
              '--script',
            ],
            {
              cwd: ROOT,
              encoding: 'utf8',
              stdio: ['ignore', 'pipe', 'pipe'],
              timeout: 120_000,
            }
          );
          return { status: 0, output };
        } catch (error) {
          const e = error as {
            status?: number;
            stdout?: string;
            stderr?: string;
          };
          return {
            status: e.status ?? -1,
            output: `${e.stdout ?? ''}${e.stderr ?? ''}`,
          };
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    test('`prisma migrate diff` between this database and the schema is empty (exit 0)', () => {
      const result = diff();
      expect(result.output).toMatch(/empty migration/);
      expect(result.status).toBe(0);
    });

    test('control: a column added by hand IS seen as drift (exit 2)', async () => {
      await db.query(`ALTER TABLE "${T_PERIODS}" ADD COLUMN "oops" TEXT`);
      try {
        const result = diff();
        expect(result.status).toBe(2);
        expect(result.output).toMatch(/DROP COLUMN "oops"/);
      } finally {
        await db.query(`ALTER TABLE "${T_PERIODS}" DROP COLUMN "oops"`);
      }
    });
  });

  test('last: the guard on ai_usage_reservations is still enabled', async () => {
    const { rows } = await db.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = $1::regclass`,
      [`"${T_RESERVATIONS}"`]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tgenabled).toBe('O');
  });
});
