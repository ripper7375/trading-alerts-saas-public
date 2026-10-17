/**
 * The plain values the cockpit shares with `relative-strength-chart.tsx`. They
 * live apart from the chart so the cockpit can read them without importing it:
 * the chart is loaded on demand (`next/dynamic`), and its loading skeleton
 * needs the plot height.
 *
 * @module components/currency-index-pro/chart/relative-strength-config
 */

/** The chart's default plot height (px); the loading skeleton uses it too. */
export const RELATIVE_STRENGTH_CHART_HEIGHT = 480;
