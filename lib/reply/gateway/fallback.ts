/**
 * The fallback model (build step 7 part 3; architecture 5.10, 7.6; ADR-055).
 *
 * "One default and one fallback from another provider": when the model that was asked first
 * fails, the second one, of another vendor, is asked, and what each of them cost is reported
 * separately so that the quota ledger (part 6) can settle each under its own reservation line.
 * This is OUR logic and not OpenRouter's own model fallback, because the fallback must be a
 * model that was recorded, priced and evaluated. If both fail the outcome says so, with each
 * code, and the orchestrator (part 7) sends the board-only fixed answer (7.6).
 *
 * WHEN THE FALLBACK IS ASKED. After the primary fails for any reason except one: the request's own
 * deadline passed (`ABORTED`), because a second model cannot meet a deadline that is gone. A
 * timeout, a network error, a 429, a 5xx, a refused request (a 400 or 404 can be one host's
 * problem), a body that is not a completion: all ask the fallback. A failed call at 401, 402 or
 * 403 will fail again at the same account, but the second call costs nothing and the fixed answer
 * waits on it either way, so it is asked too.
 *
 * WHEN IT IS NOT. When none is named or it is switched off (`NO_FALLBACK`); when it is the same
 * vendor as the primary (`SAME_PROVIDER`, ADR-055: the registry refuses such a pair, this is the
 * second lock for ports built by hand); when the deadline has passed (`ABORTED`). A prompt that is
 * too large for the fallback's window, or a chart the fallback cannot read, is refused by the
 * fallback port itself with a code and NOTHING sent (a call of zero attempts, nothing to charge):
 * it shows in the attempts, so the trace says why the second model did not answer.
 *
 * Each model is asked at most once per request, and each has its own retry (one) inside its port.
 *
 * Pure but for the ports it calls: no I/O of its own, no clock, no randomness.
 *
 * @module lib/reply/gateway/fallback
 */

import type { LaunchPlan } from './registry';
import { vendorOf } from './registry';
import {
  ANSWER_TIMEOUT_MS,
  FALLBACK_TIMEOUT_MS,
  createOpenRouterModelPort,
  type CallOptions,
} from './openrouter';
import type {
  GatewayConfig,
  GatewayErrorCode,
  ModelAnswer,
  ModelCallResult,
  ModelPort,
  ModelRequest,
} from './types';

export type ModelSlot = 'PRIMARY' | 'FALLBACK';

export interface ModelAttempt {
  slot: ModelSlot;
  result: ModelCallResult;
}

/** Why the fallback was not asked after the primary failed. */
export type FallbackSkipReason = 'NO_FALLBACK' | 'SAME_PROVIDER' | 'ABORTED';

export interface FallbackOutcome {
  /** the answer that was used, or null when nobody answered */
  answer: ModelAnswer | null;
  answered_by: ModelSlot | null;
  /** every model that was asked, in order; each is a call of its own with its own usage */
  attempts: readonly ModelAttempt[];
  /** set only when the primary failed and the fallback was not asked */
  fallback_skipped: FallbackSkipReason | null;
  /** when nobody answered: the code of the last failure, or `NO_MODEL` when no model was named */
  failure: GatewayErrorCode | 'NO_MODEL' | null;
}

export interface FallbackPorts {
  primary: ModelPort | null;
  fallback: ModelPort | null;
}

/** The two ports of a launch plan: the primary waits 25 s an attempt, the fallback 20 s (decision D23). */
export function launchPorts(
  config: GatewayConfig | null,
  plan: LaunchPlan,
  options: CallOptions = {}
): FallbackPorts {
  return {
    primary:
      plan.primary === null
        ? null
        : createOpenRouterModelPort(config, plan.primary, {
            ...options,
            defaultTimeoutMs: ANSWER_TIMEOUT_MS,
          }),
    fallback:
      plan.fallback === null
        ? null
        : createOpenRouterModelPort(config, plan.fallback, {
            ...options,
            defaultTimeoutMs: FALLBACK_TIMEOUT_MS,
          }),
  };
}

/** Ask the primary; if it fails, ask the fallback; report every call. */
export async function completeWithFallback(
  ports: FallbackPorts,
  request: ModelRequest
): Promise<FallbackOutcome> {
  if (ports.primary === null) {
    return {
      answer: null,
      answered_by: null,
      attempts: [],
      fallback_skipped: null,
      failure: 'NO_MODEL',
    };
  }
  const first = await ports.primary.complete(request);
  const attempts: ModelAttempt[] = [{ slot: 'PRIMARY', result: first }];
  if (first.ok) {
    return {
      answer: first,
      answered_by: 'PRIMARY',
      attempts,
      fallback_skipped: null,
      failure: null,
    };
  }

  const skipped = skipReason(ports, first.code, request);
  if (skipped !== null || ports.fallback === null) {
    return {
      answer: null,
      answered_by: null,
      attempts,
      fallback_skipped: skipped,
      failure: first.code,
    };
  }

  // the fallback may be asked for less than the request, never for more than it can write
  const second = await ports.fallback.complete({
    ...request,
    max_output_tokens: Math.min(
      request.max_output_tokens,
      ports.fallback.target.max_output_tokens
    ),
  });
  attempts.push({ slot: 'FALLBACK', result: second });
  if (second.ok) {
    return {
      answer: second,
      answered_by: 'FALLBACK',
      attempts,
      fallback_skipped: null,
      failure: null,
    };
  }
  return {
    answer: null,
    answered_by: null,
    attempts,
    fallback_skipped: null,
    failure: second.code,
  };
}

function skipReason(
  ports: FallbackPorts,
  primaryFailure: GatewayErrorCode,
  request: ModelRequest
): FallbackSkipReason | null {
  if (primaryFailure === 'ABORTED' || request.signal?.aborted === true) {
    return 'ABORTED';
  }
  if (ports.fallback === null) return 'NO_FALLBACK';
  if (
    ports.primary !== null &&
    vendorOf(ports.primary.target.slug) === vendorOf(ports.fallback.target.slug)
  ) {
    return 'SAME_PROVIDER';
  }
  return null;
}
