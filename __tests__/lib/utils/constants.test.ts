/**
 * Constants Tests
 *
 * Tests for application constants.
 */

import {
  TIMEFRAMES,
  SYMBOLS,
  FREE_SYMBOLS,
  SYMBOL_NAMES,
  TIMEFRAME_NAMES,
  TIERS,
  TIER_LIMITS,
  PRICING,
  ALERT_CONDITIONS,
  getTierLimits,
  isSymbolAvailableForTier,
  getSymbolsForTier,
  getSymbolName,
  getTimeframeName,
} from '@/lib/utils/constants';

describe('Constants', () => {
  describe('TIMEFRAMES', () => {
    it('should have correct timeframes', () => {
      expect(TIMEFRAMES).toContain('M15');
      expect(TIMEFRAMES).toContain('M30');
      expect(TIMEFRAMES).toContain('H1');
      expect(TIMEFRAMES).toContain('H2');
      expect(TIMEFRAMES).toContain('H4');
      expect(TIMEFRAMES).toContain('H8');
      expect(TIMEFRAMES).toContain('D1');
    });

    it('should have 7 timeframes', () => {
      expect(TIMEFRAMES.length).toBe(7);
    });
  });

  describe('SYMBOLS', () => {
    it('should have correct symbols', () => {
      expect(SYMBOLS).toContain('XAUUSD');
      expect(SYMBOLS).toContain('EURUSD');
      expect(SYMBOLS).toContain('GBPUSD');
      expect(SYMBOLS).toContain('USDJPY');
      expect(SYMBOLS).toContain('AUDUSD');
      expect(SYMBOLS).toContain('BTCUSD');
      expect(SYMBOLS).toContain('ETHUSD');
      expect(SYMBOLS).toContain('XAGUSD');
      expect(SYMBOLS).toContain('NDX100');
      expect(SYMBOLS).toContain('US30');
    });

    it('should have 10 symbols for PRO tier', () => {
      expect(SYMBOLS.length).toBe(10);
    });
  });

  describe('FREE_SYMBOLS', () => {
    it('should only contain XAUUSD', () => {
      expect(FREE_SYMBOLS).toEqual(['XAUUSD']);
      expect(FREE_SYMBOLS.length).toBe(1);
    });
  });

  describe('SYMBOL_NAMES', () => {
    it('should have display names for all symbols', () => {
      SYMBOLS.forEach((symbol) => {
        expect(SYMBOL_NAMES[symbol]).toBeDefined();
        expect(typeof SYMBOL_NAMES[symbol]).toBe('string');
      });
    });

    it('should have correct display names', () => {
      expect(SYMBOL_NAMES.XAUUSD).toContain('Gold');
      expect(SYMBOL_NAMES.EURUSD).toContain('Euro');
      expect(SYMBOL_NAMES.BTCUSD).toContain('Bitcoin');
    });
  });

  describe('TIMEFRAME_NAMES', () => {
    it('should have display names for all timeframes', () => {
      TIMEFRAMES.forEach((tf) => {
        expect(TIMEFRAME_NAMES[tf]).toBeDefined();
        expect(typeof TIMEFRAME_NAMES[tf]).toBe('string');
      });
    });

    it('should have correct display names', () => {
      expect(TIMEFRAME_NAMES.M15).toBe('15 Minutes');
      expect(TIMEFRAME_NAMES.H1).toBe('1 Hour');
      expect(TIMEFRAME_NAMES.D1).toBe('Daily');
    });
  });

  describe('TIERS', () => {
    it('should have FREE and PRO tiers', () => {
      expect(TIERS).toContain('FREE');
      expect(TIERS).toContain('PRO');
      expect(TIERS.length).toBe(2);
    });
  });

  describe('TIER_LIMITS', () => {
    describe('FREE tier', () => {
      it('should have correct limits', () => {
        expect(TIER_LIMITS.FREE.maxAlerts).toBe(5);
        expect(TIER_LIMITS.FREE.maxWatchlists).toBe(3);
        expect(TIER_LIMITS.FREE.maxWatchlistItems).toBe(5);
        expect(TIER_LIMITS.FREE.rateLimit).toBe(100);
      });

      it('should only allow XAUUSD', () => {
        expect(TIER_LIMITS.FREE.symbols).toEqual(['XAUUSD']);
      });

      it('should allow all timeframes', () => {
        expect(TIER_LIMITS.FREE.timeframes).toEqual(TIMEFRAMES);
      });

      it('should have limited features', () => {
        expect(TIER_LIMITS.FREE.features.emailAlerts).toBe(true);
        expect(TIER_LIMITS.FREE.features.pushNotifications).toBe(false);
        expect(TIER_LIMITS.FREE.features.exportData).toBe(false);
        expect(TIER_LIMITS.FREE.features.prioritySupport).toBe(false);
      });
    });

    describe('PRO tier', () => {
      it('should have correct limits', () => {
        expect(TIER_LIMITS.PRO.maxAlerts).toBe(20);
        expect(TIER_LIMITS.PRO.maxWatchlists).toBe(10);
        expect(TIER_LIMITS.PRO.maxWatchlistItems).toBe(50);
        expect(TIER_LIMITS.PRO.rateLimit).toBe(1000);
      });

      it('should allow all symbols', () => {
        expect(TIER_LIMITS.PRO.symbols).toEqual(SYMBOLS);
      });

      it('should have all features enabled', () => {
        expect(TIER_LIMITS.PRO.features.emailAlerts).toBe(true);
        expect(TIER_LIMITS.PRO.features.pushNotifications).toBe(true);
        expect(TIER_LIMITS.PRO.features.exportData).toBe(true);
        expect(TIER_LIMITS.PRO.features.prioritySupport).toBe(true);
        expect(TIER_LIMITS.PRO.features.advancedCharts).toBe(true);
      });
    });
  });

  describe('PRICING', () => {
    it('should have correct FREE pricing', () => {
      expect(PRICING.FREE.monthly).toBe(0);
      expect(PRICING.FREE.yearly).toBe(0);
      expect(PRICING.FREE.name).toBe('Free');
    });

    it('should have correct PRO pricing', () => {
      expect(PRICING.PRO.monthly).toBe(29);
      expect(PRICING.PRO.yearly).toBe(290);
      expect(PRICING.PRO.name).toBe('Pro');
    });
  });

  describe('ALERT_CONDITIONS', () => {
    it('should have all condition types', () => {
      expect(ALERT_CONDITIONS).toContain('price_above');
      expect(ALERT_CONDITIONS).toContain('price_below');
      expect(ALERT_CONDITIONS).toContain('price_equals');
      expect(ALERT_CONDITIONS).toContain('price_crosses_above');
      expect(ALERT_CONDITIONS).toContain('price_crosses_below');
    });
  });

  describe('getTierLimits', () => {
    it('should return FREE tier limits', () => {
      const limits = getTierLimits('FREE');

      expect(limits).toBe(TIER_LIMITS.FREE);
      expect(limits.maxAlerts).toBe(5);
    });

    it('should return PRO tier limits', () => {
      const limits = getTierLimits('PRO');

      expect(limits).toBe(TIER_LIMITS.PRO);
      expect(limits.maxAlerts).toBe(20);
    });
  });

  describe('isSymbolAvailableForTier', () => {
    it('should return true for XAUUSD on FREE tier', () => {
      expect(isSymbolAvailableForTier('XAUUSD', 'FREE')).toBe(true);
    });

    it('should return false for other symbols on FREE tier', () => {
      expect(isSymbolAvailableForTier('EURUSD', 'FREE')).toBe(false);
      expect(isSymbolAvailableForTier('BTCUSD', 'FREE')).toBe(false);
    });

    it('should return true for all symbols on PRO tier', () => {
      SYMBOLS.forEach((symbol) => {
        expect(isSymbolAvailableForTier(symbol, 'PRO')).toBe(true);
      });
    });
  });

  describe('getSymbolsForTier', () => {
    it('should return FREE_SYMBOLS for FREE tier', () => {
      expect(getSymbolsForTier('FREE')).toEqual(FREE_SYMBOLS);
    });

    it('should return all SYMBOLS for PRO tier', () => {
      expect(getSymbolsForTier('PRO')).toEqual(SYMBOLS);
    });
  });

  describe('getSymbolName', () => {
    it('should return display name for symbol', () => {
      expect(getSymbolName('XAUUSD')).toBe('Gold (XAU/USD)');
      expect(getSymbolName('EURUSD')).toBe('Euro/US Dollar');
    });
  });

  describe('getTimeframeName', () => {
    it('should return display name for timeframe', () => {
      expect(getTimeframeName('M15')).toBe('15 Minutes');
      expect(getTimeframeName('H1')).toBe('1 Hour');
      expect(getTimeframeName('D1')).toBe('Daily');
    });
  });
});
