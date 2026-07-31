/**
 * Alert-engine shared types.
 *
 * Session 4B-1 (F9): hoisted into `@trading-alerts/types`, the shared package
 * consumed by both this monolith and (from Session 4B-2 onward)
 * operation-service's ported alert engine. This file is a thin re-export so
 * every existing `lib/alert-engine/types` import keeps working unchanged.
 * Never fork these types back into this tree — edit
 * `packages/types/src/alert-engine/types.ts` instead.
 *
 * @module lib/alert-engine/types
 */

export type {
  Direction,
  PriceEvent,
  AlertWatch,
  FireEvent,
} from '@trading-alerts/types/alert-engine';
