/**
 * Currency Index Comparison (PRO) -- candle construction.
 *
 * Pure, client-safe: no Prisma, no I/O. The API route runs these on raw
 * `currency_gold_indices` rows; the tests exercise them directly.
 *
 * Two transformations turn Lane 4's stored rows into chartable candles:
 *
 * 1. CHAINING (chainSessions). Every Lane 4 index is rebased to exactly 100.00
 *    at its own daily session open, so a multi-day series is a sawtooth that
 *    snaps back to 100 once per day -- which would break Heiken Ashi (its open
 *    averages the previous candle) and HRMA/SMMA (recursive filters) at every
 *    reset. Each session's segment is instead scaled so its first bar's OPEN
 *    continues from the previous session's last CLOSE, producing one unbroken
 *    series. The LATEST session keeps scale 1, so today's values are exactly
 *    the values the landing-page widget and the 28-pair screener show;
 *    earlier sessions are scaled to line up with it. Display-only: nothing
 *    stored changes.
 *
 *    What chaining cannot recover, stated rather than hidden: the price gap
 *    between one session's last close and the next session's first open
 *    (e.g. gold's 23:59-01:01 rollover halt, a weekend gap, or any bars the
 *    engine missed) is treated as zero movement. For a row with no stored
 *    OHLC (pushed before index OHLC existed) the first bar's open falls back
 *    to its close, so that bar's own intrabar move is lost too.
 *
 * 2. TIMEFRAME (toTimeframe). M5 is the stored resolution. M15 candles are
 *    MT5-style clock-aligned buckets (floor(bar_time / 900) * 900): open of
 *    the first M5 bar, max high, min low, close of the last. A bucket never
 *    spans two sessions. The newest bucket may still be forming, as on any
 *    live chart.
 *
 * @module lib/currency-index-comparison/series
 */

export const COMPARISON_INDEX_NAMES = [
  'XAUX',
  'USDX',
  'EURX',
  'JPYX',
  'GBPX',
  'AUDX',
  'NZDX',
  'CADX',
  'CHFX',
] as const;

export type ComparisonIndexName = (typeof COMPARISON_INDEX_NAMES)[number];

/** The PRO comparison page -- linked from the public /xaux-vs-usdx page. */
export const CURRENCY_INDEX_COMPARE_PATH = '/pro/currency-index/compare';

/** At most this many indices are plotted at once (PRO requirement). */
export const MAX_SELECTED_INDICES = 2;

/** Upper bound on candles returned per index, on both M5 and M15. */
export const MAX_COMPARISON_CANDLES = 3000;

export type ComparisonTimeframe = 'M5' | 'M15';

export function isComparisonIndexName(
  value: string
): value is ComparisonIndexName {
  return (COMPARISON_INDEX_NAMES as readonly string[]).includes(value);
}

/** One stored Lane 4 row, as read from `currency_gold_indices`. */
export interface RawIndexBar {
  barTime: number;
  sessionOpenBarTime: number;
  /** NULL for a row pushed before index OHLC existed. */
  open: number | null;
  high: number | null;
  low: number | null;
  /** The row's `value` -- always the index close. */
  close: number;
}

export interface IndexCandle {
  /** Unix UTC seconds -- the candle's open time. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** One index's candles, as served by the comparison API route. */
export interface ComparisonSeries {
  symbol: ComparisonIndexName;
  candles: IndexCandle[];
}

interface SessionCandle extends IndexCandle {
  sessionOpenBarTime: number;
}

const M15_SECONDS = 900;

/**
 * Fills a missing open/high/low from the close and guarantees a well-formed
 * candle (high >= open/close >= low). A NULL is "no OHLC recorded", never a
 * zero -- the close is the only honest stand-in.
 */
function normalize(raw: RawIndexBar): SessionCandle {
  const open = raw.open ?? raw.close;
  const high = Math.max(raw.high ?? raw.close, open, raw.close);
  const low = Math.min(raw.low ?? raw.close, open, raw.close);
  return {
    time: raw.barTime,
    open,
    high,
    low,
    close: raw.close,
    sessionOpenBarTime: raw.sessionOpenBarTime,
  };
}

/**
 * Chains ascending M5 rows into one continuous series anchored on the latest
 * session. See the module doc comment for the rule and its limits.
 */
export function chainSessions(raw: readonly RawIndexBar[]): SessionCandle[] {
  if (raw.length === 0) return [];

  const bars = raw.map(normalize);

  // Scale factor per bar, relative to the OLDEST session (factor 1).
  const factors: number[] = new Array(bars.length);
  let factor = 1;
  factors[0] = factor;
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1] as SessionCandle;
    const bar = bars[i] as SessionCandle;
    if (bar.sessionOpenBarTime !== prev.sessionOpenBarTime && bar.open > 0) {
      // Previous session's last close == this session's first open.
      factor = (factor * prev.close) / bar.open;
    }
    factors[i] = factor;
  }

  // Re-anchor so the latest session is unscaled.
  const latest = factors[factors.length - 1] as number;
  return bars.map((bar, i) => {
    const k = (factors[i] as number) / latest;
    return {
      ...bar,
      open: bar.open * k,
      high: bar.high * k,
      low: bar.low * k,
      close: bar.close * k,
    };
  });
}

/** M5 passthrough, or MT5-style clock-aligned M15 buckets. Input ascending. */
export function toTimeframe(
  bars: readonly SessionCandle[],
  timeframe: ComparisonTimeframe
): IndexCandle[] {
  if (timeframe === 'M5') {
    return bars.map(({ time, open, high, low, close }) => ({
      time,
      open,
      high,
      low,
      close,
    }));
  }

  const candles: IndexCandle[] = [];
  let current: IndexCandle | null = null;
  let currentSession: number | null = null;

  for (const bar of bars) {
    const bucket = bar.time - (bar.time % M15_SECONDS);
    if (
      current &&
      current.time === bucket &&
      currentSession === bar.sessionOpenBarTime
    ) {
      current.high = Math.max(current.high, bar.high);
      current.low = Math.min(current.low, bar.low);
      current.close = bar.close;
    } else {
      current = {
        time: bucket,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      };
      currentSession = bar.sessionOpenBarTime;
      candles.push(current);
    }
  }

  // A session boundary inside one clock bucket would emit two candles with the
  // same time, which a time-series chart rejects. Lane 4's boundaries (00:00
  // and 01:01 server time) never do this, but merge defensively rather than
  // hand the chart an invalid series.
  const merged: IndexCandle[] = [];
  for (const candle of candles) {
    const last = merged[merged.length - 1];
    if (last && last.time === candle.time) {
      last.high = Math.max(last.high, candle.high);
      last.low = Math.min(last.low, candle.low);
      last.close = candle.close;
    } else {
      merged.push(candle);
    }
  }
  return merged;
}

/**
 * Raw ascending Lane 4 rows -> at most MAX_COMPARISON_CANDLES chained candles
 * on the requested timeframe.
 */
export function buildComparisonCandles(
  raw: readonly RawIndexBar[],
  timeframe: ComparisonTimeframe
): IndexCandle[] {
  return toTimeframe(chainSessions(raw), timeframe).slice(
    -MAX_COMPARISON_CANDLES
  );
}
