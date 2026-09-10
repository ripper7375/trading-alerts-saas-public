import { describe, it, expect } from '@jest/globals';

import { buildNewsContext } from '@/lib/economic-events/prompt-context';
import type { UpcomingEconomicEvent } from '@/lib/economic-events/queries';

const NOW = new Date('2026-01-14T12:00:00Z');
const NOW_SEC = Math.floor(NOW.getTime() / 1000);

function event(
  overrides: Partial<UpcomingEconomicEvent> = {}
): UpcomingEconomicEvent {
  return {
    valueId: '1',
    eventId: '840010013',
    eventName: 'Non-Farm Employment Change',
    eventTime: NOW_SEC + 5400, // 13:30 UTC
    currency: 'USD',
    countryCode: 'US',
    importance: 'HIGH',
    forecastValue: 0.3,
    previousValue: 0.0,
    digits: 2,
    timeMode: 0,
    sourceUrl: null,
    ...overrides,
  };
}

/**
 * These are anti-fabrication tests, not formatting tests. Each one guards a
 * way the model could be led to state an economic fact that is not true.
 */
describe('buildNewsContext', () => {
  it('returns an EMPTY STRING when nothing is scheduled', () => {
    // The caller then omits the section entirely. Emitting "no events known"
    // would still put the topic in front of the model, and the model does not
    // know what is scheduled next week — a plausible guess is worse than
    // silence.
    expect(buildNewsContext([], NOW)).toBe('');
  });

  it('states an absent forecast in words rather than as a number', () => {
    // Measured: 12 of 23 upcoming HIGH-impact events carry no forecast at all,
    // because rate decisions, votes and speeches structurally have none.
    const out = buildNewsContext([event({ forecastValue: null })], NOW);
    expect(out).toContain('forecast: not published');
    expect(out).not.toMatch(/forecast: 0\.00/);
  });

  it('keeps a real 0.00 reading distinct from an absent one', () => {
    const out = buildNewsContext(
      [event({ forecastValue: 0.0, previousValue: null })],
      NOW
    );
    expect(out).toContain('forecast: 0.00');
    expect(out).toContain('previous: not published');
  });

  it('forbids the model from adding events of its own', () => {
    const out = buildNewsContext([event()], NOW);
    expect(out).toContain('ONLY scheduled events known to the system');
    expect(out).toContain('do not estimate a forecast');
  });

  it('gives both an absolute UTC time and a relative one', () => {
    const out = buildNewsContext([event()], NOW);
    expect(out).toContain('2026-01-14 13:30 UTC');
    expect(out).toContain('in 1h 30m');
  });

  it('marks an approximate time instead of implying the minute', () => {
    // A non-zero time_mode means upstream knows only the day, or is estimating.
    const out = buildNewsContext([event({ timeMode: 1 })], NOW);
    expect(out).toContain('(approximate time)');
  });

  it('does not mark a precise time as approximate', () => {
    expect(buildNewsContext([event({ timeMode: 0 })], NOW)).not.toContain(
      '(approximate time)'
    );
  });

  it('names the currency so a EUR print is not read as a dollar one', () => {
    const out = buildNewsContext(
      [event({ currency: 'EUR', eventName: 'ECB Rate Decision' })],
      NOW
    );
    expect(out).toContain('EUR');
    expect(out).toContain('ECB Rate Decision');
  });

  it('renders days for a distant event', () => {
    const out = buildNewsContext(
      [event({ eventTime: NOW_SEC + 3 * 86400 + 4 * 3600 })],
      NOW
    );
    expect(out).toContain('in 3d 4h');
  });

  it('says imminent rather than a negative countdown', () => {
    const out = buildNewsContext([event({ eventTime: NOW_SEC - 60 })], NOW);
    expect(out).toContain('imminent');
    expect(out).not.toContain('in -');
  });

  it('honours the per-event digits', () => {
    const out = buildNewsContext(
      [event({ forecastValue: 4.25, digits: 1 })],
      NOW
    );
    expect(out).toContain('forecast: 4.3');
  });

  it('lists every event given, one line each', () => {
    const out = buildNewsContext(
      [
        event({ valueId: 'a', eventName: 'CPI y/y' }),
        event({ valueId: 'b', eventName: 'FOMC Statement' }),
      ],
      NOW
    );
    expect(out).toContain('CPI y/y');
    expect(out).toContain('FOMC Statement');
    expect(out.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(2);
  });
});
