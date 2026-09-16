/**
 * Height maths for the drag-resizable M5/M15 split rendered by
 * components/charts/mtf-stacked-charts.tsx.
 *
 * The two charts share one clipped box, and `lightweight-charts` needs an
 * explicit pixel height rather than a flexible one -- so the split cannot just
 * be CSS. react-resizable-panels reports the divider position as percentages,
 * and these functions turn that into the two canvas heights.
 *
 * Pure functions, no DOM: unit-tested in
 * __tests__/components/charts/mtf-split-layout.test.ts.
 *
 * @module components/charts/mtf-split-layout
 */

/**
 * Chrome around each canvas inside a stacked `TradingChart`: the label strip
 * (`h-9`, 36px), the `space-y-4` gap beneath it (16px), and the chart card's
 * own `p-4` padding with a 1px border top and bottom (34px).
 *
 * Measured against the live layout, not estimated, and rounded up rather than
 * down: the two charts share one clipped box, so an underestimate here does
 * not overflow visibly -- it silently cuts the bottom off the lower chart.
 * The strip is fixed-height in components/charts/trading-chart.tsx precisely
 * so this is one number rather than one per timeframe.
 */
export const CHROME_PER_CHART = 86;

/** A canvas shorter than this is unreadable. */
export const MIN_CHART_HEIGHT = 160;

/** Smallest pane worth offering: a readable canvas plus its chrome. */
export const MIN_PANE_PX = MIN_CHART_HEIGHT + CHROME_PER_CHART;

/** The divider itself -- `h-2.5` on a vertical ResizableHandle. */
export const SPLIT_HANDLE_PX = 10;

/** Used until the group has been measured (first paint, jsdom). */
export const FALLBACK_TOTAL_HEIGHT_PX = 640;

/** An even split, which is also what the downloaded PNG renders. */
export const DEFAULT_SPLIT: readonly [number, number] = [50, 50];

/** Height the two panes actually share, once the divider has taken its own. */
export function usablePaneSpacePx(totalHeightPx: number): number {
  return Math.max(0, totalHeightPx - SPLIT_HANDLE_PX);
}

/**
 * Canvas height for each pane, given the divider position.
 *
 * Clamped to `MIN_CHART_HEIGHT`, which only bites on a viewport too short to
 * honour the split; the pane clips rather than pushing the other chart down.
 */
export function paneCanvasHeights(
  totalHeightPx: number,
  split: readonly number[]
): [number, number] {
  const space = usablePaneSpacePx(totalHeightPx);
  const canvas = (percent: number | undefined): number =>
    Math.max(
      MIN_CHART_HEIGHT,
      Math.floor((space * (percent ?? 50)) / 100) - CHROME_PER_CHART
    );
  return [canvas(split[0]), canvas(split[1])];
}

/**
 * Minimum pane size as a percentage of the group, so neither chart can be
 * dragged below a readable height.
 *
 * Capped at 50 because both panes carry it: a larger minimum could not be
 * satisfied by both at once, and the library would clamp it anyway. On a
 * viewport short enough to hit that cap the divider simply stops moving,
 * which is the honest outcome -- there is no space left to reallocate.
 */
export function minPanePercent(totalHeightPx: number): number {
  const space = usablePaneSpacePx(totalHeightPx);
  if (space <= 0) return 50;
  const percent = (MIN_PANE_PX / space) * 100;
  return Math.min(50, Math.round(percent * 1e4) / 1e4);
}
