/**
 * levelsForMark — converts a persisted drawing into the price levels an alert
 * can watch.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`. This file is a
 * thin re-export so every existing `../geometry/levels` import keeps working
 * unchanged. Never fork this math back into this tree — edit
 * `packages/types/src/geometry/levels.ts` instead.
 *
 * @module components/charts/drawing/geometry/levels
 */

export { levelsForMark } from '@trading-alerts/types/geometry';
