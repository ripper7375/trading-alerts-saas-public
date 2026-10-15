/** @jest-environment node */
import { MARKETS } from '@/lib/world-gold/catalog';
import {
  dueCloses,
  getMarketSchedule,
  localTimeToUtc,
  previousScheduledDate,
} from '@/lib/world-gold/schedule';
const market = (id: string) => MARKETS.find((entry) => entry.id === id)!;
describe('Regular local market schedules', () => {
  test.each([
    ['gb', '2026-07-15', 1020, '2026-07-15T16:00:00.000Z'],
    ['gb', '2026-12-15', 1020, '2026-12-15T17:00:00.000Z'],
    ['de', '2026-07-15', 1050, '2026-07-15T15:30:00.000Z'],
    ['de', '2026-12-15', 1050, '2026-12-15T16:30:00.000Z'],
    ['ch', '2026-10-26', 1050, '2026-10-26T16:30:00.000Z'],
    ['au', '2026-12-15', 1020, '2026-12-15T09:00:00.000Z'],
    ['in', '2026-10-15', 1410, '2026-10-15T18:00:00.000Z'],
  ])(
    '%s local close on %s resolves with IANA timezone rules',
    (id, date, minute, expected) => {
      expect(
        localTimeToUtc(date, Number(minute), market(id).timeZone).toISOString()
      ).toBe(expected);
    }
  );
  test.each([
    ['th', '2026-10-15T01:59:59Z', false],
    ['th', '2026-10-15T02:00:00Z', true],
    ['th', '2026-10-15T10:29:59Z', true],
    ['th', '2026-10-15T10:30:00Z', false],
    ['gb', '2026-10-17T10:00:00Z', false],
    ['hk', '2026-10-16T20:59:59Z', true], // Saturday04:59: Friday electronic session.
    ['hk', '2026-10-16T21:00:00Z', false],
    ['hk', '2026-10-18T17:00:00Z', false], // Monday01:00: Sunday did not start a session.
    ['jp', '2026-10-15T06:45:00Z', false],
    ['jp', '2026-10-15T08:00:00Z', true],
    ['jp', '2026-10-16T20:59:59Z', true],
    ['jp', '2026-10-16T21:00:00Z', false],
    ['ae', '2026-10-16T11:59:59Z', false],
    ['ae', '2026-10-16T12:00:00Z', true],
    ['ae', '2026-10-17T07:00:00Z', true],
    ['ae', '2026-10-17T18:00:00Z', false],
    ['tr', '2026-10-15T15:30:00Z', true], // Bazaar open after BIST benchmark.
    ['tr', '2026-10-15T16:00:00Z', false],
  ])('%s at %s open=%s', (id, instant, expected) => {
    expect(getMarketSchedule(market(id), new Date(instant)).isOpen).toBe(
      expected
    );
  });
  test('Monday previous benchmark is Friday, UAE previous benchmark is Sunday', () => {
    expect(previousScheduledDate(market('gb'), '2026-10-19')).toBe(
      '2026-10-16'
    );
    expect(previousScheduledDate(market('ae'), '2026-10-19')).toBe(
      '2026-10-18'
    );
  });
  test('does not use today close as today previous-day baseline', () => {
    expect(previousScheduledDate(market('th'), '2026-10-15')).toBe(
      '2026-10-14'
    );
  });
  test('close becomes due exactly at cutoff and missed closes older than raw retention stay unavailable', () => {
    expect(dueCloses(market('th'), new Date('2026-10-15T10:29:59Z'))).toEqual(
      []
    );
    expect(
      dueCloses(market('th'), new Date('2026-10-15T10:30:00Z'))[0]?.date
    ).toBe('2026-10-15');
    expect(dueCloses(market('th'), new Date('2026-10-15T18:30:00Z'))).toEqual(
      []
    );
  });
  test('night-time clock retains previous local calendar day when scanning due closes', () => {
    expect(
      dueCloses(market('in'), new Date('2026-10-15T20:00:00Z'))[0]?.date
    ).toBe('2026-10-15');
  });
  test('all accepted reference close times remain distinct from secondary sessions', () => {
    expect(
      Object.fromEntries(MARKETS.map((entry) => [entry.id, entry.closeMinutes]))
    ).toEqual({
      gb: 1020,
      th: 1050,
      hk: 990,
      jp: 945,
      in: 1410,
      ae: 1320,
      tr: 1080,
      de: 1050,
      ch: 1050,
      au: 1020,
    });
  });
});
