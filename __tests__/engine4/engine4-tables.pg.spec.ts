/**
 * @jest-environment node
 */

/**
 * The three Engine 4 tables against a REAL PostgreSQL (build step 5, part 5):
 * user_trade_preferences, user_trade_preferences_history and trade_consent_records,
 * as created by prisma/migrations/20261010000000_add_engine4_tables/migration.sql.
 *
 * The unit tests (`__tests__/lib/engine4/store/`) compare files and use an in-memory
 * stand-in. This spec shows what the database does: that every CHECK constraint Prisma
 * cannot see refuses what it is there to refuse and accepts the value on its line; that
 * the append-only trigger refuses an UPDATE, a DELETE and a TRUNCATE of an audit row and
 * lets exactly one change through; that the stores (`lib/engine4/store/`) write what they
 * mean through the real generated Prisma client; and, the point of the whole design, that
 * DELETING A User keeps every history and consent row, with user_id NULL and the hash,
 * the key version and every other column exactly as they were.
 *
 * It also holds the TypeScript profile validator and the database to each other: a
 * seeded corpus of profiles is given to `validateProfile` and to both profile tables, and
 * they must agree on every one. And it runs `prisma migrate diff` against the database
 * and expects no drift (with a control that drift is seen).
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of the three tables, and the users it
 *                        creates (email e4-test-*@example.test), in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and
 *      create an empty database;
 *   2. build the NON-MARKET schema as it was BEFORE this migration:
 *        prisma migrate diff --config <scratch config outside the repo> --from-empty \
 *          --to-schema <prisma/non-market-data/schema.prisma at the commit before part 5> --script
 *      (keep the text from the first "-- CreateSchema", ASCII, no BOM) and apply it with
 *      `psql -v ON_ERROR_STOP=1 -f ...`; then apply the MIGRATION FILE itself, not a diff of the
 *      schema (a diff has no CHECK constraints and no trigger, and the first test below fails
 *      if they are missing):
 *        psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261010000000_add_engine4_tables/migration.sql
 *      The database must hold the non-market tables and nothing else, or the drift test sees
 *      the extra tables;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/engine4/*.pg.spec.ts' --coverage=false
 *      (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs
 *      this file; `--runTestsByPath` finds nothing on Windows, `--testMatch` does);
 *   4. stop and remove the instance.
 */

import { execFileSync } from 'child_process';
import { createHmac } from 'crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { Client as PgClient } from 'pg';

import {
  Rational,
  serializeValidatedSetup,
  validateProfile,
  validateSetup,
} from '@/lib/engine4';
import type { SetupFields, TraderProfile, ValidatedSetup } from '@/lib/engine4';
import { recordConsent } from '@/lib/engine4/store/consent-store';
import { readProfile, saveProfile } from '@/lib/engine4/store/profile-store';
import { hashUserId, verifyUserHash } from '@/lib/engine4/store/user-hash';
import type { AuditKey } from '@/lib/engine4/store/user-hash';

import {
  ROOMY_PROFILE,
  setup as buildSetup,
} from '../lib/engine4/helpers/setup';
import { makeRng } from '../lib/engine4/helpers/rng';

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
    'prisma/migrations/20261010000000_add_engine4_tables/migration.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n');

const T_PREFS = 'user_trade_preferences';
const T_HISTORY = 'user_trade_preferences_history';
const T_CONSENT = 'trade_consent_records';
const AUDIT_TABLES = [T_HISTORY, T_CONSENT] as const;

const KEY_A: AuditKey = { key: 'a'.repeat(48), version: 1, source: 'ENV' };
const KEY_B: AuditKey = { key: 'b'.repeat(48), version: 2, source: 'ENV' };
const HASH = 'a'.repeat(64);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Refusal {
  code: string | undefined;
  constraint: string | undefined;
  message: string;
}

type Row = Record<string, unknown>;

let counter = 0;
const uid = (): string => `e4-row-${(counter += 1)}`;

/** `INSERT INTO "table" (...) VALUES ($1, ...)` for the keys of a row. */
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

const profileRow = (over: Row = {}): Row => ({
  trader_type: 'DAY_TRADER',
  style: 'BOTH',
  max_risk_pct: '1.5',
  max_leverage: '1.5',
  target_rrr: '1.75',
  equity: '5000',
  min_sld: '13',
  commission: '4',
  ...over,
});

const historyRow = (over: Row = {}): Row => ({
  id: uid(),
  user_id: null,
  user_id_hash: HASH,
  key_version: 1,
  ...profileRow(),
  ...over,
});

const sha256Hex = (c: PgClient, text: string): Promise<string> =>
  c
    .query<{
      h: string;
    }>(`SELECT encode(sha256(convert_to($1, 'UTF8')), 'hex') AS h`, [text])
    .then((r) => r.rows[0]!.h);

const MODAL: SetupFields = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

/** A real validated setup: the 18 Sep golden cycle through the real validator. */
function validated(
  profile: Partial<TraderProfile> = {},
  fields: SetupFields = {}
): ValidatedSetup {
  return validateSetup(buildSetup({ profile }).ctx, { ...MODAL, ...fields });
}

/** The columns of a consent row for a setup object; `over` may break any of them. */
async function consentRow(
  c: PgClient,
  snapshotId: string,
  setup: Row,
  over: Row = {}
): Promise<Row> {
  const text = JSON.stringify(setup);
  return {
    id: uid(),
    user_id: null,
    user_id_hash: HASH,
    key_version: 1,
    action: 'ACCEPT',
    symbol: 'XAUUSD',
    cycle_slot: Number(setup['pinnedSlot']),
    synthesis_rule_id: 'R7',
    synthesis_rules_version: 'draft-1',
    zone_id: (setup['entry'] as { zoneId: string | null }).zoneId,
    side: setup['side'],
    profile_snapshot_id: snapshotId,
    badge: null,
    setup_json: text,
    setup: text,
    setup_sha256: await sha256Hex(c, text),
    engine4_version: '1.0.0',
    symbol_specs_version: 4,
    template_version: 'report2-0.1',
    disclaimer_version: 'disc-2026-10',
    language: 'en',
    ...over,
  };
}

// ---------------------------------------------------------------------------

suite('the Engine 4 tables on a real Postgres', () => {
  jest.setTimeout(180_000);

  let prisma: any;
  let db: PgClient;

  /** BEGIN, run, and ROLLBACK: nothing of it survives. */
  async function rolledBack<T>(fn: (c: PgClient) => Promise<T>): Promise<T> {
    await db.query('BEGIN');
    try {
      return await fn(db);
    } finally {
      await db.query('ROLLBACK');
    }
  }

  /** A user row and a history snapshot of it, inside the open transaction. */
  async function userWithSnapshot(
    c: PgClient
  ): Promise<{ userId: string; snapshotId: string }> {
    const userId = uid();
    await c.query(
      `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
      [userId, `${userId}@example.test`]
    );
    const snapshot = historyRow({ user_id: userId });
    const { sql, params } = insertSql(T_HISTORY, snapshot);
    await c.query(sql, params);
    return { userId, snapshotId: snapshot['id'] as string };
  }

  /** Delete what this spec wrote. The audit tables refuse a DELETE, so their triggers are off for it. */
  async function wipe(): Promise<void> {
    await db.query('BEGIN');
    try {
      for (const table of AUDIT_TABLES) {
        await db.query(`ALTER TABLE "${table}" DISABLE TRIGGER USER`);
      }
      await db.query(`DELETE FROM "${T_CONSENT}"`);
      await db.query(`DELETE FROM "${T_PREFS}"`);
      await db.query(`DELETE FROM "${T_HISTORY}"`);
      await db.query(
        `DELETE FROM "User" WHERE "email" LIKE 'e4-%@example.test' OR "email" LIKE 'e4-test-%'`
      );
      for (const table of AUDIT_TABLES) {
        await db.query(`ALTER TABLE "${table}" ENABLE TRIGGER USER`);
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
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
      expect(wanted.length).toBeGreaterThan(30);
      const { rows } = await db.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE contype = 'c' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PREFS}"`, `"${T_HISTORY}"`, `"${T_CONSENT}"`]]
      );
      expect(rows.map((r) => r.conname)).toEqual(wanted);
    });

    test('keys: a primary key on id, one profile per user, and the five foreign keys with their delete rules', async () => {
      const keys = await db.query<{
        conname: string;
        contype: string;
        tbl: string;
      }>(
        `SELECT conname, contype, conrelid::regclass::text AS tbl FROM pg_constraint
          WHERE contype IN ('p', 'u') AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PREFS}"`, `"${T_HISTORY}"`, `"${T_CONSENT}"`]]
      );
      expect(
        keys.rows.filter((r) => r.contype === 'p').map((r) => r.conname)
      ).toEqual([
        'trade_consent_records_pkey',
        'user_trade_preferences_history_pkey',
        'user_trade_preferences_pkey',
      ]);
      // user_id is unique on the CURRENT profile (an index, not a constraint, in Prisma's DDL)
      const unique = await db.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE 'CREATE UNIQUE%'
          AND indexname <> 'user_trade_preferences_pkey'`,
        [T_PREFS]
      );
      expect(unique.rows.map((r) => r.indexname)).toEqual([
        'user_trade_preferences_user_id_key',
      ]);

      const fks = await db.query<{ conname: string; confdeltype: string }>(
        `SELECT conname, confdeltype FROM pg_constraint
          WHERE contype = 'f' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_PREFS}"`, `"${T_HISTORY}"`, `"${T_CONSENT}"`]]
      );
      expect(
        Object.fromEntries(fks.rows.map((r) => [r.conname, r.confdeltype]))
      ).toEqual({
        // a = no action, r = restrict, c = cascade, n = set null
        trade_consent_records_profile_snapshot_id_fkey: 'r',
        trade_consent_records_user_id_fkey: 'n',
        user_trade_preferences_history_user_id_fkey: 'n',
        user_trade_preferences_snapshot_id_fkey: 'r',
        user_trade_preferences_user_id_fkey: 'c',
      });
    });

    test('the append-only triggers exist on the two audit tables, are enabled, and the current profile has none', async () => {
      const { rows } = await db.query<{
        tgname: string;
        tgenabled: string;
        tbl: string;
      }>(
        `SELECT tgname, tgenabled, tgrelid::regclass::text AS tbl FROM pg_trigger
          WHERE NOT tgisinternal AND tgrelid = ANY ($1::regclass[]) ORDER BY tgname`,
        [[`"${T_PREFS}"`, `"${T_HISTORY}"`, `"${T_CONSENT}"`]]
      );
      expect(rows.map((r) => [r.tbl, r.tgname, r.tgenabled])).toEqual([
        [T_CONSENT, 'trade_consent_records_append_only', 'O'],
        [T_CONSENT, 'trade_consent_records_no_truncate', 'O'],
        [T_HISTORY, 'user_trade_preferences_history_append_only', 'O'],
        [T_HISTORY, 'user_trade_preferences_history_no_truncate', 'O'],
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe('the profile rules, on both profile tables, at their boundaries', () => {
    // [label, columns, the constraint that refuses it (suffix), or null when it is accepted]
    const CASES: [string, Row, string | null][] = [
      ['the defaults', {}, null],
      ['risk 0.5 (the floor)', { max_risk_pct: '0.5' }, null],
      ['risk 0.49', { max_risk_pct: '0.49' }, 'max_risk_pct_bounds'],
      ['risk 2 (the ceiling)', { max_risk_pct: '2' }, null],
      ['risk 2.01', { max_risk_pct: '2.01' }, 'max_risk_pct_bounds'],
      ['leverage 5 (the 1:5 ceiling)', { max_leverage: '5' }, null],
      ['leverage 5.01', { max_leverage: '5.01' }, 'max_leverage_ceiling'],
      ['leverage 4.99', { max_leverage: '4.99' }, null],
      ['leverage 0', { max_leverage: '0' }, 'max_leverage_ceiling'],
      ['leverage 0.01', { max_leverage: '0.01' }, null],
      ['RRR 1.5 (the floor)', { target_rrr: '1.5' }, null],
      ['RRR 1.49', { target_rrr: '1.49' }, 'target_rrr_bounds'],
      ['RRR 3.5 (the ceiling), style BOTH', { target_rrr: '3.5' }, null],
      ['RRR 3.51', { target_rrr: '3.51' }, 'target_rrr_bounds'],
      [
        'counter-trend RRR 2.5',
        { style: 'TREND_COUNTERING', target_rrr: '2.5' },
        null,
      ],
      [
        'counter-trend RRR 2.51',
        { style: 'TREND_COUNTERING', target_rrr: '2.51' },
        'counter_trend_rrr_cap',
      ],
      [
        'trend-following RRR 3.5',
        { style: 'TREND_FOLLOWING', target_rrr: '3.5' },
        null,
      ],
      ['equity 0', { equity: '0' }, 'equity_is_positive'],
      ['equity 0.01', { equity: '0.01' }, null],
      [
        'equity with 24 decimals, kept exactly',
        { equity: '12345.678901234567890123456' },
        null,
      ],
      ['min stop 0', { min_sld: '0' }, 'min_sld_is_positive'],
      ['min stop 0.01', { min_sld: '0.01' }, null],
      ['commission 0', { commission: '0' }, null],
      ['commission -1', { commission: '-1' }, 'figures_are_decimal_text'],
      [
        'commission 1.50 (not canonical)',
        { commission: '1.50' },
        'figures_are_decimal_text',
      ],
      [
        'equity 05000 (leading zero)',
        { equity: '05000' },
        'figures_are_decimal_text',
      ],
      ['equity 1e3', { equity: '1e3' }, 'figures_are_decimal_text'],
      ['equity ""', { equity: '' }, 'figures_are_decimal_text'],
      ['equity " 5"', { equity: ' 5' }, 'figures_are_decimal_text'],
      ['equity "5."', { equity: '5.' }, 'figures_are_decimal_text'],
      ['equity ".5"', { equity: '.5' }, 'figures_are_decimal_text'],
      ['equity "1,5"', { equity: '1,5' }, 'figures_are_decimal_text'],
      [
        'risk "abc" is only a bad text, not a cast error',
        { max_risk_pct: 'abc' },
        'figures_are_decimal_text',
      ],
      // every one of the six figures is held to the decimal-text rule on its own
      ['leverage "abc"', { max_leverage: 'abc' }, 'figures_are_decimal_text'],
      ['RRR "abc"', { target_rrr: 'abc' }, 'figures_are_decimal_text'],
      ['equity "abc"', { equity: 'abc' }, 'figures_are_decimal_text'],
      ['min stop "abc"', { min_sld: 'abc' }, 'figures_are_decimal_text'],
      ['commission "abc"', { commission: 'abc' }, 'figures_are_decimal_text'],
      ['trader type SWING', { trader_type: 'SWING' }, 'trader_type_is_known'],
      ['trader type SCALPER', { trader_type: 'SCALPER' }, null],
      ['style MIXED', { style: 'MIXED' }, 'style_is_known'],
    ];

    describe.each([T_HISTORY, T_PREFS])('%s', (table) => {
      async function insert(c: PgClient, over: Row): Promise<Refusal | null> {
        const { userId, snapshotId } = await userWithSnapshot(c);
        const row =
          table === T_HISTORY
            ? historyRow(over)
            : {
                id: uid(),
                user_id: userId,
                snapshot_id: snapshotId,
                updated_at: new Date(),
                ...profileRow(over),
              };
        const { sql, params } = insertSql(table, row);
        return refusal(c, sql, params);
      }

      test.each(CASES)('%s', async (_label, over, suffix) => {
        const result = await rolledBack((c) => insert(c, over));
        if (suffix === null) {
          expect(result).toBeNull();
        } else {
          expect(result).toMatchObject({
            code: '23514',
            constraint: `${table}_${suffix}`,
          });
        }
      });
    });
  });

  describe('the hash columns of the history table', () => {
    test.each([
      [
        'a 64-character lowercase hex hash',
        { user_id_hash: 'f'.repeat(64) },
        null,
      ],
      [
        'a hash in capitals',
        { user_id_hash: 'F'.repeat(64) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash of 63 characters',
        { user_id_hash: 'a'.repeat(63) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash of 65 characters',
        { user_id_hash: 'a'.repeat(65) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash that is not hex',
        { user_id_hash: 'g'.repeat(64) },
        'user_id_hash_is_hex',
      ],
      ['key version 1', { key_version: 1 }, null],
      ['key version 0', { key_version: 0 }, 'key_version_is_positive'],
      ['key version -1', { key_version: -1 }, 'key_version_is_positive'],
    ] as [string, Row, string | null][])('%s', async (_label, over, suffix) => {
      const { sql, params } = insertSql(T_HISTORY, historyRow(over));
      const result = await rolledBack((c) => refusal(c, sql, params));
      if (suffix === null) expect(result).toBeNull();
      else
        expect(result).toMatchObject({
          code: '23514',
          constraint: `${T_HISTORY}_${suffix}`,
        });
    });

    test('a hash is required, and so is a key version (NOT NULL)', async () => {
      for (const column of ['user_id_hash', 'key_version']) {
        const { sql, params } = insertSql(
          T_HISTORY,
          historyRow({ [column]: null })
        );
        const result = await rolledBack((c) => refusal(c, sql, params));
        expect(result).toMatchObject({ code: '23502' });
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('the consent record’s rules', () => {
    const GOOD = JSON.parse(serializeValidatedSetup(validated())) as Row;
    const CUSTOM = JSON.parse(
      serializeValidatedSetup(
        validated({}, { zoneId: undefined, entry: '4370' })
      )
    ) as Row;

    async function insert(
      over: Row,
      setupObject: Row = GOOD,
      extra: Row = {}
    ): Promise<Refusal | null> {
      return rolledBack(async (c) => {
        const { snapshotId } = await userWithSnapshot(c);
        const row = await consentRow(
          c,
          snapshotId,
          { ...setupObject, ...extra },
          over
        );
        const { sql, params } = insertSql(T_CONSENT, row);
        return refusal(c, sql, params);
      });
    }

    test('the setups under test are what the cases need', () => {
      expect(GOOD).toMatchObject({
        ok: true,
        side: 'BUY',
        entry: { zoneId: 'Z1' },
      });
      expect(CUSTOM).toMatchObject({
        ok: true,
        entry: { source: 'CUSTOM', zoneId: null },
      });
      expect(typeof GOOD['pinnedSlot']).toBe('string');
    });

    test('a record that agrees with itself is accepted, for each of the three actions', async () => {
      for (const action of ['ACCEPT', 'MODIFY', 'DECLINE']) {
        expect(await insert({ action })).toBeNull();
      }
    });

    test('a SELL setup is accepted with a SELL side', async () => {
      expect(await insert({ side: 'SELL' }, GOOD, { side: 'SELL' })).toBeNull();
    });

    test('a setup text with characters beyond ASCII is accepted with its UTF-8 hash', async () => {
      // an event name in the holding-window warnings can be in any script
      const result = await rolledBack(async (c) => {
        const { snapshotId } = await userWithSnapshot(c);
        const text = JSON.stringify({
          ...GOOD,
          note: 'Décision de taux, 利率决议, قرار الفائدة',
        });
        const row = await consentRow(
          c,
          snapshotId,
          { ...GOOD, note: 'Décision de taux, 利率决议, قرار الفائدة' },
          {
            setup_json: text,
            setup: text,
            setup_sha256: await sha256Hex(c, text),
          }
        );
        const { sql, params } = insertSql(T_CONSENT, row);
        return refusal(c, sql, params);
      });
      expect(result).toBeNull();
    });

    test('a custom entry has a NULL zone, and the setup says so', async () => {
      expect(await insert({ zone_id: null }, CUSTOM)).toBeNull();
    });

    test.each([
      ['an unknown action', { action: 'ACCEPTED' }, 'action_is_known'],
      ['a lower-case action', { action: 'accept' }, 'action_is_known'],
      ['a fourth action, CANCEL', { action: 'CANCEL' }, 'action_is_known'],
      ['a fourth action, REJECT', { action: 'REJECT' }, 'action_is_known'],
      [
        'a hash in capitals',
        { user_id_hash: 'A'.repeat(64) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash of 63 characters',
        { user_id_hash: 'a'.repeat(63) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash of 65 characters',
        { user_id_hash: 'a'.repeat(65) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash that is not hex',
        { user_id_hash: 'g'.repeat(64) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash with a stray character in front',
        { user_id_hash: 'g' + 'a'.repeat(64) },
        'user_id_hash_is_hex',
      ],
      [
        'a hash with a stray character behind',
        { user_id_hash: 'a'.repeat(64) + 'g' },
        'user_id_hash_is_hex',
      ],
      [
        'a hash with a newline behind',
        { user_id_hash: 'a'.repeat(64) + '\n' },
        'user_id_hash_is_hex',
      ],
      ['key version 0', { key_version: 0 }, 'key_version_is_positive'],
      [
        'a symbol_specs version of 0',
        { symbol_specs_version: 0 },
        'symbol_specs_version_is_positive',
      ],
      ['an empty symbol', { symbol: '' }, 'names_are_not_empty'],
      ['a symbol of spaces', { symbol: '   ' }, 'names_are_not_empty'],
      ['a blank rule id', { synthesis_rule_id: '   ' }, 'names_are_not_empty'],
      [
        'an empty rules version',
        { synthesis_rules_version: '' },
        'names_are_not_empty',
      ],
      [
        'an empty Engine 4 version',
        { engine4_version: '' },
        'names_are_not_empty',
      ],
      [
        'an empty template version',
        { template_version: '' },
        'names_are_not_empty',
      ],
      [
        'an empty disclaimer version',
        { disclaimer_version: ' ' },
        'names_are_not_empty',
      ],
      ['an empty language', { language: '' }, 'names_are_not_empty'],
      [
        'a setup hash that is not the text’s',
        { setup_sha256: 'e'.repeat(64) },
        'setup_text_is_its_copy_and_hash',
      ],
      [
        'a text that is not the JSONB copy (the hash is right for the text)',
        'text-differs',
        'setup_text_is_its_copy_and_hash',
      ],
      [
        'a cycle slot that is not the setup’s',
        { cycle_slot: 1790000001 },
        'cycle_slot_follows_the_setup',
      ],
      [
        'a side that is not the setup’s',
        { side: 'SELL' },
        'side_follows_the_setup',
      ],
      [
        'a NULL side for a setup that has one',
        { side: null },
        'side_follows_the_setup',
      ],
      [
        'a zone that is not the setup’s',
        { zone_id: 'Z2' },
        'zone_follows_the_setup',
      ],
      [
        'a NULL zone for a setup that picked one',
        { zone_id: null },
        'zone_follows_the_setup',
      ],
    ] as [string, Row | 'text-differs', string][])(
      'refuses %s',
      async (_label, over, suffix) => {
        let result: Refusal | null;
        if (over === 'text-differs') {
          result = await rolledBack(async (c) => {
            const { snapshotId } = await userWithSnapshot(c);
            const other = JSON.stringify({
              ...GOOD,
              ok: !(GOOD['ok'] as boolean),
            });
            const row = await consentRow(c, snapshotId, GOOD, {
              setup_json: other,
              setup_sha256: await sha256Hex(c, other),
            });
            const { sql, params } = insertSql(T_CONSENT, row);
            return refusal(c, sql, params);
          });
        } else {
          result = await insert(over);
        }
        expect(result).toMatchObject({
          code: '23514',
          constraint: `${T_CONSENT}_${suffix}`,
        });
      }
    );

    test('a side that is not BUY or SELL is refused by its own rule (the setup says the same, so it is the only one broken)', async () => {
      expect(
        await insert({ side: 'LONG' }, GOOD, { side: 'LONG' })
      ).toMatchObject({
        code: '23514',
        constraint: `${T_CONSENT}_side_is_known`,
      });
    });

    test('a zone for a custom entry is refused', async () => {
      expect(await insert({ zone_id: 'Z1' }, CUSTOM)).toMatchObject({
        constraint: `${T_CONSENT}_zone_follows_the_setup`,
      });
    });

    test('a setup that is not a validated-setup/1 document is refused (with its own text and hash)', async () => {
      expect(
        await insert({}, GOOD, { schema: 'validated-setup/2' })
      ).toMatchObject({
        code: '23514',
        constraint: `${T_CONSENT}_setup_is_a_validated_setup`,
      });
    });

    test('a slot of 0 is refused by its own rule when the setup says 0 too', async () => {
      expect(await insert({}, GOOD, { pinnedSlot: '0' })).toMatchObject({
        code: '23514',
        constraint: `${T_CONSENT}_cycle_slot_is_positive`,
      });
    });

    test('a setup with no side takes a NULL side', async () => {
      expect(await insert({ side: null }, GOOD, { side: null })).toBeNull();
    });

    test('the text is the record: a reordered text with its own hash is the same document and is accepted', async () => {
      const result = await rolledBack(async (c) => {
        const { snapshotId } = await userWithSnapshot(c);
        const entries = Object.entries(GOOD).reverse();
        const reordered = JSON.stringify(Object.fromEntries(entries));
        expect(reordered).not.toBe(JSON.stringify(GOOD));
        const row = await consentRow(c, snapshotId, GOOD, {
          setup_json: reordered,
          setup: reordered,
          setup_sha256: await sha256Hex(c, reordered),
        });
        const { sql, params } = insertSql(T_CONSENT, row);
        return refusal(c, sql, params);
      });
      expect(result).toBeNull();
    });

    test('NOT NULL: the hash, the key version, the setup text and every version', async () => {
      for (const column of [
        'user_id_hash',
        'key_version',
        'setup_json',
        'setup',
        'setup_sha256',
        'engine4_version',
        'template_version',
        'disclaimer_version',
        'language',
        'symbol',
        'profile_snapshot_id',
      ]) {
        expect(await insert({ [column]: null })).toMatchObject({
          code: '23502',
        });
      }
    });

    test('the snapshot must exist', async () => {
      expect(
        await insert({ profile_snapshot_id: 'no-such-snapshot' })
      ).toMatchObject({
        code: '23503',
        constraint: `${T_CONSENT}_profile_snapshot_id_fkey`,
      });
    });

    test('the user, when named, must exist; NULL is allowed', async () => {
      expect(await insert({ user_id: 'no-such-user' })).toMatchObject({
        code: '23503',
        constraint: `${T_CONSENT}_user_id_fkey`,
      });
      expect(await insert({ user_id: null })).toBeNull();
    });

    test('recorded_at is set by the database', async () => {
      const when = await rolledBack(async (c) => {
        const { snapshotId } = await userWithSnapshot(c);
        const row = await consentRow(c, snapshotId, GOOD);
        const { sql, params } = insertSql(T_CONSENT, row);
        await c.query(sql, params);
        const read = await c.query<{ recorded_at: Date }>(
          `SELECT recorded_at FROM "${T_CONSENT}" WHERE id = $1`,
          [row['id']]
        );
        return read.rows[0]!.recorded_at;
      });
      expect(Math.abs(when.getTime() - Date.now())).toBeLessThan(120_000);
    });
  });

  // -------------------------------------------------------------------------
  describe('the audit tables are append-only', () => {
    const GOOD = JSON.parse(serializeValidatedSetup(validated())) as Row;

    /** One owned history row and one owned consent row, in the open transaction. */
    async function ownedRows(c: PgClient) {
      const { userId, snapshotId } = await userWithSnapshot(c);
      const consent = await consentRow(c, snapshotId, GOOD, {
        user_id: userId,
      });
      const { sql, params } = insertSql(T_CONSENT, consent);
      await c.query(sql, params);
      return { userId, snapshotId, consentId: consent['id'] as string };
    }

    test.each([
      [T_HISTORY, 'equity', "'1'"],
      [T_HISTORY, 'user_id_hash', `'${'b'.repeat(64)}'`],
      [T_HISTORY, 'key_version', '9'],
      [T_CONSENT, 'action', "'DECLINE'"],
      [T_CONSENT, 'badge', "'edited'"],
      [T_CONSENT, 'language', "'fr'"],
      [T_CONSENT, 'user_id_hash', `'${'b'.repeat(64)}'`],
    ])(
      'an UPDATE of %s.%s is refused, and the row is unchanged',
      async (table, column, value) => {
        await rolledBack(async (c) => {
          const { snapshotId, consentId } = await ownedRows(c);
          const id = table === T_HISTORY ? snapshotId : consentId;
          const before = await c.query(
            `SELECT * FROM "${table}" WHERE id = $1`,
            [id]
          );
          const result = await refusal(
            c,
            `UPDATE "${table}" SET "${column}" = ${value} WHERE id = $1`,
            [id]
          );
          expect(result).toMatchObject({ code: '23001' });
          expect(result?.message).toMatch(/append-only/);
          const after = await c.query(
            `SELECT * FROM "${table}" WHERE id = $1`,
            [id]
          );
          expect(after.rows).toEqual(before.rows);
        });
      }
    );

    test.each([T_HISTORY, T_CONSENT])(
      'a DELETE from %s is refused',
      async (table) => {
        await rolledBack(async (c) => {
          const { snapshotId, consentId } = await ownedRows(c);
          const id = table === T_HISTORY ? snapshotId : consentId;
          expect(
            await refusal(c, `DELETE FROM "${table}" WHERE id = $1`, [id])
          ).toMatchObject({
            code: '23001',
          });
          expect(await refusal(c, `DELETE FROM "${table}"`)).toMatchObject({
            code: '23001',
          });
          const left = await c.query(
            `SELECT count(*)::int AS n FROM "${table}" WHERE id = $1`,
            [id]
          );
          expect(left.rows[0]!.n).toBe(1);
        });
      }
    );

    test.each([T_HISTORY, T_CONSENT])(
      'a row nothing points at cannot be deleted either: it is the trigger, not a foreign key (%s)',
      async (table) => {
        await rolledBack(async (c) => {
          await ownedRows(c);
          // a snapshot with no consent, no current profile: only the trigger stands in the way
          const { snapshotId: lone } = await userWithSnapshot(c);
          const id =
            table === T_HISTORY ? lone : (await ownedRows(c)).consentId;
          const result = await refusal(
            c,
            `DELETE FROM "${table}" WHERE id = $1`,
            [id]
          );
          expect(result).toMatchObject({ code: '23001' });
          expect(result?.message).toMatch(/append-only/);
        });
      }
    );

    test('a TRUNCATE of the consent table is refused by its trigger', async () => {
      await rolledBack(async (c) => {
        await ownedRows(c);
        const result = await refusal(c, `TRUNCATE "${T_CONSENT}"`);
        expect(result).toMatchObject({ code: '23001' });
        expect(result?.message).toContain(`"${T_CONSENT}"`);
      });
    });

    test('a TRUNCATE of the history table alone is refused by PostgreSQL itself (a foreign key points at it)', async () => {
      await rolledBack(async (c) => {
        await ownedRows(c);
        expect(await refusal(c, `TRUNCATE "${T_HISTORY}"`)).toMatchObject({
          code: '0A000',
        });
      });
    });

    test('...and the history trigger is the wall when the foreign key is not: each audit table’s trigger refuses on its own', async () => {
      // TRUNCATE ... CASCADE passes the foreign-key check, so the triggers are what decide
      await rolledBack(async (c) => {
        await ownedRows(c);
        const both = await refusal(c, `TRUNCATE "${T_HISTORY}" CASCADE`);
        expect(both).toMatchObject({ code: '23001' });
        // consent's trigger off: the history trigger still refuses
        await c.query(
          `ALTER TABLE "${T_CONSENT}" DISABLE TRIGGER "${T_CONSENT}_no_truncate"`
        );
        const historyOnly = await refusal(c, `TRUNCATE "${T_HISTORY}" CASCADE`);
        expect(historyOnly).toMatchObject({ code: '23001' });
        expect(historyOnly?.message).toContain(`"${T_HISTORY}"`);
        // history's trigger off and consent's back on: the consent trigger refuses
        await c.query(
          `ALTER TABLE "${T_CONSENT}" ENABLE TRIGGER "${T_CONSENT}_no_truncate"`
        );
        await c.query(
          `ALTER TABLE "${T_HISTORY}" DISABLE TRIGGER "${T_HISTORY}_no_truncate"`
        );
        const consentOnly = await refusal(c, `TRUNCATE "${T_HISTORY}" CASCADE`);
        expect(consentOnly).toMatchObject({ code: '23001' });
        expect(consentOnly?.message).toContain(`"${T_CONSENT}"`);
        // both off: the truncate goes through, which shows the two triggers are the only thing in the way
        await c.query(
          `ALTER TABLE "${T_CONSENT}" DISABLE TRIGGER "${T_CONSENT}_no_truncate"`
        );
        expect(await refusal(c, `TRUNCATE "${T_HISTORY}" CASCADE`)).toBeNull();
      });
    });

    test('a TRUNCATE of "User" CASCADE cannot reach an audit table either', async () => {
      await rolledBack(async (c) => {
        await ownedRows(c);
        const result = await refusal(c, `TRUNCATE "User" CASCADE`);
        expect(result).toMatchObject({ code: '23001' });
      });
    });

    test.each([T_HISTORY, T_CONSENT])(
      'the ONE change that is allowed: user_id from a value to NULL, nothing else (%s)',
      async (table) => {
        await rolledBack(async (c) => {
          const { userId, snapshotId, consentId } = await ownedRows(c);
          const id = table === T_HISTORY ? snapshotId : consentId;
          const before = (
            await c.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])
          ).rows[0];
          expect(before.user_id).toBe(userId);
          expect(
            await refusal(
              c,
              `UPDATE "${table}" SET user_id = NULL WHERE id = $1`,
              [id]
            )
          ).toBeNull();
          // refusal() undid it; do it for real now
          await c.query(`UPDATE "${table}" SET user_id = NULL WHERE id = $1`, [
            id,
          ]);
          const after = (
            await c.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])
          ).rows[0];
          expect(after).toEqual({ ...before, user_id: null });
        });
      }
    );

    test.each([T_HISTORY, T_CONSENT])(
      '...but not NULL together with another change (%s)',
      async (table) => {
        await rolledBack(async (c) => {
          const { snapshotId, consentId } = await ownedRows(c);
          const id = table === T_HISTORY ? snapshotId : consentId;
          const other =
            table === T_HISTORY ? `equity = '1'` : `language = 'fr'`;
          expect(
            await refusal(
              c,
              `UPDATE "${table}" SET user_id = NULL, ${other} WHERE id = $1`,
              [id]
            )
          ).toMatchObject({ code: '23001' });
        });
      }
    );

    test.each([T_HISTORY, T_CONSENT])(
      '...and a row can never be given an owner again (%s)',
      async (table) => {
        await rolledBack(async (c) => {
          const { userId, snapshotId, consentId } = await ownedRows(c);
          const id = table === T_HISTORY ? snapshotId : consentId;
          await c.query(`UPDATE "${table}" SET user_id = NULL WHERE id = $1`, [
            id,
          ]);
          expect(
            await refusal(
              c,
              `UPDATE "${table}" SET user_id = $2 WHERE id = $1`,
              [id, userId]
            )
          ).toMatchObject({ code: '23001' });
          // nor can an ownerless row be "changed" to NULL again as a way of touching it
          expect(
            await refusal(
              c,
              `UPDATE "${table}" SET user_id = NULL WHERE id = $1`,
              [id]
            )
          ).toMatchObject({ code: '23001' });
        });
      }
    );

    test('...and an owner cannot be swapped for another user', async () => {
      await rolledBack(async (c) => {
        const { snapshotId } = await ownedRows(c);
        const { userId: other } = await userWithSnapshot(c);
        expect(
          await refusal(
            c,
            `UPDATE "${T_HISTORY}" SET user_id = $2 WHERE id = $1`,
            [snapshotId, other]
          )
        ).toMatchObject({ code: '23001' });
      });
    });

    test('the CURRENT profile is not append-only: it is updated and deleted with the account', async () => {
      await rolledBack(async (c) => {
        const { userId, snapshotId } = await userWithSnapshot(c);
        const row = {
          id: uid(),
          user_id: userId,
          snapshot_id: snapshotId,
          updated_at: new Date(),
          ...profileRow(),
        };
        const { sql, params } = insertSql(T_PREFS, row);
        await c.query(sql, params);
        await c.query(
          `UPDATE "${T_PREFS}" SET equity = '9' WHERE user_id = $1`,
          [userId]
        );
        const read = await c.query(
          `SELECT equity FROM "${T_PREFS}" WHERE user_id = $1`,
          [userId]
        );
        expect(read.rows[0].equity).toBe('9');
        await c.query(`DELETE FROM "${T_PREFS}" WHERE user_id = $1`, [userId]);
      });
    });

    test('one profile per user: a second current row for the same user is refused', async () => {
      await rolledBack(async (c) => {
        const { userId, snapshotId } = await userWithSnapshot(c);
        const make = (): Row => ({
          id: uid(),
          user_id: userId,
          snapshot_id: snapshotId,
          updated_at: new Date(),
          ...profileRow(),
        });
        const first = insertSql(T_PREFS, make());
        await c.query(first.sql, first.params);
        const second = insertSql(T_PREFS, make());
        expect(await refusal(c, second.sql, second.params)).toMatchObject({
          code: '23505',
          constraint: 'user_trade_preferences_user_id_key',
        });
      });
    });

    test('a snapshot that something points at cannot be removed even with the trigger out of the way (RESTRICT)', async () => {
      // the trigger is switched off for this one statement, to show the foreign key is a second wall
      await db.query('BEGIN');
      try {
        const { snapshotId, userId } = await userWithSnapshot(db);
        const consent = await consentRow(db, snapshotId, GOOD, {
          user_id: userId,
        });
        const { sql, params } = insertSql(T_CONSENT, consent);
        await db.query(sql, params);
        await db.query(`ALTER TABLE "${T_HISTORY}" DISABLE TRIGGER USER`);
        const result = await refusal(
          db,
          `DELETE FROM "${T_HISTORY}" WHERE id = $1`,
          [snapshotId]
        );
        // ON DELETE RESTRICT raises restrict_violation (23001); NO ACTION would say 23503
        expect(result).toMatchObject({
          code: '23001',
          constraint: `${T_CONSENT}_profile_snapshot_id_fkey`,
        });
      } finally {
        await db.query('ROLLBACK');
      }
    });
  });

  // -------------------------------------------------------------------------
  describe('the stores, through the real client', () => {
    async function newUser(tag: string): Promise<string> {
      const user = await prisma.user.create({
        data: {
          email: `e4-test-${tag}-${uid()}@example.test`,
          name: `E4 ${tag}`,
        },
      });
      return user.id as string;
    }
    const rows = async (sql: string, params: unknown[] = []): Promise<Row[]> =>
      (await db.query(sql, params)).rows;

    test('a first profile is a snapshot and the current profile, written together', async () => {
      const userId = await newUser('first');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      expect(saved).toMatchObject({ ok: true, changed: true });
      if (!saved.ok) return;
      const history = await rows(
        `SELECT * FROM "${T_HISTORY}" WHERE user_id = $1`,
        [userId]
      );
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: saved.snapshotId,
        user_id_hash: hashUserId(userId, KEY_A).hash,
        key_version: 1,
        equity: '10000',
        max_leverage: '5',
      });
      const current = await rows(
        `SELECT * FROM "${T_PREFS}" WHERE user_id = $1`,
        [userId]
      );
      expect(current).toHaveLength(1);
      expect(current[0]).toMatchObject({
        snapshot_id: saved.snapshotId,
        equity: '10000',
      });
      expect((await readProfile(userId, prisma))?.profile).toEqual(
        ROOMY_PROFILE
      );
    });

    test('a profile with 24 decimals comes back exactly', async () => {
      const userId = await newUser('exact');
      const profile = {
        ...ROOMY_PROFILE,
        equity: '12345.678901234567890123456',
      };
      await saveProfile(userId, profile, { client: prisma, key: KEY_A });
      expect((await readProfile(userId, prisma))?.profile.equity).toBe(
        '12345.678901234567890123456'
      );
    });

    test('saving the same profile again writes nothing; a change appends and moves the current profile', async () => {
      const userId = await newUser('change');
      const first = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      const same = await saveProfile(
        userId,
        { ...ROOMY_PROFILE, equity: '10000.00' },
        { client: prisma, key: KEY_A }
      );
      expect(same).toMatchObject({ ok: true, changed: false });
      expect(
        await rows(`SELECT id FROM "${T_HISTORY}" WHERE user_id = $1`, [userId])
      ).toHaveLength(1);
      const second = await saveProfile(
        userId,
        { ...ROOMY_PROFILE, equity: '9000' },
        { client: prisma, key: KEY_A }
      );
      expect(second).toMatchObject({ ok: true, changed: true });
      expect(
        await rows(`SELECT id FROM "${T_HISTORY}" WHERE user_id = $1`, [userId])
      ).toHaveLength(2);
      if (first.ok && second.ok) {
        expect(first.snapshotId).not.toBe(second.snapshotId);
        const current = await rows(
          `SELECT snapshot_id, equity FROM "${T_PREFS}" WHERE user_id = $1`,
          [userId]
        );
        expect(current).toEqual([
          { snapshot_id: second.snapshotId, equity: '9000' },
        ]);
        expect((await readProfile(userId, prisma))?.snapshotId).toBe(
          second.snapshotId
        );
      }
    });

    test('a profile the engine refuses is returned with its problems and writes nothing', async () => {
      const userId = await newUser('invalid');
      const result = await saveProfile(
        userId,
        { ...ROOMY_PROFILE, maxLeverage: '6' },
        { client: prisma, key: KEY_A }
      );
      expect(result).toMatchObject({ ok: false, code: 'INVALID_PROFILE' });
      expect(
        await rows(`SELECT id FROM "${T_HISTORY}" WHERE user_id = $1`, [userId])
      ).toHaveLength(0);
    });

    test('an unknown user is refused by the database, and nothing is left behind', async () => {
      await expect(
        saveProfile('no-such-user', ROOMY_PROFILE, {
          client: prisma,
          key: KEY_A,
        })
      ).rejects.toBeDefined();
      expect(
        await rows(`SELECT id FROM "${T_HISTORY}" WHERE user_id_hash = $1`, [
          hashUserId('no-such-user', KEY_A).hash,
        ])
      ).toHaveLength(0);
    });

    test('the snapshot and the current profile are ONE transaction: a failing second write rolls the first back', async () => {
      const userId = await newUser('atomic');
      await db.query(`CREATE FUNCTION e4_test_boom() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'boom'; END; $$`);
      await db.query(`CREATE TRIGGER e4_test_boom BEFORE INSERT OR UPDATE ON "${T_PREFS}"
        FOR EACH ROW EXECUTE FUNCTION e4_test_boom()`);
      try {
        await expect(
          saveProfile(userId, ROOMY_PROFILE, { client: prisma, key: KEY_A })
        ).rejects.toThrow(/boom/);
      } finally {
        await db.query(`DROP TRIGGER e4_test_boom ON "${T_PREFS}"`);
        await db.query(`DROP FUNCTION e4_test_boom()`);
      }
      expect(
        await rows(`SELECT id FROM "${T_HISTORY}" WHERE user_id = $1`, [userId])
      ).toHaveLength(0);
      expect(
        await rows(`SELECT id FROM "${T_PREFS}" WHERE user_id = $1`, [userId])
      ).toHaveLength(0);
    });

    test('an Accept is stored as the exact text, its hash, and the columns of 6.11', async () => {
      const userId = await newUser('accept');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_B,
      });
      if (!saved.ok) throw new Error('profile');
      const setup = validated();
      const result = await recordConsent(
        {
          userId,
          action: 'ACCEPT',
          symbol: 'XAUUSD',
          setup,
          synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
          profileSnapshotId: saved.snapshotId,
          badge: 'AI-CAUTIONARY',
          templateVersion: 'report2-0.1',
          disclaimerVersion: 'disc-2026-10',
          language: 'en',
        },
        { client: prisma, key: KEY_B }
      );
      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      const [row] = await rows(`SELECT * FROM "${T_CONSENT}" WHERE id = $1`, [
        result.id,
      ]);
      expect(row).toMatchObject({
        user_id: userId,
        user_id_hash: hashUserId(userId, KEY_B).hash,
        key_version: 2,
        action: 'ACCEPT',
        symbol: 'XAUUSD',
        cycle_slot: Number(setup.pinnedSlot),
        synthesis_rule_id: 'R7',
        synthesis_rules_version: 'draft-1',
        zone_id: 'Z1',
        side: 'BUY',
        profile_snapshot_id: saved.snapshotId,
        badge: 'AI-CAUTIONARY',
        setup_json: serializeValidatedSetup(setup),
        setup_sha256: result.setupSha256,
        engine4_version: '1.0.0',
        symbol_specs_version: Number(setup.versions.specs),
        template_version: 'report2-0.1',
        disclaimer_version: 'disc-2026-10',
        language: 'en',
      });
      expect(row!['setup']).toEqual(JSON.parse(serializeValidatedSetup(setup)));
      expect(row!['recorded_at']).toBeInstanceOf(Date);
    });

    test('Modify and Decline of a setup that failed are recorded; an Accept of it never reaches the database', async () => {
      const userId = await newUser('decline');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      if (!saved.ok) throw new Error('profile');
      const failed = validated({}, { riskPct: '5' });
      expect(failed.ok).toBe(false);
      const base = {
        userId,
        symbol: 'XAUUSD',
        setup: failed,
        synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
        profileSnapshotId: saved.snapshotId,
        badge: null,
        templateVersion: 'report2-0.1',
        disclaimerVersion: 'disc-2026-10',
        language: 'en',
      };
      expect(
        await recordConsent(
          { ...base, action: 'DECLINE' },
          { client: prisma, key: KEY_A }
        )
      ).toMatchObject({ ok: true });
      expect(
        await recordConsent(
          { ...base, action: 'MODIFY' },
          { client: prisma, key: KEY_A }
        )
      ).toMatchObject({ ok: true });
      expect(
        await recordConsent(
          { ...base, action: 'ACCEPT' },
          { client: prisma, key: KEY_A }
        )
      ).toMatchObject({
        ok: false,
        code: 'ACCEPT_OF_A_FAILED_SETUP',
      });
      expect(
        (
          await rows(
            `SELECT action FROM "${T_CONSENT}" WHERE user_id = $1 ORDER BY action`,
            [userId]
          )
        ).map((r) => r['action'])
      ).toEqual(['DECLINE', 'MODIFY']);
    });

    test('a custom entry is recorded with a NULL zone', async () => {
      const userId = await newUser('custom');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      if (!saved.ok) throw new Error('profile');
      const custom = validated({}, { zoneId: undefined, entry: '4370' });
      const result = await recordConsent(
        {
          userId,
          action: 'ACCEPT',
          symbol: 'XAUUSD',
          setup: custom,
          synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
          profileSnapshotId: saved.snapshotId,
          badge: null,
          templateVersion: 'report2-0.1',
          disclaimerVersion: 'disc-2026-10',
          language: 'en',
        },
        { client: prisma, key: KEY_A }
      );
      expect(result).toMatchObject({ ok: true });
      const [row] = await rows(
        `SELECT zone_id FROM "${T_CONSENT}" WHERE user_id = $1`,
        [userId]
      );
      expect(row!['zone_id']).toBeNull();
    });

    test('an unknown user is refused by the database, and so is another user’s snapshot (by the store)', async () => {
      const userId = await newUser('mine');
      const other = await newUser('theirs');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      if (!saved.ok) throw new Error('profile');
      const base = {
        action: 'DECLINE' as const,
        symbol: 'XAUUSD',
        setup: validated(),
        synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
        profileSnapshotId: saved.snapshotId,
        badge: null,
        templateVersion: 'report2-0.1',
        disclaimerVersion: 'disc-2026-10',
        language: 'en',
      };
      expect(
        await recordConsent(
          { ...base, userId: other },
          { client: prisma, key: KEY_A }
        )
      ).toMatchObject({
        ok: false,
        code: 'PROFILE_SNAPSHOT_NOT_THE_USERS',
      });
    });

    test('rows written by the stores can be neither updated nor deleted afterwards', async () => {
      const userId = await newUser('immutable');
      const saved = await saveProfile(userId, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      if (!saved.ok) throw new Error('profile');
      await expect(
        prisma.userTradePreferencesHistory.update({
          where: { id: saved.snapshotId },
          data: { equity: '1' },
        })
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.userTradePreferencesHistory.delete({
          where: { id: saved.snapshotId },
        })
      ).rejects.toThrow(/append-only/);
      await expect(prisma.tradeConsentRecord.deleteMany({})).rejects.toThrow(
        /append-only/
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('keyed hashes and key rotation (D12)', () => {
    test('the stored hash is a keyed HMAC-SHA-256 of the user id: stable for one key, different for another', async () => {
      const a = await prisma.user.create({
        data: { email: `e4-test-hash-a-${uid()}@example.test` },
      });
      const b = await prisma.user.create({
        data: { email: `e4-test-hash-b-${uid()}@example.test` },
      });
      await saveProfile(a.id, ROOMY_PROFILE, { client: prisma, key: KEY_A });
      await saveProfile(b.id, ROOMY_PROFILE, { client: prisma, key: KEY_A });
      const read = async (id: string) =>
        (
          await db.query(
            `SELECT user_id_hash, key_version FROM "${T_HISTORY}" WHERE user_id = $1`,
            [id]
          )
        ).rows[0];
      const rowA = await read(a.id);
      // independent of the helper: Node's own HMAC over the id
      expect(rowA.user_id_hash).toBe(
        createHmac('sha256', KEY_A.key).update(a.id, 'utf8').digest('hex')
      );
      expect(rowA.user_id_hash).not.toBe((await read(b.id)).user_id_hash);
      expect(rowA.user_id_hash).not.toBe(
        createHmac('sha256', KEY_B.key).update(a.id, 'utf8').digest('hex')
      );
      expect(rowA.key_version).toBe(1);
    });

    test('after a rotation the new snapshot has the new key and version, and the old one is not recomputed', async () => {
      const user = await prisma.user.create({
        data: { email: `e4-test-rotate-${uid()}@example.test` },
      });
      await saveProfile(user.id, ROOMY_PROFILE, { client: prisma, key: KEY_A });
      const before = (
        await db.query(`SELECT * FROM "${T_HISTORY}" WHERE user_id = $1`, [
          user.id,
        ])
      ).rows[0];
      await saveProfile(
        user.id,
        { ...ROOMY_PROFILE, equity: '7000' },
        { client: prisma, key: KEY_B }
      );
      // an unchanged save under the new key writes nothing and rewrites nothing
      await saveProfile(
        user.id,
        { ...ROOMY_PROFILE, equity: '7000' },
        { client: prisma, key: KEY_B }
      );
      const after = (
        await db.query(
          `SELECT * FROM "${T_HISTORY}" WHERE user_id = $1 ORDER BY recorded_at, key_version`,
          [user.id]
        )
      ).rows;
      expect(after).toHaveLength(2);
      expect(after[0]).toEqual(before);
      expect(after.map((r) => r.key_version)).toEqual([1, 2]);
      expect(after[0].user_id_hash).not.toBe(after[1].user_id_hash);
      // each hash is recognised with its own key and not with the other
      expect(
        verifyUserHash(
          user.id,
          { hash: after[0].user_id_hash, keyVersion: 1 },
          KEY_A
        )
      ).toBe('MATCH');
      expect(
        verifyUserHash(
          user.id,
          { hash: after[1].user_id_hash, keyVersion: 2 },
          KEY_B
        )
      ).toBe('MATCH');
      expect(
        verifyUserHash(
          user.id,
          { hash: after[0].user_id_hash, keyVersion: 1 },
          KEY_B
        )
      ).toBe('OTHER_KEY_VERSION');
    });
  });

  // -------------------------------------------------------------------------
  describe('deleting a User (the point of the design)', () => {
    test('history and consent rows remain with user_id NULL and everything else, hash included, exactly as it was; the current profile goes', async () => {
      const user = await prisma.user.create({
        data: {
          email: `e4-test-delete-${uid()}@example.test`,
          name: 'To be deleted',
        },
      });
      const bystander = await prisma.user.create({
        data: { email: `e4-test-bystander-${uid()}@example.test` },
      });

      // two snapshots under two keys, a consent record on each
      const p1 = await saveProfile(user.id, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      const p2 = await saveProfile(
        user.id,
        { ...ROOMY_PROFILE, equity: '8000' },
        { client: prisma, key: KEY_B }
      );
      const q1 = await saveProfile(bystander.id, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_B,
      });
      if (!p1.ok || !p2.ok || !q1.ok) throw new Error('profiles');
      const consentBase = {
        symbol: 'XAUUSD',
        synthesis: { ruleId: 'R7', rulesVersion: 'draft-1' },
        badge: 'AI-CAUTIONARY',
        templateVersion: 'report2-0.1',
        disclaimerVersion: 'disc-2026-10',
        language: 'en',
      };
      const c1 = await recordConsent(
        {
          ...consentBase,
          userId: user.id,
          action: 'DECLINE',
          setup: validated(),
          profileSnapshotId: p1.snapshotId,
        },
        { client: prisma, key: KEY_A }
      );
      const c2 = await recordConsent(
        {
          ...consentBase,
          userId: user.id,
          action: 'ACCEPT',
          setup: validated({ equity: '8000' }),
          profileSnapshotId: p2.snapshotId,
        },
        { client: prisma, key: KEY_B }
      );
      const c3 = await recordConsent(
        {
          ...consentBase,
          userId: bystander.id,
          action: 'ACCEPT',
          setup: validated(),
          profileSnapshotId: q1.snapshotId,
        },
        { client: prisma, key: KEY_B }
      );
      if (!c1.ok || !c2.ok || !c3.ok) throw new Error('consents');

      const historyIds = [p1.snapshotId, p2.snapshotId, q1.snapshotId];
      const consentIds = [c1.id, c2.id, c3.id];
      const readHistory = async () =>
        (
          await db.query(
            `SELECT * FROM "${T_HISTORY}" WHERE id = ANY ($1) ORDER BY id`,
            [historyIds]
          )
        ).rows;
      const readConsents = async () =>
        (
          await db.query(
            `SELECT * FROM "${T_CONSENT}" WHERE id = ANY ($1) ORDER BY id`,
            [consentIds]
          )
        ).rows;

      const historyBefore = await readHistory();
      const consentsBefore = await readConsents();
      expect(historyBefore.filter((r) => r.user_id === user.id)).toHaveLength(
        2
      );
      expect(consentsBefore.filter((r) => r.user_id === user.id)).toHaveLength(
        2
      );
      expect(
        (
          await db.query(`SELECT 1 FROM "${T_PREFS}" WHERE user_id = $1`, [
            user.id,
          ])
        ).rowCount
      ).toBe(1);

      // the account goes
      await prisma.user.delete({ where: { id: user.id } });

      const historyAfter = await readHistory();
      const consentsAfter = await readConsents();
      // every row is still there...
      expect(historyAfter.map((r) => r.id)).toEqual(
        historyBefore.map((r) => r.id)
      );
      expect(consentsAfter.map((r) => r.id)).toEqual(
        consentsBefore.map((r) => r.id)
      );
      // ...the deleted user's rows have user_id NULL and nothing else different...
      const asNull = (rows: Row[]): Row[] =>
        rows.map((r) =>
          r['user_id'] === user.id ? { ...r, user_id: null } : r
        );
      expect(historyAfter).toEqual(asNull(historyBefore));
      expect(consentsAfter).toEqual(asNull(consentsBefore));
      expect(historyAfter.filter((r) => r.user_id === null)).toHaveLength(2);
      expect(consentsAfter.filter((r) => r.user_id === null)).toHaveLength(2);
      // ...the bystander's rows are untouched, still owned...
      expect(historyAfter.find((r) => r.id === q1.snapshotId)?.user_id).toBe(
        bystander.id
      );
      expect(consentsAfter.find((r) => r.id === c3.id)?.user_id).toBe(
        bystander.id
      );
      // ...the hash and the key version survived, and still say whose they were
      for (const row of [...historyAfter, ...consentsAfter].filter(
        (r) => r.user_id === null
      )) {
        expect(row.user_id_hash).toMatch(/^[0-9a-f]{64}$/);
        const key = row.key_version === 1 ? KEY_A : KEY_B;
        expect(
          verifyUserHash(
            user.id,
            { hash: row.user_id_hash, keyVersion: row.key_version },
            key
          )
        ).toBe('MATCH');
      }
      // ...the consent record still points at the snapshot it was made against
      expect(
        consentsAfter.find((r) => r.id === c1.id)?.profile_snapshot_id
      ).toBe(p1.snapshotId);
      expect(
        consentsAfter.find((r) => r.id === c2.id)?.profile_snapshot_id
      ).toBe(p2.snapshotId);
      // ...and only the CURRENT profile, which is personal data, went with the account
      expect(
        (
          await db.query(`SELECT 1 FROM "${T_PREFS}" WHERE user_id = $1`, [
            user.id,
          ])
        ).rowCount
      ).toBe(0);
      expect(
        (
          await db.query(`SELECT 1 FROM "${T_PREFS}" WHERE user_id = $1`, [
            bystander.id,
          ])
        ).rowCount
      ).toBe(1);

      // an orphaned audit row is still immutable
      await expect(
        prisma.userTradePreferencesHistory.update({
          where: { id: p1.snapshotId },
          data: { equity: '1' },
        })
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.tradeConsentRecord.delete({ where: { id: c1.id } })
      ).rejects.toThrow(/append-only/);
    });

    test('the same through plain SQL, with no application code: DELETE FROM "User"', async () => {
      const user = await prisma.user.create({
        data: { email: `e4-test-sql-${uid()}@example.test` },
      });
      const saved = await saveProfile(user.id, ROOMY_PROFILE, {
        client: prisma,
        key: KEY_A,
      });
      if (!saved.ok) throw new Error('profile');
      await db.query(`DELETE FROM "User" WHERE id = $1`, [user.id]);
      const [row] = (
        await db.query(
          `SELECT user_id, user_id_hash, key_version, equity FROM "${T_HISTORY}" WHERE id = $1`,
          [saved.snapshotId]
        )
      ).rows;
      expect(row).toEqual({
        user_id: null,
        user_id_hash: hashUserId(user.id, KEY_A).hash,
        key_version: 1,
        equity: '10000',
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('the TypeScript validator and the database agree', () => {
    const RISKS = [
      '0.25',
      '0.4',
      '0.49',
      '0.5',
      '0.75',
      '1',
      '1.5',
      '1.99',
      '2',
      '2.01',
      '2.5',
      'abc',
    ];
    const LEVERAGES = [
      '0',
      '0.5',
      '1',
      '1.5',
      '3',
      '4.99',
      '5',
      '5.01',
      '10',
      '-1',
    ];
    const RRRS = [
      '1',
      '1.49',
      '1.5',
      '1.75',
      '2',
      '2.5',
      '2.51',
      '3.49',
      '3.5',
      '3.51',
      '4',
      'x',
    ];
    const EQUITIES = ['0', '0.01', '100', '5000', '12345.67', '-5'];
    const MIN_SLDS = ['0', '0.5', '13', '14.25', '-2'];
    const COMMISSIONS = ['0', '3.5', '4', '-0.5'];
    const TYPES = ['SCALPER', 'DAY_TRADER', 'SWING'];
    const STYLES = ['TREND_FOLLOWING', 'TREND_COUNTERING', 'BOTH', 'MIXED'];

    interface Candidate {
      traderType: string;
      style: string;
      maxRiskPct: string;
      maxLeverage: string;
      targetRrr: string;
      equity: string;
      minSld: string;
      commission: string;
    }

    const DEFAULT: Candidate = {
      traderType: 'DAY_TRADER',
      style: 'BOTH',
      maxRiskPct: '1.5',
      maxLeverage: '1.5',
      targetRrr: '1.75',
      equity: '5000',
      minSld: '13',
      commission: '4',
    };

    function candidates(): Candidate[] {
      const out: Candidate[] = [];
      const lists: [keyof Candidate, string[]][] = [
        ['traderType', TYPES],
        ['style', STYLES],
        ['maxRiskPct', RISKS],
        ['maxLeverage', LEVERAGES],
        ['targetRrr', RRRS],
        ['equity', EQUITIES],
        ['minSld', MIN_SLDS],
        ['commission', COMMISSIONS],
      ];
      // every value of every field once, the rest at the defaults...
      for (const [field, values] of lists) {
        for (const value of values) out.push({ ...DEFAULT, [field]: value });
      }
      // ...and random combinations, the same ones on every run
      const rng = makeRng(20261010n);
      for (let i = 0; i < 700; i += 1) {
        const c: Candidate = { ...DEFAULT };
        for (const [field, values] of lists) c[field] = rng.pick(values);
        out.push(c);
      }
      return out;
    }

    /** The text a store would write: the engine’s canonical text when it can read the figure, the raw text otherwise. */
    function columnsOf(c: Candidate): Row {
      const canon = (text: string): string => {
        try {
          return Rational.of(text).toString();
        } catch {
          return text;
        }
      };
      return {
        trader_type: c.traderType,
        style: c.style,
        max_risk_pct: canon(c.maxRiskPct),
        max_leverage: canon(c.maxLeverage),
        target_rrr: canon(c.targetRrr),
        equity: canon(c.equity),
        min_sld: canon(c.minSld),
        commission: canon(c.commission),
      };
    }

    test('on a seeded corpus, validateProfile says ok exactly when BOTH tables accept the canonical text', async () => {
      const corpus = candidates();
      expect(corpus.length).toBeGreaterThan(750);
      let accepted = 0;
      let refused = 0;
      await rolledBack(async (c) => {
        const { userId, snapshotId } = await userWithSnapshot(c);
        for (const candidate of corpus) {
          const engineOk = validateProfile(candidate).ok;
          const columns = columnsOf(candidate);
          const history = insertSql(T_HISTORY, historyRow(columns));
          const prefs = insertSql(T_PREFS, {
            id: uid(),
            user_id: userId,
            snapshot_id: snapshotId,
            updated_at: new Date(),
            ...columns,
          });
          const inHistory =
            (await refusal(c, history.sql, history.params)) === null;
          const inPrefs = (await refusal(c, prefs.sql, prefs.params)) === null;
          if (engineOk !== inHistory || engineOk !== inPrefs) {
            throw new Error(
              `engine ${engineOk}, history ${inHistory}, current ${inPrefs} for ${JSON.stringify(candidate)}`
            );
          }
          if (engineOk) accepted += 1;
          else refused += 1;
        }
      });
      // the corpus is worth something only if it has both kinds
      expect(accepted).toBeGreaterThan(50);
      expect(refused).toBeGreaterThan(300);
    });
  });

  // -------------------------------------------------------------------------
  describe('no drift', () => {
    function diff(): { status: number; output: string } {
      const dir = mkdtempSync(join(tmpdir(), 'e4-drift-'));
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
      await db.query(`ALTER TABLE "${T_CONSENT}" ADD COLUMN "oops" TEXT`);
      try {
        const result = diff();
        expect(result.status).toBe(2);
        expect(result.output).toMatch(/DROP COLUMN "oops"/);
      } finally {
        await db.query(`ALTER TABLE "${T_CONSENT}" DROP COLUMN "oops"`);
      }
    });
  });

  test('last: every trigger of the audit tables is still enabled', async () => {
    const { rows } = await db.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = ANY ($1::regclass[])`,
      [[`"${T_HISTORY}"`, `"${T_CONSENT}"`]]
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.tgenabled === 'O')).toBe(true);
  });
});
