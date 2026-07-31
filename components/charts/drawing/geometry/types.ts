/**
 * Drawing geometry — shared types.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`. This file is a
 * thin re-export so every existing `./geometry/types` / `../geometry/types`
 * import keeps working unchanged. Never fork these types back into this
 * tree — edit `packages/types/src/geometry/types.ts` instead.
 *
 * @module components/charts/drawing/geometry/types
 */

export type {
  Anchor,
  AlertLevel,
  DrawingStyle,
  DrawingType,
  LineStyle,
  MarkSnapshot,
} from '@trading-alerts/types/geometry';
