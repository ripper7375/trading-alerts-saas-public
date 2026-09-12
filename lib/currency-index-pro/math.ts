/**
 * Currency Index PRO Plan — Phase 2 pure math.
 *
 * No Prisma, no I/O -- every function here takes plain arrays/numbers and
 * returns plain arrays/numbers, so the spec's Section 4.1/4.2 formulas can
 * be unit-tested directly against hand-computed examples.
 *
 * @module lib/currency-index-pro/math
 */

export interface CurrencyIndexBar {
  barTime: number;
  value: number;
  changePct: number;
}

/**
 * Filters an ascending, session-ordered M5 bar array down to the M15-close
 * bars: the 3rd bar of each 15-minute triplet counting from the session's
 * own open (spec Section 5.1's "Bar 1/2/3 -> 1 M15 bar", applied to a point
 * value series rather than OHLC candles -- there is no high/low/open/close
 * to aggregate here, only a value observed every 5 minutes, so "M15" means
 * sampling the bar that closes each 15-minute window, not aggregating one).
 *
 * A bar whose offset from the session open isn't a clean multiple of 300s
 * (a genuine data gap) is simply excluded rather than mis-bucketed.
 */
export function sampleM15Bars(
  bars: readonly CurrencyIndexBar[],
  sessionOpenBarTime: number
): CurrencyIndexBar[] {
  return bars.filter((bar) => {
    const offset = bar.barTime - sessionOpenBarTime;
    return offset >= 0 && offset % 900 === 600;
  });
}

/**
 * Hull-like RMA (spec Section 4.1, extracted from HRMA_Modified Buffers.mq5).
 * Seeded from the series' own first point (RMA1[0] = RMA2[0] = P[0]), the
 * conventional way to start a recursive exponential filter with no prior
 * state -- this is normal indicator cold-start behavior, not missing data,
 * so the returned array is always fully defined, just less converged near
 * the start of a session.
 */
export function computeHrma(series: readonly number[], len = 36): number[] {
  if (series.length === 0) return [];

  const alpha1 = 2 / (len / 2 + 1);
  const alpha2 = 2 / (len + 1);
  const alpha3 = 2 / (Math.sqrt(len) + 1);

  const result: number[] = [];
  // Running scalars, not array back-indexing -- both correct (bounded by
  // the loop below) and sidesteps noUncheckedIndexedAccess on every
  // previous-value lookup.
  let rma1 = series[0] as number;
  let rma2 = series[0] as number;
  let hrma = rma1; // t=0: diff = 2*rma1 - rma2 = rma1, since rma1 === rma2 here
  result.push(hrma);

  for (let t = 1; t < series.length; t++) {
    const price = series[t] as number;
    rma1 = alpha1 * price + (1 - alpha1) * rma1;
    rma2 = alpha2 * price + (1 - alpha2) * rma2;
    const diff = 2 * rma1 - rma2;
    hrma = alpha3 * diff + (1 - alpha3) * hrma;
    result.push(hrma);
  }

  return result;
}

/**
 * Wilder's Smoothed Moving Average (spec Section 4.2, extracted from
 * SMMA_Modified Buffers.mq5). Unlike HRMA, this has a genuine, spec-defined
 * seed point at index `len - 1` (a plain average of the first `len`
 * points) -- indices before that are returned as `null` rather than a
 * fabricated running average, matching this codebase's established
 * "a genuinely missing value is null, never a guessed number" convention.
 */
export function computeSmma(
  series: readonly number[],
  len = 13
): (number | null)[] {
  const smma: (number | null)[] = new Array(series.length).fill(null);
  if (series.length < len) return smma;

  let seed = 0;
  for (let i = 0; i < len; i++) seed += series[i] as number;
  let current = seed / len;
  smma[len - 1] = current;

  for (let t = len; t < series.length; t++) {
    current = (current * (len - 1) + (series[t] as number)) / len;
    smma[t] = current;
  }

  return smma;
}
