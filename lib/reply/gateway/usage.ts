/**
 * Usage and cost capture (build step 7 part 3; architecture 5.6, ADR-050; decision D2).
 *
 * Units follow ACTUAL COST (ADR-050), so what this file produces is the number the quota ledger
 * (part 6) charges: the provider's reported cost, as an integer in micro-dollars. A float is never
 * stored. The three outcomes:
 *
 *  1. The provider reported a cost (`usage.cost`, in US dollars, because the request asked for the
 *     usage block): `cost_micro_usd` is that figure rounded to a whole micro-dollar and
 *     `cost_flag` is null.
 *  2. It did not (or sent something that cannot be a cost: not a number, negative, or more than
 *     $100 for one call), and the registry has a dated price and the provider gave both token
 *     counts: `cost_micro_usd` is the price times the tokens, in exact integer arithmetic, and
 *     `cost_flag` is `COST_ESTIMATED`. Cached input is priced as ordinary input, so the estimate is
 *     never below the truth.
 *  3. Neither: `cost_micro_usd` is null and `cost_flag` is `COST_ESTIMATED`. The caller must not
 *     treat the call as free.
 *
 * A token count that is not a whole number of at least zero is null. `cached_tokens` above
 * `prompt_tokens` cannot be right and is null.
 *
 * A US dollar is a million micro-dollars, and a price in USD per million tokens is therefore also
 * micro-dollars per token, so the estimate is `price_in * prompt + price_out * completion`. The
 * registry holds a price to six decimals at most, so the arithmetic below is done on integers.
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/gateway/usage
 */

import 'server-only';

import { GATEWAY_COST_FLAG, type UsageCapture } from './types';

/** The most one call can plausibly cost, in micro-dollars: $100. A larger "reported" cost is not believed. */
export const MAX_CALL_COST_MICRO_USD = 100_000_000;

const MICRO_PER_USD = 1_000_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A count of tokens: a whole number of at least zero, else null. */
function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** US dollars to whole micro-dollars, rounded to the nearest; null for anything that is not a believable cost. */
export function usdToMicro(usd: unknown): number | null {
  if (typeof usd !== 'number' || !Number.isFinite(usd) || usd < 0) return null;
  const micro = Math.round(usd * MICRO_PER_USD);
  return micro <= MAX_CALL_COST_MICRO_USD ? micro : null;
}

/**
 * The cost of a call at a registry price, in whole micro-dollars (rounded to the nearest), or null
 * when a price or a count is missing. Prices are USD per million tokens with at most six decimals.
 */
export function costFromPrice(
  price: { price_in: number | null; price_out: number | null },
  promptTokens: number | null,
  completionTokens: number | null
): number | null {
  if (
    price.price_in === null ||
    price.price_out === null ||
    promptTokens === null ||
    completionTokens === null
  ) {
    return null;
  }
  // prices as integers of 1e-6 micro-dollars per token, so nothing is rounded until the end
  const inScaled = BigInt(Math.round(price.price_in * MICRO_PER_USD));
  const outScaled = BigInt(Math.round(price.price_out * MICRO_PER_USD));
  const scaled =
    inScaled * BigInt(promptTokens) + outScaled * BigInt(completionTokens);
  const micro = Number(
    (scaled + BigInt(MICRO_PER_USD / 2)) / BigInt(MICRO_PER_USD)
  );
  return micro <= MAX_CALL_COST_MICRO_USD ? micro : null;
}

/** What the provider's `usage` block says, with the registry price as the fallback for the cost. */
export function extractUsage(
  body: unknown,
  price: { price_in: number | null; price_out: number | null } | null
): UsageCapture {
  const usage = isRecord(body) && isRecord(body['usage']) ? body['usage'] : {};
  const prompt = count(usage['prompt_tokens']);
  const completion = count(usage['completion_tokens']);
  const details = isRecord(usage['prompt_tokens_details'])
    ? usage['prompt_tokens_details']
    : {};
  let cached = count(details['cached_tokens']);
  if (cached !== null && prompt !== null && cached > prompt) cached = null;

  const reported = usdToMicro(usage['cost']);
  if (reported !== null) {
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      cached_tokens: cached,
      cost_micro_usd: reported,
      cost_flag: null,
    };
  }
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    cached_tokens: cached,
    cost_micro_usd:
      price === null ? null : costFromPrice(price, prompt, completion),
    cost_flag: GATEWAY_COST_FLAG,
  };
}
