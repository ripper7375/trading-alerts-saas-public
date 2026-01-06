/**
 * Part 20 - Phase 07: Tier Validation Unit Tests
 *
 * Tests for tier-based access control for symbols and timeframes.
 *
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 4c
 */

import {
  validateTierAccess,
  isValidSymbol,
  isValidTimeframe,
  getAccessibleSymbols,
  getAccessibleTimeframes,
  ALL_SYMBOLS,
  ALL_TIMEFRAMES,
  FREE_SYMBOLS,
  FREE_TIMEFRAMES,
} from '@/lib/tier/validation';

describe('Tier Validation', () => {
  describe('FREE tier symbol access', () => {
    it('should allow FREE tier to access FREE symbols', () => {
      const freeSymbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];

      freeSymbols.forEach((symbol) => {
        const result = validateTierAccess(symbol, 'H1', 'FREE');
        expect(result.allowed).toBe(true);
        expect(result.message).toContain('FREE tier access granted');
      });
    });

    it('should deny FREE tier access to PRO-only symbols', () => {
      const proSymbols = [
        'AUDJPY',
        'AUDUSD',
        'ETHUSD',
        'GBPJPY',
        'GBPUSD',
        'NDX100',
        'NZDUSD',
        'USDCAD',
        'USDCHF',
        'XAGUSD',
      ];

      proSymbols.forEach((symbol) => {
        const result = validateTierAccess(symbol, 'H1', 'FREE');
        expect(result.allowed).toBe(false);
        expect(result.message).toContain('requires PRO tier');
      });
    });
  });

  describe('FREE tier timeframe access', () => {
    it('should allow FREE tier to access FREE timeframes', () => {
      const freeTimeframes = ['H1', 'H4', 'D1'];

      freeTimeframes.forEach((timeframe) => {
        const result = validateTierAccess('EURUSD', timeframe, 'FREE');
        expect(result.allowed).toBe(true);
      });
    });

    it('should deny FREE tier access to PRO-only timeframes', () => {
      const proTimeframes = ['M5', 'M15', 'M30', 'H2', 'H8', 'H12'];

      proTimeframes.forEach((timeframe) => {
        const result = validateTierAccess('EURUSD', timeframe, 'FREE');
        expect(result.allowed).toBe(false);
        expect(result.message).toContain('requires PRO tier');
      });
    });
  });

  describe('PRO tier full access', () => {
    it('should allow PRO tier to access all symbols', () => {
      ALL_SYMBOLS.forEach((symbol) => {
        const result = validateTierAccess(symbol, 'H1', 'PRO');
        expect(result.allowed).toBe(true);
        expect(result.message).toContain('PRO tier access granted');
      });
    });

    it('should allow PRO tier to access all timeframes', () => {
      ALL_TIMEFRAMES.forEach((timeframe) => {
        const result = validateTierAccess('EURUSD', timeframe, 'PRO');
        expect(result.allowed).toBe(true);
      });
    });

    it('should allow PRO tier access to any symbol/timeframe combination', () => {
      // Test a PRO symbol with PRO timeframe
      const result = validateTierAccess('AUDJPY', 'M5', 'PRO');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Invalid symbol/timeframe handling', () => {
    it('should deny access for invalid symbols', () => {
      const result = validateTierAccess('INVALID', 'H1', 'PRO');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Invalid symbol');
    });

    it('should deny access for invalid timeframes', () => {
      const result = validateTierAccess('EURUSD', 'INVALID', 'PRO');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Invalid timeframe');
    });

    it('should check symbol validity before timeframe', () => {
      const result = validateTierAccess('INVALID', 'INVALID', 'PRO');
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('Invalid symbol');
    });
  });

  describe('isValidSymbol', () => {
    it('should return true for valid symbols', () => {
      expect(isValidSymbol('EURUSD')).toBe(true);
      expect(isValidSymbol('XAUUSD')).toBe(true);
    });

    it('should return false for invalid symbols', () => {
      expect(isValidSymbol('INVALID')).toBe(false);
      expect(isValidSymbol('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidSymbol('eurusd')).toBe(true);
      expect(isValidSymbol('EuRuSd')).toBe(true);
    });
  });

  describe('isValidTimeframe', () => {
    it('should return true for valid timeframes', () => {
      expect(isValidTimeframe('H1')).toBe(true);
      expect(isValidTimeframe('D1')).toBe(true);
      expect(isValidTimeframe('M5')).toBe(true);
    });

    it('should return false for invalid timeframes', () => {
      expect(isValidTimeframe('M1')).toBe(false);
      expect(isValidTimeframe('W1')).toBe(false);
      expect(isValidTimeframe('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidTimeframe('h1')).toBe(true);
      expect(isValidTimeframe('d1')).toBe(true);
    });
  });

  describe('getAccessibleSymbols', () => {
    it('should return FREE symbols for FREE tier', () => {
      const symbols = getAccessibleSymbols('FREE');
      expect(symbols.length).toBe(5);
      expect(symbols).toContain('EURUSD');
      expect(symbols).toContain('XAUUSD');
      expect(symbols).not.toContain('AUDJPY');
    });

    it('should return all symbols for PRO tier', () => {
      const symbols = getAccessibleSymbols('PRO');
      expect(symbols.length).toBe(15);
      expect(symbols).toContain('EURUSD');
      expect(symbols).toContain('AUDJPY');
      expect(symbols).toContain('XAGUSD');
    });
  });

  describe('getAccessibleTimeframes', () => {
    it('should return FREE timeframes for FREE tier', () => {
      const timeframes = getAccessibleTimeframes('FREE');
      expect(timeframes.length).toBe(3);
      expect(timeframes).toContain('H1');
      expect(timeframes).toContain('H4');
      expect(timeframes).toContain('D1');
      expect(timeframes).not.toContain('M5');
    });

    it('should return all timeframes for PRO tier', () => {
      const timeframes = getAccessibleTimeframes('PRO');
      expect(timeframes.length).toBe(9);
      expect(timeframes).toContain('M5');
      expect(timeframes).toContain('H1');
      expect(timeframes).toContain('D1');
    });
  });

  describe('Tier constants', () => {
    it('should have correct number of FREE symbols', () => {
      expect(FREE_SYMBOLS.length).toBe(5);
    });

    it('should have correct number of FREE timeframes', () => {
      expect(FREE_TIMEFRAMES.length).toBe(3);
    });

    it('should have correct number of ALL symbols', () => {
      expect(ALL_SYMBOLS.length).toBe(15);
    });

    it('should have correct number of ALL timeframes', () => {
      expect(ALL_TIMEFRAMES.length).toBe(9);
    });
  });
});
