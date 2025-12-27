import {
  FREE_SYMBOLS,
  PRO_EXCLUSIVE_SYMBOLS,
  ALL_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_EXCLUSIVE_TIMEFRAMES,
  ALL_TIMEFRAMES,
  symbolSchema,
  timeframeSchema,
  barsSchema,
  indicatorRequestSchema,
  isValidSymbol,
  isValidTimeframe,
  isFreeSymbol,
  isFreeTimeframe,
  getSymbolCategory,
  timeframeToMinutes,
  validateIndicatorRequest,
} from '@/lib/validations/indicators';

describe('Indicator Validations', () => {
  // =============================================
  // Symbol Constants Tests
  // =============================================
  describe('Symbol Constants', () => {
    it('FREE_SYMBOLS has 5 symbols', () => {
      expect(FREE_SYMBOLS).toHaveLength(5);
      expect(FREE_SYMBOLS).toContain('BTCUSD');
      expect(FREE_SYMBOLS).toContain('EURUSD');
      expect(FREE_SYMBOLS).toContain('USDJPY');
      expect(FREE_SYMBOLS).toContain('US30');
      expect(FREE_SYMBOLS).toContain('XAUUSD');
    });

    it('PRO_EXCLUSIVE_SYMBOLS has 10 additional symbols', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toHaveLength(10);
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('ETHUSD');
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('NDX100');
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('XAGUSD');
    });

    it('ALL_SYMBOLS has 15 total symbols', () => {
      expect(ALL_SYMBOLS).toHaveLength(15);
    });
  });

  // =============================================
  // Timeframe Constants Tests
  // =============================================
  describe('Timeframe Constants', () => {
    it('FREE_TIMEFRAMES has 3 timeframes', () => {
      expect(FREE_TIMEFRAMES).toHaveLength(3);
      expect(FREE_TIMEFRAMES).toContain('H1');
      expect(FREE_TIMEFRAMES).toContain('H4');
      expect(FREE_TIMEFRAMES).toContain('D1');
    });

    it('PRO_EXCLUSIVE_TIMEFRAMES has 6 additional timeframes', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toHaveLength(6);
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M5');
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M15');
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M30');
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H2');
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H8');
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H12');
    });

    it('ALL_TIMEFRAMES has 9 total timeframes', () => {
      expect(ALL_TIMEFRAMES).toHaveLength(9);
    });

    it('NO M1 or W1 in timeframes', () => {
      expect(ALL_TIMEFRAMES).not.toContain('M1');
      expect(ALL_TIMEFRAMES).not.toContain('W1');
    });
  });

  // =============================================
  // Symbol Schema Tests
  // =============================================
  describe('symbolSchema', () => {
    it('accepts valid symbols', () => {
      expect(symbolSchema.parse('BTCUSD')).toBe('BTCUSD');
      expect(symbolSchema.parse('EURUSD')).toBe('EURUSD');
      expect(symbolSchema.parse('ETHUSD')).toBe('ETHUSD');
    });

    it('transforms to uppercase', () => {
      expect(symbolSchema.parse('btcusd')).toBe('BTCUSD');
      expect(symbolSchema.parse('EurUsd')).toBe('EURUSD');
    });

    it('rejects invalid symbols', () => {
      expect(() => symbolSchema.parse('INVALID')).toThrow();
      expect(() => symbolSchema.parse('AAPL')).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => symbolSchema.parse('')).toThrow();
    });
  });

  // =============================================
  // Timeframe Schema Tests
  // =============================================
  describe('timeframeSchema', () => {
    it('accepts valid timeframes', () => {
      expect(timeframeSchema.parse('H1')).toBe('H1');
      expect(timeframeSchema.parse('M5')).toBe('M5');
      expect(timeframeSchema.parse('D1')).toBe('D1');
    });

    it('transforms to uppercase', () => {
      expect(timeframeSchema.parse('h1')).toBe('H1');
      expect(timeframeSchema.parse('m5')).toBe('M5');
    });

    it('rejects invalid timeframes', () => {
      expect(() => timeframeSchema.parse('M1')).toThrow(); // No M1!
      expect(() => timeframeSchema.parse('W1')).toThrow(); // No W1!
      expect(() => timeframeSchema.parse('INVALID')).toThrow();
    });

    it('rejects empty string', () => {
      expect(() => timeframeSchema.parse('')).toThrow();
    });
  });

  // =============================================
  // Bars Schema Tests
  // =============================================
  describe('barsSchema', () => {
    it('accepts valid bars values', () => {
      expect(barsSchema.parse('100')).toBe(100);
      expect(barsSchema.parse('1000')).toBe(1000);
      expect(barsSchema.parse('5000')).toBe(5000);
    });

    it('defaults to 1000 when undefined', () => {
      expect(barsSchema.parse(undefined)).toBe(1000);
    });

    it('rejects values below 1', () => {
      expect(() => barsSchema.parse('0')).toThrow();
      expect(() => barsSchema.parse('-1')).toThrow();
    });

    it('rejects values above 5000', () => {
      expect(() => barsSchema.parse('5001')).toThrow();
      expect(() => barsSchema.parse('10000')).toThrow();
    });
  });

  // =============================================
  // Indicator Request Schema Tests
  // =============================================
  describe('indicatorRequestSchema', () => {
    it('validates complete request', () => {
      const result = indicatorRequestSchema.parse({
        symbol: 'btcusd',
        timeframe: 'h1',
        bars: '500',
      });

      expect(result.symbol).toBe('BTCUSD');
      expect(result.timeframe).toBe('H1');
      expect(result.bars).toBe(500);
    });

    it('uses default bars when not provided', () => {
      const result = indicatorRequestSchema.parse({
        symbol: 'EURUSD',
        timeframe: 'D1',
      });

      expect(result.bars).toBe(1000);
    });
  });

  // =============================================
  // Utility Function Tests
  // =============================================
  describe('isValidSymbol', () => {
    it('returns true for valid symbols', () => {
      expect(isValidSymbol('BTCUSD')).toBe(true);
      expect(isValidSymbol('ETHUSD')).toBe(true);
      expect(isValidSymbol('btcusd')).toBe(true); // case insensitive
    });

    it('returns false for invalid symbols', () => {
      expect(isValidSymbol('INVALID')).toBe(false);
      expect(isValidSymbol('AAPL')).toBe(false);
    });
  });

  describe('isValidTimeframe', () => {
    it('returns true for valid timeframes', () => {
      expect(isValidTimeframe('H1')).toBe(true);
      expect(isValidTimeframe('M5')).toBe(true);
      expect(isValidTimeframe('h1')).toBe(true); // case insensitive
    });

    it('returns false for invalid timeframes', () => {
      expect(isValidTimeframe('M1')).toBe(false);
      expect(isValidTimeframe('W1')).toBe(false);
      expect(isValidTimeframe('INVALID')).toBe(false);
    });
  });

  describe('isFreeSymbol', () => {
    it('returns true for FREE tier symbols', () => {
      expect(isFreeSymbol('BTCUSD')).toBe(true);
      expect(isFreeSymbol('EURUSD')).toBe(true);
      expect(isFreeSymbol('XAUUSD')).toBe(true);
    });

    it('returns false for PRO-only symbols', () => {
      expect(isFreeSymbol('ETHUSD')).toBe(false);
      expect(isFreeSymbol('NDX100')).toBe(false);
    });
  });

  describe('isFreeTimeframe', () => {
    it('returns true for FREE tier timeframes', () => {
      expect(isFreeTimeframe('H1')).toBe(true);
      expect(isFreeTimeframe('H4')).toBe(true);
      expect(isFreeTimeframe('D1')).toBe(true);
    });

    it('returns false for PRO-only timeframes', () => {
      expect(isFreeTimeframe('M5')).toBe(false);
      expect(isFreeTimeframe('H2')).toBe(false);
    });
  });

  describe('getSymbolCategory', () => {
    it('identifies crypto symbols', () => {
      expect(getSymbolCategory('BTCUSD')).toBe('crypto');
      expect(getSymbolCategory('ETHUSD')).toBe('crypto');
    });

    it('identifies forex symbols', () => {
      expect(getSymbolCategory('EURUSD')).toBe('forex');
      expect(getSymbolCategory('GBPUSD')).toBe('forex');
    });

    it('identifies index symbols', () => {
      expect(getSymbolCategory('US30')).toBe('index');
      expect(getSymbolCategory('NDX100')).toBe('index');
    });

    it('identifies commodity symbols', () => {
      expect(getSymbolCategory('XAUUSD')).toBe('commodity');
      expect(getSymbolCategory('XAGUSD')).toBe('commodity');
    });

    it('returns unknown for invalid symbols', () => {
      expect(getSymbolCategory('INVALID')).toBe('unknown');
    });
  });

  describe('timeframeToMinutes', () => {
    it('converts timeframes correctly', () => {
      expect(timeframeToMinutes('M5')).toBe(5);
      expect(timeframeToMinutes('M15')).toBe(15);
      expect(timeframeToMinutes('M30')).toBe(30);
      expect(timeframeToMinutes('H1')).toBe(60);
      expect(timeframeToMinutes('H2')).toBe(120);
      expect(timeframeToMinutes('H4')).toBe(240);
      expect(timeframeToMinutes('H8')).toBe(480);
      expect(timeframeToMinutes('H12')).toBe(720);
      expect(timeframeToMinutes('D1')).toBe(1440);
    });

    it('handles case insensitivity', () => {
      expect(timeframeToMinutes('h1')).toBe(60);
      expect(timeframeToMinutes('d1')).toBe(1440);
    });

    it('returns 0 for invalid timeframes', () => {
      expect(timeframeToMinutes('INVALID')).toBe(0);
      expect(timeframeToMinutes('M1')).toBe(0);
    });
  });

  describe('validateIndicatorRequest', () => {
    it('validates and returns parsed data', () => {
      const result = validateIndicatorRequest({
        symbol: 'btcusd',
        timeframe: 'h1',
        bars: '500',
      });

      expect(result.symbol).toBe('BTCUSD');
      expect(result.timeframe).toBe('H1');
      expect(result.bars).toBe(500);
    });

    it('throws on invalid data', () => {
      expect(() =>
        validateIndicatorRequest({
          symbol: 'INVALID',
          timeframe: 'H1',
        })
      ).toThrow();
    });
  });
});
