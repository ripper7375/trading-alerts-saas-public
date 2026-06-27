/**
 * Truth-table tests for cross/touch detection.
 */

import { detectCross } from '@/lib/alert-engine/detect';

describe('detectCross', () => {
  const L = 100;

  it('detects an upward close-to-close cross (either)', () => {
    expect(detectCross(99, 101, 99, 101, L, 0, 'either')).toBe(true);
  });

  it('detects a downward close-to-close cross (either)', () => {
    expect(detectCross(101, 99, 99, 101, L, 0, 'either')).toBe(true);
  });

  it('does not cross when staying on one side', () => {
    expect(detectCross(98, 99, 98, 99, L, 0, 'either')).toBe(false);
  });

  it('cross_up only fires on an upward cross', () => {
    expect(detectCross(99, 101, 99, 101, L, 0, 'cross_up')).toBe(true);
    expect(detectCross(101, 99, 99, 101, L, 0, 'cross_up')).toBe(false);
  });

  it('cross_down only fires on a downward cross', () => {
    expect(detectCross(101, 99, 99, 101, L, 0, 'cross_down')).toBe(true);
    expect(detectCross(99, 101, 99, 101, L, 0, 'cross_down')).toBe(false);
  });

  it('catches an intrabar wick touch via either (close stays below)', () => {
    // close 98 stays below, but the bar high reached 100.5 -> touched
    expect(detectCross(97, 98, 97, 100.5, L, 0, 'either')).toBe(true);
  });

  it('directional alerts ignore a wick that the close did not cross', () => {
    expect(detectCross(97, 98, 97, 100.5, L, 0, 'cross_up')).toBe(false);
  });

  it('respects tolerance band', () => {
    // within 2.0 of the level counts as touched
    expect(detectCross(95, 98.5, 95, 98.5, L, 2, 'either')).toBe(true);
    expect(detectCross(95, 97.5, 95, 97.5, L, 2, 'either')).toBe(false);
  });

  it('first event (prev null) can still touch via either', () => {
    expect(detectCross(null, 100, 99, 101, L, 0, 'either')).toBe(true);
    // ...but a directional close-cross needs a prev to compare
    expect(detectCross(null, 101, 99, 101, L, 0, 'cross_up')).toBe(false);
  });
});
