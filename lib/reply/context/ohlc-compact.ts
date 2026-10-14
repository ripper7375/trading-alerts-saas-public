/**
 * One day of OHLC in the compact form of architecture 5.5 (build step 7 part 2, ADR-047).
 *
 * The block is shared by every trader of one trader type in one cycle, so it is built from the
 * closed bars alone and the packet's last price, and it carries no clock, no id and nothing of
 * a user:
 *
 * ```
 * DATA AS OF 18 SEP 20:55 UTC · XAUUSD · CLOSED BARS
 * DAY  open 4331.40  high 4391.20  low 4318.75
 * M5 · 288 bars · from 17 Sep 20:55 · step 5 min
 * o h l c
 * 4331.40 4333.15 4330.60 4332.85
 * ...
 * -- market break 17 Sep 21:00 to 22:00 --
 * ...
 * M15 · 96 bars · same day · step 15 min
 * o h l c
 * ...
 * LAST PRICE 4377.99 · close of the last closed M5 bar (opened 18 Sep 20:50 UTC)
 * ```
 *
 * Differences from the sketch of 5.5, each on purpose: the LAST PRICE line is the close of the
 * last closed M5 bar and says so (decision D6: no forming price has a source, ADR-011), and
 * `o h l c` is repeated under each timeframe so each block reads on its own. A header states the
 * REAL number of bars: a day with a market break or a weekend has fewer than 288, and the block
 * is never padded.
 *
 * SUMMARY MODE (used only when the cut order asks for it) is the day line, which still covers
 * the whole day, plus the last 12 M5 and the last 8 M15 bars.
 *
 * Pure: no I/O, no clock.
 *
 * @module lib/reply/context/ohlc-compact
 */

import { boardStamp, secondsOfSlot } from '../contracts/intake';
import type { Timeframe } from '../contracts/intake';

/** One closed bar. `openTime` is the bar's OPEN time in unix UTC seconds (architecture 1.3 rule 2). */
export interface Bar {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** The closed bars of the day that ends at a cycle's last closed bar, oldest first. */
export interface DayBars {
  symbol: string;
  /** the cycle's slot, unix UTC seconds */
  slotSeconds: number;
  m5: Bar[];
  m15: Bar[];
}

export const PERIOD_SECONDS: Readonly<Record<Timeframe, number>> = {
  M5: 300,
  M15: 900,
};

/** The most bars of a day: 24 hours of each timeframe. */
export const DAY_BAR_COUNT: Readonly<Record<Timeframe, number>> = {
  M5: 288,
  M15: 96,
};

export const OHLC_MODES = ['FULL', 'SUMMARY'] as const;
export type OhlcMode = (typeof OHLC_MODES)[number];

/** The last M5 bar's close and the bar it is the close of (the packet's `data.last_price`). */
export interface LastPriceInput {
  price: number;
  /** the slot of that bar, `2026-09-18T20:50Z` */
  bar: string;
}

export interface CompactOptions {
  mode: OhlcMode;
  lastPrice: LastPriceInput | null;
  /** decimals of a price: 2 for gold */
  digits?: number;
  /** how many bars summary mode keeps */
  summaryBars?: { m5: number; m15: number };
}

export interface CompactOhlc {
  text: string;
  mode: OhlcMode;
  /** the bars the text shows */
  m5Rows: number;
  m15Rows: number;
  /** the day line's three values as printed; null when there are no bars */
  day: { open: string; high: string; low: string } | null;
}

export const DEFAULT_PRICE_DIGITS = 2;
export const DEFAULT_SUMMARY_BARS = { m5: 12, m15: 8 } as const;

const MONTH_TITLE = /^(\d\d) ([A-Z])([A-Z]{2}) /;

/** `17 Sep 21:00`: the board's stamp with the month in title case, the way 5.5 writes the bar times. */
export function stampTitle(seconds: number): string {
  const stamp = boardStamp(seconds);
  return stamp.replace(
    MONTH_TITLE,
    (_all, day: string, first: string, rest: string) =>
      `${day} ${first}${rest.toLowerCase()} `
  );
}

function clock(seconds: number): string {
  return stampTitle(seconds).slice(7);
}

function price(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError('a bar price must be a finite number');
  }
  return value.toFixed(digits);
}

function dayOf(
  bars: DayBars
): { open: number; high: number; low: number } | null {
  const source = bars.m5.length > 0 ? bars.m5 : bars.m15;
  const first = source[0];
  if (first === undefined) return null;
  let high = first.high;
  let low = first.low;
  for (const bar of source) {
    if (bar.high > high) high = bar.high;
    if (bar.low < low) low = bar.low;
  }
  return { open: first.open, high, low };
}

/** `-- market break 17 Sep 21:00 to 22:00 --`: the gap between a closed bar and the next one. */
function breakLine(from: number, to: number): string {
  const sameDay = Math.floor(from / 86_400) === Math.floor(to / 86_400);
  const end = sameDay ? clock(to) : stampTitle(to);
  return `-- market break ${stampTitle(from)} to ${end} --`;
}

function section(
  label: Timeframe,
  bars: readonly Bar[],
  shownCount: number,
  digits: number,
  summary: boolean,
  windowWord: string | null
): { lines: string[]; rows: number } {
  const total = bars.length;
  const shown = bars.slice(total - shownCount);
  const step = PERIOD_SECONDS[label];
  const stepText = `step ${step / 60} min`;
  const first = shown[0];
  if (first === undefined) {
    return { lines: [`${label} · 0 bars · none found · ${stepText}`], rows: 0 };
  }
  const count =
    summary && shown.length < total
      ? `last ${shown.length} of ${total} bars`
      : `${total} bars`;
  const from =
    windowWord === null ? `from ${stampTitle(first.openTime)}` : windowWord;
  const lines = [`${label} · ${count} · ${from} · ${stepText}`, 'o h l c'];
  let previous: Bar | undefined;
  for (const bar of shown) {
    if (previous !== undefined) {
      const closed = previous.openTime + step;
      if (bar.openTime > closed) lines.push(breakLine(closed, bar.openTime));
    }
    lines.push(
      [bar.open, bar.high, bar.low, bar.close]
        .map((value) => price(value, digits))
        .join(' ')
    );
    previous = bar;
  }
  return { lines, rows: shown.length };
}

function lastPriceLine(last: LastPriceInput | null, digits: number): string {
  if (last === null) return 'LAST PRICE unavailable';
  const opened = secondsOfSlot(last.bar);
  const label =
    opened === null
      ? 'close of the last closed M5 bar'
      : `close of the last closed M5 bar (opened ${stampTitle(opened)} UTC)`;
  return `LAST PRICE ${price(last.price, digits)} · ${label}`;
}

/** The compact block for a day of closed bars. */
export function formatCompactOhlc(
  bars: DayBars,
  options: CompactOptions
): CompactOhlc {
  const digits = options.digits ?? DEFAULT_PRICE_DIGITS;
  const summary = options.mode === 'SUMMARY';
  const keep = options.summaryBars ?? DEFAULT_SUMMARY_BARS;
  const lines = [
    `DATA AS OF ${boardStamp(bars.slotSeconds)} UTC · ${bars.symbol} · CLOSED BARS`,
  ];
  const day = dayOf(bars);
  if (day === null) {
    lines.push('OHLC UNAVAILABLE · no closed bars are available for this day');
    lines.push(lastPriceLine(options.lastPrice, digits));
    return {
      text: `${lines.join('\n')}\n`,
      mode: options.mode,
      m5Rows: 0,
      m15Rows: 0,
      day: null,
    };
  }
  const dayText = {
    open: price(day.open, digits),
    high: price(day.high, digits),
    low: price(day.low, digits),
  };
  lines.push(
    `DAY  open ${dayText.open}  high ${dayText.high}  low ${dayText.low}`
  );
  if (summary) {
    lines.push(
      'SUMMARY MODE · DAY covers the whole day; only the latest bars follow'
    );
  }
  const m5 = section(
    'M5',
    bars.m5,
    summary ? Math.min(keep.m5, bars.m5.length) : bars.m5.length,
    digits,
    summary,
    null
  );
  const m15 = section(
    'M15',
    bars.m15,
    summary ? Math.min(keep.m15, bars.m15.length) : bars.m15.length,
    digits,
    summary,
    summary ? null : 'same day'
  );
  lines.push(
    ...m5.lines,
    ...m15.lines,
    lastPriceLine(options.lastPrice, digits)
  );
  return {
    text: `${lines.join('\n')}\n`,
    mode: options.mode,
    m5Rows: m5.rows,
    m15Rows: m15.rows,
    day: dayText,
  };
}
