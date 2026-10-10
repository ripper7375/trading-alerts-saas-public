/**
 * @jest-environment node
 */

/**
 * The Engine 4 routes against a REAL PostgreSQL (build step 5, part 6): the
 * profile, size and consent routes run for real, with the real generated Prisma
 * client, the real stores and the real tables and triggers of
 * prisma/migrations/20261010000000_add_engine4_tables/migration.sql. Only the edges
 * the scratch database does not have are replaced: the session, Redis, the gateway
 * and the market-database readers (the scratch database holds the user schema only);
 * their answers are the stored 18 Sep 20:55 cycle, as in `__tests__/api/engine4/`.
 *
 * What it adds to the route tests: a consent row written THROUGH THE ROUTE is accepted
 * by every CHECK the migration has (the hash of the setup text, the JSONB copy equal to
 * the text, the filter columns equal to the setup's own), carries the keyed hash of the
 * user id, and survives the deletion of the account with `user_id` NULL and everything
 * else as it was.
 *
 * SKIPPED unless BOTH are set (the same two variables and the same recipe as
 * engine4-tables.pg.spec.ts, see its header and .claude/architecture/database-traps.md):
 *   CYCLE_PG_URL         a postgres URL on localhost or 127.0.0.1 (anything else is refused)
 *   CYCLE_PG_ALLOW_WIPE  "yes": it DELETES every row of the three tables and the users it
 *                        creates (email e4-routes-*@example.test) in that database
 *
 *   CYCLE_PG_URL=postgres://postgres@127.0.0.1:55432/<db> CYCLE_PG_ALLOW_WIPE=yes \
 *     npx jest --testMatch '**\/__tests__/engine4/engine4-routes.pg.spec.ts' --coverage=false
 */

const URL = process.env['CYCLE_PG_URL'] ?? '';
const enabled = URL !== '' && process.env['CYCLE_PG_ALLOW_WIPE'] === 'yes';
if (
  enabled &&
  !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1):\d+\//.test(URL)
) {
  throw new Error('CYCLE_PG_URL must point at localhost or 127.0.0.1');
}
const suite = enabled ? describe : describe.skip;

// the real user-schema client, pointed at the scratch database
jest.mock('@/lib/db/prisma', () => {
  if (
    process.env['CYCLE_PG_URL'] === undefined ||
    process.env['CYCLE_PG_ALLOW_WIPE'] !== 'yes'
  ) {
    return { __esModule: true, prisma: {} };
  }
  const { PrismaClient } = require('.prisma/non-market-client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  return {
    __esModule: true,
    prisma: new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env['CYCLE_PG_URL'] }),
    }),
  };
});
jest.mock('@/lib/auth/session', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .sessionModule()
);
jest.mock('@/lib/redis/client', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .redisModule()
);
jest.mock('@/lib/active-indicator/gateway-client', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .gatewayModule()
);
jest.mock('@/lib/engine4/read/cycle', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .cycleModule()
);
jest.mock('@/lib/engine4/read/specs', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .specsModule()
);
jest.mock('@/lib/engine4/read/events', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .eventsModule()
);
jest.mock('@/lib/engine4/read/bars', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .barsModule()
);
jest.mock('@/lib/engine4/read/synthesis', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .synthesisModule()
);
jest.mock('@/lib/engine4/read/structure-levels', () =>
  jest
    .requireActual<
      typeof import('../api/engine4/helpers/mocks')
    >('../api/engine4/helpers/mocks')
    .structureModule()
);

import type { Client as PgClient } from 'pg';

import * as consentRoute from '@/app/api/engine4/consent/route';
import * as profileRoute from '@/app/api/engine4/profile/route';
import * as sizeRoute from '@/app/api/engine4/size/route';
import { serializeValidatedSetup, validateSetup } from '@/lib/engine4';
import { hashUserId, resolveAuditKey } from '@/lib/engine4/store/user-hash';

import { setup as engineSetup } from '../lib/engine4/helpers/setup';
import { post, resetAll, signIn, world } from '../api/engine4/helpers/mocks';
import { ROOMY, Z1_FIELDS } from '../api/engine4/helpers/world';

const T_PREFS = 'user_trade_preferences';
const T_HISTORY = 'user_trade_preferences_history';
const T_CONSENT = 'trade_consent_records';
const AUDIT_TABLES = [T_HISTORY, T_CONSENT] as const;

type Json = any;

suite('the Engine 4 routes on a real PostgreSQL', () => {
  let db: PgClient;
  let userId: string;
  let n = 0;
  const newId = (): string =>
    `pg-press-${String((n += 1)).padStart(6, '0')}-abcdefgh`;

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
        `DELETE FROM "User" WHERE "email" LIKE 'e4-routes-%@example.test'`
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

  async function newUser(): Promise<string> {
    n += 1;
    const id = `e4-routes-user-${n}`;
    await db.query(
      `INSERT INTO "User" ("id", "email", "updatedAt") VALUES ($1, $2, now())`,
      [id, `e4-routes-${n}@example.test`]
    );
    return id;
  }

  async function sized(over: object = {}): Promise<Json> {
    const response = await sizeRoute.POST(
      post('/api/engine4/size', {
        cycleSlot: world.slot,
        ...Z1_FIELDS,
        ...over,
      })
    );
    return response.json();
  }

  async function press(
    action: string,
    over: object = {},
    extra: { submissionId?: string; shown?: string } = {}
  ): Promise<{ status: number; json: Json }> {
    const shown = extra.shown ?? (await sized(over)).setupSha256;
    const response = await consentRoute.POST(
      post('/api/engine4/consent', {
        action,
        submissionId: extra.submissionId ?? newId(),
        cycleSlot: world.slot,
        ...Z1_FIELDS,
        ...over,
        shownSetupSha256: shown,
      })
    );
    return { status: response.status, json: await response.json() };
  }

  beforeAll(async () => {
    const { Client } = require('pg') as typeof import('pg');
    db = new Client({ connectionString: URL });
    await db.connect();
    await wipe();
  });

  afterAll(async () => {
    await wipe();
    await db.end();
    const { prisma } = require('@/lib/db/prisma');
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => world.nowMs);
    process.env['ENGINE4_REPORT2_ENABLED'] = 'true';
    resetAll();
    await wipe();
    userId = await newUser();
    signIn('PRO', userId);
    const saved = await profileRoute.POST(
      post('/api/engine4/profile', { profile: ROOMY })
    );
    expect(saved.status).toBe(200);
  });

  afterEach(() => jest.restoreAllMocks());

  test('the profile route writes the current profile and its first snapshot, with the keyed hash', async () => {
    const prefs = await db.query(
      `SELECT * FROM "${T_PREFS}" WHERE "user_id" = $1`,
      [userId]
    );
    const history = await db.query(
      `SELECT * FROM "${T_HISTORY}" WHERE "user_id" = $1`,
      [userId]
    );
    expect(prefs.rows).toHaveLength(1);
    expect(history.rows).toHaveLength(1);
    expect(prefs.rows[0].snapshot_id).toBe(history.rows[0].id);
    expect(history.rows[0]).toMatchObject({
      trader_type: 'DAY_TRADER',
      style: 'BOTH',
      max_risk_pct: '1.5',
      max_leverage: '5',
      equity: '10000',
      key_version: 1,
      user_id_hash: hashUserId(userId, resolveAuditKey()).hash,
    });
    // the same profile again writes nothing
    await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY }));
    const again = await db.query(
      `SELECT count(*)::int AS n FROM "${T_HISTORY}"`
    );
    expect(again.rows[0].n).toBe(1);
  });

  test('an invalid profile is refused by the route and nothing reaches the tables', async () => {
    const response = await profileRoute.POST(
      post('/api/engine4/profile', { profile: { ...ROOMY, maxLeverage: '6' } })
    );
    expect(response.status).toBe(422);
    const history = await db.query(
      `SELECT count(*)::int AS n FROM "${T_HISTORY}"`
    );
    expect(history.rows[0].n).toBe(1);
  });

  test('an Accept through the route is one row that every CHECK of the migration let in', async () => {
    const { status, json } = await press('ACCEPT');
    expect(status).toBe(201);
    const rows = await db.query(`SELECT * FROM "${T_CONSENT}"`);
    expect(rows.rows).toHaveLength(1);
    const row = rows.rows[0];
    const engineText = serializeValidatedSetup(
      validateSetup(engineSetup().ctx, Z1_FIELDS)
    );
    expect(row).toMatchObject({
      id: json.consent.id,
      user_id: userId,
      action: 'ACCEPT',
      symbol: 'XAUUSD',
      cycle_slot: world.slot,
      zone_id: 'Z1',
      side: 'BUY',
      synthesis_rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
      synthesis_rules_version: 'draft-1',
      badge: null,
      engine4_version: '1.0.0',
      symbol_specs_version: 3,
      template_version: 'report2-template/draft-1',
      disclaimer_version: 'disclaimer/draft-1',
      language: 'en-US',
      key_version: 1,
      user_id_hash: hashUserId(userId, resolveAuditKey()).hash,
      setup_json: engineText,
      setup_sha256: json.consent.setupSha256,
    });
    // the database's own SHA-256 of the stored text is the hash the route returned
    const hashed = await db.query(
      `SELECT encode(sha256(convert_to("setup_json", 'UTF8')), 'hex') AS h,
              ("setup" = "setup_json"::jsonb) AS same
         FROM "${T_CONSENT}"`
    );
    expect(hashed.rows[0].h).toBe(json.consent.setupSha256);
    expect(hashed.rows[0].same).toBe(true);
    // and it names the snapshot of the profile the setup was validated against
    expect(row.profile_snapshot_id).toBe(
      (
        await db.query(
          `SELECT "snapshot_id" FROM "${T_PREFS}" WHERE "user_id" = $1`,
          [userId]
        )
      ).rows[0].snapshot_id
    );
  });

  test('a double click writes one row and the second press is answered from the first', async () => {
    const submissionId = newId();
    const shown = (await sized()).setupSha256;
    const first = await press('ACCEPT', {}, { submissionId, shown });
    const second = await press('ACCEPT', {}, { submissionId, shown });
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.json.duplicate).toBe(true);
    expect(second.json.consent.id).toBe(first.json.consent.id);
    const count = await db.query(
      `SELECT count(*)::int AS n FROM "${T_CONSENT}"`
    );
    expect(count.rows[0].n).toBe(1);
  });

  test('Modify and Decline are appended, in order, and a failed setup can be declined but not accepted', async () => {
    await press('MODIFY');
    await press('DECLINE', { riskPct: '1.6' });
    const refused = await press('ACCEPT', { riskPct: '1.6' });
    expect(refused.status).toBe(422);
    const rows = await db.query(
      `SELECT "action", ("setup"->>'ok')::boolean AS ok FROM "${T_CONSENT}" ORDER BY "recorded_at", "id"`
    );
    expect(rows.rows.map((r: Json) => [r.action, r.ok]).sort()).toEqual([
      ['DECLINE', false],
      ['MODIFY', true],
    ]);
  });

  test('an override up to Max RPT is in the row`s JSONB, where a reader can query it', async () => {
    await press('ACCEPT', { riskPct: '1.5' });
    const row = await db.query(
      `SELECT "setup"->'overrides'->'defectFlag'->>'chosen' AS chosen,
              "setup"->'overrides'->'defectFlag'->>'preset' AS preset,
              "setup"->'risk'->>'halfRisk' AS half
         FROM "${T_CONSENT}"`
    );
    expect(row.rows[0]).toEqual({
      chosen: '1.5',
      preset: '0.75',
      half: 'true',
    });
  });

  test('a record the route made survives the deletion of the account: user_id NULL, the hash and everything else as it was', async () => {
    await press('ACCEPT');
    const before = (await db.query(`SELECT * FROM "${T_CONSENT}"`)).rows[0];
    const historyBefore = (await db.query(`SELECT * FROM "${T_HISTORY}"`))
      .rows[0];
    await db.query(`DELETE FROM "User" WHERE "id" = $1`, [userId]);
    const after = (await db.query(`SELECT * FROM "${T_CONSENT}"`)).rows[0];
    const historyAfter = (await db.query(`SELECT * FROM "${T_HISTORY}"`))
      .rows[0];
    expect(after.user_id).toBeNull();
    expect(historyAfter.user_id).toBeNull();
    expect({ ...after, user_id: 'x' }).toEqual({ ...before, user_id: 'x' });
    expect({ ...historyAfter, user_id: 'x' }).toEqual({
      ...historyBefore,
      user_id: 'x',
    });
    expect(after.user_id_hash).toBe(hashUserId(userId, resolveAuditKey()).hash);
    // the current profile went with the account
    const prefs = await db.query(`SELECT count(*)::int AS n FROM "${T_PREFS}"`);
    expect(prefs.rows[0].n).toBe(0);
  });

  test('two traders keep their own rows', async () => {
    await press('ACCEPT');
    const other = await newUser();
    signIn('PRO', other);
    await profileRoute.POST(post('/api/engine4/profile', { profile: ROOMY }));
    await press('DECLINE');
    const rows = await db.query(
      `SELECT "user_id", "action" FROM "${T_CONSENT}" ORDER BY "recorded_at", "id"`
    );
    expect(rows.rows.map((r: Json) => [r.user_id, r.action])).toEqual([
      [userId, 'ACCEPT'],
      [other, 'DECLINE'],
    ]);
  });
});
