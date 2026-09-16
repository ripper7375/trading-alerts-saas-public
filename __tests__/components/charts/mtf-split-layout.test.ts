/**
 * Height maths for the drag-resizable M5/M15 split.
 *
 * These are the numbers `lightweight-charts` is handed for each canvas, so an
 * error here is a chart that overflows its pane (the lower one is clipped) or
 * one that leaves a dead band under it -- neither of which throws.
 */

import { describe, it, expect } from '@jest/globals';

import {
  CHROME_PER_CHART,
  DEFAULT_SPLIT,
  MIN_CHART_HEIGHT,
  MIN_PANE_PX,
  SPLIT_HANDLE_PX,
  minPanePercent,
  paneCanvasHeights,
  usablePaneSpacePx,
} from '@/components/charts/mtf-split-layout';

describe('usablePaneSpacePx', () => {
  it('reserves the divider out of the group height', () => {
    expect(usablePaneSpacePx(900)).toBe(900 - SPLIT_HANDLE_PX);
  });

  it('never goes negative', () => {
    expect(usablePaneSpacePx(4)).toBe(0);
  });
});

describe('CHROME_PER_CHART', () => {
  /**
   * Pinned to the numbers measured in a real browser against a stacked
   * TradingChart, and deliberately not re-derived from the other constants --
   * every other assertion here subtracts this value from both sides, so an
   * error in it alone cancels out and stays invisible. If the stacked chart's
   * label strip, its gap or the card's padding change, re-measure rather than
   * adjusting this to whatever makes the suite pass.
   */
  it('is the label strip, the gap under it, and the card padding', () => {
    const labelStrip = 36; // h-9
    const gapBelowStrip = 16; // space-y-4
    const cardPaddingAndBorder = 34; // p-4 + 1px top and bottom
    expect(CHROME_PER_CHART).toBe(
      labelStrip + gapBelowStrip + cardPaddingAndBorder
    );
  });
});

describe('paneCanvasHeights', () => {
  it('splits an even divider evenly, minus each chart chrome', () => {
    // 900 tall, less the 10px divider, is 890 shared; 445 a pane; 359 a canvas.
    expect(paneCanvasHeights(900, DEFAULT_SPLIT)).toEqual([359, 359]);
  });

  it('gives the dragged-larger pane the taller canvas', () => {
    const [upper, lower] = paneCanvasHeights(900, [70, 30]);
    expect(upper).toBeGreaterThan(lower);
  });

  /**
   * The load-bearing one: both charts plus their chrome and the divider must
   * fit the box they share, or the lower chart is cut off -- which is exactly
   * what a too-small CHROME_PER_CHART did before the split was drag-resizable.
   */
  it.each([
    [900, DEFAULT_SPLIT],
    [900, [70, 30]],
    [640, DEFAULT_SPLIT],
    [1400, [35, 65]],
  ])('fits the %ip box at split %p', (total, split) => {
    const [upper, lower] = paneCanvasHeights(
      total as number,
      split as number[]
    );
    const used = upper + lower + 2 * CHROME_PER_CHART + SPLIT_HANDLE_PX;
    expect(used).toBeLessThanOrEqual(total as number);
  });

  it('clamps to a readable canvas on a box too short to honour the split', () => {
    const [upper, lower] = paneCanvasHeights(200, DEFAULT_SPLIT);
    expect(upper).toBe(MIN_CHART_HEIGHT);
    expect(lower).toBe(MIN_CHART_HEIGHT);
  });

  it('treats a missing percentage as an even split', () => {
    expect(paneCanvasHeights(900, [])).toEqual(
      paneCanvasHeights(900, DEFAULT_SPLIT)
    );
  });
});

describe('minPanePercent', () => {
  it('keeps a pane at or above a readable canvas plus its chrome', () => {
    const total = 900;
    const percent = minPanePercent(total);
    const paneAtMinimum = (usablePaneSpacePx(total) * percent) / 100;
    expect(paneAtMinimum).toBeGreaterThanOrEqual(MIN_PANE_PX - 0.5);
  });

  it('leaves room to drag on a normal workspace height', () => {
    expect(minPanePercent(900)).toBeLessThan(50);
  });

  /**
   * Both panes carry this minimum, so anything above 50 could never be
   * satisfied by both at once and the divider would jump rather than hold.
   */
  it('never exceeds half the group, however short the box', () => {
    for (const total of [0, 50, 200, 400, MIN_PANE_PX * 2]) {
      expect(minPanePercent(total)).toBeLessThanOrEqual(50);
    }
  });

  it('is at or below the default split, so defaultSize is never under minSize', () => {
    for (const total of [200, 400, 640, 900, 1400]) {
      expect(minPanePercent(total)).toBeLessThanOrEqual(DEFAULT_SPLIT[0]);
    }
  });
});
