/**
 * Unit Tests: Tier Validation (V8 single-symbol architecture)
 *
 * V8: symbol/timeframe/indicator access is IDENTICAL for both tiers
 * (XAUUSD, M5/M15, all indicators). The only gated resource is Alerts:
 * FREE 0 / PRO 100. Watchlists no longer exist.
 */

import { describe, it, expect } from '@jest/globals';

import {
  TIER_LIMITS,
  getTierLimits,
  canAccessSymbol,
  validateTierAccess,
  canAccessTimeframe,
  validateTimeframeAccess,
  getAlertLimit,
  canCreateAlert,
  canAccessIndicator,
  getLockedIndicators,
  getRateLimit,
  getRateLimitForTier,
  getChartCombinations,
  validateChartAccess,
  validateFullTierAccess,
  getAvailableSymbols,
  getAvailableTimeframes,
  getAllCombinations,
} from '@/lib/tier-validation';

describe('Tier Validation (V8)', () => {
  describe('TIER_LIMITS', () => {
    it('FREE tier has 0 alerts (PRO feature)', () => {
      expect(TIER_LIMITS.FREE.maxAlerts).toBe(0);
    });

    it('PRO tier has 100 alerts', () => {
      expect(TIER_LIMITS.PRO.maxAlerts).toBe(100);
    });

    it('both tiers share the same symbols and timeframes', () => {
      expect([...TIER_LIMITS.FREE.symbols]).toEqual(['XAUUSD']);
      expect([...TIER_LIMITS.PRO.symbols]).toEqual(['XAUUSD']);
      expect([...TIER_LIMITS.FREE.timeframes]).toEqual(['M5', 'M15']);
      expect([...TIER_LIMITS.PRO.timeframes]).toEqual(['M5', 'M15']);
    });

    it('getTierLimits returns the limits object', () => {
      expect(getTierLimits('FREE')).toBe(TIER_LIMITS.FREE);
      expect(getTierLimits('PRO')).toBe(TIER_LIMITS.PRO);
    });
  });

  describe('Symbol Access (tier-independent)', () => {
    it('both tiers can access XAUUSD', () => {
      expect(canAccessSymbol('XAUUSD', 'FREE')).toBe(true);
      expect(canAccessSymbol('XAUUSD', 'PRO')).toBe(true);
    });

    it('handles case-insensitive symbol matching', () => {
      expect(canAccessSymbol('xauusd', 'FREE')).toBe(true);
    });

    it('neither tier can access former symbols', () => {
      for (const symbol of ['EURUSD', 'BTCUSD', 'GBPUSD', 'US30', 'ETHUSD']) {
        expect(canAccessSymbol(symbol, 'FREE')).toBe(false);
        expect(canAccessSymbol(symbol, 'PRO')).toBe(false);
      }
    });

    it('validateTierAccess allows XAUUSD for both tiers', () => {
      expect(validateTierAccess('FREE', 'XAUUSD').allowed).toBe(true);
      expect(validateTierAccess('PRO', 'XAUUSD').allowed).toBe(true);
    });

    it('validateTierAccess rejects unsupported symbols with a reason', () => {
      const result = validateTierAccess('PRO', 'EURUSD');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('XAUUSD');
    });

    it('validateTierAccess throws for invalid tier', () => {
      expect(() => validateTierAccess('INVALID' as 'FREE', 'XAUUSD')).toThrow();
    });
  });

  describe('Timeframe Access (tier-independent)', () => {
    it('both tiers can access M5 and M15', () => {
      for (const tf of ['M5', 'M15']) {
        expect(canAccessTimeframe(tf, 'FREE')).toBe(true);
        expect(canAccessTimeframe(tf, 'PRO')).toBe(true);
      }
    });

    it('handles case-insensitive timeframe matching', () => {
      expect(canAccessTimeframe('m15', 'FREE')).toBe(true);
    });

    it('neither tier can access former timeframes', () => {
      for (const tf of ['M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']) {
        expect(canAccessTimeframe(tf, 'FREE')).toBe(false);
        expect(canAccessTimeframe(tf, 'PRO')).toBe(false);
      }
    });

    it('validateTimeframeAccess allows M5/M15 and rejects others', () => {
      expect(validateTimeframeAccess('FREE', 'M5').allowed).toBe(true);
      expect(validateTimeframeAccess('PRO', 'M15').allowed).toBe(true);

      const rejected = validateTimeframeAccess('PRO', 'H1');
      expect(rejected.allowed).toBe(false);
      expect(rejected.reason).toContain('M5');
    });
  });

  describe('Alert Limits (the V8 tier differentiator)', () => {
    it('returns correct alert limits', () => {
      expect(getAlertLimit('FREE')).toBe(0);
      expect(getAlertLimit('PRO')).toBe(100);
    });

    it('FREE tier can NEVER create alerts', () => {
      expect(canCreateAlert('FREE', 0).allowed).toBe(false);
      expect(canCreateAlert('FREE', 0).reason).toContain('PRO');
    });

    it('PRO tier can create alerts below the 100 limit', () => {
      expect(canCreateAlert('PRO', 0).allowed).toBe(true);
      expect(canCreateAlert('PRO', 99).allowed).toBe(true);
    });

    it('PRO tier cannot exceed the 100 alert limit', () => {
      expect(canCreateAlert('PRO', 100).allowed).toBe(false);
    });
  });

  describe('Indicator Access (V8: ungated)', () => {
    it('all indicators accessible to both tiers', () => {
      for (const indicator of ['anything', 'keltner_channels', 'zigzag']) {
        expect(canAccessIndicator(indicator, 'FREE')).toBe(true);
        expect(canAccessIndicator(indicator, 'PRO')).toBe(true);
      }
    });

    it('no locked indicators for any tier', () => {
      expect(getLockedIndicators('FREE')).toEqual([]);
      expect(getLockedIndicators('PRO')).toEqual([]);
    });
  });

  describe('Rate Limits', () => {
    it('returns correct rate limits per HOUR', () => {
      expect(getRateLimit('FREE')).toBe(60);
      expect(getRateLimit('PRO')).toBe(300);
    });

    it('getRateLimitForTier is alias for getRateLimit', () => {
      expect(getRateLimitForTier('FREE')).toBe(getRateLimit('FREE'));
      expect(getRateLimitForTier('PRO')).toBe(getRateLimit('PRO'));
    });
  });

  describe('Chart Combinations (V8: 2 for both)', () => {
    it('both tiers have 2 combinations (1 × 2)', () => {
      expect(getChartCombinations('FREE')).toBe(2);
      expect(getChartCombinations('PRO')).toBe(2);
    });
  });

  describe('validateChartAccess', () => {
    it('allows XAUUSD M5/M15 for both tiers', () => {
      for (const tier of ['FREE', 'PRO'] as const) {
        expect(validateChartAccess(tier, 'XAUUSD', 'M5').allowed).toBe(true);
        expect(validateChartAccess(tier, 'XAUUSD', 'M15').allowed).toBe(true);
      }
    });

    it('rejects unsupported symbol', () => {
      expect(validateChartAccess('PRO', 'EURUSD', 'M5').allowed).toBe(false);
    });

    it('rejects unsupported timeframe', () => {
      expect(validateChartAccess('PRO', 'XAUUSD', 'H1').allowed).toBe(false);
    });
  });

  describe('validateFullTierAccess', () => {
    it('returns null for valid PRO access with alert headroom', () => {
      expect(
        validateFullTierAccess({
          tier: 'PRO',
          symbol: 'XAUUSD',
          timeframe: 'M5',
          alertCount: 50,
        })
      ).toBeNull();
    });

    it('returns message when FREE user attempts alert creation', () => {
      const msg = validateFullTierAccess({ tier: 'FREE', alertCount: 0 });
      expect(msg).not.toBeNull();
      expect(msg).toContain('PRO');
    });

    it('returns message for unsupported symbol', () => {
      const msg = validateFullTierAccess({ tier: 'PRO', symbol: 'EURUSD' });
      expect(msg).toContain('XAUUSD');
    });

    it('returns message for unsupported timeframe', () => {
      const msg = validateFullTierAccess({ tier: 'FREE', timeframe: 'D1' });
      expect(msg).toContain('M5');
    });
  });

  describe('Utility Functions', () => {
    it('getAvailableSymbols returns XAUUSD for both tiers', () => {
      expect(getAvailableSymbols('FREE')).toEqual(['XAUUSD']);
      expect(getAvailableSymbols('PRO')).toEqual(['XAUUSD']);
    });

    it('getAvailableTimeframes returns M5/M15 for both tiers', () => {
      expect(getAvailableTimeframes('FREE')).toEqual(['M5', 'M15']);
      expect(getAvailableTimeframes('PRO')).toEqual(['M5', 'M15']);
    });

    it('getAllCombinations returns the 2 supported combinations', () => {
      const combos = getAllCombinations('PRO');
      expect(combos).toEqual([
        { symbol: 'XAUUSD', timeframe: 'M5' },
        { symbol: 'XAUUSD', timeframe: 'M15' },
      ]);
    });
  });
});
