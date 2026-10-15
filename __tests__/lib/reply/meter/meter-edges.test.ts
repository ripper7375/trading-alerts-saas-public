/**
 * @jest-environment node
 */

/**
 * Edges of the meter that the mutation check found no test for (build step 7 part 6): the exact
 * rounding of a price, the boundary of the ledger's bound, the order in which models are tried for
 * the floor, an allowance of one unit, a free model, and the exact figures a settlement reports.
 */

import {
  MAX_UNITS,
  proQuotaUnits,
  usdToMicroUsd,
} from '@/lib/reply/meter/units';
import {
  DEFAULT_RESERVATION_TTL_MS,
  createMeter,
  createQuotaPort,
  type LedgerPort,
} from '@/lib/reply/meter/quota-port';
import {
  UNDERSTAND_MAX_OUTPUT_TOKENS,
  UNDERSTAND_PROMPT_TOKENS_CEILING,
  boundOf,
  callWorstCaseMicroUsd,
  callWorstCaseUnits,
  estimateRequest,
  floorUnits,
  type CallBound,
} from '@/lib/reply/meter/estimate';
import {
  reservationLadder,
  summarizeSpend,
  type SpentCall,
} from '@/lib/reply/meter/reserve-plan';

const CAL = { marginBp: 0 };
const call = (over: Partial<CallBound>): CallBound => ({
  price: { price_in: 0, price_out: 0 },
  promptTokens: 0,
  maxOutputTokens: 0,
  calibration: CAL,
  ...over,
});

describe('a price is carried to micro-dollars by rounding, never by cutting', () => {
  // 0.000249 times a million is 248.99999999999997 in floating point: a floor would lose a micro-dollar
  it('0.000249 dollars is 249 micro-dollars', () => {
    expect(0.000249 * 1_000_000).toBeLessThan(249);
    expect(usdToMicroUsd(0.000249)).toBe(249);
    expect(proQuotaUnits({ priceUsd: 0.000249, share: 1 })).toEqual({
      ok: true,
      units: 249,
    });
    // and as a share: 249 millionths of a thousand dollars is 249,000 units
    expect(proQuotaUnits({ priceUsd: 1_000, share: 0.000249 })).toEqual({
      ok: true,
      units: 249_000,
    });
  });

  it('a price of 0.000249 USD per million tokens costs 249 micro-dollars for a million tokens', () => {
    expect(
      callWorstCaseMicroUsd(
        call({
          price: { price_in: 0.000249, price_out: 0 },
          promptTokens: 1_000_000,
        }),
        0
      )
    ).toBe(249);
  });

  it('is exact on 4.35 dollars per million tokens for a million tokens (4,350,000), not a neighbour', () => {
    expect(
      callWorstCaseMicroUsd(
        call({
          price: { price_in: 4.35, price_out: 0 },
          promptTokens: 1_000_000,
        }),
        0
      )
    ).toBe(4_350_000);
  });

  it('a price of one micro-dollar is a price: it buys exactly one unit at a share of one', () => {
    expect(proQuotaUnits({ priceUsd: 0.000001, share: 1 })).toEqual({
      ok: true,
      units: 1,
    });
    expect(proQuotaUnits({ priceUsd: 0.0000009, share: 1 })).toEqual({
      ok: true,
      units: 1,
    });
    expect(proQuotaUnits({ priceUsd: 0.0000004, share: 1 })).toEqual({
      ok: false,
      code: 'PRICE',
    });
  });

  it('five million tokens at one dollar per million is exactly five dollars, 5,000,000 units', () => {
    expect(
      callWorstCaseMicroUsd(
        call({ price: { price_in: 1, price_out: 0 }, promptTokens: 5_000_000 }),
        0
      )
    ).toBe(5_000_000);
  });
});

describe('the ledger’s bound is a boundary', () => {
  const over = (maxOutputTokens: number) =>
    estimateRequest(
      {
        understand: null,
        answer: call({
          price: { price_in: 0, price_out: 1_000 },
          maxOutputTokens,
        }),
      },
      0
    );

  it('a worst case with its regeneration of exactly 2,000,000,000 units is allowed, one more token is not', () => {
    expect(over(1_000_000)).toMatchObject({
      ok: true,
      withRegenerationUnits: MAX_UNITS,
    });
    expect(over(1_000_001)).toEqual({ ok: false, code: 'TOO_LARGE' });
  });

  it('the Understand prompt ceiling is the 5,000 tokens the intake path’s largest prompt is held under', () => {
    expect(UNDERSTAND_PROMPT_TOKENS_CEILING).toBe(5_000);
  });
});

describe('boundOf', () => {
  it('counts no image when none is given', () => {
    const bound = boundOf(
      {
        price_in: 1,
        price_out: 2,
        max_output_tokens: 3,
        calibration: {
          digitsPerToken: 3,
          lettersPerToken: 4,
          cjkCharsPerToken: 1,
          otherCharsPerToken: 2,
          marginBp: 0,
        },
      },
      10
    );
    expect(bound.imageTokens).toBe(0);
  });
});

describe('floorUnits: the order of the models does not matter, an unpriced one never lowers it', () => {
  const priced = {
    price_in: 0.5,
    price_out: 2,
    max_output_tokens: 2_048,
    calibration: {
      digitsPerToken: 3,
      lettersPerToken: 4,
      cjkCharsPerToken: 1,
      otherCharsPerToken: 2,
      marginBp: 1_000,
    },
  };
  const cheaper = { ...priced, price_in: 0.1, price_out: 0.4 };
  const unpriced = { ...priced, price_in: null, price_out: null };
  const floor = (models: (typeof priced)[]) =>
    floorUnits({
      kind: 'INSTANT',
      understandModel: null,
      answerModels: models,
    });

  it('is the same whichever order the models come in', () => {
    const expected = floor([cheaper]);
    expect(floor([priced, cheaper])).toBe(expected);
    expect(floor([cheaper, priced])).toBe(expected);
    expect(floor([cheaper, priced, unpriced])).toBe(expected);
    expect(floor([unpriced, cheaper, priced])).toBe(expected);
  });

  it('an unpriced model after a priced one does not erase it', () => {
    expect(floor([priced, unpriced as never])).toBe(floor([priced]));
    expect(floor([priced, unpriced as never])).toBeGreaterThan(1);
  });

  it('a typed question with a priced Understand model and nothing priced to answer is the Understand call alone', () => {
    const typed = floorUnits({
      kind: 'TYPED',
      understandModel: priced,
      answerModels: [unpriced],
    });
    const understandOnly = floorUnits({
      kind: 'TYPED',
      understandModel: priced,
      answerModels: [],
    });
    // worked out independently of floorUnits: the reply at its most, the prompt at its least (none)
    const expected = callWorstCaseUnits({
      ...boundOf(priced, 0),
      maxOutputTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
    });
    expect(typed).toBe(expected);
    expect(understandOnly).toBe(expected);
    expect(typed).toBeGreaterThan(1);
    // and an instant prompt has no Understand call, so nothing priced is one unit
    expect(
      floorUnits({
        kind: 'INSTANT',
        understandModel: priced,
        answerModels: [unpriced],
      })
    ).toBe(1);
  });
});

describe('a hold is at least one unit, and a free regeneration is always covered', () => {
  const free = estimateRequest({
    understand: null,
    answer: call({}),
  }) as Extract<ReturnType<typeof estimateRequest>, { ok: true }>;

  it('a request that costs nothing still holds one unit', () => {
    expect(free).toMatchObject({
      baseUnits: 0,
      regenerationUnits: 0,
      withRegenerationUnits: 0,
    });
    expect(reservationLadder(free)).toEqual([
      { units: 1, regeneration: false },
    ]);
  });

  it('a regeneration of one unit has a rung of its own', () => {
    expect(
      reservationLadder({
        ...free,
        baseUnits: 10,
        regenerationUnits: 1,
        withRegenerationUnits: 11,
      })
    ).toEqual([
      { units: 11, regeneration: true },
      { units: 10, regeneration: false },
    ]);
  });

  it('the meter says a free request may regenerate', async () => {
    const ledger: LedgerPort = {
      balance: jest.fn(),
      reserve: async (q) => ({
        ok: true,
        replayed: false,
        status: 'RESERVED',
        reservedUnits: q.units,
        balance: null,
      }),
      settle: jest.fn(),
      release: jest.fn(),
    };
    const meter = createMeter({
      ledger,
      now: () => 1_800_000_000_000,
      allowanceOf: () => 100,
      floorOf: () => 1,
    });
    expect(
      await meter.reserve({ requestId: 'r', userId: 'u', tier: 'PRO' }, free)
    ).toMatchObject({
      ok: true,
      reservedUnits: 1,
      regenerationAllowed: true,
    });
    expect(DEFAULT_RESERVATION_TTL_MS).toBe(600_000);
  });
});

describe('an allowance of one unit is an allowance', () => {
  const ledger = (available: number): LedgerPort => ({
    balance: async () => ({
      limit: 1,
      used: 1 - available,
      reserved: 0,
      available,
    }),
    reserve: async (q) => ({
      ok: true,
      replayed: false,
      status: 'RESERVED',
      reservedUnits: q.units,
      balance: null,
    }),
    settle: jest.fn(),
    release: jest.fn(),
  });
  const config = (available: number) => ({
    ledger: ledger(available),
    now: () => 1_800_000_000_000,
    allowanceOf: () => 1,
    floorOf: () => 1,
  });

  it('the gate lets a request through with one unit, and not with none', async () => {
    await expect(
      createQuotaPort(config(1)).precheck({
        userId: 'u',
        tier: 'PRO',
        kind: 'TYPED',
      })
    ).resolves.toEqual({ allowed: true });
    await expect(
      createQuotaPort(config(0)).precheck({
        userId: 'u',
        tier: 'PRO',
        kind: 'TYPED',
      })
    ).resolves.toEqual({ allowed: false });
  });

  it('the meter holds against an allowance of one unit', async () => {
    const meter = createMeter(config(1));
    const estimate = estimateRequest({ understand: null, answer: call({}) });
    expect(
      await meter.reserve(
        { requestId: 'r', userId: 'u', tier: 'PRO' },
        estimate
      )
    ).toMatchObject({ ok: true });
  });
});

describe('what a settlement reports, in full', () => {
  it('the result carries the spend it settled for, the charge, and the balance', async () => {
    const ledger: LedgerPort = {
      balance: jest.fn(),
      reserve: jest.fn(),
      settle: async () => ({
        ok: true,
        replayed: false,
        chargedUnits: 730,
        absorbedUnits: 0,
        balance: null,
      }),
      release: jest.fn(),
    };
    const meter = createMeter({
      ledger,
      now: () => 1_800_000_000_000,
      allowanceOf: () => 100,
      floorOf: () => 1,
    });
    const calls: SpentCall[] = [
      { model: 'v/a', costMicroUsd: 730, promptTokens: 9, completionTokens: 2 },
    ];
    expect(
      await meter.settle({ requestId: 'r', userId: 'u', tier: 'PRO' }, calls)
    ).toEqual({
      ok: true,
      replayed: false,
      chargedUnits: 730,
      absorbedUnits: 0,
      spend: {
        costMicroUsd: 730,
        actualUnits: 730,
        model: 'v/a',
        promptTokens: 9,
        completionTokens: 2,
        calls: 1,
      },
      balance: null,
    });
  });
});

describe('summarizeSpend: what is believed and what is not', () => {
  const spent = (over: Partial<SpentCall>): SpentCall => ({
    model: 'v/a',
    costMicroUsd: 1,
    promptTokens: 1,
    completionTokens: 1,
    ...over,
  });

  it('a negative or fractional cost is unknown: the cost itself is null, not the figure', () => {
    expect(
      summarizeSpend([spent({ costMicroUsd: -5 })]).costMicroUsd
    ).toBeNull();
    expect(
      summarizeSpend([spent({ costMicroUsd: 1.5 })]).costMicroUsd
    ).toBeNull();
    expect(
      summarizeSpend([spent({ promptTokens: -1 })]).promptTokens
    ).toBeNull();
    expect(
      summarizeSpend([spent({ completionTokens: 0.5 })]).completionTokens
    ).toBeNull();
  });

  it('a count that is unknown in a later call makes the sum unknown, for each of the three figures', () => {
    const known = spent({});
    expect(
      summarizeSpend([known, spent({ completionTokens: null })])
        .completionTokens
    ).toBeNull();
    expect(
      summarizeSpend([known, spent({ promptTokens: null })]).promptTokens
    ).toBeNull();
    expect(
      summarizeSpend([known, spent({ costMicroUsd: null })]).costMicroUsd
    ).toBeNull();
    // and an unknown in an EARLIER call is not made known by a later one
    expect(
      summarizeSpend([spent({ completionTokens: null }), known])
        .completionTokens
    ).toBeNull();
    expect(
      summarizeSpend([spent({ promptTokens: null }), known]).promptTokens
    ).toBeNull();
    expect(
      summarizeSpend([spent({ costMicroUsd: null }), known]).costMicroUsd
    ).toBeNull();
  });

  it('token sums up to the ledger’s bound are kept, and a sum above it is not believed', () => {
    const big = (n: number) => spent({ promptTokens: n, completionTokens: n });
    expect(summarizeSpend([big(MAX_UNITS)])).toMatchObject({
      promptTokens: MAX_UNITS,
      completionTokens: MAX_UNITS,
    });
    expect(summarizeSpend([big(MAX_UNITS), big(1)])).toMatchObject({
      promptTokens: null,
      completionTokens: null,
    });
    // a cost of zero with unknown tokens still settles
    expect(
      summarizeSpend([spent({ costMicroUsd: 0, promptTokens: null })])
        .actualUnits
    ).toBe(0);
  });
});
