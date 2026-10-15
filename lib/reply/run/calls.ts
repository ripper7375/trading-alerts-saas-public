/**
 * What a model call becomes in the books and in the trace (build step 7 part 7a).
 *
 * One call result has two readers. The METER wants the paid calls: a call that answered is paid
 * for, and what it cost is the gateway's figure (or null, in which case the whole hold is
 * charged: a paid call is never free). A call that failed with no answer is not recorded as
 * spent, because no usage came back to price it: the provider billed nothing we can know of, and
 * charging the trader for it would be a guess. The TRACE wants every call that was made, in
 * order, with its outcome, so that support can see a fallback, a timeout and a regeneration.
 *
 * Pure.
 *
 * @module lib/reply/run/calls
 */

import type {
  ModelCallOutcome,
  ModelCallRecord,
  ModelCallRole,
} from '../contracts/trace-fields';
import type { ModelCallResult } from '../gateway/types';
import type { SpentCall } from '../meter/reserve-plan';

/** The paid call the meter records, or null when the call produced no answer to pay for. */
export function spentOf(result: ModelCallResult): SpentCall | null {
  if (!result.ok) return null;
  return {
    model: result.model,
    costMicroUsd: result.usage.cost_micro_usd,
    promptTokens: result.usage.prompt_tokens,
    completionTokens: result.usage.completion_tokens,
  };
}

/** A call refused before anything was sent (`attempts` 0): nothing happened, so nothing is recorded. */
export const wasSent = (result: ModelCallResult): boolean =>
  result.attempts > 0;

/**
 * The trace's record of one call. `outcome` is the caller's for an answer that arrived (it knows
 * whether the JSON parsed and the schema held); a failure is a TIMEOUT or an ERROR.
 */
export function callRecordOf(
  role: ModelCallRole,
  result: ModelCallResult,
  outcome: ModelCallOutcome = 'OK'
): ModelCallRecord {
  if (!result.ok) {
    return {
      role,
      model: result.model,
      outcome: result.code === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR',
      attempts: Math.min(Math.max(result.attempts, 1), 5),
      tokens_prompt: null,
      tokens_completion: null,
      tokens_cached: null,
      cost_micro_usd: null,
      cost_estimated: false,
      latency_ms: Math.max(0, Math.round(result.latency_ms)),
    };
  }
  return {
    role,
    model: result.model,
    outcome,
    attempts: Math.min(Math.max(result.attempts, 1), 5),
    tokens_prompt: result.usage.prompt_tokens,
    tokens_completion: result.usage.completion_tokens,
    tokens_cached: result.usage.cached_tokens,
    cost_micro_usd: result.usage.cost_micro_usd,
    cost_estimated: result.usage.cost_flag !== null,
    latency_ms: Math.max(0, Math.round(result.latency_ms)),
  };
}

const sumOrNull = (values: readonly (number | null)[]): number | null => {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
};

/** The real token counts of the calls that wrote an answer, summed; null where any call did not say. */
export function answerTokens(calls: readonly ModelCallRecord[]): {
  prompt: number | null;
  completion: number | null;
  cached: number | null;
} {
  const wrote = calls.filter(
    (call) =>
      call.role !== 'UNDERSTAND' &&
      call.outcome !== 'TIMEOUT' &&
      call.outcome !== 'ERROR'
  );
  if (wrote.length === 0)
    return { prompt: null, completion: null, cached: null };
  return {
    prompt: sumOrNull(wrote.map((call) => call.tokens_prompt)),
    completion: sumOrNull(wrote.map((call) => call.tokens_completion)),
    cached: sumOrNull(wrote.map((call) => call.tokens_cached)),
  };
}

/** What the whole request cost the provider, summed over the calls that answered; null when any answer's cost is unknown. */
export function totalCost(calls: readonly ModelCallRecord[]): number | null {
  const answered = calls.filter(
    (call) => call.outcome !== 'TIMEOUT' && call.outcome !== 'ERROR'
  );
  if (answered.length === 0) return null;
  return sumOrNull(answered.map((call) => call.cost_micro_usd));
}
