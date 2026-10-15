/**
 * @jest-environment node
 */

/**
 * Edges of the ledger store that the mutation check found no test for (build step 7 part 6): a bad
 * limit named among other problems, an error that is not a lost race, a refusal that reports the
 * period as it is now, a settlement of zero tokens, and the years the ledger accepts.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import {
  LEDGER_SQL,
  reserveUnits,
  settleReservation,
  type LedgerClient,
} from '@/lib/platform/metering/ledger-store';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { isInstant } from '@/lib/platform/metering/period';
import {
  REAP_BATCH_DEFAULT,
  REAP_BATCH_MAX,
  reapExpired,
} from '@/lib/platform/metering/reaper';

import { LedgerModel, ModelDatabaseError } from '../helpers/ledger-model';
import { MIN, T0 } from '../helpers/ledger-scenarios';

const RESERVE = {
  requestId: 'req-1',
  userId: 'user-1',
  month: '2026-10',
  limit: 1_000,
  units: 100,
  nowMs: T0,
  expiresAtMs: T0 + 10 * MIN,
};

describe('input problems', () => {
  it('names a bad limit together with the others, in the order of the fields', async () => {
    const model = new LedgerModel();
    const result = await reserveUnits(
      {
        ...RESERVE,
        requestId: '',
        userId: '',
        month: 'x',
        limit: -1,
        units: 0,
      },
      { client: model }
    );
    expect(result).toMatchObject({
      ok: false,
      code: 'BAD_INPUT',
      problems: ['REQUEST_ID', 'USER', 'MONTH', 'LIMIT', 'UNITS'],
    });
    expect(model.calls).toEqual([]);
  });

  it('refuses a deadline and a time in the same call, each by its name', async () => {
    const model = new LedgerModel();
    const result = await reserveUnits(
      { ...RESERVE, nowMs: Number.NaN, expiresAtMs: Number.NaN },
      { client: model }
    );
    expect(result).toMatchObject({ problems: ['NOW', 'EXPIRY'] });
  });
});

describe('an error is a lost race only when it is a key violation', () => {
  it('any other error with a reservation already there is rethrown, not read as a retry', async () => {
    const model = new LedgerModel();
    model.addUser('user-1');
    await reserveUnits(RESERVE, { client: model });
    model.failNext = { sql: LEDGER_SQL.reserve, code: '57014' };
    await expect(
      reserveUnits(RESERVE, { client: model })
    ).rejects.toBeInstanceOf(ModelDatabaseError);
  });
});

describe('a refusal reports the balance as it is when the refusal is made', () => {
  it('reads the period again, so a change between the two statements is seen', async () => {
    const period = (reserved: number) => ({
      id: 'p-1',
      user_id: 'user-1',
      month: '2026-10',
      limit: 1_000,
      used: 0,
      reserved,
      created_at: '2026-10-15T10:00:00.000Z',
      updated_at: '2026-10-15T10:00:00.000Z',
    });
    const client: LedgerClient = {
      async $queryRawUnsafe<T = unknown>(sql: string) {
        if (sql === LEDGER_SQL.ensurePeriod) return [period(0)] as T;
        if (sql === LEDGER_SQL.readPeriod) return [period(700)] as T;
        return [] as T;
      },
    };
    expect(await reserveUnits(RESERVE, { client })).toEqual({
      ok: false,
      code: 'INSUFFICIENT',
      balance: { limit: 1_000, used: 0, reserved: 700, available: 300 },
    });
  });

  it('falls back to the period it made when the row cannot be read again', async () => {
    const period = {
      id: 'p-1',
      user_id: 'user-1',
      month: '2026-10',
      limit: 1_000,
      used: 0,
      reserved: 250,
      created_at: '2026-10-15T10:00:00.000Z',
      updated_at: '2026-10-15T10:00:00.000Z',
    };
    const client: LedgerClient = {
      async $queryRawUnsafe<T = unknown>(sql: string) {
        return (sql === LEDGER_SQL.ensurePeriod ? [period] : []) as T;
      },
    };
    expect(await reserveUnits(RESERVE, { client })).toMatchObject({
      ok: false,
      code: 'INSUFFICIENT',
      balance: { reserved: 250, available: 750 },
    });
  });
});

describe('a settlement may report no tokens at all', () => {
  it('accepts zero tokens and a cost of zero', async () => {
    const model = new LedgerModel();
    model.addUser('user-1');
    await reserveUnits(RESERVE, { client: model });
    expect(
      await settleReservation(
        {
          requestId: 'req-1',
          userId: 'user-1',
          actualUnits: 0,
          costMicroUsd: 0,
          model: null,
          promptTokens: 0,
          completionTokens: 0,
          nowMs: T0 + MIN,
        },
        { client: model }
      )
    ).toMatchObject({
      ok: true,
      reservation: { actual_units: 0, prompt_tokens: 0, completion_tokens: 0 },
    });
  });
});

describe('the years of the ledger', () => {
  it('holds a time from the first millisecond of 2000 to the last of 9998', () => {
    expect(isInstant(Date.UTC(1999, 11, 31, 23, 59, 59, 999))).toBe(false);
    expect(isInstant(Date.UTC(2000, 0, 1))).toBe(true);
    expect(isInstant(Date.UTC(9998, 11, 31, 23, 59, 59, 999))).toBe(true);
    expect(isInstant(Date.UTC(9999, 0, 1))).toBe(false);
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '2026',
      null,
      undefined,
      {},
    ]) {
      expect(isInstant(bad)).toBe(false);
    }
  });

  it('the store refuses a time outside them and accepts the edges, as the reaper does', async () => {
    const model = new LedgerModel();
    model.addUser('user-1');
    const at = (nowMs: number) =>
      reserveUnits(
        {
          ...RESERVE,
          requestId: `r-${nowMs}`,
          nowMs,
          expiresAtMs: nowMs + MIN,
        },
        { client: model }
      );
    expect(await at(Date.UTC(1999, 11, 31, 23, 59, 59, 999))).toMatchObject({
      ok: false,
      code: 'BAD_INPUT',
      problems: expect.arrayContaining(['NOW']),
    });
    expect(await at(Date.UTC(2000, 0, 1))).toMatchObject({ ok: true });
  });
});

describe('the port reads a month with no row as the whole allowance, whatever it is', () => {
  it('an allowance of nothing is a balance of nothing, and one of one unit is one unit', async () => {
    const model = new LedgerModel();
    model.addUser('user-1');
    const port = createLedgerPort({ client: model });
    expect(
      await port.balance({ userId: 'user-1', nowMs: T0, allowanceUnits: 0 })
    ).toEqual({ limit: 0, used: 0, reserved: 0, available: 0 });
    expect(
      await port.balance({ userId: 'user-1', nowMs: T0, allowanceUnits: 1 })
    ).toEqual({ limit: 1, used: 0, reserved: 0, available: 1 });
  });
});

describe('the reaper’s limits are the figures the runbook names', () => {
  it('a run expires at most 500 reservations by default and 5,000 at the most', async () => {
    expect(REAP_BATCH_DEFAULT).toBe(500);
    expect(REAP_BATCH_MAX).toBe(5_000);
    const model = new LedgerModel();
    expect(await reapExpired(T0, { client: model })).toMatchObject({
      ok: true,
    });
    expect(model.calls[0]!.values[1]).toBe(500);
    expect(
      await reapExpired(T0, { client: model, batch: 5_000 })
    ).toMatchObject({ ok: true });
    expect(
      await reapExpired(T0, { client: model, batch: 5_001 })
    ).toMatchObject({
      ok: false,
      problems: ['BATCH'],
    });
  });
});
