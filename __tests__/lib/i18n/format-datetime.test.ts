/**
 * Date and time formatting in the user's timezone, date format and time
 * format (Settings → Language & Region).
 *
 * @module __tests__/lib/i18n/format-datetime.test
 */

import {
  formatDateInZone,
  formatDateTimeInZone,
  formatTimeInZone,
} from '@/lib/i18n/format-datetime';

// 25 Dec 2024, 22:30:05 UTC: already 26 Dec in Bangkok (UTC+7).
const LATE_EVENING_UTC = Date.UTC(2024, 11, 25, 22, 30, 5);

describe('formatDateInZone', () => {
  it('uses the timezone to decide the calendar day', () => {
    expect(
      formatDateInZone(LATE_EVENING_UTC, {
        timezone: 'Asia/Bangkok',
        dateFormat: 'DMY',
      })
    ).toBe('26/12/2024');
    expect(
      formatDateInZone(LATE_EVENING_UTC, {
        timezone: 'America/New_York',
        dateFormat: 'DMY',
      })
    ).toBe('25/12/2024');
  });

  it('orders the parts by the date format', () => {
    const tz = { timezone: 'UTC' };
    expect(
      formatDateInZone(LATE_EVENING_UTC, { ...tz, dateFormat: 'MDY' })
    ).toBe('12/25/2024');
    expect(
      formatDateInZone(LATE_EVENING_UTC, { ...tz, dateFormat: 'YMD' })
    ).toBe('2024-12-25');
  });

  it('accepts ISO strings and rejects invalid dates', () => {
    const prefs = { timezone: 'UTC', dateFormat: 'DMY' as const };
    expect(formatDateInZone('2024-01-15T10:30:00Z', prefs)).toBe('15/01/2024');
    expect(formatDateInZone('not a date', prefs)).toBe('--/--/----');
  });
});

describe('formatTimeInZone', () => {
  it('shows 24-hour or 12-hour time in the timezone', () => {
    expect(
      formatTimeInZone(LATE_EVENING_UTC, {
        timezone: 'Asia/Bangkok',
        timeFormat: '24h',
      })
    ).toBe('05:30');
    expect(
      formatTimeInZone(LATE_EVENING_UTC, {
        timezone: 'Asia/Bangkok',
        timeFormat: '12h',
      })
    ).toBe('5:30 AM');
  });

  it('writes midnight as 00 (24-hour) and 12 AM (12-hour)', () => {
    const midnight = Date.UTC(2024, 0, 1, 0, 5);
    expect(
      formatTimeInZone(midnight, { timezone: 'UTC', timeFormat: '24h' })
    ).toBe('00:05');
    expect(
      formatTimeInZone(midnight, { timezone: 'UTC', timeFormat: '12h' })
    ).toBe('12:05 AM');
  });

  it('can include seconds', () => {
    expect(
      formatTimeInZone(
        LATE_EVENING_UTC,
        { timezone: 'UTC', timeFormat: '24h' },
        { seconds: true }
      )
    ).toBe('22:30:05');
  });
});

describe('formatDateTimeInZone', () => {
  it('joins date and time in the same timezone', () => {
    expect(
      formatDateTimeInZone(LATE_EVENING_UTC, {
        timezone: 'Asia/Bangkok',
        dateFormat: 'MDY',
        timeFormat: '12h',
      })
    ).toBe('12/26/2024 5:30 AM');
  });
});
