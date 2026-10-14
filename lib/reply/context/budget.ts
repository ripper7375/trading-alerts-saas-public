/**
 * The budget of one request (build step 7 part 2; architecture 5.4, ADR-048, plan decision D7,
 * finding S7-F5).
 *
 * `min(19,600, the model's budget)`. The 19,600 is the sum of the ten caps and is counted in
 * the estimator's own tokens (the "starting values to re-measure per model" of 5.4). The model's
 * budget is what its context can take, and the estimator may count fewer tokens than the model's
 * own tokenizer, so the model's side is held back by the safety margin: a request fits when its
 * estimate, plus the margin, is within the model's budget. In the estimator's units that is
 * `floor(modelBudget / (1 + margin))`.
 *
 * With every component at its cap the total is exactly 19,600, so for a model whose budget
 * (less the margin) is at least that, nothing ever has to be cut for want of room, and the cut
 * order of ADR-048 is the rule for a smaller model, not an extra limit on a large one. The
 * budget is data: a model with a smaller context, or a request budget set lower, makes the cut
 * order fire.
 *
 * Pure.
 *
 * @module lib/reply/context/budget
 */

import type { ContextCaps } from './caps';
import type { TokenCalibration } from './tokens';

/** The largest model budget accepted: a typo guard, not a limit of any model. */
export const MAX_MODEL_BUDGET = 10_000_000;

export type BudgetProblem = 'MODEL_BUDGET' | 'ANSWER_RESERVE';

/** Whether the numbers a request supplies can be used; null when they can. */
export function budgetInputProblem(
  modelBudget: unknown,
  answerReserve: unknown
): BudgetProblem | null {
  if (
    typeof modelBudget !== 'number' ||
    !Number.isInteger(modelBudget) ||
    modelBudget < 1 ||
    modelBudget > MAX_MODEL_BUDGET
  ) {
    return 'MODEL_BUDGET';
  }
  if (
    typeof answerReserve !== 'number' ||
    !Number.isInteger(answerReserve) ||
    answerReserve < 0
  ) {
    return 'ANSWER_RESERVE';
  }
  return null;
}

/** The model's budget in the estimator's tokens: held back by the safety margin, rounded down. */
export function modelBudgetInEstimatorTokens(
  modelBudget: number,
  calibration: Readonly<TokenCalibration>
): number {
  return Math.floor((modelBudget * 10_000) / (10_000 + calibration.marginBp));
}

/** `min(the caps' total, the model's budget)`, in the estimator's tokens. */
export function effectiveBudget(
  caps: Pick<ContextCaps, 'total'>,
  modelBudget: number,
  calibration: Readonly<TokenCalibration>
): number {
  return Math.min(
    caps.total,
    modelBudgetInEstimatorTokens(modelBudget, calibration)
  );
}
