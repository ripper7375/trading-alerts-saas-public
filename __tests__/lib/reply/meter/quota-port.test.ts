/**
 * @jest-environment node
 */

/**
 * The quota port of the gate and the meter around the model calls (build step 7 part 6;
 * architecture 4.2 step 1, 5.6, 5.14 item 2; ADR-050, ADR-072, ADR-073; decisions D2, D3, D4).
 *
 *  - the floor check at the gate: an empty account is refused before the Understand call is made,
 *    and a service that cannot be read refuses (the gate says FEATURE_UNAVAILABLE);
 *  - the ladder of holds: the base with one regeneration if the ledger grants it, the base alone,
 *    or a refusal with the balance;
 *  - `runMetered`: the model is called only under a granted hold, a paid call is settled even when
 *    the request then fails, a request that never reached the model gives its units back, a retry
 *    does not pay twice;
 *  - ACCEPTANCE 5.14 item 2: a request whose worst case exceeds the balance is refused before the
 *    model is called (the model port's call count is 0).
 *
 * The ledger under the meter is, in the tests that need a real one, the in-memory model of
 * `__tests__/lib/platform/helpers/ledger-model.ts` through the platform's port.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { runIntake } from '@/lib/intake';
import { createLedgerPort } from '@/lib/platform/metering/ledger-port';
import { createFixtureModel } from '@/lib/reply/gateway/fixture';
import type { ModelRequest } from '@/lib/reply/gateway/types';
import {
  boundOf,
  estimateRequest,
  type RequestEstimate,
} from '@/lib/reply/meter/estimate';
import {
  DEFAULT_RESERVATION_TTL_MS,
  createMeter,
  createQuotaPort,
  runMetered,
  type Balance,
  type LedgerPort,
  type MeterConfig,
} from '@/lib/reply/meter/quota-port';

import { instant, makeFake, newTrace, typed } from '../../intake/helpers/ports';
import { LedgerModel } from '../../platform/helpers/ledger-model';

const NOW = Date.UTC(2026, 9, 15, 10, 0, 0);
const USER = 'user-pro-1';
const REQUEST = { requestId: 'req-1', userId: USER, tier: 'PRO' };

const balanceOf = (available: number, limit = 1_000_000): Balance => ({
  limit,
  used: limit - available,
  reserved: 0,
  available,
});

/** A scripted ledger that records what it is asked. */
function scripted(over: Partial<LedgerPort> = {}) {
  const calls = {
    balance: [] as unknown[],
    reserve: [] as unknown[],
    settle: [] as unknown[],
    release: [] as unknown[],
  };
  const ledger: LedgerPort = {
    balance: async (q) => {
      calls.balance.push(q);
      return balanceOf(1_000_000);
    },
    reserve: async (q) => {
      calls.reserve.push(q);
      return {
        ok: true,
        replayed: false,
        status: 'RESERVED',
        reservedUnits: q.units,
        balance: balanceOf(1_000_000 - q.units),
      };
    },
    settle: async (q) => {
      calls.settle.push(q);
      return {
        ok: true,
        replayed: false,
        chargedUnits: q.actualUnits ?? 0,
        absorbedUnits: 0,
        balance: null,
      };
    },
    release: async (q) => {
      calls.release.push(q);
      return { ok: true, changed: true, status: 'RELEASED' };
    },
    ...over,
  };
  return { ledger, calls };
}

const config = (
  ledger: LedgerPort,
  over: Partial<MeterConfig> = {}
): MeterConfig => ({
  ledger,
  now: () => NOW,
  allowanceOf: (tier) => (tier === 'PRO' ? 5_000_000 : 0),
  floorOf: () => 100,
  ...over,
});

/** The worst case of the example request: an Understand call and an answer, with the numbers of the estimate tests. */
const ESTIMATE = estimateRequest({
  understand: {
    price: { price_in: 0.1, price_out: 0.4 },
    promptTokens: 4_000,
    maxOutputTokens: 700,
    calibration: { marginBp: 1_000 },
  },
  answer: {
    price: { price_in: 0.5, price_out: 2 },
    promptTokens: 10_000,
    maxOutputTokens: 2_048,
    calibration: { marginBp: 1_000 },
  },
}) as Extract<RequestEstimate, { ok: true }>;

describe('the example estimate is the one of the estimate tests', () => {
  it('holds 11,348 units for the base and 21,904 with a regeneration', () => {
    expect(ESTIMATE).toMatchObject({
      baseUnits: 11_348,
      withRegenerationUnits: 21_904,
    });
  });
});

// ---------------------------------------------------------------------------------------
describe('createQuotaPort: the floor check of the gate', () => {
  it('lets a request through when the balance reaches the floor, exactly at it too', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(100) });
    const port = createQuotaPort(config(ledger));
    await expect(
      port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: true });
  });

  it('refuses one unit short of the floor', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(99) });
    const port = createQuotaPort(config(ledger));
    await expect(
      port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: false });
  });

  it('refuses an empty account whatever the floor', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(0) });
    for (const floor of [0, 1, 100]) {
      const port = createQuotaPort(config(ledger, { floorOf: () => floor }));
      await expect(
        port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' })
      ).resolves.toEqual({ allowed: false });
    }
  });

  it('never lets the floor go below one unit', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(0) });
    const port = createQuotaPort(config(ledger, { floorOf: () => -50 }));
    await expect(
      port.precheck({ userId: USER, tier: 'PRO', kind: 'INSTANT' })
    ).resolves.toEqual({ allowed: false });
  });

  it('asks the floor of the kind of request, and the ledger for this trader, this instant and this allowance', async () => {
    const kinds: string[] = [];
    const { ledger, calls } = scripted();
    const port = createQuotaPort(
      config(ledger, {
        floorOf: (kind) => {
          kinds.push(kind);
          return kind === 'TYPED' ? 500 : 50;
        },
      })
    );
    await port.precheck({ userId: USER, tier: 'PRO', kind: 'INSTANT' });
    await port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' });
    expect(kinds).toEqual(['INSTANT', 'TYPED']);
    expect(calls.balance).toEqual([
      { userId: USER, nowMs: NOW, allowanceUnits: 5_000_000 },
      { userId: USER, nowMs: NOW, allowanceUnits: 5_000_000 },
    ]);
  });

  it('refuses when there is no allowance (PRO_MONTHLY_UNITS unset: fail closed), and does not ask the ledger', async () => {
    const { ledger, calls } = scripted();
    const port = createQuotaPort(config(ledger, { allowanceOf: () => null }));
    await expect(
      port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: false });
    expect(calls.balance).toEqual([]);
  });

  it('refuses a tier whose allowance is zero (Free has no units, ADR-072), and does not ask the ledger', async () => {
    const { ledger, calls } = scripted();
    const port = createQuotaPort(config(ledger));
    await expect(
      port.precheck({ userId: USER, tier: 'FREE', kind: 'TYPED' })
    ).resolves.toEqual({ allowed: false });
    expect(calls.balance).toEqual([]);
  });

  it('lets a ledger that cannot be read fail the check: it never lets a request through for free', async () => {
    const { ledger } = scripted({
      balance: async () => {
        throw new Error('database down');
      },
    });
    const port = createQuotaPort(config(ledger));
    await expect(
      port.precheck({ userId: USER, tier: 'PRO', kind: 'TYPED' })
    ).rejects.toThrow('database down');
  });

  it('charges and holds nothing: it only reads', async () => {
    const { ledger, calls } = scripted();
    await createQuotaPort(config(ledger)).precheck({
      userId: USER,
      tier: 'PRO',
      kind: 'TYPED',
    });
    expect([calls.reserve, calls.settle, calls.release]).toEqual([[], [], []]);
  });
});

// ---------------------------------------------------------------------------------------
describe('at the gate of the pipeline: an empty account is refused before the Understand call is paid for', () => {
  async function runOver(
    port: ReturnType<typeof createQuotaPort>,
    request: ReturnType<typeof typed> | ReturnType<typeof instant>
  ) {
    const recorder = newTrace(request.kind === 'INSTANT' ? 'instant' : 'typed');
    const fake = makeFake({}, recorder);
    fake.ports.gate.quota = port;
    const result = await runIntake(fake.ports, recorder, async () => ({
      ok: true as const,
      request,
    }));
    return { result, fake, trace: recorder.snapshot() };
  }

  it('an empty balance: QUOTA_INSUFFICIENT, and neither the model nor anything after the gate was reached', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(0) });
    const { result, fake, trace } = await runOver(
      createQuotaPort(config(ledger)),
      typed('Should I buy gold now')
    );
    expect(result).toMatchObject({
      kind: 'REFUSED',
      refusal: { code: 'QUOTA_INSUFFICIENT', stage: 'GATE' },
    });
    expect(fake.calls.understand).toBe(0);
    expect(fake.calls.snapshot).toBe(0);
    expect(fake.calls.knowledge).toBe(0);
    expect(trace).toMatchObject({
      outcome: 'REFUSED',
      refusal_code: 'QUOTA_INSUFFICIENT',
      units_charged: 0,
    });
  });

  it('PRO_MONTHLY_UNITS unset: every request is refused at the gate', async () => {
    const { ledger, calls } = scripted();
    const port = createQuotaPort(config(ledger, { allowanceOf: () => null }));
    for (const request of [typed('x'), instant('INSTANT_M5_INSPECT')]) {
      const { result, fake } = await runOver(port, request);
      expect(result).toMatchObject({
        kind: 'REFUSED',
        refusal: { code: 'QUOTA_INSUFFICIENT' },
      });
      expect(fake.calls.understand).toBe(0);
    }
    expect(calls.balance).toEqual([]);
  });

  it('a balance that reaches the floor passes the gate and the question goes on to the model', async () => {
    const { ledger } = scripted({ balance: async () => balanceOf(5_000) });
    const { result, fake } = await runOver(
      createQuotaPort(config(ledger)),
      typed('Should I buy gold now')
    );
    expect(result.kind).toBe('PACKET');
    expect(fake.calls.understand).toBe(1);
  });

  it('a ledger that fails is FEATURE_UNAVAILABLE, with the failure named for the trace', async () => {
    const { ledger } = scripted({
      balance: async () => {
        throw new Error('quota down');
      },
    });
    const { result, fake, trace } = await runOver(
      createQuotaPort(config(ledger)),
      typed('x')
    );
    expect(result).toMatchObject({
      kind: 'REFUSED',
      refusal: { code: 'FEATURE_UNAVAILABLE' },
    });
    expect(trace.problems).toEqual(['QUOTA_PORT_ERROR']);
    expect(fake.calls.understand).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------
describe('createMeter.reserve: the ladder', () => {
  it('holds the base with one regeneration when the ledger grants it', async () => {
    const { ledger, calls } = scripted();
    const meter = createMeter(config(ledger));
    expect(await meter.reserve(REQUEST, ESTIMATE)).toEqual({
      ok: true,
      replayed: false,
      status: 'RESERVED',
      reservedUnits: 21_904,
      regenerationAllowed: true,
      balance: balanceOf(1_000_000 - 21_904),
    });
    expect(calls.reserve).toHaveLength(1);
    expect(calls.reserve[0]).toMatchObject({
      requestId: 'req-1',
      userId: USER,
      units: 21_904,
      allowanceUnits: 5_000_000,
    });
  });

  it('falls to the base alone when the larger hold is refused, and the request may not regenerate', async () => {
    const asked: number[] = [];
    const { ledger } = scripted({
      reserve: async (q) => {
        asked.push(q.units);
        return q.units > 15_000
          ? { ok: false, code: 'INSUFFICIENT', balance: balanceOf(15_000) }
          : {
              ok: true,
              replayed: false,
              status: 'RESERVED',
              reservedUnits: q.units,
              balance: balanceOf(15_000 - q.units),
            };
      },
    });
    const result = await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE);
    expect(asked).toEqual([21_904, 11_348]);
    expect(result).toMatchObject({
      ok: true,
      reservedUnits: 11_348,
      regenerationAllowed: false,
    });
  });

  it('refuses with the balance and the units needed when not even the base fits', async () => {
    const asked: number[] = [];
    const { ledger } = scripted({
      reserve: async (q) => {
        asked.push(q.units);
        return { ok: false, code: 'INSUFFICIENT', balance: balanceOf(5_000) };
      },
    });
    expect(
      await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE)
    ).toEqual({
      ok: false,
      code: 'INSUFFICIENT',
      neededUnits: 11_348,
      balance: balanceOf(5_000),
    });
    expect(asked).toEqual([21_904, 11_348]);
  });

  it('reports the balance of the last refusal, which is the freshest', async () => {
    let n = 0;
    const { ledger } = scripted({
      reserve: async () => {
        n += 1;
        return {
          ok: false,
          code: 'INSUFFICIENT',
          balance: balanceOf(n === 1 ? 9_000 : 4_000),
        };
      },
    });
    const result = await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE);
    expect(result).toMatchObject({ ok: false, balance: { available: 4_000 } });
  });

  it('sets the deadline from the clock and the time to live', async () => {
    const { ledger, calls } = scripted();
    await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE);
    expect(DEFAULT_RESERVATION_TTL_MS).toBe(10 * 60 * 1000);
    expect(calls.reserve[0]).toMatchObject({
      nowMs: NOW,
      expiresAtMs: NOW + DEFAULT_RESERVATION_TTL_MS,
    });
    await createMeter(config(ledger, { reservationTtlMs: 90_000 })).reserve(
      { ...REQUEST, requestId: 'req-2' },
      ESTIMATE
    );
    expect(calls.reserve[1]).toMatchObject({ expiresAtMs: NOW + 90_000 });
  });

  it('reads the clock at each rung, so a slow refusal does not hand the next hold an old deadline', async () => {
    let t = NOW;
    const { ledger, calls } = scripted({
      reserve: async () => ({
        ok: false,
        code: 'INSUFFICIENT',
        balance: balanceOf(0),
      }),
    });
    await createMeter(config(ledger, { now: () => (t += 1_000) })).reserve(
      REQUEST,
      ESTIMATE
    );
    expect(calls.balance).toEqual([]);
    expect(t).toBe(NOW + 2_000);
  });

  it('a retry finds the hold it made and says what the stored hold covers', async () => {
    const { ledger } = scripted({
      reserve: async () => ({
        ok: true,
        replayed: true,
        status: 'SETTLED',
        reservedUnits: 11_348,
        balance: null,
      }),
    });
    expect(
      await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE)
    ).toEqual({
      ok: true,
      replayed: true,
      status: 'SETTLED',
      reservedUnits: 11_348,
      regenerationAllowed: false,
      balance: null,
    });
  });

  it('is not metered, and does not ask the ledger, when the tier has no allowance or the allowance is not set', async () => {
    const { ledger, calls } = scripted();
    for (const allowance of [null, 0]) {
      const meter = createMeter(
        config(ledger, { allowanceOf: () => allowance })
      );
      expect(await meter.reserve(REQUEST, ESTIMATE)).toEqual({
        ok: false,
        code: 'NOT_METERED',
      });
    }
    expect(
      await createMeter(config(ledger)).reserve(
        { ...REQUEST, tier: 'FREE' },
        ESTIMATE
      )
    ).toEqual({
      ok: false,
      code: 'NOT_METERED',
    });
    expect(calls.reserve).toEqual([]);
  });

  it('does not run a request whose worst case it cannot price', async () => {
    const { ledger, calls } = scripted();
    const meter = createMeter(config(ledger));
    expect(
      await meter.reserve(REQUEST, {
        ok: false,
        code: 'PRICE_UNKNOWN',
        call: 'answer',
      })
    ).toEqual({
      ok: false,
      code: 'PRICE_UNKNOWN',
      call: 'answer',
    });
    expect(
      await meter.reserve(REQUEST, { ok: false, code: 'TOO_LARGE' })
    ).toEqual({ ok: false, code: 'BAD_REQUEST' });
    expect(calls.reserve).toEqual([]);
  });

  it.each([
    ['REQUEST_ID_TAKEN', 'REQUEST_ID_TAKEN'],
    ['USER_NOT_FOUND', 'USER_NOT_FOUND'],
    ['BAD_INPUT', 'BAD_REQUEST'],
  ] as const)(
    'passes on %s as %s, without trying a smaller hold',
    async (code, expected) => {
      const { ledger, calls } = scripted({
        reserve: async () => ({ ok: false, code }),
      });
      expect(
        await createMeter(config(ledger)).reserve(REQUEST, ESTIMATE)
      ).toEqual({ ok: false, code: expected });
      expect(calls.reserve).toEqual([]);
    }
  );

  it('a ledger that throws is an error, not a grant', async () => {
    const { ledger } = scripted({
      reserve: async () => {
        throw new Error('database down');
      },
    });
    await expect(
      createMeter(config(ledger)).reserve(REQUEST, ESTIMATE)
    ).rejects.toThrow('database down');
  });
});

// ---------------------------------------------------------------------------------------
describe('createMeter.settle and release', () => {
  it('settles for the sum of the calls’ costs, with the model that wrote the reply and the tokens', async () => {
    const { ledger, calls } = scripted();
    const result = await createMeter(config(ledger)).settle(REQUEST, [
      {
        model: 'vendor/understand',
        costMicroUsd: 30,
        promptTokens: 400,
        completionTokens: 50,
      },
      {
        model: 'vendor/answer',
        costMicroUsd: 700,
        promptTokens: 9_000,
        completionTokens: 1_500,
      },
    ]);
    expect(calls.settle).toEqual([
      {
        requestId: 'req-1',
        userId: USER,
        nowMs: NOW,
        actualUnits: 730,
        costMicroUsd: 730,
        model: 'vendor/answer',
        promptTokens: 9_400,
        completionTokens: 1_550,
      },
    ]);
    expect(result).toMatchObject({
      ok: true,
      chargedUnits: 730,
      absorbedUnits: 0,
      replayed: false,
    });
  });

  it('an unknown cost settles with no units: the ledger then charges the whole reservation', async () => {
    const { ledger, calls } = scripted();
    await createMeter(config(ledger)).settle(REQUEST, [
      {
        model: 'vendor/answer',
        costMicroUsd: null,
        promptTokens: 1,
        completionTokens: 1,
      },
    ]);
    expect(calls.settle[0]).toMatchObject({
      actualUnits: null,
      costMicroUsd: null,
    });
  });

  it('refuses to settle nothing: with no call there is nothing spent, and the caller releases', async () => {
    const { ledger, calls } = scripted();
    expect(await createMeter(config(ledger)).settle(REQUEST, [])).toEqual({
      ok: false,
      code: 'NOTHING_SPENT',
    });
    expect(calls.settle).toEqual([]);
  });

  it('passes on what the ledger refused', async () => {
    for (const code of [
      'NOT_FOUND',
      'ALREADY_RELEASED',
      'BAD_INPUT',
    ] as const) {
      const { ledger } = scripted({
        settle: async () => ({ ok: false, code }),
      });
      expect(
        await createMeter(config(ledger)).settle(REQUEST, [
          {
            model: null,
            costMicroUsd: 1,
            promptTokens: null,
            completionTokens: null,
          },
        ])
      ).toEqual({ ok: false, code });
    }
  });

  it('releases a hold by request and trader', async () => {
    const { ledger, calls } = scripted();
    expect(await createMeter(config(ledger)).release(REQUEST)).toEqual({
      ok: true,
      changed: true,
      status: 'RELEASED',
    });
    expect(calls.release).toEqual([
      { requestId: 'req-1', userId: USER, nowMs: NOW },
    ]);
  });
});

// ---------------------------------------------------------------------------------------
describe('runMetered over a real ledger (the model of the two tables)', () => {
  const model = (limit = 5_000_000) => {
    const db = new LedgerModel();
    db.addUser(USER);
    db.addUser('user-2');
    const ledger = createLedgerPort({ client: db });
    return {
      db,
      meter: createMeter(config(ledger, { allowanceOf: () => limit })),
    };
  };
  const reservationOf = (db: LedgerModel, id = 'req-1') =>
    db.reservations.get(id);
  const periodOf = (db: LedgerModel) => db.periods.get(`${USER}|2026-10`);

  it('holds, runs, and settles for what was spent; the unspent part is free again', async () => {
    const { db, meter } = model();
    const seen: unknown[] = [];
    const result = await runMetered(
      meter,
      REQUEST,
      ESTIMATE,
      async (hold, rec) => {
        seen.push(hold);
        expect(periodOf(db)?.reserved).toBe(21_904);
        rec.record({
          model: 'vendor/understand',
          costMicroUsd: 30,
          promptTokens: 400,
          completionTokens: 50,
        });
        rec.record({
          model: 'vendor/answer',
          costMicroUsd: 7_000,
          promptTokens: 9_000,
          completionTokens: 1_500,
        });
        return 'the reply';
      }
    );
    expect(result).toMatchObject({
      ok: true,
      value: 'the reply',
      release: null,
      settlement: { ok: true, chargedUnits: 7_030, absorbedUnits: 0 },
    });
    expect(seen).toEqual([
      {
        reservedUnits: 21_904,
        regenerationAllowed: true,
        balance: expect.any(Object),
      },
    ]);
    expect(reservationOf(db)).toMatchObject({
      status: 'SETTLED',
      actual_units: 7_030,
      cost_micro_usd: 7_030,
      model: 'vendor/answer',
      prompt_tokens: 9_400,
    });
    expect(periodOf(db)).toMatchObject({ used: 7_030, reserved: 0 });
  });

  it('a regeneration is a second paid call, and both are charged', async () => {
    const { db, meter } = model();
    await runMetered(meter, REQUEST, ESTIMATE, async (_hold, rec) => {
      rec.record({
        model: 'v/a',
        costMicroUsd: 7_000,
        promptTokens: 1,
        completionTokens: 1,
      });
      rec.record({
        model: 'v/a',
        costMicroUsd: 6_500,
        promptTokens: 1,
        completionTokens: 1,
      });
    });
    expect(periodOf(db)).toMatchObject({ used: 13_500, reserved: 0 });
  });

  it('no call made: the units are released and nothing is charged', async () => {
    const { db, meter } = model();
    const result = await runMetered(
      meter,
      REQUEST,
      ESTIMATE,
      async () => 'a fixed answer'
    );
    expect(result).toMatchObject({
      ok: true,
      value: 'a fixed answer',
      settlement: null,
      release: { ok: true, changed: true },
    });
    expect(reservationOf(db)).toMatchObject({
      status: 'RELEASED',
      actual_units: null,
    });
    expect(periodOf(db)).toMatchObject({ used: 0, reserved: 0 });
  });

  it('a request that fails AFTER a model call is still charged for what was spent, and the error goes on', async () => {
    const { db, meter } = model();
    await expect(
      runMetered(meter, REQUEST, ESTIMATE, async (_hold, rec) => {
        rec.record({
          model: 'v/a',
          costMicroUsd: 4_000,
          promptTokens: 10,
          completionTokens: 5,
        });
        throw new Error('the schema check blew up');
      })
    ).rejects.toThrow('the schema check blew up');
    expect(reservationOf(db)).toMatchObject({
      status: 'SETTLED',
      actual_units: 4_000,
    });
    expect(periodOf(db)).toMatchObject({ used: 4_000, reserved: 0 });
  });

  it('a request that fails BEFORE any model call gives its units back, and the error goes on', async () => {
    const { db, meter } = model();
    await expect(
      runMetered(meter, REQUEST, ESTIMATE, async () => {
        throw new Error('the context could not be assembled');
      })
    ).rejects.toThrow('the context could not be assembled');
    expect(reservationOf(db)).toMatchObject({ status: 'RELEASED' });
    expect(periodOf(db)).toMatchObject({ used: 0, reserved: 0 });
  });

  it('a call whose cost the gateway could not say is charged at the whole reservation: a paid call is never free', async () => {
    const { db, meter } = model();
    await runMetered(meter, REQUEST, ESTIMATE, async (_hold, rec) => {
      rec.record({
        model: 'v/a',
        costMicroUsd: null,
        promptTokens: 10,
        completionTokens: 5,
      });
    });
    expect(reservationOf(db)).toMatchObject({
      status: 'SETTLED',
      actual_units: 21_904,
      cost_micro_usd: null,
    });
    expect(periodOf(db)).toMatchObject({ used: 21_904, reserved: 0 });
  });

  it('a cost above the balance is capped at the balance, and the rest is the business’s', async () => {
    const { db, meter } = model(25_000);
    const result = await runMetered(
      meter,
      REQUEST,
      ESTIMATE,
      async (_hold, rec) => {
        rec.record({
          model: 'v/a',
          costMicroUsd: 40_000,
          promptTokens: 1,
          completionTokens: 1,
        });
      }
    );
    expect(result).toMatchObject({
      ok: true,
      settlement: { ok: true, chargedUnits: 25_000, absorbedUnits: 15_000 },
    });
    expect(periodOf(db)).toMatchObject({
      used: 25_000,
      reserved: 0,
      limit: 25_000,
    });
  });

  it('a retry of a request that was settled does not run the model again, and charges nothing more', async () => {
    const { db, meter } = model();
    let calls = 0;
    const run = async (_hold: unknown, rec: { record(c: never): void }) => {
      calls += 1;
      rec.record({
        model: 'v/a',
        costMicroUsd: 1_000,
        promptTokens: 1,
        completionTokens: 1,
      } as never);
    };
    await runMetered(meter, REQUEST, ESTIMATE, run);
    const again = await runMetered(meter, REQUEST, ESTIMATE, run);
    expect(again).toEqual({ ok: false, duplicate: { status: 'SETTLED' } });
    expect(calls).toBe(1);
    expect(periodOf(db)).toMatchObject({ used: 1_000, reserved: 0 });
  });

  it('a retry of a request still in flight is a duplicate too: one paid call under one hold', async () => {
    const { db, meter } = model();
    let inner: unknown;
    await runMetered(meter, REQUEST, ESTIMATE, async () => {
      inner = await runMetered(meter, REQUEST, ESTIMATE, async () => {
        throw new Error('the duplicate must not run');
      });
    });
    expect(inner).toEqual({ ok: false, duplicate: { status: 'RESERVED' } });
    expect(periodOf(db)).toMatchObject({ used: 0, reserved: 0 });
  });

  it('a ledger error after the model call does not lose the reply that was paid for', async () => {
    const { ledger } = scripted({
      settle: async () => {
        throw new Error('database went away');
      },
    });
    const result = await runMetered(
      createMeter(config(ledger)),
      REQUEST,
      ESTIMATE,
      async (_hold, rec) => {
        rec.record({
          model: 'v/a',
          costMicroUsd: 500,
          promptTokens: 1,
          completionTokens: 1,
        });
        return 'the paid-for reply';
      }
    );
    expect(result).toEqual({
      ok: true,
      value: 'the paid-for reply',
      settlement: { ok: false, code: 'LEDGER_ERROR' },
      release: null,
    });
  });

  it('a ledger error on the release is reported the same way', async () => {
    const { ledger } = scripted({
      release: async () => {
        throw new Error('database went away');
      },
    });
    expect(
      await runMetered(
        createMeter(config(ledger)),
        REQUEST,
        ESTIMATE,
        async () => 7
      )
    ).toEqual({
      ok: true,
      value: 7,
      settlement: null,
      release: { ok: false, code: 'LEDGER_ERROR' },
    });
  });

  it('copies each recorded call, so a caller that reuses its object cannot change what is settled', async () => {
    const { db, meter } = model();
    await runMetered(meter, REQUEST, ESTIMATE, async (_hold, rec) => {
      const call = {
        model: 'v/a',
        costMicroUsd: 100,
        promptTokens: 1,
        completionTokens: 1,
      };
      rec.record(call);
      call.costMicroUsd = 999_999;
    });
    expect(periodOf(db)).toMatchObject({ used: 100 });
  });

  it('different traders’ requests do not touch each other’s balance', async () => {
    const { db, meter } = model();
    await runMetered(meter, REQUEST, ESTIMATE, async (_h, rec) => {
      rec.record({
        model: 'v/a',
        costMicroUsd: 100,
        promptTokens: 1,
        completionTokens: 1,
      });
    });
    await runMetered(
      meter,
      { requestId: 'req-2', userId: 'user-2', tier: 'PRO' },
      ESTIMATE,
      async (_h, rec) => {
        rec.record({
          model: 'v/a',
          costMicroUsd: 250,
          promptTokens: 1,
          completionTokens: 1,
        });
      }
    );
    expect(db.periods.get(`${USER}|2026-10`)).toMatchObject({ used: 100 });
    expect(db.periods.get('user-2|2026-10')).toMatchObject({ used: 250 });
  });
});

// ---------------------------------------------------------------------------------------
describe('ACCEPTANCE 5.14 item 2: a request whose worst case exceeds the balance is refused before the model is called', () => {
  const REPLY = {
    kind: 'REPLY' as const,
    text: '{"ok":true}',
    usage: { prompt_tokens: 100, completion_tokens: 20, cost_micro_usd: 900 },
  };
  const MODEL_REQUEST: ModelRequest = {
    messages: [{ role: 'user', content: 'a prompt' }],
    max_output_tokens: 100,
    temperature: 0,
    response: { kind: 'TEXT' },
  };

  /** The orchestrator's shape: ask the model inside the hold and report the paid call. */
  async function ask(
    model: ReturnType<typeof createFixtureModel>,
    meter: ReturnType<typeof createMeter>,
    estimate: RequestEstimate
  ) {
    return runMetered(meter, REQUEST, estimate, async (_hold, recorder) => {
      const answer = await model.complete(MODEL_REQUEST);
      if (answer.ok) {
        recorder.record({
          model: answer.model,
          costMicroUsd: answer.usage.cost_micro_usd,
          promptTokens: answer.usage.prompt_tokens,
          completionTokens: answer.usage.completion_tokens,
        });
      }
      return answer;
    });
  }

  it('a balance of 5,000 units against a worst case of 11,348: refused, the model port was called ZERO times, nothing is held or charged', async () => {
    const db = new LedgerModel();
    db.addUser(USER);
    const fixture = createFixtureModel({ scenarios: { default: [REPLY] } });
    const meter = createMeter(
      config(createLedgerPort({ client: db }), { allowanceOf: () => 5_000 })
    );
    const result = await ask(fixture, meter, ESTIMATE);
    expect(result).toEqual({
      ok: false,
      refusal: {
        ok: false,
        code: 'INSUFFICIENT',
        neededUnits: 11_348,
        balance: { limit: 5_000, used: 0, reserved: 0, available: 5_000 },
      },
    });
    expect(fixture.count).toBe(0);
    expect(fixture.calls).toEqual([]);
    expect(db.reservations.size).toBe(0);
    expect(db.periods.get(`${USER}|2026-10`)).toMatchObject({
      used: 0,
      reserved: 0,
    });
  });

  it('one unit short of the base is refused, and the model is not called', async () => {
    const db = new LedgerModel();
    db.addUser(USER);
    const fixture = createFixtureModel({ scenarios: { default: [REPLY] } });
    const meter = createMeter(
      config(createLedgerPort({ client: db }), {
        allowanceOf: () => ESTIMATE.baseUnits - 1,
      })
    );
    expect(await ask(fixture, meter, ESTIMATE)).toMatchObject({
      ok: false,
      refusal: { code: 'INSUFFICIENT' },
    });
    expect(fixture.count).toBe(0);
  });

  it('exactly the base is granted without a regeneration, the model is called, and the settlement is what it cost', async () => {
    const db = new LedgerModel();
    db.addUser(USER);
    const fixture = createFixtureModel({ scenarios: { default: [REPLY] } });
    const meter = createMeter(
      config(createLedgerPort({ client: db }), {
        allowanceOf: () => ESTIMATE.baseUnits,
      })
    );
    const result = await ask(fixture, meter, ESTIMATE);
    expect(result).toMatchObject({
      ok: true,
      settlement: { ok: true, chargedUnits: 900 },
    });
    expect(fixture.count).toBe(1);
    expect(db.periods.get(`${USER}|2026-10`)).toMatchObject({
      used: 900,
      reserved: 0,
    });
  });

  it('no allowance at all (PRO_MONTHLY_UNITS unset): refused, the model is not called, no ledger row is made', async () => {
    const db = new LedgerModel();
    db.addUser(USER);
    const fixture = createFixtureModel({ scenarios: { default: [REPLY] } });
    const meter = createMeter(
      config(createLedgerPort({ client: db }), { allowanceOf: () => null })
    );
    expect(await ask(fixture, meter, ESTIMATE)).toEqual({
      ok: false,
      refusal: { ok: false, code: 'NOT_METERED' },
    });
    expect(fixture.count).toBe(0);
    expect(db.calls).toEqual([]);
  });

  it('a call without a price has no worst case: refused, the model is not called', async () => {
    const db = new LedgerModel();
    db.addUser(USER);
    const fixture = createFixtureModel({ scenarios: { default: [REPLY] } });
    const unpriced = estimateRequest({
      understand: null,
      answer: boundOf(
        {
          price_in: null,
          price_out: null,
          max_output_tokens: 2_048,
          calibration: {
            digitsPerToken: 3,
            lettersPerToken: 4,
            cjkCharsPerToken: 1,
            otherCharsPerToken: 2,
            marginBp: 1_000,
          },
        },
        1_000
      ),
    });
    const meter = createMeter(config(createLedgerPort({ client: db })));
    expect(await ask(fixture, meter, unpriced)).toEqual({
      ok: false,
      refusal: { ok: false, code: 'PRICE_UNKNOWN', call: 'answer' },
    });
    expect(fixture.count).toBe(0);
  });
});
