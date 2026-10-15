/**
 * @jest-environment node
 */

/**
 * The reply flow on a REAL PostgreSQL (build step 7 part 7a; acceptance 5.14 items 1 and 2, plan
 * part 7 "Done when"): a question goes in, a reply comes out, and the database holds exactly what
 * the orchestrator says happened. The orchestrator, the gate, the answer gate, the assembler, the
 * checks, the composer, the quota meter, the ledger store and the thread, message and trace
 * stores all run for real, over the generated Prisma client; only the things that are not in this
 * database are replaced (the market data the intake path reads, the model, the chart).
 *
 * What it shows that the unit tests (an in-memory model of the tables) cannot:
 *  - the question becomes a settled ledger line, a thread, two messages and one trace row, and the
 *    database's own CHECKs and triggers accept every row the code wrote;
 *  - a request sent twice is charged once, and a request sent twice AT THE SAME TIME (two
 *    connections racing for one request id) runs the model once;
 *  - a hold that cannot be covered is refused before any model is called, and a client that leaves
 *    before a model is called leaves the books as they were (RELEASED, nothing used);
 *  - a trader who deletes the account takes the balance, the thread and the messages with them and
 *    leaves the audit row, with the user id gone and the keyed hash still there;
 *  - a trader who deletes a thread takes the thread and its messages and leaves the audit row whole
 *    (the threads API's DELETE, part 7b), and nobody else's delete or rename touches it.
 *
 * SKIPPED unless BOTH are set:
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES the rows of the reply tables and the users it creates
 *                        (email rf-*@example.test) in that database
 *
 * To run it on a throwaway database see `__tests__/reply/reply-trace-chat.pg.spec.ts` and
 * `ledger.pg.spec.ts`: build the schema, apply the TWO migration files
 * (20261014000000_add_reply_trace_and_chat_tables and 20261014010000_add_ai_metering_tables), then
 *   CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *     npx jest --testMatch '**\/__tests__/reply/reply-flow.pg.spec.ts' --coverage=false
 * (the root Jest configuration only collects *.test.ts, so a plain `npx jest` never runs this
 * file).
 */

import type { Client as PgClient } from 'pg';

import { readTrace } from '@/lib/platform/traces/store';
import { listMessages } from '@/lib/platform/chat/messages-store';
import {
  deleteThread,
  getThread,
  renameThread,
} from '@/lib/platform/chat/threads-store';
import { readPeriod } from '@/lib/platform/metering/ledger-store';
import { monthOf } from '@/lib/platform/metering/period';
import type { Report1Result } from '@/lib/reply/contracts/result';
import { requestIdOf } from '@/lib/reply/run/request-id';

import {
  AUDIT_KEY,
  buildWorld,
  CLIENT_ID,
  run,
} from '../lib/reply/run/helpers/world';
import type { ReplyWorld } from '../lib/reply/run/helpers/world';

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

let counter = 0;
const userIdOf = (n: number): string =>
  `cm0rfuser${String(n).padStart(16, '0')}`;

suite('the reply flow on a real Postgres', () => {
  jest.setTimeout(180_000);

  let prisma: any;
  let db: PgClient;

  async function newUser(): Promise<string> {
    counter += 1;
    const id = userIdOf(counter);
    await db.query(
      `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
      [id, `rf-${id}@example.test`]
    );
    return id;
  }

  async function wipe(): Promise<void> {
    // a trace row is the 7-year audit record: the database refuses to delete one that is not archived,
    // so this spec switches the table's triggers off for its own cleaning, and on again
    await db.query(`ALTER TABLE "request_traces" DISABLE TRIGGER USER`);
    try {
      await db.query(
        `DELETE FROM "request_traces" WHERE "user_id_hash" IN (SELECT "user_id_hash" FROM "request_traces" WHERE "client_request_id" LIKE 'rf-%')`
      );
      await db.query(
        `DELETE FROM "request_traces" WHERE "client_request_id" LIKE 'rf-%'`
      );
    } finally {
      await db.query(`ALTER TABLE "request_traces" ENABLE TRIGGER USER`);
    }
    await db.query(`DELETE FROM "User" WHERE "email" LIKE 'rf-%@example.test'`);
  }

  async function world(
    options: Parameters<typeof buildWorld>[0] = {}
  ): Promise<{ w: ReplyWorld; userId: string }> {
    const userId = await newUser();
    const w = await buildWorld({
      ...options,
      intake: {
        session: { userId, tier: 'PRO' },
        ...(options.intake ?? {}),
      },
      clients: { ledger: prisma, chat: prisma, traces: prisma },
    });
    return { w, userId };
  }

  const clientId = (): string => `rf-${(counter += 1)}-aaaa-bbbb`;

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

  test('a typed question becomes a settled ledger line, a thread, two messages and a trace row', async () => {
    const { w, userId } = await world();
    const cid = clientId();
    const out = await run(w, { kind: 'TYPED', clientRequestId: cid });
    expect(out.kind).toBe('REPLY');
    if (out.kind !== 'REPLY') return;
    const result = out.result as Report1Result;
    expect(result.kind).toBe('REPORT1');
    expect(out.requestId).toBe(await requestIdOf(userId, cid));
    expect(w.primary?.count).toBe(1);

    // the ledger: one reservation, settled for the Understand call and the reply
    const reservation = await db.query(
      `SELECT "status", "actual_units", "reserved_units", "model", "cost_micro_usd"
         FROM "ai_usage_reservations" WHERE "request_id" = $1`,
      [out.requestId]
    );
    expect(reservation.rows).toHaveLength(1);
    expect(reservation.rows[0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 300 + 2_500,
      cost_micro_usd: 300 + 2_500,
      model: 'fixture-a/recorded',
    });
    expect(reservation.rows[0].reserved_units).toBeGreaterThan(2_800);
    const month = monthOf(w.fake.ports.now())!;
    const period = await readPeriod(userId, month, { client: prisma });
    expect(period).toMatchObject({ used: 2_800, reserved: 0 });

    // the thread and its messages, filed under the request
    const thread = await getThread(userId, result.thread_id, {
      client: prisma,
    });
    expect(thread).toMatchObject({
      user_id: userId,
      title_source: 'AUTO',
      message_count: 2,
      report_count: 1,
      last_bias: 'LONG',
    });
    expect(thread!.title).toBe('XAUUSD · LONG · 18 SEP 20:55');
    const messages = await listMessages(userId, result.thread_id, {
      client: prisma,
    });
    expect(messages!.map((m) => [m.seq, m.role, m.kind, m.request_id])).toEqual(
      [
        [1, 'USER', 'TYPED', out.requestId],
        [2, 'ASSISTANT', 'REPORT1', out.requestId],
      ]
    );
    expect(messages![1]!.body_json).toMatchObject({
      kind: 'REPORT1',
      thread_id: result.thread_id,
    });

    // the trace: one row, every group, the keyed hash, no question
    const row = await readTrace(out.requestId, { client: prisma });
    expect(row).toMatchObject({
      user_id: userId,
      client_request_id: cid,
      thread_id: result.thread_id,
      outcome: 'REPORT1',
      tier: 'PRO',
      intent: 'DIRECTION',
      model: 'fixture-a/recorded',
      units_charged: 2_800,
      regenerations: 0,
      number_violations: 0,
      wording_violations: 0,
      key_version: AUDIT_KEY.version,
    });
    expect(row!.reply_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(
      'What is the direction of gold now'
    );
  });

  test('a request sent twice is charged once and returns the stored reply', async () => {
    const { w, userId } = await world();
    const cid = clientId();
    const first = await run(w, { kind: 'INSTANT', clientRequestId: cid });
    const second = await run(w, { kind: 'INSTANT', clientRequestId: cid });
    expect(first.kind === 'REPLY' && first.replayed).toBe(false);
    expect(second.kind === 'REPLY' && second.replayed).toBe(true);
    if (first.kind !== 'REPLY' || second.kind !== 'REPLY') return;
    expect(second.result).toEqual(first.result);
    expect(w.primary?.count).toBe(1);
    const counts = await db.query(
      `SELECT (SELECT count(*) FROM "ai_usage_reservations" WHERE "user_id" = $1)::int AS holds,
              (SELECT count(*) FROM "request_traces" WHERE "request_id" = $2)::int AS traces,
              (SELECT count(*) FROM "chat_messages" WHERE "request_id" = $2)::int AS messages`,
      [userId, first.requestId]
    );
    expect(counts.rows[0]).toEqual({ holds: 1, traces: 1, messages: 2 });
  });

  test('two connections racing with one request id run the model once', async () => {
    const { w } = await world();
    const cid = clientId();
    const results = await Promise.all([
      run(w, { kind: 'INSTANT', clientRequestId: cid }),
      run(w, { kind: 'INSTANT', clientRequestId: cid }),
    ]);
    // exactly one of them ran the request
    const ran = results.filter((r) => r.kind === 'REPLY' && !r.replayed);
    expect(ran).toHaveLength(1);
    expect(w.primary?.count).toBe(1);
    expect(w.fake.calls.understand).toBe(0);
    // the other was told to wait (it met the first one's hold), or, if it came after the first
    // had finished, was given the stored reply: never a second run, never a second charge
    const other = results.find((r) => r !== ran[0])!;
    if (other.kind === 'ERROR') {
      expect(other).toMatchObject({ code: 'INTERNAL', retryable: true });
    } else {
      expect(other).toMatchObject({ kind: 'REPLY', replayed: true });
    }
    const requestId = (ran[0] as { requestId: string }).requestId;
    const holds = await db.query(
      `SELECT "status", "actual_units" FROM "ai_usage_reservations" WHERE "request_id" = $1`,
      [requestId]
    );
    expect(holds.rows).toEqual([{ status: 'SETTLED', actual_units: 2_500 }]);
    const messages = await db.query(
      `SELECT count(*)::int AS n FROM "chat_messages" WHERE "request_id" = $1`,
      [requestId]
    );
    expect(messages.rows[0].n).toBe(2);
  });

  test('a hold that cannot be covered is refused before any model is called, and leaves the books alone', async () => {
    const { w, userId } = await world({ allowance: 30_000 });
    const out = await run(w, { kind: 'TYPED', clientRequestId: clientId() });
    expect(out.kind).toBe('REFUSED');
    if (out.kind !== 'REFUSED') return;
    expect(out.refusal.code).toBe('QUOTA_INSUFFICIENT');
    expect(out.quota).toMatchObject({
      limitUnits: 30_000,
      availableUnits: 30_000,
    });
    expect(w.primary?.count).toBe(0);
    expect(w.fake.calls.understand).toBe(0);
    const held = await db.query(
      `SELECT count(*)::int AS n FROM "ai_usage_reservations" WHERE "user_id" = $1`,
      [userId]
    );
    expect(held.rows[0].n).toBe(0);
  });

  test('a client that leaves before a model is called releases its hold', async () => {
    const { w, userId } = await world();
    const controller = new AbortController();
    const bars = w.ports.dayBars;
    w.ports.dayBars = async (slot) => {
      controller.abort();
      return bars(slot);
    };
    const out = await run(
      w,
      { kind: 'INSTANT', clientRequestId: clientId() },
      { signal: controller.signal }
    );
    expect(out.kind).toBe('ABORTED');
    if (out.kind !== 'ABORTED') return;
    expect(w.primary?.count).toBe(0);
    const state = await db.query(
      `SELECT r."status", p."used", p."reserved"
         FROM "ai_usage_reservations" r JOIN "ai_quota_periods" p ON p."id" = r."period_id"
        WHERE r."user_id" = $1`,
      [userId]
    );
    expect(state.rows).toEqual([{ status: 'RELEASED', used: 0, reserved: 0 }]);
    const traces = await db.query(
      `SELECT count(*)::int AS n FROM "request_traces" WHERE "request_id" = $1`,
      [out.requestId]
    );
    expect(traces.rows[0].n).toBe(0);
  });

  test('a failed trace write after the model was paid leaves the charge settled and no thread behind', async () => {
    const { w, userId } = await world({ traceFails: true });
    const out = await run(w, { kind: 'INSTANT', clientRequestId: clientId() });
    expect(out).toMatchObject({
      kind: 'ERROR',
      code: 'PERSISTENCE_FAILED',
      retryable: false,
    });
    const state = await db.query(
      `SELECT r."status", r."actual_units" FROM "ai_usage_reservations" r WHERE r."user_id" = $1`,
      [userId]
    );
    expect(state.rows).toEqual([{ status: 'SETTLED', actual_units: 2_500 }]);
    const threads = await db.query(
      `SELECT count(*)::int AS n FROM "chat_threads" WHERE "user_id" = $1`,
      [userId]
    );
    expect(threads.rows[0].n).toBe(0);
  });

  test('a thread goes on: the second question joins it and sees the first', async () => {
    const { w, userId } = await world();
    const first = await run(w, { kind: 'TYPED', clientRequestId: clientId() });
    if (first.kind !== 'REPLY')
      throw new Error('the first question did not become a reply');
    const second = await run(w, {
      kind: 'TYPED',
      threadId: first.result.thread_id,
      clientRequestId: clientId(),
    });
    expect(second.kind).toBe('REPLY');
    const thread = await getThread(userId, first.result.thread_id, {
      client: prisma,
    });
    expect(thread).toMatchObject({ message_count: 4, report_count: 2 });
    // another trader cannot join it: the gate says THREAD_INVALID, with no sign it exists
    const other = await world();
    const refused = await run(other.w, {
      kind: 'TYPED',
      threadId: first.result.thread_id,
      clientRequestId: clientId(),
    });
    expect(refused.kind === 'REFUSED' && refused.refusal.code).toBe(
      'THREAD_INVALID'
    );
    expect(other.w.primary?.count).toBe(0);
  });

  test('deleting the account takes the balance, the thread and the messages, and leaves the audit row', async () => {
    const { w, userId } = await world();
    const out = await run(w, { kind: 'TYPED', clientRequestId: clientId() });
    if (out.kind !== 'REPLY') throw new Error('no reply');
    await db.query(`DELETE FROM "User" WHERE "id" = $1`, [userId]);
    const gone = await db.query(
      `SELECT (SELECT count(*) FROM "chat_threads" WHERE "id" = $1)::int AS threads,
              (SELECT count(*) FROM "chat_messages" WHERE "thread_id" = $1)::int AS messages,
              (SELECT count(*) FROM "ai_usage_reservations" WHERE "user_id" = $2)::int AS holds,
              (SELECT count(*) FROM "ai_quota_periods" WHERE "user_id" = $2)::int AS periods`,
      [out.result.thread_id, userId]
    );
    expect(gone.rows[0]).toEqual({
      threads: 0,
      messages: 0,
      holds: 0,
      periods: 0,
    });
    const row = await readTrace(out.requestId, { client: prisma });
    expect(row).toMatchObject({
      user_id: null,
      outcome: 'REPORT1',
      units_charged: 2_800,
      thread_id: out.result.thread_id,
    });
    expect(row!.user_id_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.key_version).toBe(AUDIT_KEY.version);
  });

  test('deleting a thread takes the thread and its messages and leaves the audit row whole; another trader cannot touch it', async () => {
    const { w, userId } = await world();
    const out = await run(w, { kind: 'TYPED', clientRequestId: clientId() });
    if (out.kind !== 'REPLY') throw new Error('no reply');
    const threadId = out.result.thread_id;
    const stranger = await newUser();

    // another trader's rename and delete find nothing, and change nothing
    await expect(
      renameThread(stranger, threadId, 'mine now', { client: prisma })
    ).resolves.toEqual({ ok: false, code: 'NOT_FOUND' });
    await expect(
      deleteThread(stranger, threadId, { client: prisma })
    ).resolves.toBe(false);
    expect(
      (await getThread(userId, threadId, { client: prisma }))!.title_source
    ).toBe('AUTO');

    // the owner's rename is theirs for good, and their delete takes the thread and its messages
    await expect(
      renameThread(userId, threadId, '  Gold, my way  ', { client: prisma })
    ).resolves.toEqual({ ok: true, title: 'Gold, my way' });
    expect(await getThread(userId, threadId, { client: prisma })).toMatchObject(
      { title: 'Gold, my way', title_source: 'USER' }
    );
    await expect(
      deleteThread(userId, threadId, { client: prisma })
    ).resolves.toBe(true);
    await expect(
      deleteThread(userId, threadId, { client: prisma })
    ).resolves.toBe(false);
    const gone = await db.query(
      `SELECT (SELECT count(*) FROM "chat_threads" WHERE "id" = $1)::int AS threads,
              (SELECT count(*) FROM "chat_messages" WHERE "thread_id" = $1)::int AS messages`,
      [threadId]
    );
    expect(gone.rows[0]).toEqual({ threads: 0, messages: 0 });

    // the audit row is untouched: same user, same reply digest, same thread id as the day it was written
    const row = await readTrace(out.requestId, { client: prisma });
    expect(row).toMatchObject({
      user_id: userId,
      outcome: 'REPORT1',
      units_charged: 2_800,
      thread_id: threadId,
    });
    expect(row!.reply_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  void CLIENT_ID;
});
