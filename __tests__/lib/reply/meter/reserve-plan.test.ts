/**
 * @jest-environment node
 */

/**
 * How a request holds its units and what it settles for (build step 7 part 6; ADR-050; decision D11).
 */

import type { RequestEstimate } from '@/lib/reply/meter/estimate';
import {
  reservationLadder,
  summarizeSpend,
  type SpentCall,
} from '@/lib/reply/meter/reserve-plan';
import { MAX_UNITS } from '@/lib/reply/meter/units';

const OK = (over: Partial<Extract<RequestEstimate, { ok: true }>> = {}) =>
  ({
    ok: true,
    understandUnits: 792,
    answerUnits: 10_556,
    regenerationUnits: 10_556,
    baseUnits: 11_348,
    withRegenerationUnits: 21_904,
    ...over,
  }) as Extract<RequestEstimate, { ok: true }>;

describe('reservationLadder', () => {
  it('tries the base with one regeneration first, then the base alone', () => {
    expect(reservationLadder(OK())).toEqual([
      { units: 21_904, regeneration: true },
      { units: 11_348, regeneration: false },
    ]);
  });

  it('has only the base when there is no regeneration to hold', () => {
    expect(
      reservationLadder(
        OK({ regenerationUnits: 0, withRegenerationUnits: 11_348 })
      )
    ).toEqual([{ units: 11_348, regeneration: false }]);
  });

  it('goes from the most to the least, never the other way', () => {
    const rungs = reservationLadder(OK());
    expect(rungs.map((r) => r.units)).toEqual(
      [...rungs.map((r) => r.units)].sort((a, b) => b - a)
    );
  });
});

const call = (over: Partial<SpentCall> = {}): SpentCall => ({
  model: 'google/gemini-3.6-flash',
  costMicroUsd: 100,
  promptTokens: 1_000,
  completionTokens: 200,
  ...over,
});

describe('summarizeSpend', () => {
  it('sums the cost, the tokens, and takes the last model that was named', () => {
    expect(
      summarizeSpend([
        call({
          model: 'vendor/understand',
          costMicroUsd: 30,
          promptTokens: 400,
          completionTokens: 50,
        }),
        call({
          model: 'vendor/answer',
          costMicroUsd: 700,
          promptTokens: 9_000,
          completionTokens: 1_500,
        }),
      ])
    ).toEqual({
      costMicroUsd: 730,
      actualUnits: 730,
      model: 'vendor/answer',
      promptTokens: 9_400,
      completionTokens: 1_550,
      calls: 2,
    });
  });

  it('a regeneration is a call like another: the cost of both is charged', () => {
    const spend = summarizeSpend([
      call({ costMicroUsd: 700 }),
      call({ costMicroUsd: 650 }),
    ]);
    expect(spend.actualUnits).toBe(1_350);
    expect(spend.calls).toBe(2);
  });

  it('an unknown cost makes the sum unknown: the whole reservation is then charged, never nothing', () => {
    const spend = summarizeSpend([
      call({ costMicroUsd: 700 }),
      call({ costMicroUsd: null }),
    ]);
    expect(spend.costMicroUsd).toBeNull();
    expect(spend.actualUnits).toBeNull();
    expect(spend.calls).toBe(2);
    // the tokens it did report are still reported
    expect(spend.promptTokens).toBe(2_000);
  });

  it('an unknown token count makes that count unknown and nothing else', () => {
    const spend = summarizeSpend([call(), call({ promptTokens: null })]);
    expect(spend.promptTokens).toBeNull();
    expect(spend.completionTokens).toBe(400);
    expect(spend.costMicroUsd).toBe(200);
  });

  it('a cost of zero is a cost (a free call), not an unknown one', () => {
    const spend = summarizeSpend([call({ costMicroUsd: 0 })]);
    expect(spend.costMicroUsd).toBe(0);
    expect(spend.actualUnits).toBe(0);
  });

  it.each([
    ['a negative cost', { costMicroUsd: -5 }],
    ['a fractional cost', { costMicroUsd: 1.5 }],
    ['a NaN cost', { costMicroUsd: Number.NaN }],
  ])('%s is unknown, not believed', (_n, over) => {
    expect(summarizeSpend([call(over)]).actualUnits).toBeNull();
  });

  it('a sum the ledger cannot hold is not believed either', () => {
    const spend = summarizeSpend([
      call({ costMicroUsd: MAX_UNITS }),
      call({ costMicroUsd: 1 }),
    ]);
    expect(spend.costMicroUsd).toBeNull();
    expect(spend.actualUnits).toBeNull();
    // the largest sum it can hold is held
    expect(
      summarizeSpend([call({ costMicroUsd: MAX_UNITS })]).actualUnits
    ).toBe(MAX_UNITS);
  });

  it('keeps the model of a call that named none from erasing the one before', () => {
    expect(
      summarizeSpend([
        call({ model: 'vendor/answer' }),
        call({ model: null }),
        call({ model: '' }),
      ]).model
    ).toBe('vendor/answer');
    expect(summarizeSpend([call({ model: null })]).model).toBeNull();
  });

  it('says there were no calls when there were none (the caller releases instead of settling)', () => {
    expect(summarizeSpend([])).toMatchObject({
      calls: 0,
      costMicroUsd: 0,
      actualUnits: 0,
      model: null,
    });
  });
});
