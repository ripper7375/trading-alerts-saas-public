/**
 * Drawing geometry — shared types.
 *
 * This module is intentionally framework-free: it imports nothing from
 * `lightweight-charts` or React. It operates purely on anchor points
 * ({ time, price }) so the same code runs in the browser (chart) and in the
 * server-side alert worker (Phase 4). See
 * docs/PHASE-1-DRAWING-ENGINE-CLEANROOM-SPEC.md §6.
 *
 * Hoisted into @trading-alerts/types (Session 4B-1, F9) — this is now the
 * single source of truth. Never fork this module.
 *
 * @module @trading-alerts/types/geometry/types
 */

/** The drawable tool types. Mirrors the Prisma `Drawing.type` vocabulary. */
export type DrawingType =
  | 'TRENDLINE'
  | 'HLINE'
  | 'CHANNEL'
  | 'FIB_RETRACE'
  | 'FIB_EXT'
  | 'TEXT';

/** A point in chart space. Never pixels. */
export interface Anchor {
  /** Bar timestamp, unix seconds. */
  time: number;
  /** Price in chart price-space. */
  price: number;
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Visual + tool-specific style. Tool extras (fib ratios via `levels`, channel
 * `offset`, trendline `extendLeft`/`extendRight`, `text`, …) ride in the index
 * signature and are read defensively by the geometry layer.
 */
export interface DrawingStyle {
  color: string;
  lineWidth: number;
  lineStyle: LineStyle;
  [key: string]: unknown;
}

/** A price level an alert can watch. */
export interface AlertLevel {
  /** Stable id, e.g. 'line' | 'channel_top' | 'fib_0.618'. Matches the API targetLevel vocabulary. */
  id: string;
  /** Human-readable label for UI. */
  label: string;
  /** Price of this level at the given bar time, or null if undefined there. */
  valueAt: (time: number) => number | null;
}

/** Persisted shape of a drawing (↔ Prisma `Drawing`). */
export interface MarkSnapshot {
  id: string;
  type: DrawingType;
  anchors: Anchor[];
  style: DrawingStyle;
}
