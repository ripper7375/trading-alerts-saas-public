/**
 * Constants Tests (V8 single-symbol architecture)
 *
 * Tests for application constants: XAUUSD only, M5/M15 only,
 * FREE 0 alerts / PRO 100, no watchlists.
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

describe('Constants (V8)', () => {
  describe('TIMEFRAMES', () => {
    it('should contain exactly M5 and M15', () => {
      expect([...TIMEFRAMES]).toEqual(['M5', 'M15']);
    });
  });

  describe('SYMBOLS', () => {
    it('should contain exactly XAUUSD', () => {
      expect([...SYMBOLS]).toEqual(['XAUUSD']);
    });
  });

  describe('FREE_SYMBOLS', () => {
    it('should be identical to SYMBOLS (no symbol gating)', () => {
      expect([...FREE_SYMBOLS]).toEqual([...SYMBOLS]);
    });
  });

  describe('SYMBOL_NAMES', () => {
    it('should have display names for all symbols', () => {
      SYMBOLS.forEach((symbol) => {
        expect(SYMBOL_NAMES[symbol]).toBeDefined();
        expect(typeof SYMBOL_NAMES[symbol]).toBe('string');
      });
    });

    it('should name XAUUSD as Gold', () => {
      expect(SYMBOL_NAMES.XAUUSD).toContain('Gold');
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
      expect(TIMEFRAME_NAMES.M5).toBe('5 Minutes');
      expect(TIMEFRAME_NAMES.M15).toBe('15 Minutes');
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
      it('should have correct limits (0 alerts, 60 req/h)', () => {
        expect(TIER_LIMITS.FREE.maxAlerts).toBe(0);
        expect(TIER_LIMITS.FREE.rateLimit).toBe(60);
      });

      it('should allow XAUUSD and both timeframes', () => {
        expect([...TIER_LIMITS.FREE.symbols]).toEqual(['XAUUSD']);
        expect([...TIER_LIMITS.FREE.timeframes]).toEqual(['M5', 'M15']);
      });

      it('should have PRO features disabled', () => {
        expect(TIER_LIMITS.FREE.features.emailAlerts).toBe(false);
        expect(TIER_LIMITS.FREE.features.pushNotifications).toBe(false);
        expect(TIER_LIMITS.FREE.features.multiTimeframe).toBe(false);
        expect(TIER_LIMITS.FREE.features.drawingLineAlerts).toBe(false);
        expect(TIER_LIMITS.FREE.features.exportData).toBe(false);
        expect(TIER_LIMITS.FREE.features.prioritySupport).toBe(false);
      });
    });

    describe('PRO tier', () => {
      it('should have correct limits (100 alerts, 300 req/h)', () => {
        expect(TIER_LIMITS.PRO.maxAlerts).toBe(100);
        expect(TIER_LIMITS.PRO.rateLimit).toBe(300);
      });

      it('should have identical data access to FREE', () => {
        expect([...TIER_LIMITS.PRO.symbols]).toEqual([
          ...TIER_LIMITS.FREE.symbols,
        ]);
        expect([...TIER_LIMITS.PRO.timeframes]).toEqual([
          ...TIER_LIMITS.FREE.timeframes,
        ]);
      });

      it('should have all features enabled', () => {
        expect(TIER_LIMITS.PRO.features.emailAlerts).toBe(true);
        expect(TIER_LIMITS.PRO.features.pushNotifications).toBe(true);
        expect(TIER_LIMITS.PRO.features.multiTimeframe).toBe(true);
        expect(TIER_LIMITS.PRO.features.drawingLineAlerts).toBe(true);
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

    it('should have configurable PRO pricing (default $29/$290)', () => {
      expect(PRICING.PRO.monthly).toBeGreaterThan(0);
      expect(PRICING.PRO.yearly).toBeGreaterThan(0);
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
      expect(limits.maxAlerts).toBe(0);
    });

    it('should return PRO tier limits', () => {
      const limits = getTierLimits('PRO');
      expect(limits).toBe(TIER_LIMITS.PRO);
      expect(limits.maxAlerts).toBe(100);
    });
  });

  describe('isSymbolAvailableForTier (V8: tier-independent)', () => {
    it('should return true for XAUUSD on both tiers', () => {
      expect(isSymbolAvailableForTier('XAUUSD', 'FREE')).toBe(true);
      expect(isSymbolAvailableForTier('XAUUSD', 'PRO')).toBe(true);
    });

    it('should return false for former symbols on both tiers', () => {
      for (const symbol of ['EURUSD', 'BTCUSD', 'US30']) {
        expect(isSymbolAvailableForTier(symbol, 'FREE')).toBe(false);
        expect(isSymbolAvailableForTier(symbol, 'PRO')).toBe(false);
      }
    });
  });

  describe('getSymbolsForTier', () => {
    it('should return the same list for both tiers', () => {
      expect([...getSymbolsForTier('FREE')]).toEqual(['XAUUSD']);
      expect([...getSymbolsForTier('PRO')]).toEqual(['XAUUSD']);
    });
  });

  describe('getSymbolName', () => {
    it('should return display name for symbol', () => {
      expect(getSymbolName('XAUUSD')).toBe('Gold (XAU/USD)');
    });
  });

  describe('getTimeframeName', () => {
    it('should return display name for timeframe', () => {
      expect(getTimeframeName('M5')).toBe('5 Minutes');
      expect(getTimeframeName('M15')).toBe('15 Minutes');
    });
  });
});
