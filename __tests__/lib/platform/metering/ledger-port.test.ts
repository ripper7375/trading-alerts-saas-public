/**
 * @jest-environment node
 */

/**
 * The ledger store seen as the meter's port (build step 7 part 6): the month an instant falls in,
 * the allowance as the period's limit, and the store's answers in the port's words.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { LEDGER_SQL } from '@/lib/platform/metering/ledger-store';

import { LedgerModel } from '../helpers/ledger-model';
import { MIN, T0 } from '../helpers/ledger-scenarios';

const USER = 'user-1';
const reserveQuery = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1',
  userId: USER,
  units: 100,
  nowMs: T0,
  expiresAtMs: T0 + 10 * MIN,
  allowanceUnits: 1_000,
  ...over,
});

function world() {
  const model = new LedgerModel();
  model.addUser(USER);
  model.addUser('user-2');
  return { model, port: createLedgerPort({ client: model }) };
}

describe('balance', () => {
  it('is the whole allowance in a month with no row', async () => {
    const { port } = world();
    expect(
      await port.balance({ userId: USER, nowMs: T0, allowanceUnits: 5_000 })
    ).toEqual({ limit: 5_000, used: 0, reserved: 0, available: 5_000 });
  });

  it('is the row’s numbers once there is one', async () => {
    const { port } = world();
    await port.reserve(reserveQuery({ allowanceUnits: 5_000, units: 700 }));
    expect(
      await port.balance({ userId: USER, nowMs: T0, allowanceUnits: 5_000 })
    ).toEqual({ limit: 5_000, used: 0, reserved: 700, available: 4_300 });
  });

  it('follows an allowance that was raised at once, and keeps the row’s limit when it was lowered', async () => {
    const { port } = world();
    await port.reserve(reserveQuery({ allowanceUnits: 5_000, units: 700 }));
    expect(
      await port.balance({ userId: USER, nowMs: T0, allowanceUnits: 8_000 })
    ).toMatchObject({ limit: 8_000, available: 7_300 });
    expect(
      await port.balance({ userId: USER, nowMs: T0, allowanceUnits: 1_000 })
    ).toMatchObject({ limit: 5_000, available: 4_300 });
  });

  it('reads the month of the instant: October’s row is not November’s', async () => {
    const { port } = world();
    await port.reserve(reserveQuery({ allowanceUnits: 5_000, units: 700 }));
    const november = Date.UTC(2026, 10, 1, 0, 0, 0, 0);
    expect(
      await port.balance({
        userId: USER,
        nowMs: november,
        allowanceUnits: 5_000,
      })
    ).toMatchObject({ reserved: 0, available: 5_000 });
  });

  it('reads an instant that is not one as the allowance alone (it asks for no row)', async () => {
    const { model, port } = world();
    expect(
      await port.balance({
        userId: USER,
        nowMs: Number.NaN,
        allowanceUnits: 100,
      })
    ).toMatchObject({ limit: 100, available: 100 });
    expect(model.calls).toEqual([]);
  });

  it('only reads: it makes no row and holds nothing', async () => {
    const { model, port } = world();
    await port.balance({ userId: USER, nowMs: T0, allowanceUnits: 5_000 });
    expect(model.periods.size).toBe(0);
    expect(model.calls.map((c) => c.sql)).toEqual([LEDGER_SQL.readPeriod]);
  });
});

describe('reserve', () => {
  it('passes the allowance as the limit and says what the stored reservation is', async () => {
    const { port } = world();
    expect(await port.reserve(reserveQuery())).toEqual({
      ok: true,
      replayed: false,
      status: 'RESERVED',
      reservedUnits: 100,
      balance: { limit: 1_000, used: 0, reserved: 100, available: 900 },
    });
  });

  it('a retry is a replay, with the stored state and units, and no balance', async () => {
    const { port } = world();
    await port.reserve(reserveQuery());
    await port.settle({
      requestId: 'req-1',
      userId: USER,
      nowMs: T0 + MIN,
      actualUnits: 40,
      costMicroUsd: 40,
      model: null,
      promptTokens: null,
      completionTokens: null,
    });
    expect(await port.reserve(reserveQuery({ units: 999 }))).toEqual({
      ok: true,
      replayed: true,
      status: 'SETTLED',
      reservedUnits: 100,
      balance: null,
    });
  });

  it('refuses with the balance when the allowance cannot hold it', async () => {
    const { port } = world();
    expect(await port.reserve(reserveQuery({ units: 1_001 }))).toEqual({
      ok: false,
      code: 'INSUFFICIENT',
      balance: { limit: 1_000, used: 0, reserved: 0, available: 1_000 },
    });
  });

  it('passes on REQUEST_ID_TAKEN and USER_NOT_FOUND, and calls anything else bad input', async () => {
    const { port } = world();
    await port.reserve(reserveQuery());
    expect(await port.reserve(reserveQuery({ userId: 'user-2' }))).toEqual({
      ok: false,
      code: 'REQUEST_ID_TAKEN',
    });
    expect(
      await port.reserve(reserveQuery({ userId: 'ghost', requestId: 'r2' }))
    ).toEqual({
      ok: false,
      code: 'USER_NOT_FOUND',
    });
    expect(await port.reserve(reserveQuery({ units: 0 }))).toEqual({
      ok: false,
      code: 'BAD_INPUT',
    });
    expect(await port.reserve(reserveQuery({ nowMs: Number.NaN }))).toEqual({
      ok: false,
      code: 'BAD_INPUT',
    });
  });
});

describe('settle', () => {
  const settleQuery = (over: Record<string, unknown> = {}) => ({
    requestId: 'req-1',
    userId: USER,
    nowMs: T0 + MIN,
    actualUnits: 40 as number | null,
    costMicroUsd: 40 as number | null,
    model: 'google/gemini-3.6-flash' as string | null,
    promptTokens: 1 as number | null,
    completionTokens: 1 as number | null,
    ...over,
  });

  it('says what was charged and what was absorbed', async () => {
    const { port } = world();
    await port.reserve(reserveQuery({ units: 100, allowanceUnits: 100 }));
    expect(
      await port.settle(settleQuery({ actualUnits: 130, costMicroUsd: 130 }))
    ).toEqual({
      ok: true,
      replayed: false,
      chargedUnits: 100,
      absorbedUnits: 30,
      balance: { limit: 100, used: 100, reserved: 0, available: 0 },
    });
  });

  it('a second settlement returns the first charge', async () => {
    const { port } = world();
    await port.reserve(reserveQuery());
    await port.settle(settleQuery());
    expect(await port.settle(settleQuery({ actualUnits: 99 }))).toEqual({
      ok: true,
      replayed: true,
      chargedUnits: 40,
      absorbedUnits: 0,
      balance: null,
    });
  });

  it('passes on NOT_FOUND and ALREADY_RELEASED, and calls anything else bad input', async () => {
    const { port } = world();
    expect(await port.settle(settleQuery())).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    await port.reserve(reserveQuery());
    await port.release({ requestId: 'req-1', userId: USER, nowMs: T0 + MIN });
    expect(await port.settle(settleQuery())).toEqual({
      ok: false,
      code: 'ALREADY_RELEASED',
    });
    expect(await port.settle(settleQuery({ requestId: 'a b' }))).toEqual({
      ok: false,
      code: 'BAD_INPUT',
    });
  });
});

describe('release', () => {
  it('says whether it changed anything and the state the reservation is in', async () => {
    const { port } = world();
    await port.reserve(reserveQuery());
    const query = { requestId: 'req-1', userId: USER, nowMs: T0 + MIN };
    expect(await port.release(query)).toEqual({
      ok: true,
      changed: true,
      status: 'RELEASED',
    });
    expect(await port.release(query)).toEqual({
      ok: true,
      changed: false,
      status: 'RELEASED',
    });
    expect(await port.release({ ...query, requestId: 'ghost' })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await port.release({ ...query, requestId: '' })).toEqual({
      ok: false,
      code: 'BAD_INPUT',
    });
  });
});
