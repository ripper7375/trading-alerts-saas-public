/**
 * @jest-environment node
 */

import {
  MAX_MODEL_BUDGET,
  budgetInputProblem,
  effectiveBudget,
  modelBudgetInEstimatorTokens,
} from '@/lib/reply/context/budget';
import { CONTEXT_CAPS } from '@/lib/reply/context/caps';
import { DEFAULT_CALIBRATION, withMargin } from '@/lib/reply/context/tokens';

describe('budgetInputProblem', () => {
  it('puts the largest model budget at exactly ten million, in numbers and not in the constant', () => {
    expect(MAX_MODEL_BUDGET).toBe(10_000_000);
    expect(budgetInputProblem(10_000_000, 0)).toBeNull();
    expect(budgetInputProblem(10_000_001, 0)).toBe('MODEL_BUDGET');
    expect(budgetInputProblem(9_999_999, 0)).toBeNull();
  });

  it('accepts a model budget from 1 to the maximum and an answer reserve of zero or more', () => {
    expect(budgetInputProblem(1, 0)).toBeNull();
    expect(budgetInputProblem(32_000, 1_500)).toBeNull();
    expect(budgetInputProblem(MAX_MODEL_BUDGET, 1_500)).toBeNull();
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    '32000',
    null,
    undefined,
    MAX_MODEL_BUDGET + 1,
  ])('refuses a model budget of %p', (bad) => {
    expect(budgetInputProblem(bad, 1_500)).toBe('MODEL_BUDGET');
  });

  it.each([-1, 1.5, Number.NaN, '1500', null, undefined])(
    'refuses an answer reserve of %p',
    (bad) => {
      expect(budgetInputProblem(32_000, bad)).toBe('ANSWER_RESERVE');
    }
  );
});

describe("the model's budget in the estimator's tokens (held back by the margin)", () => {
  it('divides by one plus the margin, rounding down', () => {
    expect(modelBudgetInEstimatorTokens(22_000, DEFAULT_CALIBRATION)).toBe(
      20_000
    );
    expect(modelBudgetInEstimatorTokens(21_560, DEFAULT_CALIBRATION)).toBe(
      19_600
    );
    expect(modelBudgetInEstimatorTokens(21_559, DEFAULT_CALIBRATION)).toBe(
      19_599
    );
    expect(modelBudgetInEstimatorTokens(10, DEFAULT_CALIBRATION)).toBe(9);
    expect(modelBudgetInEstimatorTokens(100, DEFAULT_CALIBRATION)).toBe(90);
  });

  it("is the model's budget itself with no margin", () => {
    expect(
      modelBudgetInEstimatorTokens(32_000, {
        ...DEFAULT_CALIBRATION,
        marginBp: 0,
      })
    ).toBe(32_000);
  });

  it('shrinks with a larger margin', () => {
    expect(
      modelBudgetInEstimatorTokens(30_000, {
        ...DEFAULT_CALIBRATION,
        marginBp: 5000,
      })
    ).toBe(20_000);
  });

  it("always leaves a request that fits it within the model's own budget once the margin is added back", () => {
    for (const marginBp of [0, 1, 500, 1000, 2500, 3333, 10_000]) {
      const calibration = { ...DEFAULT_CALIBRATION, marginBp };
      for (let budget = 1; budget <= 3000; budget += 7) {
        const inside = modelBudgetInEstimatorTokens(budget, calibration);
        expect(withMargin(inside, calibration)).toBeLessThanOrEqual(budget);
        // and it is the largest number that does: one more would not fit
        expect(withMargin(inside + 1, calibration)).toBeGreaterThan(budget);
      }
    }
  });
});

describe("effectiveBudget: min(19,600, the model's budget)", () => {
  it('is the total of the caps for a large model', () => {
    expect(effectiveBudget(CONTEXT_CAPS, 200_000, DEFAULT_CALIBRATION)).toBe(
      19_600
    );
    expect(effectiveBudget(CONTEXT_CAPS, 21_560, DEFAULT_CALIBRATION)).toBe(
      19_600
    );
  });

  it("is the model's budget less the margin for a smaller one", () => {
    expect(effectiveBudget(CONTEXT_CAPS, 21_559, DEFAULT_CALIBRATION)).toBe(
      19_599
    );
    expect(effectiveBudget(CONTEXT_CAPS, 16_000, DEFAULT_CALIBRATION)).toBe(
      14_545
    );
    expect(effectiveBudget(CONTEXT_CAPS, 8_192, DEFAULT_CALIBRATION)).toBe(
      7_447
    );
  });

  it('follows the total of a different table', () => {
    expect(
      effectiveBudget({ total: 10_000 }, 200_000, DEFAULT_CALIBRATION)
    ).toBe(10_000);
    expect(
      effectiveBudget({ total: 30_000 }, 22_000, DEFAULT_CALIBRATION)
    ).toBe(20_000);
  });

  it('is the same model budget with a different calibration giving a different budget', () => {
    expect(
      effectiveBudget(CONTEXT_CAPS, 20_000, {
        ...DEFAULT_CALIBRATION,
        marginBp: 0,
      })
    ).toBe(19_600);
    expect(effectiveBudget(CONTEXT_CAPS, 20_000, DEFAULT_CALIBRATION)).toBe(
      18_181
    );
  });
});
