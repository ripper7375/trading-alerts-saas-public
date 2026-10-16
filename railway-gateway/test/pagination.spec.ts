import { parsePageLimit, parsePageOffset } from '../src/common/pagination';
import { ActiveIndicatorController } from '../src/gateway/active-indicator.controller';

describe('pagination', () => {
  describe('parsePageLimit', () => {
    it('uses the default when the value is absent', () => {
      expect(parsePageLimit(undefined, 100, 500)).toBe(100);
      expect(parsePageLimit('', 100, 500)).toBe(100);
      expect(parsePageLimit('   ', 100, 500)).toBe(100);
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
        expect(parsePageLimit(raw, 100, 500)).toBe(100);
      }
    });

    it('clamps to 1..max', () => {
      expect(parsePageLimit('0', 100, 500)).toBe(1);
      expect(parsePageLimit('-5', 100, 500)).toBe(1);
      expect(parsePageLimit('500', 100, 500)).toBe(500);
      expect(parsePageLimit('501', 100, 500)).toBe(500);
      expect(parsePageLimit('99999999999999999999', 100, 500)).toBe(500);
    });

    it('reads the leading integer, as parseInt does', () => {
      expect(parsePageLimit('25', 100, 500)).toBe(25);
      expect(parsePageLimit(' 25 ', 100, 500)).toBe(25);
      expect(parsePageLimit('25.9', 100, 500)).toBe(25);
    });
  });

  describe('parsePageOffset', () => {
    it('is 0 when absent or not a number (never NaN)', () => {
      for (const raw of [undefined, '', 'abc', 'NaN', {}, ['1'], null, false]) {
        expect(parsePageOffset(raw)).toBe(0);
      }
    });

    it('never goes negative and caps at the largest safe integer', () => {
      expect(parsePageOffset('-1')).toBe(0);
      expect(parsePageOffset('40')).toBe(40);
      expect(parsePageOffset('99999999999999999999')).toBe(
        Number.MAX_SAFE_INTEGER
      );
    });
  });
});

describe('ActiveIndicatorController.list paging (Tier 1 §5.7)', () => {
  function limitSentToService(limit?: string): Promise<unknown> {
    const listSettings = jest.fn().mockResolvedValue([]);
    const indicators = {
      listSettings,
      earliestSettableSlot: jest.fn().mockResolvedValue(0),
    };
    const controller = new ActiveIndicatorController(indicators as never);
    return controller
      .list(undefined, limit)
      .then(() => listSettings.mock.calls[0][0].limit);
  }

  it('hands the service a finite limit when ?limit is not a number', async () => {
    expect(await limitSentToService('abc')).toBe(100);
  });

  it('floors a negative or zero limit at 1', async () => {
    expect(await limitSentToService('-5')).toBe(1);
    expect(await limitSentToService('0')).toBe(1);
  });

  it('caps an oversized limit at 500 and defaults an absent one to 100', async () => {
    expect(await limitSentToService('100000')).toBe(500);
    expect(await limitSentToService(undefined)).toBe(100);
  });

  it('passes a sane limit through', async () => {
    expect(await limitSentToService('7')).toBe(7);
  });
});
