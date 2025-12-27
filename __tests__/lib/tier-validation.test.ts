import {
  validateTierAccess,
  canAccessSymbol,
  getSymbolLimit,
  getAlertLimit,
  canCreateAlert,
  validateTimeframeAccess,
  canAccessTimeframe,
  canCreateWatchlist,
  canAddWatchlistItem,
  canAccessIndicator,
  getAccessibleIndicators,
  getLockedIndicators,
  getRateLimit,
  getRateLimitForTier,
  getChartCombinations,
  getMaxWatchlists,
  validateFullTierAccess,
  type Tier,
} from '@/lib/tier-validation';

describe('Tier Validation', () => {
  // =============================================
  // Symbol Access Tests
  // =============================================
  describe('Symbol Access', () => {
    it('FREE tier can access 5 symbols', () => {
      expect(canAccessSymbol('FREE', 'BTCUSD')).toBe(true);
      expect(canAccessSymbol('FREE', 'EURUSD')).toBe(true);
      expect(canAccessSymbol('FREE', 'USDJPY')).toBe(true);
      expect(canAccessSymbol('FREE', 'US30')).toBe(true);
      expect(canAccessSymbol('FREE', 'XAUUSD')).toBe(true);
    });

    it('FREE tier cannot access PRO-exclusive symbols', () => {
      expect(canAccessSymbol('FREE', 'ETHUSD')).toBe(false);
      expect(canAccessSymbol('FREE', 'NDX100')).toBe(false);
      expect(canAccessSymbol('FREE', 'XAGUSD')).toBe(false);
      expect(canAccessSymbol('FREE', 'GBPUSD')).toBe(false);
      expect(canAccessSymbol('FREE', 'AUDUSD')).toBe(false);
    });

    it('PRO tier can access all 15 symbols', () => {
      expect(canAccessSymbol('PRO', 'BTCUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'ETHUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'XAGUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'NDX100')).toBe(true);
      expect(canAccessSymbol('PRO', 'GBPUSD')).toBe(true);
      expect(canAccessSymbol('PRO', 'AUDUSD')).toBe(true);
    });

    it('handles case-insensitive symbol matching', () => {
      expect(canAccessSymbol('FREE', 'btcusd')).toBe(true);
      expect(canAccessSymbol('FREE', 'BtCuSd')).toBe(true);
      expect(canAccessSymbol('PRO', 'ethusd')).toBe(true);
    });
  });

  // =============================================
  // Timeframe Access Tests
  // =============================================
  describe('Timeframe Access', () => {
    it('FREE tier can access 3 timeframes', () => {
      expect(canAccessTimeframe('H1', 'FREE')).toBe(true);
      expect(canAccessTimeframe('H4', 'FREE')).toBe(true);
      expect(canAccessTimeframe('D1', 'FREE')).toBe(true);
    });

    it('FREE tier cannot access PRO-exclusive timeframes', () => {
      expect(canAccessTimeframe('M5', 'FREE')).toBe(false);
      expect(canAccessTimeframe('M15', 'FREE')).toBe(false);
      expect(canAccessTimeframe('M30', 'FREE')).toBe(false);
      expect(canAccessTimeframe('H2', 'FREE')).toBe(false);
      expect(canAccessTimeframe('H8', 'FREE')).toBe(false);
      expect(canAccessTimeframe('H12', 'FREE')).toBe(false);
    });

    it('NO M1 or W1 in the system', () => {
      // M1 and W1 should not be valid for either tier
      expect(canAccessTimeframe('M1', 'FREE')).toBe(false);
      expect(canAccessTimeframe('M1', 'PRO')).toBe(false);
      expect(canAccessTimeframe('W1', 'FREE')).toBe(false);
      expect(canAccessTimeframe('W1', 'PRO')).toBe(false);
    });

    it('PRO tier can access all 9 timeframes', () => {
      const proTimeframes = [
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
      proTimeframes.forEach((timeframe) => {
        expect(canAccessTimeframe(timeframe, 'PRO')).toBe(true);
      });
    });

    it('handles case-insensitive timeframe matching', () => {
      expect(canAccessTimeframe('h1', 'FREE')).toBe(true);
      expect(canAccessTimeframe('d1', 'FREE')).toBe(true);
      expect(canAccessTimeframe('m5', 'PRO')).toBe(true);
    });
  });

  // =============================================
  // Alert Limits Tests
  // =============================================
  describe('Alert Limits', () => {
    it('FREE tier can create up to 5 alerts', () => {
      expect(canCreateAlert('FREE', 0).allowed).toBe(true);
      expect(canCreateAlert('FREE', 4).allowed).toBe(true);
      expect(canCreateAlert('FREE', 5).allowed).toBe(false);
      expect(canCreateAlert('FREE', 6).allowed).toBe(false);
    });

    it('PRO tier can create up to 20 alerts', () => {
      expect(canCreateAlert('PRO', 0).allowed).toBe(true);
      expect(canCreateAlert('PRO', 19).allowed).toBe(true);
      expect(canCreateAlert('PRO', 20).allowed).toBe(false);
      expect(canCreateAlert('PRO', 21).allowed).toBe(false);
    });

    it('returns correct alert limits', () => {
      expect(getAlertLimit('FREE')).toBe(5);
      expect(getAlertLimit('PRO')).toBe(20);
    });
  });

  // =============================================
  // Watchlist Limits Tests
  // =============================================
  describe('Watchlist Limits', () => {
    it('FREE tier can have 1 watchlist with 5 items', () => {
      // Watchlist count
      expect(canCreateWatchlist(0, 'FREE')).toBe(true);
      expect(canCreateWatchlist(1, 'FREE')).toBe(false);

      // Watchlist items
      expect(canAddWatchlistItem('FREE', 0).allowed).toBe(true);
      expect(canAddWatchlistItem('FREE', 4).allowed).toBe(true);
      expect(canAddWatchlistItem('FREE', 5).allowed).toBe(false);
    });

    it('PRO tier can have 5 watchlists with 50 items each', () => {
      // Watchlist count
      expect(canCreateWatchlist(0, 'PRO')).toBe(true);
      expect(canCreateWatchlist(4, 'PRO')).toBe(true);
      expect(canCreateWatchlist(5, 'PRO')).toBe(false);

      // Watchlist items
      expect(canAddWatchlistItem('PRO', 0).allowed).toBe(true);
      expect(canAddWatchlistItem('PRO', 49).allowed).toBe(true);
      expect(canAddWatchlistItem('PRO', 50).allowed).toBe(false);
    });

    it('returns correct max watchlists', () => {
      expect(getMaxWatchlists('FREE')).toBe(1);
      expect(getMaxWatchlists('PRO')).toBe(5);
    });
  });

  // =============================================
  // Indicator Access Tests
  // =============================================
  describe('Indicator Access', () => {
    it('FREE tier can access 2 basic indicators', () => {
      expect(canAccessIndicator('fractals', 'FREE')).toBe(true);
      expect(canAccessIndicator('trendlines', 'FREE')).toBe(true);
    });

    it('FREE tier cannot access 6 PRO-only indicators', () => {
      expect(canAccessIndicator('momentum_candles', 'FREE')).toBe(false);
      expect(canAccessIndicator('keltner_channels', 'FREE')).toBe(false);
      expect(canAccessIndicator('tema', 'FREE')).toBe(false);
      expect(canAccessIndicator('hrma', 'FREE')).toBe(false);
      expect(canAccessIndicator('smma', 'FREE')).toBe(false);
      expect(canAccessIndicator('zigzag', 'FREE')).toBe(false);
    });

    it('PRO tier can access all 8 indicators', () => {
      const indicators = [
        'fractals',
        'trendlines',
        'momentum_candles',
        'keltner_channels',
        'tema',
        'hrma',
        'smma',
        'zigzag',
      ];
      indicators.forEach((ind) => {
        expect(canAccessIndicator(ind, 'PRO')).toBe(true);
      });
    });

    it('handles case-insensitive indicator matching', () => {
      expect(canAccessIndicator('FRACTALS', 'FREE')).toBe(true);
      expect(canAccessIndicator('Trendlines', 'FREE')).toBe(true);
    });

    it('returns correct accessible indicators', () => {
      expect(getAccessibleIndicators('FREE')).toEqual([
        'fractals',
        'trendlines',
      ]);
      expect(getAccessibleIndicators('PRO')).toEqual([
        'fractals',
        'trendlines',
        'momentum_candles',
        'keltner_channels',
        'tema',
        'hrma',
        'smma',
        'zigzag',
      ]);
    });

    it('returns correct locked indicators', () => {
      expect(getLockedIndicators('FREE')).toEqual([
        'momentum_candles',
        'keltner_channels',
        'tema',
        'hrma',
        'smma',
        'zigzag',
      ]);
      expect(getLockedIndicators('PRO')).toEqual([]);
    });
  });

  // =============================================
  // Rate Limits Tests
  // =============================================
  describe('Rate Limits', () => {
    it('returns correct rate limits per HOUR', () => {
      expect(getRateLimit('FREE')).toBe(60); // 60/hour
      expect(getRateLimit('PRO')).toBe(300); // 300/hour
    });

    it('getRateLimitForTier is alias for getRateLimit', () => {
      expect(getRateLimitForTier('FREE')).toBe(60);
      expect(getRateLimitForTier('PRO')).toBe(300);
    });
  });

  // =============================================
  // Chart Combinations Tests
  // =============================================
  describe('Chart Combinations', () => {
    it('FREE tier has 15 combinations (5 × 3)', () => {
      expect(getChartCombinations('FREE')).toBe(15);
    });

    it('PRO tier has 135 combinations (15 × 9)', () => {
      expect(getChartCombinations('PRO')).toBe(135);
    });
  });

  // =============================================
  // validateTierAccess Tests (Legacy)
  // =============================================
  describe('validateTierAccess', () => {
    describe('FREE tier', () => {
      it('should allow FREE tier to access XAUUSD', () => {
        const result = validateTierAccess('FREE', 'XAUUSD');
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should allow FREE tier to access EURUSD (part of 5 FREE symbols)', () => {
        const result = validateTierAccess('FREE', 'EURUSD');
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should allow FREE tier to access BTCUSD (part of 5 FREE symbols)', () => {
        const result = validateTierAccess('FREE', 'BTCUSD');
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should allow FREE tier to access all 5 FREE symbols', () => {
        const freeSymbols = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];
        freeSymbols.forEach((symbol) => {
          const result = validateTierAccess('FREE', symbol);
          expect(result.allowed).toBe(true);
        });
      });

      it('should block FREE tier from accessing GBPUSD (PRO only)', () => {
        const result = validateTierAccess('FREE', 'GBPUSD');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('PRO');
      });

      it('should block FREE tier from accessing AUDUSD (PRO only)', () => {
        const result = validateTierAccess('FREE', 'AUDUSD');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('PRO');
      });

      it('should block FREE tier from accessing ETHUSD (PRO only)', () => {
        const result = validateTierAccess('FREE', 'ETHUSD');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('PRO');
      });
    });

    describe('PRO tier', () => {
      it('should allow PRO tier to access any symbol', () => {
        expect(validateTierAccess('PRO', 'EURUSD').allowed).toBe(true);
        expect(validateTierAccess('PRO', 'BTCUSD').allowed).toBe(true);
        expect(validateTierAccess('PRO', 'XAUUSD').allowed).toBe(true);
        expect(validateTierAccess('PRO', 'GBPUSD').allowed).toBe(true);
        expect(validateTierAccess('PRO', 'AUDUSD').allowed).toBe(true);
      });

      it('should not have reason when allowed', () => {
        const result = validateTierAccess('PRO', 'EURUSD');
        expect(result.reason).toBeUndefined();
      });
    });

    describe('Error handling', () => {
      it('should throw error for invalid tier', () => {
        expect(() => validateTierAccess('INVALID' as Tier, 'XAUUSD')).toThrow(
          'Invalid tier'
        );
      });
    });
  });

  // =============================================
  // validateTimeframeAccess Tests (Legacy)
  // =============================================
  describe('validateTimeframeAccess', () => {
    describe('FREE tier', () => {
      it('should allow H1 timeframe', () => {
        const result = validateTimeframeAccess('FREE', 'H1');
        expect(result.allowed).toBe(true);
      });

      it('should allow H4 timeframe', () => {
        const result = validateTimeframeAccess('FREE', 'H4');
        expect(result.allowed).toBe(true);
      });

      it('should allow D1 timeframe', () => {
        const result = validateTimeframeAccess('FREE', 'D1');
        expect(result.allowed).toBe(true);
      });

      it('should block M5 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'M5');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Timeframe M5 requires PRO tier');
      });

      it('should block M15 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'M15');
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('PRO');
      });

      it('should block M30 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'M30');
        expect(result.allowed).toBe(false);
      });

      it('should block H2 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'H2');
        expect(result.allowed).toBe(false);
      });

      it('should block H8 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'H8');
        expect(result.allowed).toBe(false);
      });

      it('should block H12 timeframe (PRO only)', () => {
        const result = validateTimeframeAccess('FREE', 'H12');
        expect(result.allowed).toBe(false);
      });
    });

    describe('PRO tier', () => {
      it('should allow all 9 PRO timeframes', () => {
        const proTimeframes = [
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
        proTimeframes.forEach((timeframe) => {
          const result = validateTimeframeAccess('PRO', timeframe);
          expect(result.allowed).toBe(true);
        });
      });
    });
  });

  // =============================================
  // validateFullTierAccess Tests
  // =============================================
  describe('validateFullTierAccess', () => {
    it('returns null when all access is allowed', () => {
      expect(
        validateFullTierAccess({
          tier: 'FREE',
          symbol: 'BTCUSD',
          timeframe: 'H1',
          alertCount: 3,
        })
      ).toBeNull();

      expect(
        validateFullTierAccess({
          tier: 'PRO',
          symbol: 'ETHUSD',
          timeframe: 'M5',
          alertCount: 15,
        })
      ).toBeNull();
    });

    it('returns error for symbol access violation', () => {
      const result = validateFullTierAccess({
        tier: 'FREE',
        symbol: 'ETHUSD',
      });
      expect(result).toContain('ETHUSD');
      expect(result).toContain('15 symbols');
    });

    it('returns error for timeframe access violation', () => {
      const result = validateFullTierAccess({
        tier: 'FREE',
        timeframe: 'M5',
      });
      expect(result).toContain('M5');
      expect(result).toContain('9 timeframes');
    });

    it('returns error for alert limit violation', () => {
      const result = validateFullTierAccess({
        tier: 'FREE',
        alertCount: 5,
      });
      expect(result).toContain('alert limit');
    });

    it('returns error for watchlist limit violation', () => {
      const result = validateFullTierAccess({
        tier: 'FREE',
        watchlistCount: 1,
      });
      expect(result).toContain('watchlist limit');
    });

    it('returns error for indicator access violation', () => {
      const result = validateFullTierAccess({
        tier: 'FREE',
        indicator: 'zigzag',
      });
      expect(result).toContain('zigzag');
      expect(result).toContain('8 indicators');
    });
  });

  // =============================================
  // Symbol Limit Tests (Legacy)
  // =============================================
  describe('getSymbolLimit', () => {
    it('should return 5 for FREE tier', () => {
      expect(getSymbolLimit('FREE')).toBe(5);
    });

    it('should return 15 for PRO tier', () => {
      expect(getSymbolLimit('PRO')).toBe(15);
    });
  });
});
