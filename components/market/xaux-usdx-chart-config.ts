/**
 * The plain values the XAUX vs USDX page shares with its chart: the rebase
 * slider bounds and the plot height. They live apart from
 * `xaux-usdx-comparison-chart.tsx` so the page can read them without importing
 * the chart, which is loaded on demand (`next/dynamic`); the chart re-exports
 * the bounds.
 *
 * @module components/market/xaux-usdx-chart-config
 */

/** Slider bounds for the rebase controls -- matches the feature's own request. */
export const REBASE_MIN = 50;
export const REBASE_MAX = 150;
export const REBASE_DEFAULT = 100;

/** The chart's default plot height (px); the loading skeleton uses it too. */
export const XAUX_USDX_CHART_HEIGHT = 480;
