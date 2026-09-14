/**
 * The page's ZigZag and Z-score candle ports against REAL MT5 output.
 *
 * mock-data-from-indicators/golden_certification/ holds 3000-bar XAUUSD M5 and
 * M15 exports captured from the live indicators: OHLCV, ZigZagExportv43's pivot
 * rows, and zscoreohlccandleexport's last 500 classified bars (input length
 * 432). golden_certification.py used the same archive for the Python calc
 * stack; this runs the TypeScript the page actually ships.
 *
 * Bars are aligned as that script does: each export's timestamp is rounded to
 * the timeframe grid, since the files were captured seconds to minutes apart.
 *
 * Edges, stated rather than hidden:
 * - MT5 computed the ZigZag over the chart's whole history; this computes over
 *   the 3000-bar window, starting at bar depth - 1. A pivot the export places
 *   before that bar cannot exist here and is excluded (one per timeframe).
 * - The export's last row is the live unconfirmed leg, not a pivot.
 * - A segment class is compared only where its 50 trailing segments are all
 *   inside the window, as golden_certification.py does.
 */

import { readFileSync } from 'fs';
import path from 'path';

import { describe, it, expect } from '@jest/globals';

import {
  DEFAULT_ZIGZAG_DEPTH,
  ZIGZAG_CLASS_ZSCORE_LENGTH,
  detectZigZagPivots,
  zigzagPctChangeClass,
} from '@/lib/currency-index-comparison/zigzag';
import {
  ZSCORE_CANDLE_CLASSES,
  zscoreCandleClasses,
} from '@/lib/currency-index-comparison/zscore-candle';
import type { IndexCandle } from '@/lib/currency-index-comparison/series';

const ARCHIVE = path.join(
  process.cwd(),
  'mock-data-from-indicators',
  'golden_certification'
);

type Row = Record<string, string> & { ts: number };

function load(file: string, tfSeconds: number): Row[] {
  const [header = '', ...lines] = readFileSync(file, 'utf8').split(/\r?\n/);
  const headers = header.split('\t');
  const rows: Row[] = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 4 || !parts[0]?.trim()) continue;
    const row = {
      ts: Math.round(Number(parts[0]) / tfSeconds) * tfSeconds,
    } as Row;
    headers.forEach((h, i) => (row[h] = parts[i] ?? ''));
    rows.push(row);
  }
  return rows.sort((a, b) => a.ts - b.ts);
}

describe.each([
  ['M5', 300],
  ['M15', 900],
] as const)('%s golden MT5 exports', (tf, tfSeconds) => {
  const dir = path.join(ARCHIVE, `${tf.toLowerCase()}_timeseries`);
  const candles: IndexCandle[] = load(
    path.join(dir, `OHLCV_XAUUSD_${tf}.txt`),
    tfSeconds
  ).map((r) => ({
    time: r.ts,
    open: Number(r.ohlcv_open),
    high: Number(r.ohlcv_high),
    low: Number(r.ohlcv_low),
    close: Number(r.ohlcv_close),
  }));
  const barIndex = new Map(candles.map((c, i) => [c.time, i]));

  it('uses a full 3000-bar window', () => {
    expect(candles).toHaveLength(3000);
  });

  it('Z-score candle class matches all 500 exported bars (length 432, 1.5 / 2.5)', () => {
    const classes = zscoreCandleClasses(candles, {
      length: 432,
      thresholdZ1: 1.5,
      thresholdZ2: 2.5,
    });
    const rows = load(path.join(dir, `ZScore_XAUUSD_${tf}.txt`), tfSeconds);

    let compared = 0;
    const mismatches: string[] = [];
    for (const row of rows) {
      const i = barIndex.get(row.ts);
      expect(i).toBeDefined();
      const mine = classes[i as number];
      expect(mine).not.toBeNull();
      compared++;
      const code = ZSCORE_CANDLE_CLASSES.indexOf(mine!);
      if (code !== Number(row.body_classification)) {
        mismatches.push(
          `${row.ts}: mql5=${row.body_classification} ts=${code}`
        );
      }
    }
    expect(compared).toBe(500);
    expect(mismatches).toEqual([]);
  });

  describe('ZigZag (depth 12)', () => {
    const pivots = detectZigZagPivots(candles, DEFAULT_ZIGZAG_DEPTH);
    const exported = load(path.join(dir, `ZigZag_XAUUSD_${tf}.txt`), tfSeconds)
      .slice(0, -1) // the live unconfirmed leg
      .filter((r) => (barIndex.get(r.ts) ?? -1) >= DEFAULT_ZIGZAG_DEPTH - 1);

    it('finds exactly the exported pivots: same bar, type and price, none extra', () => {
      expect(exported.length).toBeGreaterThan(170);
      const first = exported[0]!.ts;
      const last = exported[exported.length - 1]!.ts;
      const mine = pivots.filter((p) => p.time >= first && p.time <= last);

      expect(
        mine.map((p) => [
          p.time,
          p.isPeak ? 'Peak' : 'Bottom',
          p.price.toFixed(5),
        ])
      ).toEqual(
        exported.map((r) => [
          r.ts,
          r.zigzag_Type,
          Number(r.CurrentPoint).toFixed(5),
        ])
      );
    });

    it('classifies each segment as the export does (Current%ChgClass)', () => {
      const pivotAt = new Map(pivots.map((p, k) => [p.time, k]));
      let compared = 0;
      const mismatches: string[] = [];
      for (const row of exported) {
        const k = pivotAt.get(row.ts) as number;
        if (k <= ZIGZAG_CLASS_ZSCORE_LENGTH) continue;
        const prev = pivots[k - 1]!.price;
        const pct = ((pivots[k]!.price - prev) / prev) * 100;
        compared++;
        const code = zigzagPctChangeClass(pivots, k, pct);
        if (code !== Number(row['Current%ChgClass'])) {
          mismatches.push(
            `${row.ts}: mql5=${row['Current%ChgClass']} ts=${code}`
          );
        }
      }
      expect(compared).toBeGreaterThan(120);
      expect(mismatches).toEqual([]);
    });
  });
});
