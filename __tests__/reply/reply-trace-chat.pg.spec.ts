/**
 * @jest-environment node
 */

/**
 * The reply path's tables against a REAL PostgreSQL (build step 7, part 1): request_traces,
 * chat_threads and chat_messages, as created by
 * prisma/migrations/20261014000000_add_reply_trace_and_chat_tables/migration.sql.
 *
 * The unit tests (`__tests__/lib/platform/`) compare files and use an in-memory stand-in.
 * This spec shows what the database does: that every CHECK constraint Prisma cannot see
 * refuses what it is there to refuse (one constraint at a time) and accepts the value on its
 * line; that the trigger on request_traces refuses the DELETE of a row that is not archived,
 * the UPDATE of a sealed column and a TRUNCATE, and lets through exactly what Section 6 and the
 * archive job need; that the stores (`lib/platform/`) write what they mean through the real
 * generated Prisma client and the database accepts everything they write; and, the point of
 * the design, that DELETING A User removes the trader's threads and messages and leaves every
 * trace row, with user_id NULL and the hash, the key version and every other column exactly as
 * they were. And it runs `prisma migrate diff` against the database and expects no drift
 * (with a control that drift is seen).
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of the three tables, and the users it
 *                        creates (email rt-*@example.test), in that database
 *
 * To run it on a throwaway database (see .claude/architecture/database-traps.md):
 *   1. start a scratch PostgreSQL (initdb on a high port, `Start-Process postgres.exe`) and
 *      create an empty database;
 *   2. build the NON-MARKET schema as it was BEFORE this migration:
 *        prisma migrate diff --config <scratch config outside the repo> --from-empty \
 *          --to-schema <prisma/non-market-data/schema.prisma at the commit before this part> --script
 *      (keep the text from the first "-- CreateSchema", ASCII, no BOM) and apply it with
 *      `psql -v ON_ERROR_STOP=1 -f ...`; then apply the MIGRATION FILE itself, not a diff of the
 *      schema (a diff has no CHECK constraints and no trigger, and the first test below fails
 *      if they are missing):
 *        psql -v ON_ERROR_STOP=1 -d <db> -f prisma/migrations/20261014000000_add_reply_trace_and_chat_tables/migration.sql
 *      The database must hold the non-market tables and nothing else, or the drift test sees
 *      the extra tables;
 *   3. CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *        npx jest --testMatch '**\/__tests__/reply/*.pg.spec.ts' --coverage=false
 *      (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs
 *      this file; `--runTestsByPath` finds nothing on Windows, `--testMatch` does);
 *   4. stop and remove the instance.
 *
 * Cleaning up: request_traces refuses a DELETE of an unarchived row, so this spec switches the
 * table's triggers off (`ALTER TABLE ... DISABLE TRIGGER USER`) for its own wipe, and on again.
 */

import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { Client as PgClient } from 'pg';

import { buildRefusal } from '@/lib/intake';
import { canonicalJson } from '@/lib/reply/contracts/intake';
import type { ReplyTrace } from '@/lib/reply/contracts/trace-fields';
import { validateReplyTrace } from '@/lib/reply/contracts/trace-fields';
import {
  appendExchange,
  listMessages,
} from '@/lib/platform/chat/messages-store';
import {
  createThread,
  deleteThread,
  getThread,
  listThreads,
  renameThread,
} from '@/lib/platform/chat/threads-store';
import { hashTraceUser } from '@/lib/platform/traces/hash';
import type { AuditKey } from '@/lib/platform/traces/hash';
import { attachRisk, readTrace, writeTrace } from '@/lib/platform/traces/store';
import type {
  TraceCreateData,
  TraceStoreClient,
} from '@/lib/platform/traces/store';

import {
  SLOT,
  SLOT_SECONDS,
  actionResult,
  answerResult,
  clone,
  fixedResult,
  makeTrace,
  REPORT2_TEXT,
  reportResult,
  riskGroup,
  withPath,
} from '../lib/reply/helpers/fixtures';

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
    'prisma/migrations/20261014000000_add_reply_trace_and_chat_tables/migration.sql'
  ),
  'utf8'
).replace(/\r\n/g, '\n');

const T_TRACES = 'request_traces';
const T_THREADS = 'chat_threads';
const T_MESSAGES = 'chat_messages';

const KEY: AuditKey = { key: 'k'.repeat(48), version: 2, source: 'ENV' };
const sha = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

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
const next = (): number => (counter += 1);
/** A user id as long as a cuid, so the "no user id in a group" rule cannot meet it by chance. */
const userIdOf = (n: number): string =>
  `cm0rtuser${String(n).padStart(16, '0')}`;

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

/** A trace and the reply that fits it, for request number `n`. */
function traceFor(
  n: number,
  patch: (trace: ReplyTrace) => ReplyTrace = (t) => t
) {
  const requestId = `req-pg-${String(n).padStart(6, '0')}`;
  let trace = clone(makeTrace());
  trace = withPath(trace, 'request.request_id', requestId);
  trace = withPath(
    trace,
    'request.client_request_id',
    `cli-pg-${String(n).padStart(6, '0')}`
  );
  trace = patch(trace);
  const reply = withPath(reportResult(), 'provenance.request_id', requestId);
  return { trace, reply, requestId };
}

/** The row `writeTrace` would insert, taken from the store itself so the spec cannot drift from it. */
async function rowOf(
  userId: string,
  n: number,
  patch?: (t: ReplyTrace) => ReplyTrace
): Promise<Row> {
  const { trace, reply } = traceFor(n, patch);
  const captured: TraceCreateData[] = [];
  const capturing: TraceStoreClient = {
    requestTrace: {
      create: async ({ data }) => {
        captured.push(data);
        return { request_id: data.request_id };
      },
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => null,
    },
  };
  const result = await writeTrace(
    { userId, trace, reply },
    { client: capturing, key: KEY }
  );
  if (!result.ok)
    throw new Error(
      `the store refused the base trace: ${JSON.stringify(result.issues)}`
    );
  return captured[0] as unknown as Row;
}

/** The same row with a value changed in a group (as well as, or instead of, a column). */
function inGroup(row: Row, group: string, path: string, value: unknown): Row {
  const copy = clone(row) as Row;
  const parts = path.split('.');
  let node = copy[group] as Record<string, unknown>;
  for (const part of parts.slice(0, -1))
    node = node[part] as Record<string, unknown>;
  node[parts[parts.length - 1] as string] = value;
  return copy;
}

// ---------------------------------------------------------------------------

suite('the reply trace and chat tables on a real Postgres', () => {
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

  async function user(c: PgClient, n = next()): Promise<string> {
    const id = userIdOf(n);
    await c.query(
      `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
      [id, `rt-${id}@example.test`]
    );
    return id;
  }

  async function insertTrace(c: PgClient, row: Row): Promise<void> {
    const { sql, params } = insertSql(T_TRACES, row);
    await c.query(sql, params);
  }

  /** Delete what this spec wrote. request_traces refuses a DELETE, so its triggers are off for it. */
  async function wipe(): Promise<void> {
    await db.query('BEGIN');
    try {
      await db.query(`ALTER TABLE "${T_TRACES}" DISABLE TRIGGER USER`);
      await db.query(`DELETE FROM "${T_MESSAGES}"`);
      await db.query(`DELETE FROM "${T_THREADS}"`);
      await db.query(`DELETE FROM "${T_TRACES}"`);
      await db.query(
        `DELETE FROM "User" WHERE "email" LIKE 'rt-%@example.test'`
      );
      await db.query(`ALTER TABLE "${T_TRACES}" ENABLE TRIGGER USER`);
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
      expect(wanted).toHaveLength(51);
      const { rows } = await db.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint
          WHERE contype = 'c' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_TRACES}"`, `"${T_THREADS}"`, `"${T_MESSAGES}"`]]
      );
      expect(rows.map((r) => r.conname)).toEqual(wanted);
    });

    test('keys: a primary key on each table, and the three unique keys', async () => {
      const keys = await db.query<{
        conname: string;
        contype: string;
        tbl: string;
      }>(
        `SELECT conname, contype, conrelid::regclass::text AS tbl FROM pg_constraint
          WHERE contype = 'p' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_TRACES}"`, `"${T_THREADS}"`, `"${T_MESSAGES}"`]]
      );
      expect(keys.rows.map((r) => r.conname)).toEqual([
        'chat_messages_pkey',
        'chat_threads_pkey',
        'request_traces_pkey',
      ]);
      const unique = await db.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename IN ('request_traces', 'chat_threads', 'chat_messages')
            AND indexdef LIKE 'CREATE UNIQUE%' AND indexname NOT LIKE '%pkey' ORDER BY indexname`
      );
      expect(unique.rows.map((r) => r.indexname)).toEqual([
        'chat_messages_request_id_role_key',
        'chat_messages_thread_id_seq_key',
        'request_traces_user_id_hash_client_request_id_key',
      ]);
    });

    test('foreign keys: the trace sets its user to NULL, a thread and its messages cascade', async () => {
      const { rows } = await db.query<{
        conname: string;
        confdeltype: string;
        target: string;
      }>(
        `SELECT conname, confdeltype, confrelid::regclass::text AS target FROM pg_constraint
          WHERE contype = 'f' AND conrelid = ANY ($1::regclass[]) ORDER BY conname`,
        [[`"${T_TRACES}"`, `"${T_THREADS}"`, `"${T_MESSAGES}"`]]
      );
      expect(rows).toEqual([
        {
          conname: 'chat_messages_thread_id_fkey',
          confdeltype: 'c',
          target: 'chat_threads',
        },
        {
          conname: 'chat_threads_user_id_fkey',
          confdeltype: 'c',
          target: '"User"',
        },
        {
          conname: 'request_traces_user_id_fkey',
          confdeltype: 'n',
          target: '"User"',
        },
      ]);
    });

    test('the guard: a row trigger and a statement trigger, both enabled, on request_traces only', async () => {
      const { rows } = await db.query<{
        tgname: string;
        tgenabled: string;
        tgtype: number;
      }>(
        `SELECT tgname, tgenabled, tgtype FROM pg_trigger
          WHERE NOT tgisinternal AND tgrelid = ANY ($1::regclass[]) ORDER BY tgname`,
        [[`"${T_TRACES}"`, `"${T_THREADS}"`, `"${T_MESSAGES}"`]]
      );
      expect(rows.map((r) => r.tgname)).toEqual([
        'request_traces_guard_rows',
        'request_traces_guard_truncate',
      ]);
      expect(rows.every((r) => r.tgenabled === 'O')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('request_traces: the CHECK constraints', () => {
    test('the row the store writes is accepted, with and without a risk group', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        await insertTrace(c, await rowOf(u, next()));
        await insertTrace(
          c,
          await rowOf(u, next(), (t) => withPath(t, 'risk', riskGroup()))
        );
        const { rows } = await c.query(
          `SELECT count(*)::int AS n FROM "${T_TRACES}" WHERE user_id = $1`,
          [u]
        );
        expect(rows[0].n).toBe(2);
      });
    });

    /** [constraint it should be, how to break only that one, a variant that must be accepted] */
    type Case = [
      string,
      (row: Row, userId: string) => Row,
      ((row: Row, userId: string) => Row)?,
    ];
    const set =
      (patch: Row) =>
      (row: Row): Row => ({ ...row, ...patch });
    const both =
      (column: string, group: string, path: string, value: unknown) =>
      (row: Row): Row =>
        inGroup({ ...row, [column]: value }, group, path, value);

    const CASES: Case[] = [
      [
        'request_traces_ids_are_ids',
        both('request_id', 'request_group', 'request_id', 'has space'),
        both('request_id', 'request_group', 'request_id', 'r'.repeat(64)),
      ],
      [
        'request_traces_user_id_hash_is_hex',
        set({ user_id_hash: 'A'.repeat(64) }),
        set({ user_id_hash: 'a'.repeat(64) }),
      ],
      [
        'request_traces_key_version_is_positive',
        set({ key_version: 0 }),
        set({ key_version: 1 }),
      ],
      [
        'request_traces_tier_is_known',
        both('tier', 'request_group', 'tier', 'GOLD'),
        both('tier', 'request_group', 'tier', 'FREE'),
      ],
      [
        'request_traces_locale_is_a_locale',
        both('locale', 'request_group', 'reply_locale', 'EN-us'),
        both('locale', 'request_group', 'reply_locale', 'pt-BR'),
      ],
      [
        'request_traces_intent_is_known',
        both('intent', 'request_group', 'intent', 'OUT_OF_SCOPE'),
        both('intent', 'request_group', 'intent', 'INSTANT_M5_INSPECT'),
      ],
      [
        'request_traces_cycle_slot_is_a_slot',
        // 301 seconds is not a slot; the group says the minute it falls in, so only this rule fails
        (row) =>
          inGroup(
            { ...row, cycle_slot: 301 },
            'data_group',
            'cycle_slot',
            '1970-01-01T00:05Z'
          ),
        (row) =>
          inGroup(
            { ...row, cycle_slot: 300 },
            'data_group',
            'cycle_slot',
            '1970-01-01T00:05Z'
          ),
      ],
      [
        'request_traces_data_status_is_known',
        both('data_status', 'data_group', 'data_status', 'LATE'),
        both('data_status', 'data_group', 'data_status', 'MARKET_CLOSED'),
      ],
      [
        'request_traces_model_is_a_slug',
        both('model', 'model_group', 'model', 'has space'),
        both('model', 'model_group', 'model', 'vendor/model:beta'),
      ],
      [
        'request_traces_units_are_not_negative',
        both('units_charged', 'model_group', 'units_charged', -1),
        both('units_charged', 'model_group', 'units_charged', 0),
      ],
      [
        'request_traces_regenerations_are_zero_or_one',
        both('regenerations', 'checks_group', 'regenerations', 2),
        both('regenerations', 'checks_group', 'regenerations', 0),
      ],
      [
        'request_traces_violations_are_not_negative',
        both('number_violations', 'checks_group', 'numbers.violations', -1),
        both('number_violations', 'checks_group', 'numbers.violations', 0),
      ],
      [
        'request_traces_outcome_is_known',
        set({ outcome: 'DONE' }),
        set({ outcome: 'FIXED_ANSWER' }),
      ],
      [
        'request_traces_total_ms_is_not_negative',
        both('total_ms', 'time_group', 'total_ms', -1),
        both('total_ms', 'time_group', 'total_ms', 0),
      ],
      [
        'request_traces_groups_are_objects',
        set({ request_group: JSON.stringify([]) }),
        set({ risk_group: null }),
      ],
      [
        'request_traces_ids_follow_the_request',
        (row) =>
          inGroup(row, 'request_group', 'client_request_id', 'cli-pg-other'),
        (row) =>
          inGroup(
            { ...row, thread_id: null },
            'request_group',
            'thread_id',
            null
          ),
      ],
      ['request_traces_tier_follows_the_request', set({ tier: 'FREE' })],
      ['request_traces_locale_follows_the_request', set({ locale: 'de' })],
      ['request_traces_intent_follows_the_request', set({ intent: 'NEWS' })],
      [
        'request_traces_cycle_slot_follows_the_data',
        set({ cycle_slot: SLOT_SECONDS + 300 }),
      ],
      [
        'request_traces_data_status_follows_the_data',
        set({ data_status: 'STALE' }),
      ],
      [
        'request_traces_model_follows_the_model_group',
        set({ model: 'vendor/other' }),
      ],
      [
        'request_traces_units_follow_the_model_group',
        set({ units_charged: 5 }),
      ],
      [
        'request_traces_regenerations_follow_the_checks',
        set({ regenerations: 0 }),
      ],
      [
        'request_traces_violations_follow_the_checks',
        set({ number_violations: 7 }),
      ],
      ['request_traces_total_ms_follows_the_time', set({ total_ms: 1 })],
      [
        'request_traces_reply_is_its_text_and_hash',
        set({ reply_sha256: 'f'.repeat(64) }),
      ],
      [
        'request_traces_report2_is_its_text_and_hash',
        (row) => ({
          ...row,
          risk_group: riskGroup('{"a":1}'),
          consent_action: 'ACCEPT',
          report2_json: '{"a":1}',
          report2_sha256: null,
        }),
        (row) => ({
          ...row,
          risk_group: riskGroup('{"a":1}'),
          consent_action: 'ACCEPT',
          report2_json: '{"a":1}',
          report2_sha256: sha('{"a":1}'),
        }),
      ],
      ['request_traces_reply_follows_the_outcome', set({ outcome: 'ERROR' })],
      [
        'request_traces_consent_action_is_known',
        (row) => ({
          ...row,
          risk_group: { ...riskGroup(), consent_action: 'IGNORE' },
          consent_action: 'IGNORE',
        }),
        (row) => ({
          ...row,
          risk_group: { ...riskGroup(), consent_action: 'MODIFY' },
          consent_action: 'MODIFY',
        }),
      ],
      [
        // the group names the hash of REPORT2_TEXT; the Report 2 kept is another text
        'request_traces_report2_is_the_risk_setup',
        (row) => ({
          ...row,
          risk_group: riskGroup(),
          consent_action: 'ACCEPT',
          report2_json: '{"a":1}',
          report2_sha256: sha('{"a":1}'),
        }),
        (row) => ({
          ...row,
          risk_group: riskGroup('{"a":1}'),
          consent_action: 'ACCEPT',
          report2_json: '{"a":1}',
          report2_sha256: sha('{"a":1}'),
        }),
      ],
      [
        // a Report 2 with no risk group at all names nothing
        'request_traces_report2_is_the_risk_setup',
        (row) => ({
          ...row,
          report2_json: '{"a":1}',
          report2_sha256: sha('{"a":1}'),
        }),
      ],
      [
        // a consent action with no risk group at all is not the group's own
        'request_traces_consent_follows_the_risk_group',
        (row) => ({ ...row, consent_action: 'ACCEPT' }),
      ],
      [
        'request_traces_consent_follows_the_risk_group',
        (row) => ({ ...row, risk_group: riskGroup(), consent_action: null }),
        (row) => ({
          ...row,
          risk_group: { ...riskGroup(), consent_action: null },
          consent_action: null,
        }),
      ],
      [
        'request_traces_archive_is_complete',
        set({
          archived_at: new Date('2027-01-01T00:00:00Z'),
          archive_ref: null,
        }),
        set({
          archived_at: new Date('2027-01-01T00:00:00Z'),
          archive_ref: 's3://vault/req-pg',
        }),
      ],
      [
        'request_traces_groups_hold_no_user_id',
        // the user id as the thread id: valid everywhere else, and a copy of the id in the record
        (row, userId) =>
          inGroup(
            { ...row, thread_id: userId },
            'request_group',
            'thread_id',
            userId
          ),
        (row) => row,
      ],
      [
        // with no reply (an ERROR) the other texts are still searched for the user id
        'request_traces_groups_hold_no_user_id',
        (row, userId) =>
          inGroup(
            {
              ...row,
              thread_id: userId,
              outcome: 'ERROR',
              reply_json: null,
              reply_sha256: null,
            },
            'request_group',
            'thread_id',
            userId
          ),
      ],
      // the three ids are 1 to 64 characters of the id alphabet, with nothing around them
      ...(['request_id', 'client_request_id', 'thread_id'] as const).flatMap(
        (column): Case[] =>
          [' x', 'x ', 'r'.repeat(65)].map(
            (bad): Case => [
              'request_traces_ids_are_ids',
              both(column, 'request_group', column, bad),
              both(column, 'request_group', column, 'r'.repeat(64)),
            ]
          )
      ),
      [
        // 0 is a multiple of 300 and still not a slot: the first slot is 300 seconds after the epoch
        'request_traces_cycle_slot_is_a_slot',
        (row) =>
          inGroup(
            { ...row, cycle_slot: 0 },
            'data_group',
            'cycle_slot',
            '1970-01-01T00:00Z'
          ),
      ],
      // a risk group is an object like the others, not an array or a string
      ...[JSON.stringify([]), JSON.stringify('text')].map(
        (risk): Case => [
          'request_traces_groups_are_objects',
          set({ risk_group: risk }),
        ]
      ),
      [
        // a hash with no reply behind it
        'request_traces_reply_is_its_text_and_hash',
        set({
          outcome: 'ERROR',
          reply_json: null,
          reply_sha256: 'f'.repeat(64),
        }),
      ],
      // an archive reference is not blank and at most 512 characters
      ...['', '   ', 'x'.repeat(513)].map(
        (ref): Case => [
          'request_traces_archive_is_complete',
          set({
            archived_at: new Date('2027-01-01T00:00:00Z'),
            archive_ref: ref,
          }),
          set({
            archived_at: new Date('2027-01-01T00:00:00Z'),
            archive_ref: 'x'.repeat(512),
          }),
        ]
      ),
    ];

    test('the cases cover every request_traces constraint', () => {
      const names = [...new Set(CASES.map(([name]) => name))].sort();
      const wanted = [
        ...MIGRATION.matchAll(
          /ADD CONSTRAINT "(request_traces_[a-z0-9_]+)" CHECK/g
        ),
      ]
        .map((m) => m[1]!)
        .sort();
      expect(names).toEqual(wanted);
    });

    test.each(CASES.map((c, i) => [`${c[0]} #${i}`, c] as const))(
      '%s refuses its violation and only that one',
      async (_label, [name, bad]) => {
        await rolledBack(async (c) => {
          const u = await user(c);
          const row = await rowOf(u, next());
          const outcome = await refusal(
            c,
            ...(Object.values(insertSql(T_TRACES, bad(row, u))) as [
              string,
              unknown[],
            ])
          );
          expect(outcome).not.toBeNull();
          expect({
            code: outcome?.code,
            constraint: outcome?.constraint,
          }).toEqual({ code: '23514', constraint: name });
        });
      }
    );

    test.each(
      CASES.filter((c) => c[2] !== undefined).map(
        (c, i) => [`${c[0]} #${i}`, c] as const
      )
    )('%s accepts the value on its line', async (_name, [, , good]) => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const row = await rowOf(u, next());
        const outcome = await refusal(
          c,
          ...(Object.values(
            insertSql(T_TRACES, (good as NonNullable<typeof good>)(row, u))
          ) as [string, unknown[]])
        );
        expect(outcome).toBeNull();
      });
    });

    test('a reply that is not JSON is refused (the cast to jsonb), whatever its hash', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const row = await rowOf(u, next());
        const text = '{not json';
        const outcome = await refusal(
          c,
          ...(Object.values(
            insertSql(T_TRACES, {
              ...row,
              reply_json: text,
              reply_sha256: sha(text),
            })
          ) as [string, unknown[]])
        );
        expect(outcome?.code).toBe('22P02');
      });
    });

    test('a key missing from a group is a violation, not a pass: a CHECK passes on NULL, the rules do not', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const row = await rowOf(u, next());
        for (const [group, key, constraint] of [
          ['request_group', 'tier', 'request_traces_tier_follows_the_request'],
          [
            'request_group',
            'intent',
            'request_traces_intent_follows_the_request',
          ],
          [
            'model_group',
            'units_charged',
            'request_traces_units_follow_the_model_group',
          ],
          [
            'time_group',
            'total_ms',
            'request_traces_total_ms_follows_the_time',
          ],
        ] as const) {
          const broken = clone(row) as Row;
          delete (broken[group] as Record<string, unknown>)[key];
          const outcome = await refusal(
            c,
            ...(Object.values(insertSql(T_TRACES, broken)) as [
              string,
              unknown[],
            ])
          );
          expect({ group, key, constraint: outcome?.constraint }).toEqual({
            group,
            key,
            constraint,
          });
        }
      });
    });

    test('a request id is the key; a client request id is unique per user hash', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const n = next();
        const row = await rowOf(u, n);
        await insertTrace(c, row);
        const same = await refusal(
          c,
          ...(Object.values(insertSql(T_TRACES, row)) as [string, unknown[]])
        );
        expect(same?.constraint).toBe('request_traces_pkey');
        const otherId = inGroup(
          { ...row, request_id: 'req-pg-another' },
          'request_group',
          'request_id',
          'req-pg-another'
        );
        const retry = await refusal(
          c,
          ...(Object.values(insertSql(T_TRACES, otherId)) as [
            string,
            unknown[],
          ])
        );
        expect(retry?.constraint).toBe(
          'request_traces_user_id_hash_client_request_id_key'
        );
        // another user's hash may use the same client request id
        const v = await user(c);
        const theirs = await rowOf(v, n + 100_000, (t) =>
          withPath(t, 'request.client_request_id', row['client_request_id'])
        );
        expect(
          await refusal(
            c,
            ...(Object.values(insertSql(T_TRACES, theirs)) as [
              string,
              unknown[],
            ])
          )
        ).toBeNull();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('request_traces: the guard', () => {
    const MUTABLE = [
      'user_id',
      'risk_group',
      'report2_json',
      'report2_sha256',
      'consent_action',
      'archived_at',
      'archive_ref',
    ];

    async function inserted(
      c: PgClient
    ): Promise<{ userId: string; requestId: string }> {
      const userId = await user(c);
      const n = next();
      const row = await rowOf(userId, n);
      await insertTrace(c, row);
      return { userId, requestId: row['request_id'] as string };
    }

    test('refuses a DELETE of a row that is not archived (restrict_violation)', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        const outcome = await refusal(
          c,
          `DELETE FROM "${T_TRACES}" WHERE "request_id" = $1`,
          [requestId]
        );
        expect(outcome?.code).toBe('23001');
        expect(outcome?.message).toMatch(/not archived/);
        const { rows } = await c.query(
          `SELECT count(*)::int AS n FROM "${T_TRACES}" WHERE request_id = $1`,
          [requestId]
        );
        expect(rows[0].n).toBe(1);
      });
    });

    test('refuses a DELETE of every unarchived row at once, as of one statement', async () => {
      await rolledBack(async (c) => {
        await inserted(c);
        await inserted(c);
        const outcome = await refusal(c, `DELETE FROM "${T_TRACES}"`);
        expect(outcome?.code).toBe('23001');
      });
    });

    test('allows the DELETE of a row once it is archived', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        await c.query(
          `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = $2 WHERE "request_id" = $1`,
          [requestId, 's3://vault/object-1']
        );
        const outcome = await refusal(
          c,
          `DELETE FROM "${T_TRACES}" WHERE "request_id" = $1`,
          [requestId]
        );
        expect(outcome).toBeNull();
      });
    });

    test('refuses an UPDATE of every sealed column, whatever the new value', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        const { rows } = await c.query<{
          column_name: string;
          data_type: string;
        }>(
          `SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public' ORDER BY ordinal_position`,
          [T_TRACES]
        );
        const sealed = rows.filter((r) => !MUTABLE.includes(r.column_name));
        expect(sealed.length).toBe(rows.length - MUTABLE.length);
        for (const { column_name, data_type } of sealed) {
          const value =
            data_type === 'integer'
              ? `("${column_name}" + 1)`
              : data_type === 'jsonb'
                ? `'{"changed": true}'::jsonb`
                : data_type.startsWith('timestamp')
                  ? `("${column_name}" + interval '1 day')`
                  : `'changed'`;
          const outcome = await refusal(
            c,
            `UPDATE "${T_TRACES}" SET "${column_name}" = ${value} WHERE "request_id" = $1`,
            [requestId]
          );
          expect({ column_name, code: outcome?.code }).toEqual({
            column_name,
            code: '23001',
          });
        }
      });
    });

    test('allows the risk attachment: the risk group, Report 2 with its hash, the consent action', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        const text = REPORT2_TEXT;
        const outcome = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "risk_group" = $2::jsonb, "report2_json" = $3, "report2_sha256" = $4, "consent_action" = 'ACCEPT'
            WHERE "request_id" = $1`,
          [requestId, JSON.stringify(riskGroup()), text, sha(text)]
        );
        expect(outcome).toBeNull();
      });
    });

    test('keeps the CHECKs on the attachment: a consent action that the risk group does not say is refused', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        const outcome = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "risk_group" = $2::jsonb, "consent_action" = 'DECLINE' WHERE "request_id" = $1`,
          [requestId, JSON.stringify(riskGroup())]
        );
        expect(outcome?.constraint).toBe(
          'request_traces_consent_follows_the_risk_group'
        );
      });
    });

    test('archives once: NULL to a value is allowed, a second change is refused, and an archived row is frozen', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        const archive = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = 's3://vault/a' WHERE "request_id" = $1`,
          [requestId]
        );
        expect(archive).toBeNull();
        await c.query(
          `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = 's3://vault/a' WHERE "request_id" = $1`,
          [requestId]
        );
        const again = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "archive_ref" = 's3://vault/b' WHERE "request_id" = $1`,
          [requestId]
        );
        expect(again?.code).toBe('23001');
        const unarchive = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "archived_at" = NULL, "archive_ref" = NULL WHERE "request_id" = $1`,
          [requestId]
        );
        expect(unarchive?.code).toBe('23001');
        const risk = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "risk_group" = $2::jsonb WHERE "request_id" = $1`,
          [requestId, JSON.stringify(riskGroup())]
        );
        expect(risk?.code).toBe('23001');
      });
    });

    test('lets the user id go from a value to NULL, archived or not, and never back or to another', async () => {
      await rolledBack(async (c) => {
        const { userId, requestId } = await inserted(c);
        const other = await user(c);
        const toOther = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "user_id" = $2 WHERE "request_id" = $1`,
          [requestId, other]
        );
        expect(toOther?.code).toBe('23001');
        await c.query(
          `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = 's3://vault/a' WHERE "request_id" = $1`,
          [requestId]
        );
        const toNull = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "user_id" = NULL WHERE "request_id" = $1`,
          [requestId]
        );
        expect(toNull).toBeNull();
        await c.query(
          `UPDATE "${T_TRACES}" SET "user_id" = NULL WHERE "request_id" = $1`,
          [requestId]
        );
        const back = await refusal(
          c,
          `UPDATE "${T_TRACES}" SET "user_id" = $2 WHERE "request_id" = $1`,
          [requestId, userId]
        );
        expect(back?.code).toBe('23001');
      });
    });

    test('refuses a TRUNCATE', async () => {
      await rolledBack(async (c) => {
        await inserted(c);
        const outcome = await refusal(c, `TRUNCATE "${T_TRACES}"`);
        expect(outcome?.code).toBe('23001');
        expect(outcome?.message).toMatch(/TRUNCATE is refused/);
      });
    });

    test('the documented cleanup works: with the triggers switched off a row can be deleted, and the guard comes back', async () => {
      await rolledBack(async (c) => {
        const { requestId } = await inserted(c);
        await c.query(`ALTER TABLE "${T_TRACES}" DISABLE TRIGGER USER`);
        await c.query(`DELETE FROM "${T_TRACES}" WHERE "request_id" = $1`, [
          requestId,
        ]);
        await c.query(`ALTER TABLE "${T_TRACES}" ENABLE TRIGGER USER`);
        const again = await inserted(c);
        const outcome = await refusal(
          c,
          `DELETE FROM "${T_TRACES}" WHERE "request_id" = $1`,
          [again.requestId]
        );
        expect(outcome?.code).toBe('23001');
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('chat_threads and chat_messages: the CHECK constraints', () => {
    const threadRow = (userId: string, over: Row = {}): Row => ({
      id: `cm0thr${String(next()).padStart(18, '0')}`,
      user_id: userId,
      symbol: 'XAUUSD',
      title: 'XAUUSD · LONG · 18 SEP 20:55',
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
      updated_at: new Date(),
      ...over,
    });

    const messageRow = (threadId: string, over: Row = {}): Row => {
      const n = next();
      const created = new Date('2026-09-18T21:00:00Z');
      return {
        id: `cm0msg${String(n).padStart(18, '0')}`,
        thread_id: threadId,
        seq: n,
        request_id: `req-chat-${n}`,
        role: 'USER',
        kind: 'TYPED',
        body_text: 'Is gold going up?',
        created_at: created,
        expires_at: new Date('2027-09-18T21:00:00Z'),
        ...over,
      };
    };

    type Case = [string, Row, Row?];
    const THREAD_CASES: Case[] = [
      [
        'chat_threads_symbol_is_a_symbol',
        { symbol: 'xauusd' },
        { symbol: 'A.B1' },
      ],
      [
        'chat_threads_title_is_short',
        { title: 'x'.repeat(81) },
        { title: 'x'.repeat(80) },
      ],
      ['chat_threads_title_is_short', { title: '   ' }],
      [
        'chat_threads_title_source_is_known',
        { title_source: 'AI' },
        { title_source: 'USER' },
      ],
      [
        'chat_threads_trader_type_is_known',
        { trader_type: 'INVESTOR' },
        { trader_type: 'SCALPER' },
      ],
      [
        'chat_threads_last_bias_is_known',
        { last_bias: 'UP' },
        { last_bias: 'STAND_ASIDE' },
      ],
      [
        'chat_threads_last_cycle_slot_is_a_slot',
        { last_cycle_slot: 301 },
        { last_cycle_slot: SLOT_SECONDS },
      ],
      ['chat_threads_last_cycle_slot_is_a_slot', { last_cycle_slot: 0 }],
      [
        'chat_threads_preview_is_short',
        { last_preview: 'x'.repeat(121) },
        { last_preview: 'x'.repeat(120) },
      ],
      [
        'chat_threads_counts_are_consistent',
        { message_count: 1, report_count: 2 },
        { message_count: 2, report_count: 2 },
      ],
      ['chat_threads_counts_are_consistent', { message_count: -1 }],
      ['chat_threads_counts_are_consistent', { report_count: -1 }],
    ];

    test('the thread cases cover every chat_threads constraint', () => {
      const wanted = [
        ...MIGRATION.matchAll(
          /ADD CONSTRAINT "(chat_threads_[a-z0-9_]+)" CHECK/g
        ),
      ]
        .map((m) => m[1]!)
        .sort();
      expect([...new Set(THREAD_CASES.map(([name]) => name))].sort()).toEqual(
        wanted
      );
    });

    test.each(THREAD_CASES.map((c, i) => [`${c[0]} #${i}`, c] as const))(
      '%s',
      async (_label, [name, bad, good]) => {
        await rolledBack(async (c) => {
          const u = await user(c);
          const refused = await refusal(
            c,
            ...(Object.values(insertSql(T_THREADS, threadRow(u, bad))) as [
              string,
              unknown[],
            ])
          );
          expect({
            code: refused?.code,
            constraint: refused?.constraint,
          }).toEqual({ code: '23514', constraint: name });
          if (good !== undefined) {
            expect(
              await refusal(
                c,
                ...(Object.values(insertSql(T_THREADS, threadRow(u, good))) as [
                  string,
                  unknown[],
                ])
              )
            ).toBeNull();
          }
        });
      }
    );

    const MESSAGE_CASES: Case[] = [
      ['chat_messages_seq_is_positive', { seq: 0 }, { seq: 1 }],
      [
        'chat_messages_request_id_is_an_id',
        { request_id: 'has space' },
        { request_id: 'r'.repeat(64) },
      ],
      ['chat_messages_request_id_is_an_id', { request_id: 'r'.repeat(65) }],
      // (an ASSISTANT instant message: the content is right for its kind, the role is not; only the role rule fails)
      [
        'chat_messages_role_and_kind_agree',
        {
          role: 'ASSISTANT',
          kind: 'INSTANT',
          body_text: null,
          intent: 'INSTANT_M5_INSPECT',
        },
        {
          role: 'USER',
          kind: 'INSTANT',
          body_text: null,
          intent: 'INSTANT_M5_INSPECT',
        },
      ],
      [
        'chat_messages_role_and_kind_agree',
        { role: 'ASSISTANT', kind: 'TYPED' },
      ],
      ['chat_messages_role_and_kind_agree', { role: 'SYSTEM', kind: 'TYPED' }],
      [
        'chat_messages_content_fits_the_kind',
        { body_text: null },
        { body_text: 'x' },
      ],
      [
        'chat_messages_content_fits_the_kind',
        { body_json: JSON.stringify({ schema: 'x' }) },
      ],
      [
        'chat_messages_content_fits_the_kind',
        { kind: 'INSTANT', body_text: null, intent: null },
      ],
      [
        'chat_messages_content_fits_the_kind',
        { kind: 'INSTANT', body_text: null, intent: 'DIRECTION' },
      ],
      [
        'chat_messages_content_fits_the_kind',
        {
          role: 'ASSISTANT',
          kind: 'REPORT1',
          body_text: 'text',
          body_json: null,
        },
      ],
      [
        'chat_messages_content_fits_the_kind',
        {
          role: 'ASSISTANT',
          kind: 'REPORT1',
          body_text: null,
          body_json: null,
        },
      ],
      [
        'chat_messages_content_fits_the_kind',
        {
          role: 'ASSISTANT',
          kind: 'REFUSAL',
          body_text: 'text',
          body_json: JSON.stringify({ schema: 'intake-refusal/1' }),
        },
        {
          role: 'ASSISTANT',
          kind: 'REFUSAL',
          body_text: null,
          body_json: JSON.stringify({ schema: 'intake-refusal/1' }),
        },
      ],
      [
        'chat_messages_text_is_bounded',
        { body_text: 'x'.repeat(2001) },
        { body_text: 'x'.repeat(2000) },
      ],
      ['chat_messages_text_is_bounded', { body_text: '   ' }],
      [
        'chat_messages_json_is_an_object',
        {
          role: 'ASSISTANT',
          kind: 'ANSWER',
          body_text: null,
          body_json: JSON.stringify([1]),
        },
        {
          role: 'ASSISTANT',
          kind: 'ANSWER',
          body_text: null,
          body_json: JSON.stringify({ a: 1 }),
        },
      ],
      [
        'chat_messages_intent_is_known',
        { intent: 'OUT_OF_SCOPE' },
        { intent: 'NEWS' },
      ],
      [
        'chat_messages_cycle_slot_is_a_slot',
        { cycle_slot: 301 },
        { cycle_slot: SLOT_SECONDS },
      ],
      ['chat_messages_cycle_slot_is_a_slot', { cycle_slot: 0 }],
      [
        'chat_messages_expires_after_it_began',
        { expires_at: new Date('2026-09-18T21:00:00Z') },
        { expires_at: new Date('2026-09-18T21:00:00.001Z') },
      ],
    ];

    test('the message cases cover every chat_messages constraint', () => {
      const wanted = [
        ...MIGRATION.matchAll(
          /ADD CONSTRAINT "(chat_messages_[a-z0-9_]+)" CHECK/g
        ),
      ]
        .map((m) => m[1]!)
        .sort();
      expect([...new Set(MESSAGE_CASES.map(([name]) => name))].sort()).toEqual(
        wanted
      );
    });

    test.each(MESSAGE_CASES.map((c, i) => [`${c[0]} #${i}`, c] as const))(
      '%s',
      async (_label, [name, bad, good]) => {
        await rolledBack(async (c) => {
          const u = await user(c);
          const thread = threadRow(u);
          await c.query(
            ...(Object.values(insertSql(T_THREADS, thread)) as [
              string,
              unknown[],
            ])
          );
          const refused = await refusal(
            c,
            ...(Object.values(
              insertSql(T_MESSAGES, messageRow(thread['id'] as string, bad))
            ) as [string, unknown[]])
          );
          expect({
            code: refused?.code,
            constraint: refused?.constraint,
          }).toEqual({ code: '23514', constraint: name });
          if (good !== undefined) {
            expect(
              await refusal(
                c,
                ...(Object.values(
                  insertSql(
                    T_MESSAGES,
                    messageRow(thread['id'] as string, good)
                  )
                ) as [string, unknown[]])
              )
            ).toBeNull();
          }
        });
      }
    );

    test('a message number is unique in its thread; a request has one message per role', async () => {
      await rolledBack(async (c) => {
        const u = await user(c);
        const thread = threadRow(u);
        await c.query(
          ...(Object.values(insertSql(T_THREADS, thread)) as [
            string,
            unknown[],
          ])
        );
        const first = messageRow(thread['id'] as string, {
          seq: 1,
          request_id: 'req-chat-a',
        });
        await c.query(
          ...(Object.values(insertSql(T_MESSAGES, first)) as [
            string,
            unknown[],
          ])
        );
        const sameSeq = await refusal(
          c,
          ...(Object.values(
            insertSql(
              T_MESSAGES,
              messageRow(thread['id'] as string, {
                seq: 1,
                request_id: 'req-chat-b',
              })
            )
          ) as [string, unknown[]])
        );
        expect(sameSeq?.constraint).toBe('chat_messages_thread_id_seq_key');
        const sameRole = await refusal(
          c,
          ...(Object.values(
            insertSql(
              T_MESSAGES,
              messageRow(thread['id'] as string, {
                seq: 2,
                request_id: 'req-chat-a',
              })
            )
          ) as [string, unknown[]])
        );
        expect(sameRole?.constraint).toBe('chat_messages_request_id_role_key');
        const otherRole = await refusal(
          c,
          ...(Object.values(
            insertSql(
              T_MESSAGES,
              messageRow(thread['id'] as string, {
                seq: 2,
                request_id: 'req-chat-a',
                role: 'ASSISTANT',
                kind: 'ANSWER',
                body_text: null,
                body_json: JSON.stringify({ a: 1 }),
              })
            )
          ) as [string, unknown[]])
        );
        expect(otherRole).toBeNull();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('deleting an account', () => {
    test('removes the trader’s threads and messages, and leaves every trace with user_id NULL and nothing else changed', async () => {
      await wipe();
      const a = userIdOf(next());
      const b = userIdOf(next());
      for (const id of [a, b]) {
        await db.query(
          `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
          [id, `rt-${id}@example.test`]
        );
      }
      // A: two threads with messages and two traces (one of them archived); B: the same, untouched
      const threads: Record<string, string[]> = { [a]: [], [b]: [] };
      for (const id of [a, b]) {
        for (let i = 0; i < 2; i += 1) {
          const created = await createThread(
            {
              userId: id,
              symbol: 'XAUUSD',
              traderType: 'DAY_TRADER',
              title: `XAUUSD · LONG · ${i}`,
            },
            { client: prisma }
          );
          if (!created.ok) throw new Error('thread');
          threads[id]!.push(created.thread.id);
          const n = next();
          const requestId = `req-acct-${n}`;
          const reply = withPath(
            withPath(reportResult(), 'thread_id', created.thread.id),
            'provenance.request_id',
            requestId
          );
          const written = await appendExchange(
            {
              userId: id,
              threadId: created.thread.id,
              requestId,
              user: {
                kind: 'TYPED',
                text: 'Is gold going up?',
                intent: 'DIRECTION',
              },
              reply,
            },
            { client: prisma }
          );
          expect(written.ok).toBe(true);
        }
      }
      const rowsOf = (userId: string) =>
        db.query<Row>(
          `SELECT to_jsonb(t) - 'user_id' AS rest, user_id, user_id_hash, key_version FROM "${T_TRACES}" t
            WHERE user_id_hash = $1 ORDER BY request_id`,
          [hashTraceUser(userId, KEY).hash]
        );
      const traces: Record<string, string[]> = { [a]: [], [b]: [] };
      for (const id of [a, b]) {
        for (let i = 0; i < 2; i += 1) {
          const n = next();
          const { trace, reply } = traceFor(n, (t) =>
            withPath(t, 'request.thread_id', threads[id]![i])
          );
          const replyWithThread = withPath(reply, 'thread_id', threads[id]![i]);
          const result = await writeTrace(
            { userId: id, trace, reply: replyWithThread },
            { client: prisma, key: KEY }
          );
          expect(result.ok).toBe(true);
          traces[id]!.push(trace.request.request_id);
        }
      }
      await db.query(
        `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = 's3://vault/acct' WHERE request_id = $1`,
        [traces[a]![0]]
      );

      const before = await rowsOf(a);
      expect(before.rows).toHaveLength(2);
      const untouchedBefore = await rowsOf(b);

      await db.query(`DELETE FROM "User" WHERE "id" = $1`, [a]);

      // the trader's threads and messages are gone ...
      const left = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_THREADS}" WHERE user_id = $1`,
        [a]
      );
      expect(left.rows[0]!.n).toBe(0);
      const messagesLeft = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_MESSAGES}" WHERE thread_id = ANY ($1)`,
        [threads[a]]
      );
      expect(messagesLeft.rows[0]!.n).toBe(0);
      // ... and the traces stay, archived or not, with user_id NULL and every other column as it was
      const after = await db.query<Row>(
        `SELECT to_jsonb(t) - 'user_id' AS rest, user_id, user_id_hash, key_version FROM "${T_TRACES}" t
          WHERE user_id_hash = $1 ORDER BY request_id`,
        [hashTraceUser(a, KEY).hash]
      );
      expect(after.rows).toHaveLength(2);
      for (const [i, row] of after.rows.entries()) {
        expect(row['user_id']).toBeNull();
        expect(row['user_id_hash']).toBe(hashTraceUser(a, KEY).hash);
        expect(row['key_version']).toBe(2);
        expect(row['rest']).toEqual((before.rows[i] as Row)['rest']);
      }
      // the other trader is untouched
      expect((await rowsOf(b)).rows).toEqual(untouchedBefore.rows);
      const bThreads = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_THREADS}" WHERE user_id = $1`,
        [b]
      );
      expect(bThreads.rows[0]!.n).toBe(2);
      const bMessages = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_MESSAGES}" WHERE thread_id = ANY ($1)`,
        [threads[b]]
      );
      expect(bMessages.rows[0]!.n).toBe(4);
    });

    test('the hash still names the trader: it is recognised with the key of its own version', async () => {
      const id = userIdOf(next());
      const { hash } = hashTraceUser(id, KEY);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hashTraceUser(id, { ...KEY, key: 'z'.repeat(48) }).hash).not.toBe(
        hash
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('the stores on the real client', () => {
    test('writeTrace writes a row the database accepts, and readTrace reads it back', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const n = next();
      const { trace, reply, requestId } = traceFor(n);
      const result = await writeTrace(
        { userId: id, trace, reply },
        { client: prisma, key: KEY }
      );
      expect(result).toEqual({
        ok: true,
        requestId,
        replySha256: sha(canonicalJson(reply)),
      });
      const row = await readTrace(requestId, { client: prisma });
      expect(row).toMatchObject({
        request_id: requestId,
        user_id: id,
        user_id_hash: hashTraceUser(id, KEY).hash,
        key_version: 2,
        tier: 'PRO',
        locale: 'en-US',
        intent: 'DIRECTION',
        cycle_slot: SLOT_SECONDS,
        data_status: 'FRESH',
        outcome: 'REPORT1',
        units_charged: 4620,
        reply_json: canonicalJson(reply),
        reply_sha256: sha(canonicalJson(reply)),
        archived_at: null,
        report2_json: null,
        risk_group: null,
      });
      expect(row?.request_group).toEqual(trace.request);
      expect(row?.model_group).toEqual(trace.model);
      expect(SLOT).toBe('2026-09-18T20:55Z');
    });

    test('a repeated client request id is a unique violation (the idempotency key)', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const n = next();
      const first = traceFor(n);
      await writeTrace(
        { userId: id, trace: first.trace, reply: first.reply },
        { client: prisma, key: KEY }
      );
      const second = traceFor(n + 500_000, (t) =>
        withPath(
          t,
          'request.client_request_id',
          first.trace.request.client_request_id
        )
      );
      await expect(
        writeTrace(
          { userId: id, trace: second.trace, reply: second.reply },
          { client: prisma, key: KEY }
        )
      ).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    test('every outcome the contracts know is written and accepted: the writer’s rows and the database agree', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      type Variant = {
        name: string;
        patch: (t: ReplyTrace) => ReplyTrace;
        reply: ((requestId: string) => unknown) | null;
      };
      const providing = (make: () => unknown) => (requestId: string) =>
        withPath(make(), 'provenance.request_id', requestId);
      const variants: Variant[] = [];
      for (const status of [
        'FRESH',
        'DELAYED',
        'STALE',
        'MARKET_CLOSED',
        'UNKNOWN',
      ] as const) {
        variants.push({
          name: `REPORT1 ${status}`,
          patch: (t) => withPath(t, 'data.data_status', status),
          reply: providing(() => reportResult()),
        });
      }
      for (const regenerations of [0, 1] as const) {
        variants.push({
          name: `REPORT1 with ${regenerations} regenerations`,
          patch: (t) =>
            withPath(
              withPath(t, 'checks.regenerations', regenerations),
              'model.calls',
              t.model.calls.filter(
                (call) => regenerations === 1 || call.role !== 'REGENERATE'
              )
            ),
          reply: providing(() => reportResult()),
        });
      }
      variants.push({
        name: 'ANSWER',
        patch: (t) => ({
          ...withPath(
            withPath(t, 'checks.shape', 'ANSWER'),
            'request.intent',
            'EXPLAIN'
          ),
          outcome: 'ANSWER' as const,
        }),
        reply: providing(() => answerResult()),
      });
      variants.push({
        name: 'FIXED_ANSWER',
        patch: (t) => ({ ...t, outcome: 'FIXED_ANSWER' as const }),
        reply: providing(() => fixedResult()),
      });
      variants.push({
        name: 'OPEN_TRADE_SETUP, no model',
        patch: (t) => ({
          ...withPath(
            withPath(t, 'model.model', null),
            'request.intent',
            'REPORT_2'
          ),
          outcome: 'OPEN_TRADE_SETUP' as const,
        }),
        reply: providing(() => actionResult()),
      });
      variants.push({
        name: 'REFUSED, before any thread',
        patch: (t) => ({
          ...withPath(
            withPath(t, 'request.thread_id', null),
            'data.cycle_slot',
            null
          ),
          outcome: 'REFUSED' as const,
        }),
        reply: () =>
          buildRefusal(
            'QUOTA_INSUFFICIENT',
            'en-US',
            'Your monthly allowance is used up.'
          ),
      });
      variants.push({
        name: 'ERROR, no reply',
        patch: (t) => ({ ...t, outcome: 'ERROR' as const }),
        reply: null,
      });
      variants.push({
        name: 'a risk group already attached',
        patch: (t) => withPath(t, 'risk', riskGroup()),
        reply: providing(() => reportResult()),
      });
      variants.push({
        name: 'no cycle and no price bar (nothing could be read)',
        patch: (t) =>
          withPath(
            withPath(
              withPath(t, 'data.cycle_slot', null),
              'data.last_price_bar',
              null
            ),
            'data.data_status',
            null
          ),
        reply: providing(() => withPath(reportResult(), 'stamp.as_of', null)),
      });
      for (const locale of ['ar', 'ja', 'ur', 'th', 'zh-TW', 'pt-BR']) {
        variants.push({
          name: `locale ${locale}`,
          patch: (t) =>
            withPath(
              withPath(t, 'request.reply_locale', locale),
              'request.interface_locale',
              locale
            ),
          reply: providing(() =>
            withPath(reportResult(), 'reply_locale', locale)
          ),
        });
      }
      for (const v of variants) {
        const base = traceFor(next(), v.patch);
        expect({
          name: v.name,
          traceIsValid: validateReplyTrace(base.trace).ok,
        }).toEqual({ name: v.name, traceIsValid: true });
        const result = await writeTrace(
          {
            userId: id,
            trace: base.trace,
            reply: v.reply === null ? null : (v.reply(base.requestId) as never),
          },
          { client: prisma, key: KEY }
        );
        expect({
          name: v.name,
          ok: result.ok,
          issues: result.ok ? [] : result.issues,
        }).toEqual({ name: v.name, ok: true, issues: [] });
      }
      const { rows } = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_TRACES}" WHERE user_id = $1`,
        [id]
      );
      expect(rows[0]!.n).toBe(variants.length);
    });

    test('attachRisk attaches through the real client, and the database lets it', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const { trace, reply, requestId } = traceFor(next());
      await writeTrace(
        { userId: id, trace, reply },
        { client: prisma, key: KEY }
      );
      const attached = await attachRisk(
        { userId: id, requestId, risk: riskGroup(), report2Json: REPORT2_TEXT },
        { client: prisma }
      );
      expect(attached.ok).toBe(true);
      const row = await readTrace(requestId, { client: prisma });
      expect(row).toMatchObject({
        consent_action: 'ACCEPT',
        risk_group: riskGroup(),
        report2_json: REPORT2_TEXT,
      });
      // another user cannot attach to it
      const other = userIdOf(next());
      const refused = await attachRisk(
        { userId: other, requestId, risk: riskGroup(), report2Json: null },
        { client: prisma }
      );
      expect(refused).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    });

    test('once a trace is archived the database refuses an attachment, and the store lets the error through', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const { trace, reply, requestId } = traceFor(next());
      await writeTrace(
        { userId: id, trace, reply },
        { client: prisma, key: KEY }
      );
      await db.query(
        `UPDATE "${T_TRACES}" SET "archived_at" = now(), "archive_ref" = 's3://vault/x' WHERE request_id = $1`,
        [requestId]
      );
      await expect(
        attachRisk(
          { userId: id, requestId, risk: riskGroup(), report2Json: null },
          { client: prisma }
        )
      ).rejects.toBeDefined();
    });

    test('threads: create, get, list in order, rename, and delete with their messages', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const other = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [other, `rt-${other}@example.test`]
      );
      const made = [];
      for (let i = 0; i < 3; i += 1) {
        const result = await createThread(
          {
            userId: id,
            symbol: 'XAUUSD',
            traderType: 'SCALPER',
            title: `XAUUSD · SHORT · ${i}`,
          },
          { client: prisma }
        );
        if (!result.ok) throw new Error('thread');
        made.push(result.thread);
        await db.query(
          `UPDATE "${T_THREADS}" SET last_message_at = $2 WHERE id = $1`,
          [result.thread.id, new Date(Date.UTC(2026, 8, 18, 21, i, 0))]
        );
      }
      expect(
        await getThread(other, made[0]!.id, { client: prisma })
      ).toBeNull();
      const page = await listThreads(id, { client: prisma, limit: 2 });
      expect(page.threads.map((t) => t.title)).toEqual([
        'XAUUSD · SHORT · 2',
        'XAUUSD · SHORT · 1',
      ]);
      const second = await listThreads(id, {
        client: prisma,
        limit: 2,
        after: page.next!,
      });
      expect(second.threads.map((t) => t.title)).toEqual([
        'XAUUSD · SHORT · 0',
      ]);
      expect(second.next).toBeNull();
      expect(
        await renameThread(id, made[0]!.id, '  Gold  plan ', { client: prisma })
      ).toEqual({ ok: true, title: 'Gold plan' });
      expect(
        await renameThread(other, made[0]!.id, 'Mine', { client: prisma })
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(await deleteThread(other, made[0]!.id, { client: prisma })).toBe(
        false
      );
      expect(await deleteThread(id, made[0]!.id, { client: prisma })).toBe(
        true
      );
      expect(await getThread(id, made[0]!.id, { client: prisma })).toBeNull();
    });

    test('appendExchange numbers messages, updates the thread, and a repeated request is DUPLICATE_REQUEST with nothing changed', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const created = await createThread(
        {
          userId: id,
          symbol: 'XAUUSD',
          traderType: 'DAY_TRADER',
          title: 'XAUUSD · LONG',
        },
        { client: prisma }
      );
      if (!created.ok) throw new Error('thread');
      const threadId = created.thread.id;
      const reply = (requestId: string) =>
        withPath(
          withPath(reportResult(), 'thread_id', threadId),
          'provenance.request_id',
          requestId
        );
      const now = new Date('2026-09-18T21:00:12.345Z');
      const first = await appendExchange(
        {
          userId: id,
          threadId,
          requestId: 'req-real-1',
          user: {
            kind: 'TYPED',
            text: 'Is gold going up?',
            intent: 'DIRECTION',
          },
          reply: reply('req-real-1'),
          now,
        },
        { client: prisma }
      );
      expect(first.ok).toBe(true);
      const again = await appendExchange(
        {
          userId: id,
          threadId,
          requestId: 'req-real-1',
          user: {
            kind: 'TYPED',
            text: 'Is gold going up?',
            intent: 'DIRECTION',
          },
          reply: reply('req-real-1'),
          now,
        },
        { client: prisma }
      );
      expect(again).toEqual({ ok: false, code: 'DUPLICATE_REQUEST' });
      const thread = await getThread(id, threadId, { client: prisma });
      expect(thread).toMatchObject({
        message_count: 2,
        report_count: 1,
        last_bias: 'LONG',
        last_cycle_slot: SLOT_SECONDS,
      });
      const instant = await appendExchange(
        {
          userId: id,
          threadId,
          requestId: 'req-real-2',
          user: { kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' },
          reply: withPath(reply('req-real-2'), 'intent', 'INSTANT_M15_INSPECT'),
          now,
        },
        { client: prisma }
      );
      expect(instant.ok).toBe(true);
      const rows = await listMessages(id, threadId, { client: prisma });
      expect(rows?.map((m) => [m.seq, m.role, m.kind])).toEqual([
        [1, 'USER', 'TYPED'],
        [2, 'ASSISTANT', 'REPORT1'],
        [3, 'USER', 'INSTANT'],
        [4, 'ASSISTANT', 'REPORT1'],
      ]);
      expect(rows?.[0]?.expires_at).toEqual(
        new Date('2027-09-18T21:00:12.345Z')
      );
      expect(rows?.[1]?.body_json).toEqual(reply('req-real-1'));
      expect(
        await listMessages(userIdOf(next()), threadId, { client: prisma })
      ).toBeNull();

      // a thread that is another trader's, or is not there: the database's "record not found"
      // (P2025) is NOT_FOUND, and nothing at all is written
      const typed = {
        kind: 'TYPED' as const,
        text: 'Is gold going up?',
        intent: 'DIRECTION' as const,
      };
      expect(
        await appendExchange(
          {
            userId: userIdOf(next()),
            threadId,
            requestId: 'req-real-3',
            user: typed,
            reply: reply('req-real-3'),
            now,
          },
          { client: prisma }
        )
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      const missing = 'cm0thread999999999999999999';
      expect(
        await appendExchange(
          {
            userId: id,
            threadId: missing,
            requestId: 'req-real-4',
            user: typed,
            reply: withPath(
              withPath(reportResult(), 'thread_id', missing),
              'provenance.request_id',
              'req-real-4'
            ),
            now,
          },
          { client: prisma }
        )
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(await listMessages(id, threadId, { client: prisma })).toHaveLength(
        4
      );
      expect(await getThread(id, threadId, { client: prisma })).toMatchObject({
        message_count: 4,
      });
    });

    test('four exchanges at once on one thread are numbered one after the other, never twice the same', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const created = await createThread(
        {
          userId: id,
          symbol: 'XAUUSD',
          traderType: 'DAY_TRADER',
          title: 'XAUUSD · LONG',
        },
        { client: prisma }
      );
      if (!created.ok) throw new Error('thread');
      const threadId = created.thread.id;
      const results = await Promise.all(
        [1, 2, 3, 4].map((i) =>
          appendExchange(
            {
              userId: id,
              threadId,
              requestId: `req-race-${i}`,
              user: {
                kind: 'TYPED',
                text: `question ${i}`,
                intent: 'DIRECTION',
              },
              reply: withPath(
                withPath(reportResult(), 'thread_id', threadId),
                'provenance.request_id',
                `req-race-${i}`
              ),
            },
            { client: prisma }
          )
        )
      );
      expect(results.every((r) => r.ok)).toBe(true);
      const { rows } = await db.query<{ seq: number }>(
        `SELECT seq FROM "${T_MESSAGES}" WHERE thread_id = $1 ORDER BY seq`,
        [threadId]
      );
      expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const thread = await getThread(id, threadId, { client: prisma });
      expect(thread).toMatchObject({ message_count: 8, report_count: 4 });
      // a pair is two consecutive numbers of one request
      const pairs = await db.query<{ request_id: string; seqs: number[] }>(
        `SELECT request_id, array_agg(seq ORDER BY seq) AS seqs FROM "${T_MESSAGES}" WHERE thread_id = $1 GROUP BY request_id`,
        [threadId]
      );
      for (const pair of pairs.rows)
        expect(pair.seqs[1]! - pair.seqs[0]!).toBe(1);
    });

    test('deleting a thread removes its messages and leaves the traces that name it', async () => {
      const id = userIdOf(next());
      await db.query(
        `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
        [id, `rt-${id}@example.test`]
      );
      const created = await createThread(
        {
          userId: id,
          symbol: 'XAUUSD',
          traderType: 'DAY_TRADER',
          title: 'XAUUSD · LONG',
        },
        { client: prisma }
      );
      if (!created.ok) throw new Error('thread');
      const threadId = created.thread.id;
      const n = next();
      const requestId = `req-keep-${n}`;
      const { trace } = traceFor(n, (t) =>
        withPath(
          withPath(t, 'request.thread_id', threadId),
          'request.request_id',
          requestId
        )
      );
      const reply = withPath(
        withPath(reportResult(), 'thread_id', threadId),
        'provenance.request_id',
        requestId
      );
      expect(
        (
          await writeTrace(
            { userId: id, trace, reply },
            { client: prisma, key: KEY }
          )
        ).ok
      ).toBe(true);
      expect(
        (
          await appendExchange(
            {
              userId: id,
              threadId,
              requestId,
              user: {
                kind: 'TYPED',
                text: 'Is gold going up?',
                intent: 'DIRECTION',
              },
              reply,
            },
            { client: prisma }
          )
        ).ok
      ).toBe(true);
      expect(await deleteThread(id, threadId, { client: prisma })).toBe(true);
      const messages = await db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM "${T_MESSAGES}" WHERE thread_id = $1`,
        [threadId]
      );
      expect(messages.rows[0]!.n).toBe(0);
      const kept = await readTrace(requestId, { client: prisma });
      expect(kept).toMatchObject({
        request_id: requestId,
        thread_id: threadId,
        user_id: id,
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('no drift', () => {
    function diff(): { status: number; output: string } {
      const dir = mkdtempSync(join(tmpdir(), 'rt-drift-'));
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
      await db.query(`ALTER TABLE "${T_THREADS}" ADD COLUMN "oops" TEXT`);
      try {
        const result = diff();
        expect(result.status).toBe(2);
        expect(result.output).toMatch(/DROP COLUMN "oops"/);
      } finally {
        await db.query(`ALTER TABLE "${T_THREADS}" DROP COLUMN "oops"`);
      }
    });
  });

  test('last: the guard on request_traces is still enabled', async () => {
    const { rows } = await db.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgrelid = $1::regclass`,
      [`"${T_TRACES}"`]
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.tgenabled === 'O')).toBe(true);
  });
});
