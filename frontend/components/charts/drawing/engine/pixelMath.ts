/**
 * Pixel-space hit-testing math (pure).
 *
 * Operates on screen pixels only — used by marks for selection/hit-testing.
 * No chart or React imports, so it is unit-testable in isolation.
 *
 * @module components/charts/drawing/engine/pixelMath
 */

export interface PixelPoint {
  x: number;
  y: number;
}

/** Euclidean distance between two pixels. */
export function distanceBetween(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Shortest distance from point `p` to the finite segment `a`→`b` (pixels).
 * Degenerate segments (a === b) reduce to point distance.
 */
export function distancePointToSegment(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return distanceBetween(p, a);
  }

  // Projection parameter of p onto the line, clamped to the segment.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** True when `p` is within `tol` pixels of segment `a`→`b`. */
export function isNearSegment(
  p: PixelPoint,
  a: PixelPoint,
  b: PixelPoint,
  tol: number
): boolean {
  return distancePointToSegment(p, a, b) <= tol;
}

/** True when `p` is within `tol` pixels of point `a`. */
export function isNearPoint(
  p: PixelPoint,
  a: PixelPoint,
  tol: number
): boolean {
  return distanceBetween(p, a) <= tol;
}

/** True when `p` is within `tol` pixels (vertically) of horizontal line at `y`. */
export function isNearHorizontal(
  p: PixelPoint,
  y: number,
  tol: number
): boolean {
  return Math.abs(p.y - y) <= tol;
}
