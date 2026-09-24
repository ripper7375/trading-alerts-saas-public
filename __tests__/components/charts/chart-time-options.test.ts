/**
 * Chart time labels (crosshair and axis) in the user's timezone and formats.
 *
 * lightweight-charts prints timestamps as UTC unless told otherwise, so a
 * Bangkok user would otherwise read every chart 7 hours behind.
 *
 * @module __tests__/components/charts/chart-time-options.test
 */

import type { TickMarkType, Time } from 'lightweight-charts';

import { chartTimeOptions } from '@/components/charts/use-chart-time-options';

// 25 Dec 2024, 22:30 UTC, as lightweight-charts passes it (seconds).
const BAR = (Date.UTC(2024, 11, 25, 22, 30) / 1000) as Time;

const bangkok = chartTimeOptions({
  timezone: 'Asia/Bangkok',
  dateFormat: 'DMY',
  timeFormat: '24h',
  language: 'en-GB',
});

const tick = (type: number): string =>
  bangkok.timeScale.tickMarkFormatter(BAR, type as TickMarkType);

describe('chartTimeOptions', () => {
  it('labels the crosshair with the date and time in the timezone', () => {
    expect(bangkok.localization.timeFormatter(BAR)).toBe('26/12/2024 05:30');
  });

  it('labels axis ticks in the timezone', () => {
    expect(tick(3)).toBe('05:30'); // Time
    expect(tick(2)).toBe('26'); // DayOfMonth
    expect(tick(1)).toBe('Dec'); // Month
    expect(tick(0)).toBe('2024'); // Year
  });

  it('follows the 12-hour format', () => {
    const twelve = chartTimeOptions({
      timezone: 'Asia/Bangkok',
      dateFormat: 'MDY',
      timeFormat: '12h',
      language: 'en-US',
    });
    expect(twelve.localization.timeFormatter(BAR)).toBe('12/26/2024 5:30 AM');
    expect(twelve.timeScale.tickMarkFormatter(BAR, 3 as TickMarkType)).toBe(
      '5:30 AM'
    );
  });

  it('leaves date-only times unshifted', () => {
    expect(bangkok.localization.timeFormatter('2024-12-25' as Time)).toBe(
      '2024-12-25'
    );
  });
});
