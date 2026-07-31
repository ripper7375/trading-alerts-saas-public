/**
 * Fibonacci geometry — retracement and price-extension levels.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`. This file is a
 * thin re-export so every existing `../geometry/fib` import keeps working
 * unchanged. Never fork this math back into this tree — edit
 * `packages/types/src/geometry/fib.ts` instead.
 *
 * @module components/charts/drawing/geometry/fib
 */

export {
  DEFAULT_FIB_RETRACE_RATIOS,
  DEFAULT_FIB_EXT_RATIOS,
  fibRetracementLevels,
  fibExtensionLevels,
} from '@trading-alerts/types/geometry';
