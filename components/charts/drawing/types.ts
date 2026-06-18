/**
 * Engine-level drawing types (the chart-facing layer).
 *
 * Re-exports the pure geometry types and adds the `DrawingMark` contract that
 * concrete marks implement. Unlike `geometry/`, this layer may reference the
 * chart, since marks render onto it.
 *
 * @module components/charts/drawing/types
 */

import type {
  AlertLevel,
  Anchor,
  DrawingStyle,
  DrawingType,
  MarkSnapshot,
} from './geometry/types';

export type {
  AlertLevel,
  Anchor,
  DrawingStyle,
  DrawingType,
  MarkSnapshot,
} from './geometry/types';

/**
 * A drawable, selectable, alertable mark on the chart. Implemented by
 * `BaseMark` subclasses. The rendering itself is provided through the
 * Lightweight Charts primitive interface (see `BaseMark`).
 */
export interface DrawingMark {
  readonly id: string;
  readonly type: DrawingType;

  getAnchors(): Anchor[];
  setAnchors(anchors: Anchor[]): void;

  getStyle(): DrawingStyle;
  setStyle(patch: Partial<DrawingStyle>): void;

  setSelected(selected: boolean): void;
  isSelected(): boolean;

  /** Handle id under the pixel, or null. Drives anchor dragging. */
  hitHandle(x: number, y: number, tol?: number): string | null;
  /** Whether the pixel is on the mark's body (for selection/move). */
  hitBody(x: number, y: number, tol?: number): boolean;

  /** Price levels an alert can watch (empty for non-alertable marks). */
  alertLevels(): AlertLevel[];

  /** Persisted representation (↔ Prisma `Drawing`). */
  toSnapshot(): MarkSnapshot;
}
