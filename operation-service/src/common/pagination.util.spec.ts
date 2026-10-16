import { parsePageLimit, parsePageOffset } from './pagination.util';

describe('pagination.util', () => {
  describe('parsePageLimit', () => {
    it('uses the default when the value is absent', () => {
      expect(parsePageLimit(undefined, 20, 100)).toBe(20);
      expect(parsePageLimit('', 20, 100)).toBe(20);
      expect(parsePageLimit('   ', 20, 100)).toBe(20);
    });

    it('uses the default for anything that is not a number (never NaN)', () => {
      for (const raw of [
        'abc',
        'NaN',
        'Infinity',
        '--5',
        '%20',
        {},
        ['1', '2'],
        null,
        true,
      ]) {
        expect(parsePageLimit(raw, 20, 100)).toBe(20);
      }
    });

    it('clamps to 1..max', () => {
      expect(parsePageLimit('0', 20, 100)).toBe(1);
      expect(parsePageLimit('-5', 20, 100)).toBe(1);
      expect(parsePageLimit('1', 20, 100)).toBe(1);
      expect(parsePageLimit('100', 20, 100)).toBe(100);
      expect(parsePageLimit('101', 20, 100)).toBe(100);
      expect(parsePageLimit('99999999999999999999', 20, 100)).toBe(100);
    });

    it('reads the leading integer, as parseInt does', () => {
      expect(parsePageLimit('25', 20, 100)).toBe(25);
      expect(parsePageLimit(' 25 ', 20, 100)).toBe(25);
      expect(parsePageLimit('25.9', 20, 100)).toBe(25);
      expect(parsePageLimit('25abc', 20, 100)).toBe(25);
    });
  });

  describe('parsePageOffset', () => {
    it('is 0 when absent or not a number (never NaN)', () => {
      for (const raw of [undefined, '', 'abc', 'NaN', {}, ['1'], null, false]) {
        expect(parsePageOffset(raw)).toBe(0);
      }
    });

    it('never goes negative', () => {
      expect(parsePageOffset('-1')).toBe(0);
      expect(parsePageOffset('-999')).toBe(0);
    });

    it('passes non-negative integers through and caps at the largest safe integer', () => {
      expect(parsePageOffset('0')).toBe(0);
      expect(parsePageOffset('40')).toBe(40);
      expect(parsePageOffset('99999999999999999999')).toBe(
        Number.MAX_SAFE_INTEGER
      );
    });
  });
});
