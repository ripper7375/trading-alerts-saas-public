/**
 * Timezone Utilities Tests
 *
 * Tests for the All Round Clock timezone dropdown utilities.
 */

import {
  getAllTimezones,
  getTimezoneOffsetMinutes,
  formatGmtOffset,
  getTimezoneLabel,
} from '@/lib/utils/timezones';

describe('Timezone Utilities (All Round Clock)', () => {
  it('should format positive and negative GMT offsets correctly', () => {
    expect(formatGmtOffset(0)).toBe('(GMT +00:00)');
    expect(formatGmtOffset(240)).toBe('(GMT +04:00)');
    expect(formatGmtOffset(-300)).toBe('(GMT -05:00)');
    expect(formatGmtOffset(330)).toBe('(GMT +05:30)');
    expect(formatGmtOffset(840)).toBe('(GMT +14:00)');
    expect(formatGmtOffset(-720)).toBe('(GMT -12:00)');
  });

  it('should return a comprehensive list of timezones sorted chronologically', () => {
    const list = getAllTimezones();
    expect(list.length).toBeGreaterThanOrEqual(40);

    for (let i = 0; i < list.length - 1; i++) {
      expect(list[i]?.offsetMinutes).toBeLessThanOrEqual(
        list[i + 1]?.offsetMinutes ?? Number.POSITIVE_INFINITY
      );
    }
  });

  it('should sort alphabetically by identifier within the same offset', () => {
    const list = getAllTimezones();
    const grouped = new Map<number, string[]>();
    for (const tz of list) {
      const bucket = grouped.get(tz.offsetMinutes) ?? [];
      bucket.push(tz.value);
      grouped.set(tz.offsetMinutes, bucket);
    }
    for (const values of grouped.values()) {
      const sorted = [...values].sort((a, b) => a.localeCompare(b));
      expect(values).toEqual(sorted);
    }
  });

  it('should include major global financial hubs across offsets', () => {
    const list = getAllTimezones();
    const values = list.map((tz) => tz.value);

    expect(values).toContain('UTC');
    expect(values).toContain('America/New_York');
    expect(values).toContain('Europe/London');
    expect(values).toContain('Europe/Paris');
    expect(values).toContain('Asia/Dubai');
    expect(values).toContain('Asia/Tokyo');
    expect(values).toContain('Asia/Seoul');
    expect(values).toContain('Asia/Singapore');
    expect(values).toContain('Australia/Sydney');
  });

  it('should have no duplicate timezone values', () => {
    const list = getAllTimezones();
    const values = list.map((tz) => tz.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('should format timezone labels with GMT prefix', () => {
    const label = getTimezoneLabel('UTC');
    expect(label).toContain('(GMT +00:00)');
    expect(label).toContain('UTC');
  });

  it('should return a fallback label for an empty timezone value', () => {
    expect(getTimezoneLabel('')).toBe('(GMT +00:00) UTC');
  });

  it('should return 0 offset for an invalid timezone rather than throwing', () => {
    expect(getTimezoneOffsetMinutes('Not/AZone')).toBe(0);
  });
});
