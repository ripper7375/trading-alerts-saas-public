/**
 * How a request holds its units, and what it settles for (build step 7 part 6; architecture 5.6,
 * ADR-050; decision D11).
 *
 * THE LADDER. A request's worst case (`estimate.ts`) is the Understand call and the answer, and
 * ONE regeneration if the balance allows. "If the balance allows" is decided by the ledger, not by
 * a balance this code read a moment ago: the ledger's reservation is the one place the balance is
 * checked, atomically. So the plan is a ladder of holds to try, from the most to the least: the
 * base and one regeneration, then the base alone. The first the ledger grants is the hold; a
 * request granted only the base may not regenerate (a number still wrong then is shown as "not
 * verified", decision D11); a request granted neither is refused with the balance, before any
 * model is called (architecture 5.14 item 2).
 *
 * WHAT A REQUEST SETTLES FOR. The calls that were actually made and paid for are reported as they
 * finish (`SpentCall`); the settlement is their cost, summed, in units. A call whose cost the
 * gateway could not say makes the whole sum unknown, and an unknown cost charges the whole
 * reservation: a paid call is never free, and the trader is never charged more than was held. No
 * call made means nothing was spent, and the reservation is released instead.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/meter/reserve-plan
 */

import type { RequestEstimate } from './estimate';
import { MAX_UNITS, microUsdToUnits } from './units';

export interface Hold {
  /** units to hold */
  units: number;
  /** whether the hold includes the regeneration */
  regeneration: boolean;
}

/** The holds to try, in order: the base with a regeneration, then the base alone. */
export function reservationLadder(
  estimate: Extract<RequestEstimate, { ok: true }>
): Hold[] {
  const holds: Hold[] = [];
  if (estimate.regenerationUnits > 0) {
    holds.push({ units: estimate.withRegenerationUnits, regeneration: true });
  }
  // a hold is at least one unit: a worst case of nothing (a free model) still holds the one the ledger needs
  holds.push({ units: Math.max(estimate.baseUnits, 1), regeneration: false });
  return holds;
}

/** One paid call a request made, as the gateway reported it. */
export interface SpentCall {
  /** the model slug, when the call named one */
  model: string | null;
  /** the cost in micro-dollars; null when the gateway could not say */
  costMicroUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
}

export interface Spend {
  /** the sum of the costs, or null when any call's cost is unknown (the whole reservation is then charged) */
  costMicroUsd: number | null;
  /** the cost in units (D2: the same number), or null with the cost */
  actualUnits: number | null;
  /** the model of the last call that named one: the model that wrote the reply */
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  calls: number;
}

const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Sum what the calls cost. At least one call: with none there is nothing to settle. */
export function summarizeSpend(calls: readonly SpentCall[]): Spend {
  let cost: number | null = 0;
  let prompt: number | null = 0;
  let completion: number | null = 0;
  let model: string | null = null;
  for (const call of calls) {
    cost =
      cost !== null && whole(call.costMicroUsd)
        ? cost + call.costMicroUsd
        : null;
    prompt =
      prompt !== null && whole(call.promptTokens)
        ? prompt + call.promptTokens
        : null;
    completion =
      completion !== null && whole(call.completionTokens)
        ? completion + call.completionTokens
        : null;
    if (typeof call.model === 'string' && call.model !== '') model = call.model;
  }
  // a sum the ledger cannot hold is not believed: the whole reservation is charged instead
  if (cost !== null && cost > MAX_UNITS) cost = null;
  if (prompt !== null && prompt > MAX_UNITS) prompt = null;
  if (completion !== null && completion > MAX_UNITS) completion = null;
  return {
    costMicroUsd: cost,
    actualUnits: cost === null ? null : microUsdToUnits(cost),
    model,
    promptTokens: prompt,
    completionTokens: completion,
    calls: calls.length,
  };
}
