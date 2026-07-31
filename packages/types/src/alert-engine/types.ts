/**
 * Alert-engine shared types.
 *
 * Hoisted from `lib/alert-engine/types.ts` (Session 4B-1, F9) — this package
 * is now the single source of truth, consumed by the monolith and (from
 * Session 4B-2 onward) operation-service's ported alert engine.
 *
 * @module @trading-alerts/types/alert-engine/types
 */

export type Direction = 'cross_up' | 'cross_down' | 'either';

/** A live price update for a symbol/timeframe (from the MT5 -> Redis feed). */
export interface PriceEvent {
  symbol: string;
  timeframe: string;
  time: number; // bar timestamp, unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  final: boolean; // closed bar vs forming
}

/** A single watched price level derived from a DrawingAlert + its Drawing. */
export interface AlertWatch {
  alertId: string;
  drawingAlertId: string;
  userId: string;
  symbol: string;
  timeframe: string;
  levelId: string;
  /** Price of the watched level at a bar time (constant or linear-in-time). */
  valueAt: (time: number) => number | null;
  direction: Direction;
  tolerance: number;
  cooldownSec: number;
  oneShot: boolean;
}

/** Emitted when a watch crosses — handed to the dispatcher. */
export interface FireEvent {
  alertId: string;
  userId: string;
  symbol: string;
  timeframe: string;
  levelId: string;
  levelPrice: number;
  touchPrice: number;
  time: number;
  oneShot: boolean;
}
