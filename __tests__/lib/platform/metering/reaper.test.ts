/**
 * @jest-environment node
 */

/**
 * The reaper of the quota ledger (build step 7 part 6): what it refuses, what it asks, how it reads
 * the answer. What it does to the tables is in `ledger-scenarios.test.ts` (the model) and
 * `__tests__/reply/ledger.pg.spec.ts` (a real server).
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { reserveUnits } from '@/lib/platform/metering/ledger-store';
import {
  REAP_BATCH_DEFAULT,
  REAP_BATCH_MAX,
  REAP_SQL,
  reapExpired,
} from '@/lib/platform/metering/reaper';

import { LedgerModel } from '../helpers/ledger-model';
import { MIN, T0 } from '../helpers/ledger-scenarios';

function scripted(answer: unknown) {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    async $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]) {
      calls.push({ sql, values });
      return answer as T;
    },
  };
}

/** Answers the statements one after the other; the last answer repeats when the list runs out. */
function queued(answers: { expired: number; units_returned: string }[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  return {
    calls,
    async $queryRawUnsafe<T = unknown>(sql: string, ...values: unknown[]) {
      calls.push({ sql, values });
      return [answers[Math.min(calls.length, answers.length) - 1]] as T;
    },
  };
}

describe('reapExpired: what it refuses', () => {
  it.each([
    ['a time that is not an instant', Number.NaN, undefined, ['NOW']],
    ['a time before the ledger’s years', -1, undefined, ['NOW']],
    [
      'a time that is not a number',
      '2026' as unknown as number,
      undefined,
      ['NOW'],
    ],
    ['a batch of zero', T0, 0, ['BATCH']],
    ['a fractional batch', T0, 1.5, ['BATCH']],
    ['a batch above the most', T0, REAP_BATCH_MAX + 1, ['BATCH']],
    ['both', Number.NaN, -3, ['NOW', 'BATCH']],
  ])(
    '%s: BAD_INPUT, and the database is not asked',
    async (_n, now, batch, problems) => {
      const client = scripted([]);
      const result = await reapExpired(now, { client, batch });
      expect(result).toEqual({ ok: false, code: 'BAD_INPUT', problems });
      expect(client.calls).toEqual([]);
    }
  );

  it('accepts the batch limits', async () => {
    const client = scripted([{ expired: 0, units_returned: '0' }]);
    expect(await reapExpired(T0, { client, batch: 1 })).toMatchObject({
      ok: true,
    });
    expect(
      await reapExpired(T0, { client, batch: REAP_BATCH_MAX })
    ).toMatchObject({
      ok: true,
    });
  });
});

describe('reapExpired: how it asks and reads', () => {
  it('sends the time as ISO text and the batch left, and asks again until a statement expires nothing', async () => {
    const client = queued([
      { expired: 3, units_returned: '450' },
      { expired: 0, units_returned: '0' },
    ]);
    const result = await reapExpired(T0 + 6 * MIN, { client });
    expect(result).toEqual({ ok: true, expired: 3, unitsReturned: 450 });
    expect(client.calls).toEqual([
      {
        sql: REAP_SQL,
        values: ['2026-10-15T10:06:00.000Z', REAP_BATCH_DEFAULT],
      },
      {
        sql: REAP_SQL,
        values: ['2026-10-15T10:06:00.000Z', REAP_BATCH_DEFAULT - 3],
      },
    ]);
  });

  it('adds up the periods, one statement for each, and asks for less each time', async () => {
    const client = queued([
      { expired: 2, units_returned: '200' },
      { expired: 3, units_returned: '30' },
    ]);
    expect(await reapExpired(T0, { client, batch: 5 })).toEqual({
      ok: true,
      expired: 5,
      unitsReturned: 230,
    });
    // the batch is used up after the second statement: there is no third
    expect(client.calls.map((c) => c.values[1])).toEqual([5, 3]);
  });

  it('never expires more than the batch, however long the database keeps answering', async () => {
    const client = queued([{ expired: 1, units_returned: '10' }]);
    expect(await reapExpired(T0, { client, batch: 3 })).toEqual({
      ok: true,
      expired: 3,
      unitsReturned: 30,
    });
    expect(client.calls.map((c) => c.values[1])).toEqual([3, 2, 1]);
  });

  it('stops at the first statement that expires nothing', async () => {
    const client = queued([{ expired: 0, units_returned: '0' }]);
    expect(await reapExpired(T0, { client })).toEqual({
      ok: true,
      expired: 0,
      unitsReturned: 0,
    });
    expect(client.calls).toHaveLength(1);
  });

  it('stops when a statement answers with more than it was asked for', async () => {
    const client = queued([{ expired: 10, units_returned: '100' }]);
    expect(await reapExpired(T0, { client, batch: 3 })).toEqual({
      ok: true,
      expired: 10,
      unitsReturned: 100,
    });
    expect(client.calls).toHaveLength(1);
  });

  it('is a statement for ONE period, and picks only rows that are RESERVED and past their deadline', () => {
    expect(REAP_SQL).toContain(
      `r."status" = 'RESERVED' AND r."expires_at" < a."now"`
    );
    expect(REAP_SQL).not.toMatch(/\bDELETE\b/);
    expect(REAP_SQL).toContain(`SET "status" = 'EXPIRED'`);
    expect(REAP_SQL).toContain('SET "reserved" = p."reserved" - pp."units"');
    expect(REAP_SQL).toContain('LIMIT CAST($2 AS integer)');
    expect(REAP_SQL).toContain('SKIP LOCKED');
    // the period of the oldest due row, and only the due rows of that period
    expect(REAP_SQL).toContain('first_due AS (');
    expect(REAP_SQL).toContain('LIMIT 1');
    expect(REAP_SQL).toContain('r."period_id" = f."period_id"');
  });

  it.each([
    [[]],
    [[null]],
    [[{ expired: 'many', units_returned: '1' }]],
    [[{ expired: 1, units_returned: 'lots' }]],
    [[{ expired: 1.5, units_returned: '1' }]],
    [[{ expired: -1, units_returned: '1' }]],
    [[{ expired: 1, units_returned: '-5' }]],
  ])('refuses a result it cannot read: %j', async (answer) => {
    await expect(reapExpired(T0, { client: scripted(answer) })).rejects.toThrow(
      /ledger:/
    );
  });

  it('works on the model: it returns the units of what it expired, period by period', async () => {
    const model = new LedgerModel();
    model.addUser('u1');
    for (const [id, ttl] of [
      ['a', 1],
      ['b', 2],
      ['c', 30],
    ] as const) {
      await reserveUnits(
        {
          requestId: id,
          userId: 'u1',
          month: '2026-10',
          limit: 1_000,
          units: 100,
          nowMs: T0,
          expiresAtMs: T0 + ttl * MIN,
        },
        { client: model }
      );
    }
    expect(await reapExpired(T0 + 5 * MIN, { client: model })).toEqual({
      ok: true,
      expired: 2,
      unitsReturned: 200,
    });
    expect(model.periods.get('u1|2026-10')?.reserved).toBe(100);
  });

  it('on the model, takes the periods oldest deadline first, a statement for each', async () => {
    const model = new LedgerModel();
    model.addUser('u1');
    model.addUser('u2');
    // u1 holds a row due at +3 min and one at +1 min; u2 holds one due at +2 min
    for (const [id, user, ttl] of [
      ['a', 'u1', 3],
      ['b', 'u2', 2],
      ['c', 'u1', 1],
    ] as const) {
      await reserveUnits(
        {
          requestId: id,
          userId: user,
          month: '2026-10',
          limit: 1_000,
          units: 100,
          nowMs: T0,
          expiresAtMs: T0 + ttl * MIN,
        },
        { client: model }
      );
    }
    const before = model.calls.length;
    // batch 1: the oldest due row only, which is u1's "c"
    expect(
      await reapExpired(T0 + 10 * MIN, { client: model, batch: 1 })
    ).toEqual({ ok: true, expired: 1, unitsReturned: 100 });
    expect(model.reservations.get('c')?.status).toBe('EXPIRED');
    expect(model.reservations.get('a')?.status).toBe('RESERVED');
    expect(model.reservations.get('b')?.status).toBe('RESERVED');
    expect(model.calls.length - before).toBe(1);

    // the rest
    const statements = model.calls.length;
    expect(await reapExpired(T0 + 10 * MIN, { client: model })).toEqual({
      ok: true,
      expired: 2,
      unitsReturned: 200,
    });
    // u2's "b" (+2 min) is older than u1's "a" (+3 min): u2 goes first, then u1, then a statement
    // that finds nothing
    expect(model.calls.length - statements).toBe(3);
    expect(model.periods.get('u1|2026-10')?.reserved).toBe(0);
    expect(model.periods.get('u2|2026-10')?.reserved).toBe(0);
  });
});
