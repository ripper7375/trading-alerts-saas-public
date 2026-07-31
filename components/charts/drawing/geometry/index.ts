/**
 * Drawing geometry — public barrel.
 *
 * Session 4B-1 (F9): the actual math now lives in `@trading-alerts/types`,
 * the shared package consumed by both this Next.js monolith and (from
 * Session 4B-2 onward) operation-service's ported alert engine. This file is
 * a thin re-export so every existing `@/components/charts/drawing/geometry`
 * import keeps working unchanged. Never fork the math back into this tree —
 * edit `packages/types/src/geometry/*` instead.
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
} from '@trading-alerts/types/geometry';

export {
  trendlineValueAt,
  horizontalValue,
  channelLevels,
  DEFAULT_FIB_EXT_RATIOS,
  DEFAULT_FIB_RETRACE_RATIOS,
  fibExtensionLevels,
  fibRetracementLevels,
  levelsForMark,
} from '@trading-alerts/types/geometry';

export type {
  TrendlineExtent,
  ChannelLevels,
} from '@trading-alerts/types/geometry';
