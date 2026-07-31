/**
 * Drawing geometry — public barrel.
 *
 * Pure, framework-free math shared by the chart drawing engine (Phase 1), the
 * monolith's server-side alert worker, and (from Session 4B-2 onward)
 * operation-service's ported alert engine. No imports from
 * `lightweight-charts` or React are permitted anywhere under this directory.
 *
 * Hoisted from `components/charts/drawing/geometry` (Session 4B-1, F9) — this
 * package is now the single source of truth. Never fork this math.
 *
 * @module @trading-alerts/types/geometry
 */

export type {
  Anchor,
  AlertLevel,
  DrawingStyle,
  DrawingType,
  LineStyle,
  MarkSnapshot,
} from './types';

export { trendlineValueAt } from './trendline';
export type { TrendlineExtent } from './trendline';

export { horizontalValue } from './horizontal';

export { channelLevels } from './channel';
export type { ChannelLevels } from './channel';

export {
  DEFAULT_FIB_EXT_RATIOS,
  DEFAULT_FIB_RETRACE_RATIOS,
  fibExtensionLevels,
  fibRetracementLevels,
} from './fib';

export { levelsForMark } from './levels';
