/**
 * Currency Index PRO Plan — Phase 2/3 zone classification and Stage B signal
 * detection (spec Sections 3.2/4.3). Pure functions, no Prisma/I/O.
 *
 * @module lib/currency-index-pro/signals
 */

import { computeHrma, computeSmma, type CurrencyIndexBar } from './math';

export type ZoneState = 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
export type SignalType = 'CONFIRMED_BUY' | 'CONFIRMED_SELL' | 'NONE';

export interface CorridorThresholds {
  /** Tier 1 strike-zone threshold (+/-), e.g. 0.78 for +-0.78%. */
  strikeZonePct: number;
}

/**
 * Stage A classification against the Tier 1 "Strike / Warning Zone"
 * threshold (spec Section 3.2) -- NOT the Tier 2 extreme-exhaustion zone,
 * matching Section 4's own worked example ("Index >= +0.78% or <= -0.78%",
 * exactly the strike zone value).
 *
 * A `null` corridor (Lane 4 hasn't finalized a day yet, or this is the
 * very first trading day) has no threshold to classify against -- returns
 * NEUTRAL rather than fabricating a boundary.
 */
export function classifyZone(
  changePct: number,
  corridor: CorridorThresholds | null
): ZoneState {
  if (!corridor) return 'NEUTRAL';
  if (changePct >= corridor.strikeZonePct) return 'OVERBOUGHT';
  if (changePct <= -corridor.strikeZonePct) return 'OVERSOLD';
  return 'NEUTRAL';
}

export interface SignalBar {
  zone: ZoneState;
  hrma: number;
  /** `null` before SMMA's own seed point (see computeSmma) -- no signal can be evaluated there. */
  smma: number | null;
}

/**
 * Spec Section 4.3's exact Stage B trigger: a HRMA x SMMA cross on the
 * latest CLOSED bar, confirmed only if the index was in the corresponding
 * Stage A zone at some point within the last `k` bars (spec: K=6 M15 bars =
 * 90 minutes) -- "within the last k bars" is read as inclusive of the
 * current bar, the natural reading of "was in the zone recently".
 *
 * `minBarsForSignal` is a second, independent gate beyond SMMA's own
 * null-based one: SMMA has a hard, well-defined seed point (it genuinely
 * doesn't exist before `smmaPeriod` bars), but HRMA is mathematically
 * defined from bar 1 onward -- it just hasn't converged yet. A cross
 * against an unconverged HRMA is noise, not a real reversal, so the caller
 * should pass `max(hrmaPeriod, smmaPeriod)` here (the two indicators' own
 * configured periods) rather than trusting SMMA's warm-up alone. Since
 * every index resets to a fresh session daily (see this module's own
 * daily-reset design note in queries.ts/the aggregator), this gate recurs
 * at the start of EVERY trading day, not just once at Lane 4's bootstrap.
 *
 * Returns NONE (not a fabricated direction) whenever there isn't yet
 * enough history to evaluate a cross, or the bar sequence agrees on no
 * cross at all.
 */
export function detectStageBSignal(
  bars: readonly SignalBar[],
  k = 6,
  minBarsForSignal = 0
): SignalType {
  if (bars.length < 2 || bars.length < minBarsForSignal) return 'NONE';

  // Both indices are provably in-bounds given the length check above.
  const latest = bars[bars.length - 1] as SignalBar;
  const prev = bars[bars.length - 2] as SignalBar;
  if (latest.smma === null || prev.smma === null) return 'NONE';

  const bearishCross = prev.hrma >= prev.smma && latest.hrma < latest.smma;
  const bullishCross = prev.hrma <= prev.smma && latest.hrma > latest.smma;
  if (!bearishCross && !bullishCross) return 'NONE';

  const window = bars.slice(Math.max(0, bars.length - k));
  const wasOverbought = window.some((bar) => bar.zone === 'OVERBOUGHT');
  const wasOversold = window.some((bar) => bar.zone === 'OVERSOLD');

  if (bearishCross && wasOverbought) return 'CONFIRMED_SELL';
  if (bullishCross && wasOversold) return 'CONFIRMED_BUY';
  return 'NONE';
}

/** A `SignalBar` that also carries the source bar's own time/value, for
 * anything that needs to plot the series (the detail modal) rather than
 * just evaluate the latest cross (the screener table). */
export interface FullSignalBar extends SignalBar {
  barTime: number;
  changePct: number;
}

/**
 * Builds the per-bar HRMA/SMMA/zone series for one index's M15 bars.
 * Extracted so both the screener route (which only needs the LATEST bar)
 * and the detail route (which plots the WHOLE series) share one
 * computation rather than two copies drifting apart.
 */
export function buildSignalSeries(
  bars: readonly CurrencyIndexBar[],
  corridor: CorridorThresholds | null,
  hrmaPeriod: number,
  smmaPeriod: number
): FullSignalBar[] {
  const changePcts = bars.map((bar) => bar.changePct);
  const hrma = computeHrma(changePcts, hrmaPeriod);
  const smma = computeSmma(changePcts, smmaPeriod);

  return bars.map((bar, i) => ({
    barTime: bar.barTime,
    changePct: bar.changePct,
    zone: classifyZone(bar.changePct, corridor),
    hrma: hrma[i] as number,
    smma: smma[i] as number | null,
  }));
}
