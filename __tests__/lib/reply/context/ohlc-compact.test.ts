/**
 * @jest-environment node
 */

import {
  DAY_BAR_COUNT,
  PERIOD_SECONDS,
  formatCompactOhlc,
  stampTitle,
} from '@/lib/reply/context/ohlc-compact';
import type { Bar, DayBars } from '@/lib/reply/context/ohlc-compact';
import { estimateRawTokens } from '@/lib/reply/context/tokens';

import { dayBarsFor, worldFor } from './helpers/context-fixtures';

const SLOT = '2026-09-18T20:55Z';
const at = (iso: string): number => Date.parse(iso) / 1000;
const LAST = { price: 4377.99, bar: '2026-09-18T20:50Z' };
const ROW = /^\d+\.\d\d \d+\.\d\d \d+\.\d\d \d+\.\d\d$/;

const fmt = (b: Bar): string =>
  [b.open, b.high, b.low, b.close].map((v) => v.toFixed(2)).join(' ');

describe('stampTitle', () => {
  it('writes day, month in title case, and the time', () => {
    expect(stampTitle(at('2026-09-17T21:00:00Z'))).toBe('17 Sep 21:00');
    expect(stampTitle(at('2026-01-02T03:04:00Z'))).toBe('02 Jan 03:04');
  });

  it('knows all twelve months', () => {
    const names = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    names.forEach((name, month) => {
      expect(stampTitle(Date.UTC(2026, month, 15, 12, 30) / 1000)).toBe(
        `15 ${name} 12:30`
      );
    });
  });
});

describe('formatCompactOhlc: the full day', () => {
  let day: DayBars;
  let lines: string[];
  let result: ReturnType<typeof formatCompactOhlc>;
  beforeAll(async () => {
    day = await dayBarsFor(SLOT, worldFor(SLOT));
    result = formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST });
    lines = result.text.split('\n');
  });

  it('has the 288 M5 and 96 M15 rows', () => {
    expect(day.m5).toHaveLength(DAY_BAR_COUNT.M5);
    expect(day.m15).toHaveLength(DAY_BAR_COUNT.M15);
    expect(lines.filter((line) => ROW.test(line))).toHaveLength(288 + 96);
    expect(result.m5Rows).toBe(288);
    expect(result.m15Rows).toBe(96);
    expect(result.mode).toBe('FULL');
  });

  it('opens with the data stamp, the symbol and the closed-bars label', () => {
    expect(lines[0]).toBe('DATA AS OF 18 SEP 20:55 UTC · XAUUSD · CLOSED BARS');
  });

  it('has the day line with the open of the first bar and the high and low of the day', () => {
    const high = Math.max(...day.m5.map((b) => b.high));
    const low = Math.min(...day.m5.map((b) => b.low));
    const open = (day.m5[0] as Bar).open;
    expect(lines[1]).toBe(
      `DAY  open ${open.toFixed(2)}  high ${high.toFixed(2)}  low ${low.toFixed(2)}`
    );
    expect(result.day).toEqual({
      open: open.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
    });
  });

  it('has one header per timeframe, with the real count, the first bar and the step', () => {
    expect(lines[2]).toBe('M5 · 288 bars · from 17 Sep 20:55 · step 5 min');
    expect(lines[3]).toBe('o h l c');
    const m15 = lines.indexOf('M15 · 96 bars · same day · step 15 min');
    expect(m15).toBe(4 + 288);
    expect(lines[m15 + 1]).toBe('o h l c');
  });

  it('writes the rows as open high low close, two decimals, one bar to a line, oldest first', () => {
    expect(lines.slice(4, 4 + 288)).toEqual(day.m5.map(fmt));
    expect(lines.slice(4 + 288 + 2, 4 + 288 + 2 + 96)).toEqual(
      day.m15.map(fmt)
    );
  });

  it('has no timestamp on a bar', () => {
    for (const line of lines.filter((l) => ROW.test(l))) {
      expect(line.split(' ')).toHaveLength(4);
    }
  });

  it('ends with the last price: the close of the last closed M5 bar, labelled with the bar (decision D6)', () => {
    expect(lines[lines.length - 2]).toBe(
      'LAST PRICE 4377.99 · close of the last closed M5 bar (opened 18 Sep 20:50 UTC)'
    );
    expect(lines[lines.length - 1]).toBe('');
    expect(result.text.endsWith('\n')).toBe(true);
  });

  it('has exactly the lines it should and no others', () => {
    expect(lines).toHaveLength(1 + 1 + 2 + 288 + 2 + 96 + 1 + 1);
  });

  it('does not contain the forming bar or a later one (the world has them; the day does not)', async () => {
    const world = worldFor(SLOT);
    const forming = world.find(
      (b) => b.timeframe === 'M5' && b.timestamp === at('2026-09-18T20:55:00Z')
    );
    expect(forming).toBeDefined();
    const row = fmt(forming as unknown as Bar);
    expect(lines).not.toContain(row);
  });

  it('is the same text every time', () => {
    expect(formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST }).text).toBe(
      result.text
    );
  });

  it('is the size 5.5 reports: about 7,700 tokens, inside the 8,000 cap', () => {
    const tokens = estimateRawTokens(result.text);
    // a check on the ESTIMATOR against the figure the document measured with another tokenizer
    expect(tokens).toBeGreaterThan(7_700 * 0.9);
    expect(tokens).toBeLessThan(7_700 * 1.1);
    expect(tokens).toBeLessThanOrEqual(8_000);
  });
});

describe('market breaks', () => {
  it('writes one line for a break of an hour inside the day, in both timeframes', async () => {
    const start = at('2026-09-17T21:00:00Z');
    const day = await dayBarsFor(
      SLOT,
      worldFor(SLOT, { skip: [[start, start + 3600]] })
    );
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: LAST,
    }).text.split('\n');
    const breaks = lines.filter((l) => l.startsWith('--'));
    expect(breaks).toEqual([
      '-- market break 17 Sep 21:00 to 22:00 --',
      '-- market break 17 Sep 21:00 to 22:00 --',
    ]);
    expect(lines.filter((l) => ROW.test(l))).toHaveLength(276 + 92);
    expect(lines[2]).toBe('M5 · 276 bars · from 17 Sep 20:55 · step 5 min');
    // the break sits between the bar that closed at 21:00 and the bar that opened at 22:00
    const at5 = lines.indexOf('-- market break 17 Sep 21:00 to 22:00 --');
    expect(lines[at5 - 1]).toBe(
      fmt(day.m5.find((b) => b.openTime === at('2026-09-17T20:55:00Z')) as Bar)
    );
    expect(lines[at5 + 1]).toBe(
      fmt(day.m5.find((b) => b.openTime === at('2026-09-17T22:00:00Z')) as Bar)
    );
  });

  it('writes a gap of one bar as a break of five minutes', async () => {
    const hole = at('2026-09-18T09:00:00Z');
    const day = await dayBarsFor(
      SLOT,
      worldFor(SLOT, { skip: [[hole, hole + 300]] })
    );
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: LAST,
    }).text.split('\n');
    expect(lines.filter((l) => l.startsWith('--'))).toEqual(
      [
        '-- market break 18 Sep 09:00 to 09:05 --',
        // the same hole in the M15 series makes a 15-minute bar shorter, not a missing one
      ].slice(0, 1)
    );
    expect(lines.filter((l) => ROW.test(l)).length).toBe(287 + 96);
  });

  it('writes two gaps as two lines', async () => {
    const a = at('2026-09-18T03:00:00Z');
    const b = at('2026-09-18T07:00:00Z');
    const day = await dayBarsFor(
      SLOT,
      worldFor(SLOT, {
        skip: [
          [a, a + 900],
          [b, b + 1800],
        ],
      })
    );
    const m5 = day.m5;
    const text = formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST }).text;
    const m5Part = text.slice(0, text.indexOf('M15 ·'));
    expect(m5Part.split('\n').filter((l) => l.startsWith('--'))).toEqual([
      '-- market break 18 Sep 03:00 to 03:15 --',
      '-- market break 18 Sep 07:00 to 07:30 --',
    ]);
    expect(m5.length).toBe(288 - 3 - 6);
  });

  it('writes the date on both ends when the gap crosses midnight', async () => {
    const from = at('2026-09-17T23:00:00Z');
    const day = await dayBarsFor(
      SLOT,
      worldFor(SLOT, { skip: [[from, from + 3 * 3600]] })
    );
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: LAST,
    }).text.split('\n');
    expect(lines.filter((l) => l.startsWith('--'))).toEqual([
      '-- market break 17 Sep 23:00 to 18 Sep 02:00 --',
      '-- market break 17 Sep 23:00 to 18 Sep 02:00 --',
    ]);
  });

  it('writes no break line for a day with no gap', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const text = formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST }).text;
    expect(text).not.toContain('market break');
  });

  it('states the data stamp of the CYCLE, not of the last bar, on a weekend', async () => {
    const friday = at('2026-09-18T21:00:00Z');
    const sunday = at('2026-09-20T22:00:00Z');
    const slot = '2026-09-19T10:00Z';
    const day = await dayBarsFor(
      slot,
      worldFor(slot, { skip: [[friday, sunday]] })
    );
    const text = formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST }).text;
    expect(text.split('\n')[0]).toBe(
      'DATA AS OF 19 SEP 10:00 UTC · XAUUSD · CLOSED BARS'
    );
    expect(text.split('\n')[2]).toBe(
      'M5 · 288 bars · from 17 Sep 21:00 · step 5 min'
    );
  });
});

describe('summary mode', () => {
  let day: DayBars;
  let full: ReturnType<typeof formatCompactOhlc>;
  let summary: ReturnType<typeof formatCompactOhlc>;
  let lines: string[];
  beforeAll(async () => {
    day = await dayBarsFor(SLOT, worldFor(SLOT));
    full = formatCompactOhlc(day, { mode: 'FULL', lastPrice: LAST });
    summary = formatCompactOhlc(day, { mode: 'SUMMARY', lastPrice: LAST });
    lines = summary.text.split('\n');
  });

  it('is the day line plus the last 12 M5 and the last 8 M15 bars', () => {
    expect(summary.mode).toBe('SUMMARY');
    expect(summary.m5Rows).toBe(12);
    expect(summary.m15Rows).toBe(8);
    expect(lines.filter((l) => ROW.test(l))).toHaveLength(12 + 8);
    expect(lines.filter((l) => ROW.test(l))).toEqual([
      ...day.m5.slice(-12).map(fmt),
      ...day.m15.slice(-8).map(fmt),
    ]);
  });

  it('keeps the day line for the whole day', () => {
    expect(lines[1]).toBe(full.text.split('\n')[1]);
    expect(summary.day).toEqual(full.day);
  });

  it('says it is a summary, and how much of the day it shows', () => {
    expect(lines[0]).toBe(full.text.split('\n')[0]);
    expect(lines[2]).toBe(
      'SUMMARY MODE · DAY covers the whole day; only the latest bars follow'
    );
    expect(lines[3]).toBe(
      'M5 · last 12 of 288 bars · from 18 Sep 19:55 · step 5 min'
    );
    expect(lines).toContain(
      'M15 · last 8 of 96 bars · from 18 Sep 18:45 · step 15 min'
    );
  });

  it('ends with the same last-price line', () => {
    expect(lines[lines.length - 2]).toBe(full.text.split('\n').slice(-2)[0]);
  });

  it('is the size 5.5 reports for summary mode: about 460 tokens, a good deal under the full day', () => {
    const tokens = estimateRawTokens(summary.text);
    // the fixed lines (the stamp, the headers, the label of the last price) weigh more here than in
    // a measurement of the bars alone, so the band is wider than the full day's
    expect(tokens).toBeGreaterThan(460 * 0.75);
    expect(tokens).toBeLessThan(460 * 1.25);
    expect(tokens).toBeLessThan(estimateRawTokens(full.text) / 10);
  });

  it('follows the numbers it is given', () => {
    const small = formatCompactOhlc(day, {
      mode: 'SUMMARY',
      lastPrice: LAST,
      summaryBars: { m5: 3, m15: 2 },
    });
    expect(small.m5Rows).toBe(3);
    expect(small.m15Rows).toBe(2);
    const text = small.text.split('\n');
    expect(text[3]).toBe(
      'M5 · last 3 of 288 bars · from 18 Sep 20:40 · step 5 min'
    );
  });

  it('shows a break that falls inside the bars it keeps, and none that does not', async () => {
    const hole = at('2026-09-18T20:30:00Z'); // inside the last 12 M5 bars (19:55 to 20:50)
    const gapped = await dayBarsFor(
      SLOT,
      worldFor(SLOT, { skip: [[hole, hole + 300]] })
    );
    const text = formatCompactOhlc(gapped, {
      mode: 'SUMMARY',
      lastPrice: LAST,
    }).text;
    expect(text.split('\n').filter((l) => l.startsWith('--'))).toEqual([
      '-- market break 18 Sep 20:30 to 20:35 --',
    ]);
    const early = at('2026-09-17T22:00:00Z');
    const earlyGap = await dayBarsFor(
      SLOT,
      worldFor(SLOT, { skip: [[early, early + 300]] })
    );
    expect(
      formatCompactOhlc(earlyGap, { mode: 'SUMMARY', lastPrice: LAST }).text
    ).not.toContain('market break');
  });

  it('is the plain header when the day has fewer bars than the summary keeps', () => {
    const few: DayBars = {
      ...day,
      m5: day.m5.slice(-5),
      m15: day.m15.slice(-3),
    };
    const text = formatCompactOhlc(few, {
      mode: 'SUMMARY',
      lastPrice: LAST,
    }).text.split('\n');
    expect(text[3]).toBe(
      `M5 · 5 bars · from ${stampTitle(few.m5[0]?.openTime as number)} · step 5 min`
    );
    expect(text.filter((l) => ROW.test(l))).toHaveLength(8);
  });
});

describe('last price (decision D6)', () => {
  it('says it is unavailable when the packet has none', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: null,
    }).text.split('\n');
    expect(lines[lines.length - 2]).toBe('LAST PRICE unavailable');
  });

  it('leaves out the bar when its slot cannot be read, and still labels the price', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: { price: 4377.9, bar: 'not a slot' },
    }).text.split('\n');
    expect(lines[lines.length - 2]).toBe(
      'LAST PRICE 4377.90 · close of the last closed M5 bar'
    );
  });

  it('takes the number of decimals as a parameter', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const lines = formatCompactOhlc(day, {
      mode: 'FULL',
      lastPrice: LAST,
      digits: 3,
    }).text.split('\n');
    expect(lines[4]).toBe(
      day.m5
        .slice(0, 1)
        .map((b) =>
          [b.open, b.high, b.low, b.close].map((v) => v.toFixed(3)).join(' ')
        )[0]
    );
    expect(lines[lines.length - 2]).toMatch(/^LAST PRICE 4377\.990 /);
  });
});

describe('a day with nothing in it', () => {
  const empty: DayBars = {
    symbol: 'XAUUSD',
    slotSeconds: at('2026-09-18T20:55:00Z'),
    m5: [],
    m15: [],
  };

  it('says the OHLC is unavailable and still states the stamp and the last price', () => {
    const result = formatCompactOhlc(empty, { mode: 'FULL', lastPrice: LAST });
    expect(result.text.split('\n')).toEqual([
      'DATA AS OF 18 SEP 20:55 UTC · XAUUSD · CLOSED BARS',
      'OHLC UNAVAILABLE · no closed bars are available for this day',
      'LAST PRICE 4377.99 · close of the last closed M5 bar (opened 18 Sep 20:50 UTC)',
      '',
    ]);
    expect(result.day).toBeNull();
    expect(result.m5Rows).toBe(0);
    expect(result.m15Rows).toBe(0);
  });

  it('is the same in summary mode', () => {
    expect(
      formatCompactOhlc(empty, { mode: 'SUMMARY', lastPrice: LAST }).text
    ).toBe(formatCompactOhlc(empty, { mode: 'FULL', lastPrice: LAST }).text);
  });

  it('builds the day from M15 when there is no M5, and says M5 has none', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const onlyM15: DayBars = { ...day, m5: [] };
    const lines = formatCompactOhlc(onlyM15, {
      mode: 'FULL',
      lastPrice: LAST,
    }).text.split('\n');
    const high = Math.max(...day.m15.map((b) => b.high));
    expect(lines[1]).toContain(`high ${high.toFixed(2)}`);
    expect(lines).toContain('M5 · 0 bars · none found · step 5 min');
    expect(lines).toContain('M15 · 96 bars · same day · step 15 min');
    expect(
      formatCompactOhlc(onlyM15, { mode: 'FULL', lastPrice: LAST })
    ).toMatchObject({ m5Rows: 0, m15Rows: 96 });
  });

  it('builds the day from a single M5 bar rather than from the M15 bars', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const one = day.m5[day.m5.length - 1] as Bar;
    const result = formatCompactOhlc(
      { ...day, m5: [one] },
      { mode: 'FULL', lastPrice: LAST }
    );
    expect(result.day).toEqual({
      open: one.open.toFixed(2),
      high: one.high.toFixed(2),
      low: one.low.toFixed(2),
    });
    expect(result.text.split('\n')[2]).toBe(
      `M5 · 1 bars · from ${stampTitle(one.openTime)} · step 5 min`
    );
  });
});

describe('guards', () => {
  it('refuses a price that is not a finite number', async () => {
    const day = await dayBarsFor(SLOT, worldFor(SLOT));
    const broken: DayBars = {
      ...day,
      m5: [{ ...(day.m5[0] as Bar), high: Number.NaN }, ...day.m5.slice(1)],
    };
    expect(() =>
      formatCompactOhlc(broken, { mode: 'FULL', lastPrice: LAST })
    ).toThrow('a bar price must be a finite number');
    expect(() =>
      formatCompactOhlc(day, {
        mode: 'FULL',
        lastPrice: { price: Number.POSITIVE_INFINITY, bar: LAST.bar },
      })
    ).toThrow('a bar price must be a finite number');
  });

  it('knows the periods', () => {
    expect(PERIOD_SECONDS).toEqual({ M5: 300, M15: 900 });
    expect(DAY_BAR_COUNT).toEqual({ M5: 288, M15: 96 });
  });
});
