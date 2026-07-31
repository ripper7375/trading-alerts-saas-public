/**
 * Horizontal line geometry — a constant price across all time.
 *
 * @module @trading-alerts/types/geometry/horizontal
 */

/** A horizontal line's price does not vary with time. */
export function horizontalValue(price: number): number {
  return price;
}
