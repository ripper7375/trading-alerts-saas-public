/**
 * @jest-environment node
 */

/**
 * The ledger store (build step 7 part 6): what it asks of the database, what it refuses before
 * asking, and how it reads the answer. The state machine and the arithmetic are in
 * `ledger-scenarios.test.ts` (and, against a real server, `__tests__/reply/ledger.pg.spec.ts`);
 * this file holds the store's own logic.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { ID, MODEL_SLUG } from '@/lib/reply/contracts/fields';
import {
  LEDGER_MODEL_SLUG,
  LEDGER_REQUEST_ID,
  LEDGER_SQL,
  MAX_LEDGER_UNITS,
  RESERVATION_STATUSES,
  auditPeriod,
  balanceOf,
  ensurePeriod,
  isForeignKeyViolation,
  isUniqueViolation,
  periodFrom,
  readPeriod,
  releaseReservation,
  reservationFrom,
  reserveUnits,
  settleReservation,
  type LedgerClient,
} from '@/lib/platform/metering/ledger-store';
import { REAP_SQL } from '@/lib/platform/metering/reaper';

import { LedgerModel, ModelDatabaseError } from '../helpers/ledger-model';
import { MIN, T0 } from '../helpers/ledger-scenarios';

const USER = 'user-1';
const RESERVE = {
  requestId: 'req-1',
  userId: USER,
  month: '2026-10',
  limit: 1_000,
  units: 100,
  nowMs: T0,
  expiresAtMs: T0 + 10 * MIN,
};
const SETTLE = {
  requestId: 'req-1',
  userId: USER,
  actualUnits: 50,
  costMicroUsd: 50,
  model: 'google/gemini-3.6-flash',
  promptTokens: 10,
  completionTokens: 5,
  nowMs: T0 + MIN,
};

/** A client that records what it is asked and answers from a script. */
function scripted(
  answer: (sql: string, values: unknown[]) => unknown
): LedgerClient & { calls: { sql: string; values: unknown[] }[] } {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    async $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]) {
      calls.push({ sql, values });
      return answer(sql, values) as T;
    },
  };
}

describe('the bounds are the database’s and the contracts’', () => {
  it('uses the contracts’ id and model-slug patterns', () => {
    expect(LEDGER_REQUEST_ID.source).toBe(ID.source);
    expect(LEDGER_MODEL_SLUG.source).toBe(MODEL_SLUG.source);
  });

  it('allows at most 2,000,000,000 units, inside a 32-bit integer', () => {
    expect(MAX_LEDGER_UNITS).toBe(2_000_000_000);
    expect(MAX_LEDGER_UNITS).toBeLessThan(2 ** 31);
  });

  it('knows the four states of a reservation', () => {
    expect(RESERVATION_STATUSES).toEqual([
      'RESERVED',
      'SETTLED',
      'RELEASED',
      'EXPIRED',
    ]);
  });
});

describe('the statements', () => {
  const all: [string, string][] = [
    ...Object.entries(LEDGER_SQL),
    ['REAP_SQL', REAP_SQL],
  ];

  it.each(all)(
    '%s is plain text with numbered parameters: no value is ever interpolated',
    (_name, sql) => {
      expect(sql).not.toContain('${');
      expect(sql).not.toMatch(/\bundefined\b|\[object Object\]/);
      // the only literals are the fixed words of the state machine and the time zone
      const literals = [...sql.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      for (const literal of literals) {
        expect([
          'RESERVED',
          'SETTLED',
          'RELEASED',
          'EXPIRED',
          'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"',
        ]).toContain(literal);
      }
    }
  );

  it('every statement that takes a trader’s id scopes by it', () => {
    expect(LEDGER_SQL.readPeriod).toContain('p."user_id" = $1::text');
    expect(LEDGER_SQL.reserve).toContain('p."user_id" = a."user_id"');
    expect(LEDGER_SQL.settle).toContain('r."user_id" = a."user_id"');
    expect(LEDGER_SQL.release).toContain('r."user_id" = a."user_id"');
    expect(LEDGER_SQL.audit).toContain('p."user_id" = $1::text');
  });

  it('holds the units and makes the row in ONE statement, under the allowance check', () => {
    const sql = LEDGER_SQL.reserve;
    // the check is in the UPDATE's WHERE: used + reserved + n <= limit, in 64 bits
    expect(sql).toMatch(
      /UPDATE "ai_quota_periods" AS p[\s\S]*SET "reserved" = p\."reserved" \+ a\."units"/
    );
    expect(sql).toContain(
      'p."used"::bigint + p."reserved"::bigint + a."units"::bigint <= p."limit"::bigint'
    );
    // the insert is FROM the update's RETURNING, so the row exists exactly when the units were held
    expect(sql).toMatch(
      /INSERT INTO "ai_usage_reservations"[\s\S]*FROM bumped b/
    );
    // a retry finds its own row and holds nothing more
    expect(sql).toContain(
      'NOT EXISTS (SELECT 1 FROM "ai_usage_reservations" e'
    );
    // one statement
    expect(sql.trim().endsWith(';')).toBe(false);
  });

  it('settles from the locked rows: the reservation, then the period, in that order', () => {
    const sql = LEDGER_SQL.settle;
    expect(sql.indexOf('FOR UPDATE OF r')).toBeGreaterThan(0);
    expect(sql.indexOf('FOR UPDATE OF p')).toBeGreaterThan(
      sql.indexOf('FOR UPDATE OF r')
    );
    // only a RESERVED or an EXPIRED row settles
    expect(sql).toContain(`r."status" IN ('RESERVED', 'EXPIRED')`);
    // the charge is capped by what the balance has left after the hold is given back
    expect(sql).toMatch(
      /LEAST\(\s*COALESCE\(a\."actual", l\."reserved_units"\)::bigint/
    );
    expect(sql).toContain('GREATEST(');
  });

  it('releases only a RESERVED row, and the reaper only a RESERVED row past its deadline', () => {
    expect(LEDGER_SQL.release).toContain(`r."status" = 'RESERVED'`);
    expect(REAP_SQL).toContain(
      `r."status" = 'RESERVED' AND r."expires_at" < a."now"`
    );
    expect(REAP_SQL).toContain('FOR UPDATE OF r SKIP LOCKED');
  });

  it('writes no time of its own: the clock is an argument', () => {
    for (const [, sql] of all) {
      expect(sql).not.toMatch(/\bnow\(\)|CURRENT_TIMESTAMP|clock_timestamp/i);
    }
  });

  it('lets the database make the ids, not JavaScript', () => {
    expect(LEDGER_SQL.ensurePeriod).toContain('gen_random_uuid()');
  });
});

describe('reserveUnits: what it refuses before it asks', () => {
  const bad: [string, Partial<typeof RESERVE>, string][] = [
    ['an empty request id', { requestId: '' }, 'REQUEST_ID'],
    ['a request id with a space', { requestId: 'a b' }, 'REQUEST_ID'],
    [
      'a request id of 65 characters',
      { requestId: 'x'.repeat(65) },
      'REQUEST_ID',
    ],
    [
      'an SQL-looking request id',
      { requestId: `x'; DROP TABLE y; --` },
      'REQUEST_ID',
    ],
    ['no user', { userId: '' }, 'USER'],
    ['a user id of 129 characters', { userId: 'u'.repeat(129) }, 'USER'],
    ['a month of 13', { month: '2026-13' }, 'MONTH'],
    ['a month with a day', { month: '2026-10-01' }, 'MONTH'],
    ['a negative limit', { limit: -1 }, 'LIMIT'],
    ['a limit above the bound', { limit: MAX_LEDGER_UNITS + 1 }, 'LIMIT'],
    ['a fractional limit', { limit: 10.5 }, 'LIMIT'],
    ['zero units', { units: 0 }, 'UNITS'],
    ['negative units', { units: -5 }, 'UNITS'],
    ['units above the bound', { units: MAX_LEDGER_UNITS + 1 }, 'UNITS'],
    ['fractional units', { units: 1.5 }, 'UNITS'],
    ['NaN units', { units: Number.NaN }, 'UNITS'],
    ['a time that is not an instant', { nowMs: Number.NaN }, 'NOW'],
    ['a time before the ledger’s years', { nowMs: -1 }, 'NOW'],
    ['a deadline that is not after now', { expiresAtMs: T0 }, 'EXPIRY'],
    ['a deadline before now', { expiresAtMs: T0 - 1 }, 'EXPIRY'],
  ];

  it.each(bad)(
    '%s: BAD_INPUT, and the database is not asked',
    async (_n, over, problem) => {
      const client = scripted(() => {
        throw new Error('the database must not be asked');
      });
      const result = await reserveUnits({ ...RESERVE, ...over }, { client });
      expect(result).toMatchObject({ ok: false, code: 'BAD_INPUT' });
      expect((result as { problems: string[] }).problems).toContain(problem);
      expect(client.calls).toEqual([]);
    }
  );

  it('accepts a user id of 128 characters and refuses one of 129', async () => {
    const model = new LedgerModel();
    const longest = 'u'.repeat(128);
    model.addUser(longest);
    expect(
      await reserveUnits({ ...RESERVE, userId: longest }, { client: model })
    ).toMatchObject({ ok: true });
    expect(
      await reserveUnits(
        { ...RESERVE, requestId: 'req-2', userId: 'u'.repeat(129) },
        { client: model }
      )
    ).toMatchObject({ ok: false, code: 'BAD_INPUT' });
  });

  it('names every problem at once', async () => {
    const client = scripted(() => []);
    const result = await reserveUnits(
      { ...RESERVE, requestId: '', userId: '', units: 0, month: 'x' },
      { client }
    );
    expect((result as { problems: string[] }).problems).toEqual([
      'REQUEST_ID',
      'USER',
      'MONTH',
      'UNITS',
    ]);
  });

  it('accepts the boundaries: one unit, the largest hold, a limit of zero', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    expect(
      await reserveUnits({ ...RESERVE, units: 1, limit: 0 }, { client: model })
    ).toMatchObject({ ok: false, code: 'INSUFFICIENT' });
    expect(
      await reserveUnits(
        {
          ...RESERVE,
          requestId: 'req-2',
          units: MAX_LEDGER_UNITS,
          limit: MAX_LEDGER_UNITS,
        },
        { client: model }
      )
    ).toMatchObject({ ok: true, balance: { available: 0 } });
  });
});

describe('reserveUnits: how it asks', () => {
  it('makes the period, then holds, passing every value as a parameter in the order the statement numbers them', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits(RESERVE, { client: model });
    expect(model.calls.map((c) => c.sql)).toEqual([
      LEDGER_SQL.ensurePeriod,
      LEDGER_SQL.reserve,
    ]);
    expect(model.calls[0]!.values).toEqual([
      USER,
      '2026-10',
      1_000,
      '2026-10-15T10:00:00.000Z',
    ]);
    const [user, periodId, units, requestId, now, expires] = model.calls[1]!
      .values as string[];
    expect(user).toBe(USER);
    expect(periodId).toMatch(/^period-/);
    expect(units).toBe(100);
    expect(requestId).toBe('req-1');
    expect(now).toBe('2026-10-15T10:00:00.000Z');
    expect(expires).toBe('2026-10-15T10:10:00.000Z');
  });

  it('reports the balance after the hold', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    expect(await reserveUnits(RESERVE, { client: model })).toMatchObject({
      ok: true,
      replayed: false,
      balance: { limit: 1_000, used: 0, reserved: 100, available: 900 },
      reservation: {
        request_id: 'req-1',
        user_id: USER,
        reserved_units: 100,
        status: 'RESERVED',
        actual_units: null,
      },
    });
  });

  it('on a refusal reads the period again, so the balance it reports is the current one', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits(
      { ...RESERVE, requestId: 'a', units: 900 },
      { client: model }
    );
    const result = await reserveUnits(
      { ...RESERVE, requestId: 'b', units: 200 },
      { client: model }
    );
    expect(result).toEqual({
      ok: false,
      code: 'INSUFFICIENT',
      balance: { limit: 1_000, used: 0, reserved: 900, available: 100 },
    });
    expect(model.calls.at(-1)!.sql).toBe(LEDGER_SQL.readPeriod);
  });

  it('when two requests with one id raced and the insert failed, it finds the row that won (a replay)', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    // the first request holds; the second one's statement fails on the key, as PostgreSQL would
    await reserveUnits(RESERVE, { client: model });
    model.failNext = { sql: LEDGER_SQL.reserve, code: '23505' };
    const result = await reserveUnits(RESERVE, { client: model });
    expect(result).toMatchObject({
      ok: true,
      replayed: true,
      reservation: { request_id: 'req-1', status: 'RESERVED' },
    });
  });

  it('and when the id that won is another trader’s, it is REQUEST_ID_TAKEN', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    model.addUser('user-2');
    await reserveUnits(RESERVE, { client: model });
    model.failNext = { sql: LEDGER_SQL.reserve, code: '23505' };
    expect(
      await reserveUnits({ ...RESERVE, userId: 'user-2' }, { client: model })
    ).toEqual({ ok: false, code: 'REQUEST_ID_TAKEN' });
  });

  it('a key violation with no row to explain it is an error, not a guess', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    model.failNext = { sql: LEDGER_SQL.reserve, code: '23505' };
    await expect(
      reserveUnits(RESERVE, { client: model })
    ).rejects.toBeInstanceOf(ModelDatabaseError);
  });

  it('a trader who is gone is USER_NOT_FOUND, at the period and at the hold', async () => {
    const model = new LedgerModel();
    expect(await reserveUnits(RESERVE, { client: model })).toEqual({
      ok: false,
      code: 'USER_NOT_FOUND',
    });
    model.addUser(USER);
    model.failNext = { sql: LEDGER_SQL.reserve, code: '23503' };
    expect(await reserveUnits(RESERVE, { client: model })).toEqual({
      ok: false,
      code: 'USER_NOT_FOUND',
    });
  });

  it('any other database error passes through', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    model.failNext = { sql: LEDGER_SQL.reserve, code: '57014' };
    await expect(reserveUnits(RESERVE, { client: model })).rejects.toThrow(
      /57014/
    );
  });

  it('refuses a row it cannot read rather than guess', async () => {
    const client = scripted((sql) =>
      sql === LEDGER_SQL.ensurePeriod ? [{ id: 'p' }] : []
    );
    await expect(reserveUnits(RESERVE, { client })).rejects.toThrow(/ledger:/);
  });
});

describe('ensurePeriod and readPeriod', () => {
  it('refuse what the database would, without asking', async () => {
    const client = scripted(() => {
      throw new Error('the database must not be asked');
    });
    const base = { userId: USER, month: '2026-10', limit: 100, nowMs: T0 };
    expect(
      await ensurePeriod({ ...base, userId: '' }, { client })
    ).toMatchObject({
      problems: ['USER'],
    });
    expect(
      await ensurePeriod({ ...base, month: 'oct' }, { client })
    ).toMatchObject({
      problems: ['MONTH'],
    });
    expect(
      await ensurePeriod({ ...base, limit: -1 }, { client })
    ).toMatchObject({
      problems: ['LIMIT'],
    });
    expect(
      await ensurePeriod({ ...base, nowMs: Number.NaN }, { client })
    ).toMatchObject({
      problems: ['NOW'],
    });
    expect(await readPeriod('', '2026-10', { client })).toBeNull();
    expect(await readPeriod(USER, 'oct', { client })).toBeNull();
    expect(client.calls).toEqual([]);
  });

  it('readPeriod is null for a month with no row, and the row when there is one', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    expect(await readPeriod(USER, '2026-10', { client: model })).toBeNull();
    await ensurePeriod(
      { userId: USER, month: '2026-10', limit: 100, nowMs: T0 },
      { client: model }
    );
    expect(await readPeriod(USER, '2026-10', { client: model })).toMatchObject({
      user_id: USER,
      month: '2026-10',
      limit: 100,
      used: 0,
      reserved: 0,
    });
  });
});

describe('settleReservation', () => {
  const bad: [string, Partial<typeof SETTLE>, string][] = [
    ['a bad request id', { requestId: 'a b' }, 'REQUEST_ID'],
    ['no user', { userId: '' }, 'USER'],
    ['negative units', { actualUnits: -1 }, 'ACTUAL_UNITS'],
    ['fractional units', { actualUnits: 1.5 }, 'ACTUAL_UNITS'],
    [
      'units above the bound',
      { actualUnits: MAX_LEDGER_UNITS + 1 },
      'ACTUAL_UNITS',
    ],
    ['a negative cost', { costMicroUsd: -1 }, 'COST'],
    ['a cost above the bound', { costMicroUsd: MAX_LEDGER_UNITS + 1 }, 'COST'],
    ['a model that is not a slug', { model: 'bad slug' }, 'MODEL'],
    ['a negative token count', { promptTokens: -1 }, 'TOKENS'],
    ['a fractional token count', { completionTokens: 0.5 }, 'TOKENS'],
    ['a time that is not an instant', { nowMs: Number.NaN }, 'NOW'],
  ];

  it.each(bad)(
    '%s: BAD_INPUT, and the database is not asked',
    async (_n, over, problem) => {
      const client = scripted(() => {
        throw new Error('the database must not be asked');
      });
      const result = await settleReservation(
        { ...SETTLE, ...over },
        { client }
      );
      expect(result).toMatchObject({ ok: false, code: 'BAD_INPUT' });
      expect((result as { problems: string[] }).problems).toContain(problem);
      expect(client.calls).toEqual([]);
    }
  );

  it('accepts a null cost, a null model, null tokens and null units (the whole reservation is charged)', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits(RESERVE, { client: model });
    expect(
      await settleReservation(
        {
          ...SETTLE,
          actualUnits: null,
          costMicroUsd: null,
          model: null,
          promptTokens: null,
          completionTokens: null,
        },
        { client: model }
      )
    ).toMatchObject({
      ok: true,
      absorbedUnits: 0,
      reservation: { actual_units: 100, cost_micro_usd: null, model: null },
    });
  });

  it('passes every value as a parameter, in the statement’s order', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits(RESERVE, { client: model });
    model.calls.length = 0;
    await settleReservation(SETTLE, { client: model });
    expect(model.calls).toEqual([
      {
        sql: LEDGER_SQL.settle,
        values: [
          'req-1',
          USER,
          50,
          50,
          'google/gemini-3.6-flash',
          10,
          5,
          '2026-10-15T10:01:00.000Z',
        ],
      },
    ]);
  });

  it('reports the cost the balance could not take as absorbed', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits({ ...RESERVE, units: 1_000 }, { client: model });
    expect(
      await settleReservation(
        { ...SETTLE, actualUnits: 1_400, costMicroUsd: 1_400 },
        { client: model }
      )
    ).toMatchObject({
      ok: true,
      absorbedUnits: 400,
      reservation: { actual_units: 1_000, cost_micro_usd: 1_400 },
    });
  });

  it('a settlement that moved nothing on a settleable row is an error: it says so loudly', async () => {
    const reserved = {
      request_id: 'req-1',
      user_id: USER,
      period_id: 'p',
      reserved_units: 100,
      status: 'RESERVED',
      actual_units: null,
      cost_micro_usd: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
      created_at: '2026-10-15T10:00:00.000Z',
      updated_at: '2026-10-15T10:00:00.000Z',
      expires_at: '2026-10-15T10:10:00.000Z',
    };
    const client = scripted((sql) =>
      sql === LEDGER_SQL.readReservation ? [reserved] : []
    );
    await expect(settleReservation(SETTLE, { client })).rejects.toThrow(
      /settle moved nothing for a RESERVED reservation/
    );
  });
});

describe('releaseReservation', () => {
  it('refuses what the database would, without asking', async () => {
    const client = scripted(() => {
      throw new Error('the database must not be asked');
    });
    expect(
      await releaseReservation(
        { requestId: '', userId: USER, nowMs: T0 },
        { client }
      )
    ).toMatchObject({ code: 'BAD_INPUT', problems: ['REQUEST_ID'] });
    expect(
      await releaseReservation(
        { requestId: 'r', userId: '', nowMs: T0 },
        { client }
      )
    ).toMatchObject({ problems: ['USER'] });
    expect(
      await releaseReservation(
        { requestId: 'r', userId: USER, nowMs: Number.NaN },
        { client }
      )
    ).toMatchObject({ problems: ['NOW'] });
    expect(client.calls).toEqual([]);
  });

  it('reports the balance when it released, and nothing when it did not', async () => {
    const model = new LedgerModel();
    model.addUser(USER);
    await reserveUnits(RESERVE, { client: model });
    const input = { requestId: 'req-1', userId: USER, nowMs: T0 + MIN };
    expect(await releaseReservation(input, { client: model })).toMatchObject({
      ok: true,
      changed: true,
      balance: { used: 0, reserved: 0, available: 1_000 },
    });
    expect(await releaseReservation(input, { client: model })).toMatchObject({
      ok: true,
      changed: false,
      balance: null,
    });
  });
});

describe('auditPeriod', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    limit: 1_000,
    used: 250,
    reserved: 100,
    held_by_reservations: '100',
    charged_by_settlements: '250',
    ...over,
  });

  it('is null for a period that does not exist and for a bad key, without asking', async () => {
    const model = new LedgerModel();
    expect(await auditPeriod(USER, '2026-10', { client: model })).toBeNull();
    const client = scripted(() => {
      throw new Error('the database must not be asked');
    });
    expect(await auditPeriod('', '2026-10', { client })).toBeNull();
    expect(await auditPeriod(USER, 'x', { client })).toBeNull();
  });

  it('is consistent when the sums match', async () => {
    const client = scripted(() => [row()]);
    expect(await auditPeriod(USER, '2026-10', { client })).toEqual({
      consistent: true,
      problems: [],
      limit: 1_000,
      used: 250,
      reserved: 100,
      heldByReservations: 100,
      chargedBySettlements: 250,
    });
  });

  it.each([
    [{ reserved: 101 }, /reserved 101 is not the 100/],
    [{ used: 251 }, /used 251 is not the 250/],
    [{ limit: 300, used: 250, reserved: 100 }, /is above the limit 300/],
  ])('names the problem of %j', async (over, message) => {
    const client = scripted(() => [row(over)]);
    const audit = await auditPeriod(USER, '2026-10', { client });
    expect(audit?.consistent).toBe(false);
    expect(audit?.problems.join('\n')).toMatch(message);
  });

  it('reads the sums the database sends as text', async () => {
    const client = scripted(() => [
      row({
        held_by_reservations: '0',
        charged_by_settlements: '0',
        used: 0,
        reserved: 0,
      }),
    ]);
    expect((await auditPeriod(USER, '2026-10', { client }))?.consistent).toBe(
      true
    );
  });
});

describe('balanceOf', () => {
  it('is what a new request may still hold, never below zero', () => {
    expect(balanceOf({ limit: 1_000, used: 250, reserved: 100 })).toEqual({
      limit: 1_000,
      used: 250,
      reserved: 100,
      available: 650,
    });
    expect(balanceOf({ limit: 100, used: 90, reserved: 90 }).available).toBe(0);
    expect(balanceOf({ limit: 0, used: 0, reserved: 0 }).available).toBe(0);
  });
});

describe('reading a row', () => {
  const period = {
    id: 'p',
    user_id: USER,
    month: '2026-10',
    limit: 1_000,
    used: 1,
    reserved: 2,
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:01:00.000Z',
  };

  it('turns a period’s timestamps into Dates and keeps its numbers', () => {
    const row = periodFrom(period);
    expect(row.created_at).toEqual(new Date('2026-10-15T10:00:00.000Z'));
    expect(row.limit).toBe(1_000);
  });

  it('accepts the numbers a driver may send as BigInt or digits, and refuses anything else', () => {
    expect(periodFrom({ ...period, used: BigInt(7) }).used).toBe(7);
    expect(periodFrom({ ...period, used: '9' }).used).toBe(9);
    expect(() => periodFrom({ ...period, used: 1.5 })).toThrow(/whole number/);
    expect(() => periodFrom({ ...period, used: 'x' })).toThrow(/whole number/);
    expect(() => periodFrom({ ...period, used: null })).toThrow(/whole number/);
    expect(() => periodFrom({ ...period, month: 7 })).toThrow(/not text/);
    expect(() => periodFrom({ ...period, created_at: 'not a time' })).toThrow(
      /not a time/
    );
    expect(() => periodFrom({ ...period, created_at: 7 })).toThrow(
      /not a time/
    );
    expect(() => periodFrom(null)).toThrow(/not an object/);
    expect(() => periodFrom([])).toThrow(/not an object/);
  });

  it('refuses a reservation with a status it does not know', () => {
    const reservation = {
      request_id: 'r',
      user_id: USER,
      period_id: 'p',
      reserved_units: 1,
      status: 'RESERVED',
      actual_units: null,
      cost_micro_usd: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
      created_at: '2026-10-15T10:00:00.000Z',
      updated_at: '2026-10-15T10:00:00.000Z',
      expires_at: '2026-10-15T10:10:00.000Z',
    };
    expect(reservationFrom(reservation).status).toBe('RESERVED');
    expect(reservationFrom({ ...reservation, model: 'a/b' }).model).toBe('a/b');
    expect(
      reservationFrom({ ...reservation, model: undefined }).model
    ).toBeNull();
    expect(() => reservationFrom({ ...reservation, status: 'DONE' })).toThrow(
      /status that is not known/
    );
    expect(() =>
      reservationFrom({ ...reservation, status: undefined })
    ).toThrow(/status that is not known/);
    expect(() => reservationFrom({ ...reservation, model: 7 })).toThrow(
      /not text/
    );
    expect(() => reservationFrom('row')).toThrow(/not an object/);
  });
});

describe('recognising the database’s errors in the shapes the driver wraps them in', () => {
  const unique = [
    { code: '23505' },
    { code: 'P2002' },
    { code: 'P2010', meta: { code: '23505' } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '23505' } } },
    },
    { cause: { code: '23505' } },
    { message: 'Raw query failed. Code: `23505`. Message: `duplicate key`' },
  ];
  const foreign = [
    { code: '23503' },
    { code: 'P2010', meta: { code: '23503' } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '23503' } } },
    },
    { cause: { sqlState: '23503' } },
    { message: 'Raw query failed. Code: `23503`.' },
  ];

  it.each(unique)('knows a unique violation in %j', (error) => {
    expect(isUniqueViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error)).toBe(false);
  });

  it.each(foreign)('knows a foreign-key violation in %j', (error) => {
    expect(isForeignKeyViolation(error)).toBe(true);
    expect(isUniqueViolation(error)).toBe(false);
  });

  it.each([
    null,
    undefined,
    'text',
    7,
    {},
    { code: '23514' },
    { code: 'P2025' },
    { message: 'timeout' },
  ])('knows neither in %p', (error) => {
    expect(isUniqueViolation(error)).toBe(false);
    expect(isForeignKeyViolation(error)).toBe(false);
  });

  it('stops looking at a depth of 5, so a cycle cannot hang it', () => {
    const loop: Record<string, unknown> = {};
    loop['cause'] = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });

  it('looks five levels down and no further', () => {
    const nested = (levels: number, code: string): unknown => {
      let error: Record<string, unknown> = { code };
      for (let i = 0; i < levels; i += 1) error = { cause: error };
      return error;
    };
    expect(isUniqueViolation(nested(5, '23505'))).toBe(true);
    expect(isUniqueViolation(nested(6, '23505'))).toBe(false);
    expect(isForeignKeyViolation(nested(5, '23503'))).toBe(true);
    expect(isForeignKeyViolation(nested(6, '23503'))).toBe(false);
  });
});
