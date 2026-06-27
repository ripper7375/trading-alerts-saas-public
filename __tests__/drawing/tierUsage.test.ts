/**
 * Tests for tier usage helpers.
 */

import {
  alertUsage,
  drawingUsage,
} from '@/components/charts/drawing/tierUsage';

describe('tierUsage', () => {
  it('formats alert usage and flags at-limit', () => {
    const free = alertUsage('FREE', 5);
    expect(free.limit).toBeGreaterThan(0);
    expect(free.label).toBe(`5 / ${free.limit}`);
    expect(alertUsage('FREE', free.limit).atLimit).toBe(true);
    expect(alertUsage('FREE', 0).atLimit).toBe(false);
  });

  it('PRO has a higher (or equal) alert limit than FREE', () => {
    expect(alertUsage('PRO', 0).limit).toBeGreaterThanOrEqual(
      alertUsage('FREE', 0).limit
    );
  });

  it('formats drawing usage', () => {
    const du = drawingUsage('PRO', 3);
    expect(du.label).toBe(`3 / ${du.limit}`);
    expect(du.atLimit).toBe(false);
  });
});
