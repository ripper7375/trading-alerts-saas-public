/**
 * Trendline / line-segment geometry.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`. This file is a
 * thin re-export so every existing `../geometry/trendline` import keeps
 * working unchanged. Never fork this math back into this tree — edit
 * `packages/types/src/geometry/trendline.ts` instead.
 *
 * @module components/charts/drawing/geometry/trendline
 */

export { trendlineValueAt } from '@trading-alerts/types/geometry';
export type { TrendlineExtent } from '@trading-alerts/types/geometry';
