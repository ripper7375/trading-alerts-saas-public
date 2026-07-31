/**
 * Alert-engine shared types.
 *
 * Session 4B-2: ported from the monolith's `lib/alert-engine/types.ts` —
 * itself a thin re-export of `@trading-alerts/types/alert-engine` since
 * Session 4B-1 (F9). Re-exports the same plain types (no framework
 * wrapping) so every downstream file in this module compiles against the
 * single shared source of truth.
 *
 * @module alert-engine/types
 */

export type {
  Direction,
  PriceEvent,
  AlertWatch,
  FireEvent,
} from '@trading-alerts/types/alert-engine';
