/**
 * The scenarios of the quota ledger, written once and run twice: against the in-memory model of
 * `ledger-model.ts` on every run of the suite (`metering/ledger-scenarios.test.ts`), and against
 * a REAL PostgreSQL by the gated `__tests__/reply/ledger.pg.spec.ts`. The same expectations on both
 * are what shows the model is faithful and the database does what the design says.
 *
 * Every scenario ends by auditing the periods it touched: the invariant that no CHECK can see
 * (`reserved` is what the RESERVED reservations hold, `used` is what the SETTLED ones charged).
 */

import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import {
  auditPeriod,
  LEDGER_SQL,
  ensurePeriod,
  readPeriod,
  releaseReservation,
  reserveUnits,
  settleReservation,
  type LedgerClient,
} from '@/lib/platform/metering/ledger-store';
import { monthOf } from '@/lib/platform/metering/period';
import { reapExpired } from '@/lib/platform/metering/reaper';

export interface ScenarioEnv {
  client: LedgerClient;
  /** a user that exists (a row of "User" in the database) */
  newUser(): Promise<string>;
  deleteUser(userId: string): Promise<void>;
  countRows(userId: string): Promise<{ periods: number; reservations: number }>;
}

export interface Scenario {
  name: string;
  run(env: ScenarioEnv): Promise<void>;
}

/** 2026-10-15 10:00:00 UTC. */
export const T0 = Date.UTC(2026, 9, 15, 10, 0, 0);
export const MIN = 60_000;
export const OCT = '2026-10';
export const NOV = '2026-11';

let sequence = 0;
/** A request id that no other scenario (or earlier run) used: the table's key is global. */
export const requestId = (prefix = 'req'): string => {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
};

export async function expectConsistent(
  env: ScenarioEnv,
  userId: string,
  month: string
): Promise<void> {
  const audit = await auditPeriod(userId, month, { client: env.client });
  expect(audit).not.toBeNull();
  expect(audit?.problems).toEqual([]);
  expect(audit?.consistent).toBe(true);
}

interface ReserveOptions {
  limit?: number;
  nowMs?: number;
  ttlMs?: number;
  month?: string;
}

export function reserve(
  env: ScenarioEnv,
  userId: string,
  id: string,
  units: number,
  options: ReserveOptions = {}
) {
  const nowMs = options.nowMs ?? T0;
  return reserveUnits(
    {
      requestId: id,
      userId,
      month: options.month ?? (monthOf(nowMs) as string),
      limit: options.limit ?? 1_000,
      units,
      nowMs,
      expiresAtMs: nowMs + (options.ttlMs ?? 10 * MIN),
    },
    { client: env.client }
  );
}

export function settle(
  env: ScenarioEnv,
  userId: string,
  id: string,
  actualUnits: number | null,
  more: {
    costMicroUsd?: number | null;
    model?: string | null;
    promptTokens?: number | null;
    completionTokens?: number | null;
    nowMs?: number;
  } = {}
) {
  return settleReservation(
    {
      requestId: id,
      userId,
      actualUnits,
      costMicroUsd:
        more.costMicroUsd === undefined ? actualUnits : more.costMicroUsd,
      model: more.model === undefined ? 'google/gemini-3.6-flash' : more.model,
      promptTokens: more.promptTokens === undefined ? 1_000 : more.promptTokens,
      completionTokens:
        more.completionTokens === undefined ? 400 : more.completionTokens,
      nowMs: more.nowMs ?? T0 + MIN,
    },
    { client: env.client }
  );
}

export function release(
  env: ScenarioEnv,
  userId: string,
  id: string,
  nowMs = T0 + MIN
) {
  return releaseReservation(
    { requestId: id, userId, nowMs },
    { client: env.client }
  );
}

const periodOf = async (env: ScenarioEnv, userId: string, month = OCT) =>
  readPeriod(userId, month, { client: env.client });

export const SCENARIOS: Scenario[] = [
  {
    name: 'reserve, then settle: the hold moves to used, and the unspent part is free again',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      const held = await reserve(env, user, id, 400);
      expect(held).toMatchObject({
        ok: true,
        replayed: false,
        reservation: { status: 'RESERVED', reserved_units: 400 },
        balance: { limit: 1_000, used: 0, reserved: 400, available: 600 },
      });
      const settled = await settle(env, user, id, 250);
      expect(settled).toMatchObject({
        ok: true,
        replayed: false,
        absorbedUnits: 0,
        reservation: {
          status: 'SETTLED',
          reserved_units: 400,
          actual_units: 250,
          cost_micro_usd: 250,
          model: 'google/gemini-3.6-flash',
          prompt_tokens: 1_000,
          completion_tokens: 400,
        },
        balance: { limit: 1_000, used: 250, reserved: 0, available: 750 },
      });
      expect(await periodOf(env, user)).toMatchObject({
        used: 250,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'reserve, then release: nothing is charged and the units are free again',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      const released = await release(env, user, id);
      expect(released).toMatchObject({
        ok: true,
        changed: true,
        reservation: {
          status: 'RELEASED',
          actual_units: null,
          cost_micro_usd: null,
          model: null,
        },
        balance: { used: 0, reserved: 0, available: 1_000 },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'reserve, then expire: the reaper gives the units back, and the row is EXPIRED',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400, { ttlMs: 5 * MIN });
      const reaped = await reapExpired(T0 + 6 * MIN, { client: env.client });
      expect(reaped).toMatchObject({ ok: true });
      expect((reaped as { expired: number }).expired).toBeGreaterThanOrEqual(1);
      expect(await periodOf(env, user)).toMatchObject({ used: 0, reserved: 0 });
      const again = await reserve(env, user, id, 400);
      expect(again).toMatchObject({
        ok: true,
        replayed: true,
        reservation: { status: 'EXPIRED' },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'settle after expiry: a late settlement still charges the actual cost',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400, { ttlMs: 5 * MIN });
      await reapExpired(T0 + 6 * MIN, { client: env.client });
      const late = await settle(env, user, id, 250, { nowMs: T0 + 7 * MIN });
      expect(late).toMatchObject({
        ok: true,
        replayed: false,
        absorbedUnits: 0,
        reservation: { status: 'SETTLED', actual_units: 250 },
        balance: { used: 250, reserved: 0 },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'settle after expiry when the freed units were taken: the charge is what is left, the rest is absorbed',
    async run(env) {
      const user = await env.newUser();
      const slow = requestId('slow');
      const quick = requestId('quick');
      await reserve(env, user, slow, 600, { ttlMs: 5 * MIN });
      await reapExpired(T0 + 6 * MIN, { client: env.client });
      // another request takes 900 of the 1,000 while the slow one is expired
      expect(
        await reserve(env, user, quick, 900, { nowMs: T0 + 7 * MIN })
      ).toMatchObject({ ok: true });
      const late = await settle(env, user, slow, 500, { nowMs: T0 + 8 * MIN });
      expect(late).toMatchObject({
        ok: true,
        absorbedUnits: 400,
        reservation: {
          status: 'SETTLED',
          actual_units: 100,
          cost_micro_usd: 500,
        },
        balance: { used: 100, reserved: 900, available: 0 },
      });
      // the period never exceeds its limit, and the audit still adds up
      expect(await periodOf(env, user)).toMatchObject({
        used: 100,
        reserved: 900,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a double submit of one request id settles once: the second settlement returns the first',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      const first = await settle(env, user, id, 250);
      const second = await settle(env, user, id, 999, { costMicroUsd: 999 });
      expect(first).toMatchObject({ ok: true, replayed: false });
      expect(second).toMatchObject({
        ok: true,
        replayed: true,
        balance: null,
        reservation: {
          status: 'SETTLED',
          actual_units: 250,
          cost_micro_usd: 250,
        },
      });
      expect(await periodOf(env, user)).toMatchObject({
        used: 250,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'reserving one request id twice holds once: the second finds the first, whatever state it is in',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      const again = await reserve(env, user, id, 400);
      expect(again).toMatchObject({
        ok: true,
        replayed: true,
        balance: null,
        reservation: { status: 'RESERVED', reserved_units: 400 },
      });
      expect(await periodOf(env, user)).toMatchObject({ reserved: 400 });
      await settle(env, user, id, 100);
      const afterSettle = await reserve(env, user, id, 400);
      expect(afterSettle).toMatchObject({
        ok: true,
        replayed: true,
        reservation: { status: 'SETTLED', actual_units: 100 },
      });
      expect(await periodOf(env, user)).toMatchObject({
        used: 100,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'the balance is the limit: the last unit is granted, one more is refused with the balance',
    async run(env) {
      const user = await env.newUser();
      expect(await reserve(env, user, requestId(), 600)).toMatchObject({
        ok: true,
      });
      const refused = await reserve(env, user, requestId(), 500);
      expect(refused).toEqual({
        ok: false,
        code: 'INSUFFICIENT',
        balance: { limit: 1_000, used: 0, reserved: 600, available: 400 },
      });
      // exactly what is left is granted (used + reserved + n = limit)
      expect(await reserve(env, user, requestId(), 400)).toMatchObject({
        ok: true,
        balance: { reserved: 1_000, available: 0 },
      });
      expect(await reserve(env, user, requestId(), 1)).toMatchObject({
        ok: false,
        code: 'INSUFFICIENT',
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a refused reservation leaves no row and holds nothing',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      expect(await reserve(env, user, id, 1_001)).toMatchObject({
        ok: false,
        code: 'INSUFFICIENT',
      });
      expect(await env.countRows(user)).toEqual({
        periods: 1,
        reservations: 0,
      });
      expect(await periodOf(env, user)).toMatchObject({ used: 0, reserved: 0 });
      // the id is free to use after a refusal
      expect(await reserve(env, user, id, 1_000)).toMatchObject({ ok: true });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a zero allowance holds nothing: every reservation is refused',
    async run(env) {
      const user = await env.newUser();
      expect(
        await reserve(env, user, requestId(), 1, { limit: 0 })
      ).toMatchObject({
        ok: false,
        code: 'INSUFFICIENT',
        balance: { limit: 0, available: 0 },
      });
    },
  },
  {
    name: 'an unknown cost charges the whole reservation: a paid call is never free',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 600);
      const settled = await settle(env, user, id, null, {
        costMicroUsd: null,
        model: null,
        promptTokens: null,
        completionTokens: null,
      });
      expect(settled).toMatchObject({
        ok: true,
        absorbedUnits: 0,
        reservation: {
          status: 'SETTLED',
          actual_units: 600,
          cost_micro_usd: null,
          model: null,
          prompt_tokens: null,
        },
        balance: { used: 600, reserved: 0 },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a cost above the hold is charged in full when the balance has the room, and capped at the balance when it has not',
    async run(env) {
      const user = await env.newUser();
      const a = requestId();
      await reserve(env, user, a, 100);
      expect(await settle(env, user, a, 300)).toMatchObject({
        ok: true,
        absorbedUnits: 0,
        reservation: { actual_units: 300 },
        balance: { used: 300, reserved: 0 },
      });
      const b = requestId();
      await reserve(env, user, b, 100);
      // 700 left, 100 of them held; a cost of 5,000 is capped at the 700
      expect(await settle(env, user, b, 5_000)).toMatchObject({
        ok: true,
        absorbedUnits: 4_300,
        reservation: { actual_units: 700, cost_micro_usd: 5_000 },
        balance: { used: 1_000, reserved: 0, available: 0 },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a cost of zero is a settlement that charges nothing',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 300);
      expect(await settle(env, user, id, 0)).toMatchObject({
        ok: true,
        reservation: { status: 'SETTLED', actual_units: 0 },
        balance: { used: 0, reserved: 0 },
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'release is idempotent, final, and leaves a settled or expired row as it is',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 300);
      expect(await release(env, user, id)).toMatchObject({
        ok: true,
        changed: true,
      });
      expect(await release(env, user, id)).toMatchObject({
        ok: true,
        changed: false,
        reservation: { status: 'RELEASED' },
      });
      // RELEASED is final: a cost that arrives for it is refused, not charged
      expect(await settle(env, user, id, 100)).toEqual({
        ok: false,
        code: 'ALREADY_RELEASED',
      });
      const settledId = requestId();
      await reserve(env, user, settledId, 300);
      await settle(env, user, settledId, 100);
      expect(await release(env, user, settledId)).toMatchObject({
        ok: true,
        changed: false,
        reservation: { status: 'SETTLED', actual_units: 100 },
      });
      const expiredId = requestId();
      await reserve(env, user, expiredId, 300, { ttlMs: MIN });
      await reapExpired(T0 + 5 * MIN, { client: env.client });
      expect(await release(env, user, expiredId, T0 + 6 * MIN)).toMatchObject({
        ok: true,
        changed: false,
        reservation: { status: 'EXPIRED' },
      });
      expect(await periodOf(env, user)).toMatchObject({
        used: 100,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a request id is one trader’s: another trader can neither take it nor settle or release it',
    async run(env) {
      const owner = await env.newUser();
      const other = await env.newUser();
      const id = requestId();
      await reserve(env, owner, id, 300);
      expect(await reserve(env, other, id, 10)).toEqual({
        ok: false,
        code: 'REQUEST_ID_TAKEN',
      });
      expect(await settle(env, other, id, 10)).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await release(env, other, id)).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      // nothing of the owner's moved, and the other trader holds nothing
      expect(await periodOf(env, owner)).toMatchObject({ reserved: 300 });
      expect(await periodOf(env, other)).toMatchObject({
        reserved: 0,
        used: 0,
      });
      await expectConsistent(env, owner, OCT);
      await expectConsistent(env, other, OCT);
    },
  },
  {
    name: 'the reservation statement itself refuses another trader’s period: nothing is held and no row is made',
    async run(env) {
      const owner = await env.newUser();
      const other = await env.newUser();
      const ensured = await ensurePeriod(
        { userId: owner, month: OCT, limit: 1_000, nowMs: T0 },
        { client: env.client }
      );
      expect(ensured.ok).toBe(true);
      const periodId = ensured.ok ? ensured.period.id : '';
      const rows = await env.client.$queryRawUnsafe<unknown[]>(
        LEDGER_SQL.reserve,
        other,
        periodId,
        100,
        requestId(),
        new Date(T0).toISOString(),
        new Date(T0 + 10 * MIN).toISOString()
      );
      expect(rows).toEqual([]);
      expect(await periodOf(env, owner)).toMatchObject({
        used: 0,
        reserved: 0,
      });
      expect(await env.countRows(owner)).toEqual({
        periods: 1,
        reservations: 0,
      });
      expect(await env.countRows(other)).toEqual({
        periods: 0,
        reservations: 0,
      });
      await expectConsistent(env, owner, OCT);
    },
  },
  {
    name: 'the reservation statement itself finds a request id that has a row: it returns nothing and raises nothing',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      const held = await reserve(env, user, id, 300);
      expect(held).toMatchObject({ ok: true, replayed: false });
      const periodId = held.ok ? held.reservation.period_id : '';
      // the statement, asked again with the same request id, is a no-op and not a key violation
      const rows = await env.client.$queryRawUnsafe<unknown[]>(
        LEDGER_SQL.reserve,
        user,
        periodId,
        300,
        id,
        new Date(T0).toISOString(),
        new Date(T0 + 10 * MIN).toISOString()
      );
      expect(rows).toEqual([]);
      expect(await periodOf(env, user)).toMatchObject({ reserved: 300 });
      expect(await env.countRows(user)).toEqual({
        periods: 1,
        reservations: 1,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'settle and release of an id that was never reserved are NOT_FOUND',
    async run(env) {
      const user = await env.newUser();
      expect(await settle(env, user, requestId('ghost'), 1)).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
      expect(await release(env, user, requestId('ghost'))).toEqual({
        ok: false,
        code: 'NOT_FOUND',
      });
    },
  },
  {
    name: 'month rollover at the UTC boundary: a new month is a new balance, and the old month keeps its own',
    async run(env) {
      const user = await env.newUser();
      const port = createLedgerPort({ client: env.client });
      const lastMs = Date.UTC(2026, 9, 31, 23, 59, 59, 999);
      const firstMs = Date.UTC(2026, 10, 1, 0, 0, 0, 0);
      expect(monthOf(lastMs)).toBe(OCT);
      expect(monthOf(firstMs)).toBe(NOV);

      const october = requestId('oct');
      const heldInOctober = await port.reserve({
        requestId: october,
        userId: user,
        units: 800,
        nowMs: lastMs,
        expiresAtMs: lastMs + 10 * MIN,
        allowanceUnits: 1_000,
      });
      expect(heldInOctober).toMatchObject({
        ok: true,
        balance: { used: 0, reserved: 800, available: 200 },
      });
      // one millisecond later the trader has the whole allowance again, in a new row
      expect(
        await port.balance({
          userId: user,
          nowMs: firstMs,
          allowanceUnits: 1_000,
        })
      ).toEqual({ limit: 1_000, used: 0, reserved: 0, available: 1_000 });
      const november = requestId('nov');
      expect(
        await port.reserve({
          requestId: november,
          userId: user,
          units: 900,
          nowMs: firstMs,
          expiresAtMs: firstMs + 10 * MIN,
          allowanceUnits: 1_000,
        })
      ).toMatchObject({ ok: true, balance: { reserved: 900, available: 100 } });

      // the October request settles after midnight: it is charged to October
      expect(
        await settle(env, user, october, 300, { nowMs: firstMs + MIN })
      ).toMatchObject({
        ok: true,
        balance: { limit: 1_000, used: 300, reserved: 0 },
      });
      expect(await periodOf(env, user, OCT)).toMatchObject({
        used: 300,
        reserved: 0,
      });
      expect(await periodOf(env, user, NOV)).toMatchObject({
        used: 0,
        reserved: 900,
      });
      await expectConsistent(env, user, OCT);
      await expectConsistent(env, user, NOV);
    },
  },
  {
    name: 'the allowance raised mid-month applies at once; lowered, it does not take back what was granted',
    async run(env) {
      const user = await env.newUser();
      await reserve(env, user, requestId(), 700);
      const raised = await ensurePeriod(
        { userId: user, month: OCT, limit: 1_500, nowMs: T0 + MIN },
        { client: env.client }
      );
      expect(raised).toMatchObject({ ok: true, period: { limit: 1_500 } });
      // a raise is a change of the row, and says when; a refused lowering changes nothing
      expect(
        (raised as { period: { updated_at: Date } }).period.updated_at.getTime()
      ).toBe(T0 + MIN);
      const lowered = await ensurePeriod(
        { userId: user, month: OCT, limit: 200, nowMs: T0 + 2 * MIN },
        { client: env.client }
      );
      expect(lowered).toMatchObject({
        ok: true,
        period: { limit: 1_500, reserved: 700 },
      });
      expect(
        (
          lowered as { period: { updated_at: Date } }
        ).period.updated_at.getTime()
      ).toBe(T0 + MIN);
      // the raised limit is what the next reservation sees
      expect(
        await reserve(env, user, requestId(), 800, { limit: 200 })
      ).toMatchObject({ ok: true, balance: { limit: 1_500, reserved: 1_500 } });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'the reaper expires only what is due: past its deadline, RESERVED, and not before or at it',
    async run(env) {
      const user = await env.newUser();
      const due = requestId('due');
      const edge = requestId('edge');
      const later = requestId('later');
      const settledId = requestId('done');
      await reserve(env, user, due, 100, { ttlMs: 5 * MIN });
      await reserve(env, user, edge, 100, { ttlMs: 10 * MIN });
      await reserve(env, user, later, 100, { ttlMs: 30 * MIN });
      await reserve(env, user, settledId, 100, { ttlMs: MIN });
      await settle(env, user, settledId, 50);
      // at exactly T0 + 10 minutes the 10-minute reservation is not yet past its deadline
      const reaped = await reapExpired(T0 + 10 * MIN, { client: env.client });
      expect(reaped).toMatchObject({
        ok: true,
        expired: 1,
        unitsReturned: 100,
      });
      const row = async (id: string) =>
        (await reserve(env, user, id, 1)) as {
          reservation: { status: string };
        };
      expect((await row(due)).reservation.status).toBe('EXPIRED');
      expect((await row(edge)).reservation.status).toBe('RESERVED');
      expect((await row(later)).reservation.status).toBe('RESERVED');
      expect((await row(settledId)).reservation.status).toBe('SETTLED');
      expect(await periodOf(env, user)).toMatchObject({
        used: 50,
        reserved: 200,
      });
      // a second run has nothing more to do
      expect(
        await reapExpired(T0 + 10 * MIN, { client: env.client })
      ).toMatchObject({
        ok: true,
        expired: 0,
        unitsReturned: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'the reaper returns each period its own units and respects the batch size',
    async run(env) {
      const a = await env.newUser();
      const b = await env.newUser();
      for (let i = 0; i < 3; i += 1) {
        await reserve(env, a, requestId('a'), 100, { ttlMs: MIN });
      }
      await reserve(env, b, requestId('b'), 250, { ttlMs: MIN });
      const first = await reapExpired(T0 + 5 * MIN, {
        client: env.client,
        batch: 2,
      });
      expect(first).toMatchObject({ ok: true });
      expect((first as { expired: number }).expired).toBeLessThanOrEqual(2);
      let guard = 0;
      while (
        ((
          (await reapExpired(T0 + 5 * MIN, {
            client: env.client,
            batch: 2,
          })) as { expired: number }
        ).expired ?? 0) > 0 &&
        guard < 50
      ) {
        guard += 1;
      }
      expect(await periodOf(env, a)).toMatchObject({ reserved: 0 });
      expect(await periodOf(env, b)).toMatchObject({ reserved: 0 });
      await expectConsistent(env, a, OCT);
      await expectConsistent(env, b, OCT);
    },
  },
  {
    name: 'eight requests race for the last units: exactly one is granted',
    async run(env) {
      const user = await env.newUser();
      const ids = Array.from({ length: 8 }, (_, i) => requestId(`race${i}`));
      const results = await Promise.all(
        ids.map((id) => reserve(env, user, id, 600))
      );
      const granted = results.filter((r) => r.ok);
      const refused = results.filter((r) => !r.ok);
      expect(granted).toHaveLength(1);
      expect(refused).toHaveLength(7);
      for (const r of refused) {
        expect(r).toMatchObject({ ok: false, code: 'INSUFFICIENT' });
      }
      expect(await periodOf(env, user)).toMatchObject({
        reserved: 600,
        used: 0,
      });
      expect(await env.countRows(user)).toEqual({
        periods: 1,
        reservations: 1,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'eight requests race with one request id: one hold, seven retries',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => reserve(env, user, id, 300))
      );
      expect(results.every((r) => r.ok)).toBe(true);
      expect(
        results.filter((r) => r.ok && !(r as { replayed: boolean }).replayed)
      ).toHaveLength(1);
      expect(await periodOf(env, user)).toMatchObject({ reserved: 300 });
      expect(await env.countRows(user)).toEqual({
        periods: 1,
        reservations: 1,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'eight settlements of one request id race: the cost is charged once',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => settle(env, user, id, 250))
      );
      expect(results.every((r) => r.ok)).toBe(true);
      expect(
        results.filter((r) => r.ok && !(r as { replayed: boolean }).replayed)
      ).toHaveLength(1);
      expect(await periodOf(env, user)).toMatchObject({
        used: 250,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a settlement racing a release of one request: whichever wins, the books balance',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      const [s, r] = await Promise.all([
        settle(env, user, id, 250),
        release(env, user, id),
      ]);
      const settled = s.ok && !s.replayed;
      const released = r.ok && r.changed;
      expect(settled !== released).toBe(true);
      expect(await periodOf(env, user)).toMatchObject({
        used: settled ? 250 : 0,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a settlement racing the reaper: whichever wins, the books balance',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400, { ttlMs: MIN });
      const [s] = await Promise.all([
        settle(env, user, id, 250, { nowMs: T0 + 5 * MIN }),
        reapExpired(T0 + 5 * MIN, { client: env.client }),
      ]);
      // settled directly, or expired first and settled late: both charge the 250
      expect(s).toMatchObject({ ok: true });
      expect(await periodOf(env, user)).toMatchObject({
        used: 250,
        reserved: 0,
      });
      await expectConsistent(env, user, OCT);
    },
  },
  {
    name: 'a deleted user takes the balance with it',
    async run(env) {
      const user = await env.newUser();
      const id = requestId();
      await reserve(env, user, id, 400);
      await settle(env, user, id, 100);
      expect(await env.countRows(user)).toEqual({
        periods: 1,
        reservations: 1,
      });
      await env.deleteUser(user);
      expect(await env.countRows(user)).toEqual({
        periods: 0,
        reservations: 0,
      });
      expect(await periodOf(env, user)).toBeNull();
    },
  },
  {
    name: 'a user that does not exist (deleted mid-request) is USER_NOT_FOUND, not an error',
    async run(env) {
      const ghost = `ghost-${requestId()}`;
      expect(await reserve(env, ghost, requestId(), 10)).toEqual({
        ok: false,
        code: 'USER_NOT_FOUND',
      });
    },
  },
];
