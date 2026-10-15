/**
 * The worst-case cost of a request, in units (build step 7 part 6; architecture 5.6, ADR-050).
 *
 * ADR-050: "units from actual cost; reserve the worst case". Before a request calls a model, the
 * ledger holds the most it could cost, so that a request can never leave a trader's balance below
 * zero and a trader who cannot pay for the worst case is refused BEFORE any model is called
 * (architecture 5.14 item 2). What is actually spent is settled afterwards and the rest is given
 * back; nothing here charges.
 *
 * The worst case of one call is the registry's dated price (USD per million tokens, which is also
 * micro-dollars per token) times the most tokens the call can use:
 *   - the PROMPT at its most: the estimator's count before the margin, carried to the model's own
 *     tokens by the model's calibration margin (`withMargin`), plus the image if a chart is sent;
 *     cached input is priced as ordinary input, so a cache can only make the call cheaper;
 *   - the REPLY at its most: `max_output_tokens`, which the request itself caps;
 * rounded UP to a whole micro-dollar, then carried up by `COST_MARGIN_BP` for a price that moved or
 * a host that charges more than the one the registry price was read from (a reading of the part 6
 * hand-off: 10%, the same as the starting calibration margin; the measurement of S3 replaces it).
 *
 * A request is the Understand call (typed questions only) plus the answer call, plus ONE
 * regeneration, which is a second answer call, if the balance can hold it (decision D11: one
 * regeneration shared by the number check and the wording check). All the arithmetic is on
 * integers (BigInt for the product of a price and a count), so a price with six decimals and a
 * count of millions of tokens cannot lose a micro-dollar to a float.
 *
 * A call whose price is not known (a registry row nobody has priced) has no worst case: the
 * result says which call, and the caller refuses to go on (fail closed). The one exception is the
 * FLOOR, a lower bound that may leave an unpriced call out (see `floorUnits`).
 *
 * Pure: no I/O, no clock, no randomness.
 *
 * @module lib/reply/meter/estimate
 */

import { SYSTEM_RULES_TEXT, WORDING_GUIDE_TEXT } from '../context/static-text';
import {
  DEFAULT_CALIBRATION,
  estimateRawTokens,
  withMargin,
} from '../context/tokens';
import type { ModelTarget } from '../gateway/types';

import { MAX_UNITS, microUsdToUnits } from './units';

/** The margin on the cost of a call, in basis points: 1000 is 10%. */
export const COST_MARGIN_BP = 1_000;
/** The least balance the gate lets a request through with: an empty account is refused. */
export const MIN_FLOOR_UNITS = 1;
/**
 * The most the Understand call's prompt holds, in the estimator's tokens before the margin: its
 * fixed system text, a question of at most 1,000 characters (counted at a token a character, the
 * densest script) and the most glossary hints of one request at their longest. The largest the
 * intake path can build counts 4,023 today; a test holds this above it, so growing the system text
 * or the hint limit fails there before it can under-reserve.
 */
export const UNDERSTAND_PROMPT_TOKENS_CEILING = 5_000;
/** The most the Understand call writes (`UNDERSTAND_MAX_TOKENS` of the gateway adapter; a test holds the two equal). */
export const UNDERSTAND_MAX_OUTPUT_TOKENS = 700;
/** The estimator's count of the static prompt prefix (the rules and the wording guide): no prompt is smaller. */
export const STATIC_PROMPT_TOKENS = estimateRawTokens(
  `${SYSTEM_RULES_TEXT}\n${WORDING_GUIDE_TEXT}`
);

export interface CallBound {
  price: { price_in: number | null; price_out: number | null };
  /** estimator tokens of the prompt BEFORE the margin: the most the prompt can hold */
  promptTokens: number;
  /** tokens an attached image costs, in the model's own units; 0 or absent when no chart is sent */
  imageTokens?: number;
  /** the most the call is asked to write */
  maxOutputTokens: number;
  calibration: { marginBp: number };
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** USD per million tokens, with at most six decimals, as an integer number of micro-dollars per million tokens. */
function scaledPrice(price: number | null): bigint | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    return null;
  }
  return BigInt(Math.round(price * 1_000_000));
}

const ceilDiv = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator - BigInt(1)) / denominator;

/**
 * The worst-case cost of one call in micro-dollars, rounded up, margin included; null when the
 * price is unknown or any figure is not a whole number of at least zero.
 */
export function callWorstCaseMicroUsd(
  call: CallBound,
  marginBp: number = COST_MARGIN_BP
): number | null {
  const priceIn = scaledPrice(call.price.price_in);
  const priceOut = scaledPrice(call.price.price_out);
  const image = call.imageTokens ?? 0;
  if (
    priceIn === null ||
    priceOut === null ||
    !isCount(call.promptTokens) ||
    !isCount(call.maxOutputTokens) ||
    !isCount(image) ||
    !isCount(marginBp) ||
    !isCount(call.calibration.marginBp)
  ) {
    return null;
  }
  const promptModelTokens =
    withMargin(call.promptTokens, {
      ...DEFAULT_CALIBRATION,
      marginBp: call.calibration.marginBp,
    }) + image;
  // price × tokens, in millionths of a micro-dollar
  const scaled =
    priceIn * BigInt(promptModelTokens) +
    priceOut * BigInt(call.maxOutputTokens);
  const micro = ceilDiv(scaled, BigInt(1_000_000));
  const withMarginMicro = ceilDiv(
    micro * BigInt(10_000 + marginBp),
    BigInt(10_000)
  );
  if (withMarginMicro > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(withMarginMicro);
}

/** The worst case of one call in units, or null (see `callWorstCaseMicroUsd`). */
export function callWorstCaseUnits(
  call: CallBound,
  marginBp: number = COST_MARGIN_BP
): number | null {
  const micro = callWorstCaseMicroUsd(call, marginBp);
  return micro === null ? null : microUsdToUnits(micro);
}

/** The bound of a call to a registry model: its price, its reply limit and its calibration. */
export function boundOf(
  model: Pick<
    ModelTarget,
    'price_in' | 'price_out' | 'max_output_tokens' | 'calibration'
  >,
  promptTokens: number,
  imageTokens = 0
): CallBound {
  return {
    price: { price_in: model.price_in, price_out: model.price_out },
    promptTokens,
    imageTokens,
    maxOutputTokens: model.max_output_tokens,
    calibration: model.calibration,
  };
}

export interface RequestBounds {
  /** the Understand call of a typed question; null for an instant prompt, which has none */
  understand: CallBound | null;
  answer: CallBound;
}

export type RequestEstimate =
  | {
      ok: true;
      understandUnits: number;
      answerUnits: number;
      /** one more answer call, at the same bounds */
      regenerationUnits: number;
      /** the Understand call and the answer */
      baseUnits: number;
      /** the base and one regeneration */
      withRegenerationUnits: number;
    }
  | { ok: false; code: 'PRICE_UNKNOWN'; call: 'understand' | 'answer' }
  | { ok: false; code: 'TOO_LARGE' };

/** The worst case of a request, in units, with and without the regeneration. */
export function estimateRequest(
  bounds: RequestBounds,
  marginBp: number = COST_MARGIN_BP
): RequestEstimate {
  let understandUnits = 0;
  if (bounds.understand !== null) {
    const units = callWorstCaseUnits(bounds.understand, marginBp);
    if (units === null) {
      return { ok: false, code: 'PRICE_UNKNOWN', call: 'understand' };
    }
    understandUnits = units;
  }
  const answerUnits = callWorstCaseUnits(bounds.answer, marginBp);
  if (answerUnits === null) {
    return { ok: false, code: 'PRICE_UNKNOWN', call: 'answer' };
  }
  const baseUnits = understandUnits + answerUnits;
  const withRegenerationUnits = baseUnits + answerUnits;
  if (withRegenerationUnits > MAX_UNITS)
    return { ok: false, code: 'TOO_LARGE' };
  return {
    ok: true,
    understandUnits,
    answerUnits,
    regenerationUnits: answerUnits,
    baseUnits,
    withRegenerationUnits,
  };
}

export type FloorKind = 'TYPED' | 'INSTANT';

export interface FloorInput {
  kind: FloorKind;
  /** the model that reads a typed question, when the environment names one the registry prices */
  understandModel: Pick<
    ModelTarget,
    'price_in' | 'price_out' | 'max_output_tokens' | 'calibration'
  > | null;
  /** the models that may answer this trader: the cheapest sets the floor */
  answerModels: readonly Pick<
    ModelTarget,
    'price_in' | 'price_out' | 'max_output_tokens' | 'calibration'
  >[];
}

/**
 * The balance below which no request could be served: a LOWER bound of every reservation the
 * request could make, so a trader the floor refuses would have been refused at the reservation
 * too, and the refusal comes before the Understand call is paid for. It is the cheapest
 * priced answer model's worst case at the smallest possible prompt (the static prefix, with no
 * chart), plus the Understand call for a typed question; a call nobody has priced adds nothing,
 * and when nothing is priced the floor is `MIN_FLOOR_UNITS`: an account with no balance at all is
 * still refused, which is the part of the floor that does not need a price.
 */
export function floorUnits(
  input: FloorInput,
  marginBp: number = COST_MARGIN_BP
): number {
  let understand = 0;
  if (input.kind === 'TYPED' && input.understandModel !== null) {
    // a lower bound: the reply at its most, the prompt at its least (none)
    const units = callWorstCaseUnits(
      {
        ...boundOf(input.understandModel, 0),
        maxOutputTokens: UNDERSTAND_MAX_OUTPUT_TOKENS,
      },
      marginBp
    );
    if (units !== null) understand = units;
  }
  let cheapest: number | null = null;
  for (const model of input.answerModels) {
    const units = callWorstCaseUnits(
      boundOf(model, STATIC_PROMPT_TOKENS),
      marginBp
    );
    if (units !== null && (cheapest === null || units < cheapest)) {
      cheapest = units;
    }
  }
  return Math.max(MIN_FLOOR_UNITS, understand + (cheapest ?? 0));
}
