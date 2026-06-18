/**
 * Unit tests for the pure pixel-space hit-testing math.
 */

import {
  distanceBetween,
  distancePointToSegment,
  isNearHorizontal,
  isNearPoint,
  isNearSegment,
} from '@/components/charts/drawing/engine/pixelMath';

describe('distanceBetween', () => {
  it('computes euclidean distance', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });
});

describe('distancePointToSegment', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it('is zero on the segment', () => {
    expect(distancePointToSegment({ x: 5, y: 0 }, a, b)).toBeCloseTo(0);
  });

  it('measures perpendicular distance', () => {
    expect(distancePointToSegment({ x: 5, y: 4 }, a, b)).toBeCloseTo(4);
  });

  it('clamps beyond the end caps', () => {
    expect(distancePointToSegment({ x: 13, y: 0 }, a, b)).toBeCloseTo(3);
    expect(distancePointToSegment({ x: -3, y: 0 }, a, b)).toBeCloseTo(3);
  });

  it('handles a degenerate (zero-length) segment', () => {
    expect(distancePointToSegment({ x: 3, y: 4 }, a, a)).toBeCloseTo(5);
  });
});

describe('isNearSegment / isNearPoint / isNearHorizontal', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it('isNearSegment respects tolerance', () => {
    expect(isNearSegment({ x: 5, y: 3 }, a, b, 4)).toBe(true);
    expect(isNearSegment({ x: 5, y: 6 }, a, b, 4)).toBe(false);
  });

  it('isNearPoint respects tolerance', () => {
    expect(isNearPoint({ x: 2, y: 2 }, a, 3)).toBe(true);
    expect(isNearPoint({ x: 5, y: 5 }, a, 3)).toBe(false);
  });

  it('isNearHorizontal checks vertical distance only', () => {
    expect(isNearHorizontal({ x: 999, y: 102 }, 100, 5)).toBe(true);
    expect(isNearHorizontal({ x: 0, y: 110 }, 100, 5)).toBe(false);
  });
});
