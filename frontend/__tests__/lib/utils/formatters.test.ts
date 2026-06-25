/**
 * Formatters Tests
 *
 * Tests for formatting utility functions.
 */

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCompactNumber,
  formatNumber,
  formatPercent,
  formatPrice,
  formatBytes,
  formatDuration,
  pluralize,
  formatCount,
} from '@/lib/utils/formatters';

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('should format USD currency', () => {
      expect(formatCurrency(29)).toBe('$29.00');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format with different currencies', () => {
      expect(formatCurrency(29, 'EUR')).toContain('29');
      expect(formatCurrency(29, 'GBP')).toContain('29');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-29)).toBe('-$29.00');
    });
  });

  describe('formatDate', () => {
    it('should format date with default medium style', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
    });

    it('should format date from string', () => {
      const formatted = formatDate('2024-01-15');

      expect(formatted).toContain('Jan');
    });

    it('should support different styles', () => {
      const date = new Date('2024-01-15');

      const short = formatDate(date, 'short');
      const long = formatDate(date, 'long');

      expect(short.length).toBeLessThan(long.length);
    });

    it('should throw for invalid date', () => {
      expect(() => formatDate('invalid')).toThrow('Invalid date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatDateTime(date);

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      // Time format varies by locale
      expect(formatted).toMatch(/\d/);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const relative = formatRelativeTime(fiveMinutesAgo);

      expect(relative).toContain('minute');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const relative = formatRelativeTime(twoHoursAgo);

      expect(relative).toContain('hour');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const relative = formatRelativeTime(threeDaysAgo);

      expect(relative).toContain('day');
    });

    it('should format weeks ago', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const relative = formatRelativeTime(twoWeeksAgo);

      expect(relative).toContain('week');
    });

    it('should handle string dates', () => {
      const recent = new Date(Date.now() - 30 * 1000).toISOString();
      const relative = formatRelativeTime(recent);

      expect(relative).toContain('second');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format thousands as K', () => {
      expect(formatCompactNumber(1000)).toBe('1K');
      expect(formatCompactNumber(1500)).toBe('1.5K');
      expect(formatCompactNumber(10000)).toBe('10K');
    });

    it('should format millions as M', () => {
      expect(formatCompactNumber(1000000)).toBe('1M');
      expect(formatCompactNumber(2500000)).toBe('2.5M');
    });

    it('should not compact small numbers', () => {
      expect(formatCompactNumber(100)).toBe('100');
      expect(formatCompactNumber(999)).toBe('999');
    });
  });

  describe('formatNumber', () => {
    it('should format with thousands separator', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should handle decimals', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56');
    });
  });

  describe('formatPercent', () => {
    it('should format as percentage', () => {
      expect(formatPercent(0.1)).toBe('10.00%');
      expect(formatPercent(0.5)).toBe('50.00%');
      expect(formatPercent(1)).toBe('100.00%');
    });

    it('should support custom decimal places', () => {
      expect(formatPercent(0.1234, 1)).toBe('12.3%');
      expect(formatPercent(0.1234, 0)).toBe('12%');
    });
  });

  describe('formatPrice', () => {
    it('should format price with 2 decimals by default', () => {
      expect(formatPrice(2000)).toBe('2000.00');
      expect(formatPrice(2000.5)).toBe('2000.50');
    });

    it('should use 2 decimals for crypto above 1000', () => {
      expect(formatPrice(45000.12, 'BTCUSD')).toBe('45000.12');
    });

    it('should use 4 decimals for crypto below 1000', () => {
      expect(formatPrice(500.1234, 'ETHUSD')).toBe('500.1234');
    });

    it('should use 5 decimals for forex pairs', () => {
      expect(formatPrice(1.08502, 'EURUSD')).toBe('1.08502');
    });

    it('should use 3 decimals for JPY pairs', () => {
      expect(formatPrice(150.123, 'USDJPY')).toBe('150.123');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should support custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB');
      expect(formatBytes(1536, 3)).toBe('1.5 KB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(300000)).toBe('5m 0s');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(5400000)).toBe('1h 30m');
    });

    it('should format days and hours', () => {
      expect(formatDuration(86400000)).toBe('1d 0h');
      expect(formatDuration(129600000)).toBe('1d 12h');
    });
  });

  describe('pluralize', () => {
    it('should return singular for count of 1', () => {
      expect(pluralize(1, 'item')).toBe('item');
      expect(pluralize(1, 'alert')).toBe('alert');
    });

    it('should return plural for other counts', () => {
      expect(pluralize(0, 'item')).toBe('items');
      expect(pluralize(2, 'item')).toBe('items');
      expect(pluralize(100, 'item')).toBe('items');
    });

    it('should use custom plural form', () => {
      expect(pluralize(2, 'person', 'people')).toBe('people');
      expect(pluralize(1, 'person', 'people')).toBe('person');
    });
  });

  describe('formatCount', () => {
    it('should format count with label', () => {
      expect(formatCount(1, 'alert')).toBe('1 alert');
      expect(formatCount(5, 'alert')).toBe('5 alerts');
    });

    it('should format with thousands separator', () => {
      expect(formatCount(1000, 'user')).toBe('1,000 users');
    });

    it('should use custom plural', () => {
      expect(formatCount(2, 'person', 'people')).toBe('2 people');
    });
  });
});
