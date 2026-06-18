/**
 * Drawing geometry — public barrel.
 *
 * Pure, framework-free math shared by the chart drawing engine (Phase 1) and
 * the server-side alert worker (Phase 4). No imports from `lightweight-charts`
 * or React are permitted anywhere under this directory.
 *
 * @module components/charts/drawing/geometry
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
