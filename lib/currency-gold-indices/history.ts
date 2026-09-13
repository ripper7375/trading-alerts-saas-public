/**
 * Multi-day M15 sampling for the Lane 4 XAUX vs USDX comparison chart.
 *
 * `currency_gold_indices` stores one point value per 5-minute bar, not OHLC
 * (Phase 1 finding, see currency-index-pro/math.ts's own `sampleM15Bars`
 * doc comment) -- there is nothing to aggregate for "M15", only a value
 * observed every 5 minutes, so M15 means sampling the bar that closes each
 * 15-minute window from the session's own open.
 *
 * `sampleM15Bars` in lib/currency-index-pro/math.ts solves the same problem
 * but takes a single `sessionOpenBarTime` for the whole array -- correct for
 * that module's "today only" queries, but this comparison chart spans up to
 * 3000 bars across many days. Rather than re-derive each day's boundary,
 * every row in `currency_gold_indices` already carries ITS OWN day's
 * `session_open_bar_time` (stamped by the VPS engine, the only place with
 * ground truth of the Eightcap DST offset rule), so each bar can be tested
 * against its own anchor directly. This also has to be correct for XAUX
 * specifically, whose daily reopen is 01:01 server time, not a clean
 * 15-minute offset from midnight the way the 8 FX-based indices' 00:00
 * reopen is -- a single global modulo constant would be wrong for it.
 *
 * FIX (2026-09-13): XAUX's anchor (01:01) is not on the 5-minute grid either,
 * but every real M5 bar_time is (MT5 stamps a bar with its open time, always a
 * multiple of 300s). Measuring the offset from the raw 01:01 anchor put every
 * real XAUX bar at an offset of 240/540/840 mod 900 -- never 600 -- so the M15
 * XAUX line was silently empty. The original test only passed because its
 * XAUX fixture bars sat at anchor + 600 (01:11), a time no M5 bar can have.
 * The anchor is now floored to the 5-minute bar that CONTAINS it (01:00 for a
 * 01:01 reopen) before measuring -- a no-op for the 8 FX indices, whose 00:00
 * anchor is already on the grid.
 *
 * @module lib/currency-gold-indices/history
 */

export function isM15CloseBar(
  barTime: number,
  sessionOpenBarTime: number
): boolean {
  const anchor = sessionOpenBarTime - (sessionOpenBarTime % 300);
  const offset = barTime - anchor;
  return offset >= 0 && offset % 900 === 600;
}

/** Upper bound on bars returned per index, per the XAUX vs USDX comparison
 * chart's own requirement -- both M5 and M15 views. */
export const MAX_COMPARISON_HISTORY_BARS = 3000;

/** The only two indices this comparison chart plots. A dedicated small list
 * rather than a generic `indices=` query param -- this route has exactly
 * one purpose, per the feature request, not a general-purpose history API. */
export const COMPARISON_CHART_INDEX_NAMES = ['XAUX', 'USDX'] as const;

export type ComparisonTimeframe = 'M5' | 'M15';
