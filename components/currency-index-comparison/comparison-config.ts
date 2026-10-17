/**
 * The plain values the PRO comparison workspace shares with its chart: the two
 * slots, the plot types, the ZigZag and Z-score classes and their colours.
 *
 * They live apart from `currency-index-comparison-chart.tsx` so the workspace
 * can read them without importing the chart: the chart (and `lightweight-charts`
 * with it) is loaded on demand by `next/dynamic`, and a value import from the
 * chart module would pull it back into the page's own bundle.
 * `currency-index-comparison-chart.tsx` re-exports everything here, so existing
 * imports keep working.
 *
 * @module components/currency-index-comparison/comparison-config
 */

import type {
  ComparisonIndexName,
  IndexCandle,
} from '@/lib/currency-index-comparison/series';
import type { ZigZagClass } from '@/lib/currency-index-comparison/zigzag';
import type { HighlightedZScoreClass } from '@/lib/currency-index-comparison/zscore-candle';

export type PlotType = 'none' | 'line' | 'ohlc' | 'heikin-ashi';
export type SlotId = 'A' | 'B';

export const SLOT_IDS: readonly SlotId[] = ['A', 'B'];

export interface ChartSlot {
  symbol: ComparisonIndexName;
  /**
   * Price-scale title: the symbol, or e.g. "XAUX (A)" when both slots hold
   * the same index, so their labels stay distinguishable.
   */
  label: string;
  candles: IndexCandle[];
  /** Display-only rebase base, 50-150 (100 = real values). */
  base: number;
  showHrma: boolean;
  showSmma: boolean;
  showZigzag: boolean;
  showZscore: boolean;
}

export const REBASE_DEFAULT = 100;

/** The chart's default plot height (px); the loading skeleton uses it too. */
export const COMPARISON_CHART_HEIGHT = 520;

const SLOT_COLORS: Record<SlotId, { light: string; dark: string }> = {
  A: { light: '#c98500', dark: '#c98500' },
  B: { light: '#2a78d6', dark: '#3987e5' },
};

export function slotColor(slot: SlotId, theme: 'light' | 'dark'): string {
  return SLOT_COLORS[slot][theme];
}

export const ZIGZAG_CLASSES: readonly ZigZagClass[] = [
  'normal',
  'large',
  'extreme',
];

export const ZIGZAG_LINE_WIDTH: Record<ZigZagClass, 1 | 2 | 4> = {
  normal: 1,
  large: 2,
  extreme: 4,
};

export const ZSCORE_HIGHLIGHT_CLASSES: readonly HighlightedZScoreClass[] = [
  'up-large',
  'up-extreme',
  'down-large',
  'down-extreme',
];

const ZSCORE_COLORS: Record<
  'light' | 'dark',
  Record<HighlightedZScoreClass, { body: string; outline: string }>
> = {
  // Tints: 60% of the hue over the chart surface (#ffffff / #0a0e17).
  light: {
    'up-large': { body: '#66b566', outline: '#008300' },
    'up-extreme': { body: '#008300', outline: '#008300' },
    'down-large': { body: '#e697b3', outline: '#d55181' },
    'down-extreme': { body: '#d55181', outline: '#d55181' },
  },
  dark: {
    'up-large': { body: '#045409', outline: '#008300' },
    'up-extreme': { body: '#008300', outline: '#008300' },
    'down-large': { body: '#843657', outline: '#d55181' },
    'down-extreme': { body: '#d55181', outline: '#d55181' },
  },
};

export function zscoreClassColors(
  cls: HighlightedZScoreClass,
  theme: 'light' | 'dark'
): { body: string; outline: string } {
  return ZSCORE_COLORS[theme][cls];
}
