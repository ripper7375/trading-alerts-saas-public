/**
 * Tests for tier usage helpers.
 */

import {
  alertUsage,
  drawingUsage,
} from '@/components/charts/drawing/tierUsage';

describe('tierUsage', () => {
  it('formats alert usage and flags at-limit', () => {
    // V8: Alerts are a PRO-only feature — FREE tier's alert limit is 0.
    const free = alertUsage('FREE', 5);
    expect(free.limit).toBe(0);
    expect(free.label).toBe(`5 / ${free.limit}`);
    // With a limit of 0, FREE is always at-limit, even with zero alerts.
    expect(alertUsage('FREE', 0).atLimit).toBe(true);
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
