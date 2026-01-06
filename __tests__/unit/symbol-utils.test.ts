/**
 * Part 20 - Phase 07: Symbol Utilities Unit Tests
 *
 * Tests for symbol normalization and validation.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 8
 */

import {
  isValidSymbol,
  isValidTimeframe,
  VALID_SYMBOLS,
  VALID_TIMEFRAMES,
} from '@/lib/constants/business-rules';

// ============================================================================
// SYMBOL NORMALIZATION TESTS
// ============================================================================

describe('Symbol Utilities', () => {
  describe('Symbol Suffix Stripping', () => {
    /**
     * Helper function to strip broker suffix from symbol
     * (This mirrors the MQL5 NormalizeSymbol function)
     */
    function normalizeSymbol(brokerSymbol: string): string {
      const suffixes = ['.i', '.pro', 'm', '.raw', '.std', '.e', '.z'];
      let normalized = brokerSymbol;

      for (const suffix of suffixes) {
        const pos = normalized.toLowerCase().indexOf(suffix.toLowerCase());
        if (pos > 0 && pos === normalized.length - suffix.length) {
          normalized = normalized.substring(0, pos);
          break;
        }
      }

      return normalized.toUpperCase();
    }

    it('should strip .i suffix', () => {
      expect(normalizeSymbol('EURUSD.i')).toBe('EURUSD');
      expect(normalizeSymbol('XAUUSD.i')).toBe('XAUUSD');
    });

    it('should strip .pro suffix', () => {
      expect(normalizeSymbol('EURUSD.pro')).toBe('EURUSD');
      expect(normalizeSymbol('BTCUSD.pro')).toBe('BTCUSD');
    });

    it('should strip m suffix', () => {
      expect(normalizeSymbol('EURUSDm')).toBe('EURUSD');
      expect(normalizeSymbol('GBPUSDm')).toBe('GBPUSD');
    });

    it('should strip .raw suffix', () => {
      expect(normalizeSymbol('EURUSD.raw')).toBe('EURUSD');
    });

    it('should strip .std suffix', () => {
      expect(normalizeSymbol('EURUSD.std')).toBe('EURUSD');
    });

    it('should strip .e suffix', () => {
      expect(normalizeSymbol('EURUSD.e')).toBe('EURUSD');
    });

    it('should strip .z suffix', () => {
      expect(normalizeSymbol('EURUSD.z')).toBe('EURUSD');
    });

    it('should handle already-normalized symbols', () => {
      expect(normalizeSymbol('EURUSD')).toBe('EURUSD');
      expect(normalizeSymbol('XAUUSD')).toBe('XAUUSD');
      expect(normalizeSymbol('BTCUSD')).toBe('BTCUSD');
    });

    it('should convert to uppercase', () => {
      expect(normalizeSymbol('eurusd')).toBe('EURUSD');
      expect(normalizeSymbol('EurUsd.i')).toBe('EURUSD');
    });

    it('should handle symbols with numbers', () => {
      expect(normalizeSymbol('US30.i')).toBe('US30');
      expect(normalizeSymbol('NDX100.pro')).toBe('NDX100');
    });
  });

  describe('isValidSymbol', () => {
    it('should return true for all supported symbols', () => {
      const supportedSymbols = [
        'AUDJPY',
        'AUDUSD',
        'BTCUSD',
        'ETHUSD',
        'EURUSD',
        'GBPJPY',
        'GBPUSD',
        'NDX100',
        'NZDUSD',
        'US30',
        'USDCAD',
        'USDCHF',
        'USDJPY',
        'XAGUSD',
        'XAUUSD',
      ];

      supportedSymbols.forEach((symbol) => {
        expect(isValidSymbol(symbol)).toBe(true);
      });
    });

    it('should return false for unsupported symbols', () => {
      expect(isValidSymbol('INVALID')).toBe(false);
      expect(isValidSymbol('EURJPY')).toBe(false); // Not in supported list
      expect(isValidSymbol('')).toBe(false);
      expect(isValidSymbol('EUR')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidSymbol('eurusd')).toBe(true);
      expect(isValidSymbol('EurUsd')).toBe(true);
      expect(isValidSymbol('EURUSD')).toBe(true);
    });

    it('should have exactly 15 supported symbols', () => {
      expect(VALID_SYMBOLS.length).toBe(15);
    });
  });

  describe('isValidTimeframe', () => {
    it('should return true for all supported timeframes', () => {
      const supportedTimeframes = [
        'M5',
        'M15',
        'M30',
        'H1',
        'H2',
        'H4',
        'H8',
        'H12',
        'D1',
      ];

      supportedTimeframes.forEach((tf) => {
        expect(isValidTimeframe(tf)).toBe(true);
      });
    });

    it('should return false for unsupported timeframes', () => {
      expect(isValidTimeframe('M1')).toBe(false); // 1 minute not supported
      expect(isValidTimeframe('W1')).toBe(false); // Weekly not supported
      expect(isValidTimeframe('MN1')).toBe(false); // Monthly not supported
      expect(isValidTimeframe('')).toBe(false);
      expect(isValidTimeframe('INVALID')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidTimeframe('h1')).toBe(true);
      expect(isValidTimeframe('H1')).toBe(true);
      expect(isValidTimeframe('m15')).toBe(true);
    });

    it('should have exactly 9 supported timeframes', () => {
      expect(VALID_TIMEFRAMES.length).toBe(9);
    });
  });

  describe('Symbol Categories', () => {
    it('should include forex pairs', () => {
      const forexPairs = [
        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'AUDUSD',
        'NZDUSD',
        'USDCAD',
        'USDCHF',
        'GBPJPY',
        'AUDJPY',
      ];

      forexPairs.forEach((symbol) => {
        expect(isValidSymbol(symbol)).toBe(true);
      });
    });

    it('should include cryptocurrencies', () => {
      expect(isValidSymbol('BTCUSD')).toBe(true);
      expect(isValidSymbol('ETHUSD')).toBe(true);
    });

    it('should include indices', () => {
      expect(isValidSymbol('US30')).toBe(true);
      expect(isValidSymbol('NDX100')).toBe(true);
    });

    it('should include precious metals', () => {
      expect(isValidSymbol('XAUUSD')).toBe(true);
      expect(isValidSymbol('XAGUSD')).toBe(true);
    });
  });
});
