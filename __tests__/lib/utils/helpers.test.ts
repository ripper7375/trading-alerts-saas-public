/**
 * Helper Utilities Tests
 *
 * Tests for general-purpose utility functions.
 */

import {
  generateId,
  sleep,
  truncate,
  isDefined,
  isNotEmpty,
  pick,
  omit,
  deepClone,
  capitalize,
  titleCase,
  slugify,
  randomInt,
  isBrowser,
  isServer,
  safeJsonParse,
  chunk,
  unique,
  groupBy,
} from '@/lib/utils/helpers';

describe('Helper Utilities', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it('should generate ID without prefix by default', () => {
      const id = generateId();

      expect(id).not.toContain('_');
    });

    it('should generate ID with prefix when provided', () => {
      const id = generateId('user');

      expect(id).toMatch(/^user_/);
    });

    it('should generate alphanumeric IDs', () => {
      const id = generateId();

      expect(id).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe('sleep', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should return a promise', () => {
      const result = sleep(1);

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      const result = truncate('This is a very long string', 10);

      expect(result).toBe('This is...');
      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should not truncate short strings', () => {
      const result = truncate('Short', 10);

      expect(result).toBe('Short');
    });

    it('should use custom suffix', () => {
      const result = truncate('Long string here', 10, '…');

      expect(result).toBe('Long stri…');
    });

    it('should use default length of 50', () => {
      const longString = 'a'.repeat(60);
      const result = truncate(longString);

      expect(result.length).toBe(50);
    });
  });

  describe('isDefined', () => {
    it('should return false for null', () => {
      expect(isDefined(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isDefined(undefined)).toBe(false);
    });

    it('should return true for defined values', () => {
      expect(isDefined('')).toBe(true);
      expect(isDefined(0)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined([])).toBe(true);
    });
  });

  describe('isNotEmpty', () => {
    it('should return false for null and undefined', () => {
      expect(isNotEmpty(null)).toBe(false);
      expect(isNotEmpty(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isNotEmpty('')).toBe(false);
      expect(isNotEmpty('   ')).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isNotEmpty([])).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isNotEmpty({})).toBe(false);
    });

    it('should return true for non-empty values', () => {
      expect(isNotEmpty('hello')).toBe(true);
      expect(isNotEmpty([1])).toBe(true);
      expect(isNotEmpty({ a: 1 })).toBe(true);
      expect(isNotEmpty(0)).toBe(true);
      expect(isNotEmpty(false)).toBe(true);
    });
  });

  describe('pick', () => {
    it('should pick specified keys from object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = pick(obj, ['a', 'c']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should ignore non-existent keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a', 'c' as keyof typeof obj]);

      expect(result).toEqual({ a: 1 });
    });

    it('should return empty object for empty keys array', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, []);

      expect(result).toEqual({});
    });
  });

  describe('omit', () => {
    it('should omit specified keys from object', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = omit(obj, ['b']);

      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should return copy if no keys to omit', () => {
      const obj = { a: 1, b: 2 };
      const result = omit(obj, []);

      expect(result).toEqual({ a: 1, b: 2 });
      expect(result).not.toBe(obj);
    });
  });

  describe('deepClone', () => {
    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      const clone = deepClone(obj);

      expect(clone).toEqual(obj);
      expect(clone).not.toBe(obj);
      expect(clone.a).not.toBe(obj.a);
    });

    it('should clone arrays', () => {
      const arr = [1, [2, 3], { a: 4 }];
      const clone = deepClone(arr);

      expect(clone).toEqual(arr);
      expect(clone).not.toBe(arr);
    });

    it('should handle primitives', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(null)).toBe(null);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('HELLO')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('titleCase', () => {
    it('should convert to title case', () => {
      expect(titleCase('hello world')).toBe('Hello World');
    });

    it('should handle mixed case', () => {
      expect(titleCase('hELLO wORLD')).toBe('Hello World');
    });
  });

  describe('slugify', () => {
    it('should convert to slug format', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello! World?')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should trim leading/trailing dashes', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });
  });

  describe('randomInt', () => {
    it('should generate number within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInt(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
      }
    });

    it('should generate integers', () => {
      const result = randomInt(1, 100);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('isBrowser / isServer', () => {
    it('should detect server environment in Node', () => {
      // In Jest (Node), window is undefined
      expect(isServer()).toBe(true);
      expect(isBrowser()).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"a":1}', {});

      expect(result).toEqual({ a: 1 });
    });

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('invalid', { default: true });

      expect(result).toEqual({ default: true });
    });

    it('should return fallback for empty string', () => {
      const result = safeJsonParse('', []);

      expect(result).toEqual([]);
    });
  });

  describe('chunk', () => {
    it('should chunk array into smaller arrays', () => {
      const result = chunk([1, 2, 3, 4, 5], 2);

      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      const result = chunk([], 2);

      expect(result).toEqual([]);
    });

    it('should handle array smaller than chunk size', () => {
      const result = chunk([1, 2], 5);

      expect(result).toEqual([[1, 2]]);
    });
  });

  describe('unique', () => {
    it('should remove duplicates', () => {
      const result = unique([1, 2, 2, 3, 3, 3]);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle strings', () => {
      const result = unique(['a', 'b', 'a', 'c']);

      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should preserve order', () => {
      const result = unique([3, 1, 2, 1, 3]);

      expect(result).toEqual([3, 1, 2]);
    });
  });

  describe('groupBy', () => {
    it('should group array items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, (item) => item.type);

      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });

    it('should handle empty array', () => {
      const result = groupBy([], () => 'key');

      expect(result).toEqual({});
    });
  });
});
