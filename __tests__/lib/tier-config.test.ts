/**
 * Unit Tests: Tier Configuration (V8 single-symbol architecture)
 * Tests tier constants and configuration functions in lib/tier-config.ts
 *
 * V8: XAUUSD only, M5/M15 only, identical data access for both tiers.
 * Tier differentiation: alerts (FREE 0 / PRO 100) and rate limits.
 */

import { describe, it, expect } from '@jest/globals';

import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  TIER_CONFIGS,
  SYMBOLS,
  TIMEFRAMES,
  FREE_SYMBOLS,
  PRO_SYMBOLS,
  PRO_EXCLUSIVE_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_TIMEFRAMES,
  PRO_EXCLUSIVE_TIMEFRAMES,
  TRIAL_CONFIG,
  getTierConfig,
  getAccessibleSymbols,
  getAccessibleTimeframes,
  getChartCombinations,
  canAccessSymbol,
  canAccessTimeframe,
  type Tier,
} from '@/lib/tier-config';

describe('Tier Configuration Constants (V8)', () => {
  describe('FREE_TIER_CONFIG', () => {
    it('should have correct name', () => {
      expect(FREE_TIER_CONFIG.name).toBe('FREE');
    });

    it('should have $0 price', () => {
      expect(FREE_TIER_CONFIG.price).toBe(0);
    });

    it('should have 1 symbol', () => {
      expect(FREE_TIER_CONFIG.symbols).toBe(1);
    });

    it('should have 2 timeframes', () => {
      expect(FREE_TIER_CONFIG.timeframes).toBe(2);
    });

    it('should have 2 chart combinations (1 × 2)', () => {
      expect(FREE_TIER_CONFIG.chartCombinations).toBe(2);
    });

    it('should have 0 max alerts (alerts are a PRO feature)', () => {
      expect(FREE_TIER_CONFIG.maxAlerts).toBe(0);
    });

    it('should have 60 requests/hour rate limit', () => {
      expect(FREE_TIER_CONFIG.rateLimit).toBe(60);
    });
  });

  describe('PRO_TIER_CONFIG', () => {
    it('should have correct name', () => {
      expect(PRO_TIER_CONFIG.name).toBe('PRO');
    });

    it('should have a configurable positive price (default $29)', () => {
      expect(PRO_TIER_CONFIG.price).toBeGreaterThan(0);
    });

    it('should have 1 symbol (same as FREE)', () => {
      expect(PRO_TIER_CONFIG.symbols).toBe(1);
    });

    it('should have 2 timeframes (same as FREE)', () => {
      expect(PRO_TIER_CONFIG.timeframes).toBe(2);
    });

    it('should have 2 chart combinations (1 × 2)', () => {
      expect(PRO_TIER_CONFIG.chartCombinations).toBe(2);
    });

    it('should have 100 max alerts', () => {
      expect(PRO_TIER_CONFIG.maxAlerts).toBe(100);
    });

    it('should have 300 requests/hour rate limit', () => {
      expect(PRO_TIER_CONFIG.rateLimit).toBe(300);
    });
  });

  describe('TIER_CONFIGS', () => {
    it('should map FREE to FREE_TIER_CONFIG', () => {
      expect(TIER_CONFIGS.FREE).toBe(FREE_TIER_CONFIG);
    });

    it('should map PRO to PRO_TIER_CONFIG', () => {
      expect(TIER_CONFIGS.PRO).toBe(PRO_TIER_CONFIG);
    });

    it('should only have FREE and PRO tiers', () => {
      expect(Object.keys(TIER_CONFIGS)).toEqual(['FREE', 'PRO']);
    });
  });
});

describe('Symbol Constants (V8: XAUUSD only)', () => {
  it('SYMBOLS should contain exactly XAUUSD', () => {
    expect([...SYMBOLS]).toEqual(['XAUUSD']);
  });

  it('FREE_SYMBOLS and PRO_SYMBOLS should be identical (aliases of SYMBOLS)', () => {
    expect([...FREE_SYMBOLS]).toEqual([...SYMBOLS]);
    expect([...PRO_SYMBOLS]).toEqual([...SYMBOLS]);
  });

  it('PRO_EXCLUSIVE_SYMBOLS should be empty (no symbol gating)', () => {
    expect(PRO_EXCLUSIVE_SYMBOLS).toHaveLength(0);
  });
});

describe('Timeframe Constants (V8: M5 and M15 only)', () => {
  it('TIMEFRAMES should contain exactly M5 and M15', () => {
    expect([...TIMEFRAMES]).toEqual(['M5', 'M15']);
  });

  it('FREE_TIMEFRAMES and PRO_TIMEFRAMES should be identical (aliases)', () => {
    expect([...FREE_TIMEFRAMES]).toEqual([...TIMEFRAMES]);
    expect([...PRO_TIMEFRAMES]).toEqual([...TIMEFRAMES]);
  });

  it('PRO_EXCLUSIVE_TIMEFRAMES should be empty (no timeframe gating)', () => {
    expect(PRO_EXCLUSIVE_TIMEFRAMES).toHaveLength(0);
  });
});

describe('TRIAL_CONFIG', () => {
  it('should have 7-day duration', () => {
    expect(TRIAL_CONFIG.DURATION_DAYS).toBe(7);
  });

  it('should be free (price = 0)', () => {
    expect(TRIAL_CONFIG.PRICE).toBe(0);
  });

  it('should grant PRO access during trial', () => {
    expect(TRIAL_CONFIG.GRANT_PRO_ACCESS).toBe(true);
  });
});

describe('getTierConfig', () => {
  it('should return FREE_TIER_CONFIG for FREE tier', () => {
    expect(getTierConfig('FREE')).toBe(FREE_TIER_CONFIG);
  });

  it('should return PRO_TIER_CONFIG for PRO tier', () => {
    expect(getTierConfig('PRO')).toBe(PRO_TIER_CONFIG);
  });

  it('should throw error for invalid tier', () => {
    expect(() => getTierConfig('INVALID' as Tier)).toThrow('Invalid tier');
  });

  it('should include valid tiers in error message', () => {
    try {
      getTierConfig('INVALID' as Tier);
    } catch (error) {
      expect((error as Error).message).toContain('FREE');
      expect((error as Error).message).toContain('PRO');
    }
  });
});

describe('getAccessibleSymbols (V8: tier-independent)', () => {
  it('should return XAUUSD for FREE tier', () => {
    expect([...getAccessibleSymbols('FREE')]).toEqual(['XAUUSD']);
  });

  it('should return XAUUSD for PRO tier', () => {
    expect([...getAccessibleSymbols('PRO')]).toEqual(['XAUUSD']);
  });

  it('should return identical lists for both tiers', () => {
    expect(getAccessibleSymbols('FREE')).toEqual(getAccessibleSymbols('PRO'));
  });
});

describe('getAccessibleTimeframes (V8: tier-independent)', () => {
  it('should return M5 and M15 for FREE tier', () => {
    expect([...getAccessibleTimeframes('FREE')]).toEqual(['M5', 'M15']);
  });

  it('should return M5 and M15 for PRO tier', () => {
    expect([...getAccessibleTimeframes('PRO')]).toEqual(['M5', 'M15']);
  });

  it('should return identical lists for both tiers', () => {
    expect(getAccessibleTimeframes('FREE')).toEqual(
      getAccessibleTimeframes('PRO')
    );
  });
});

describe('getChartCombinations (V8: 2 for both tiers)', () => {
  it('should return 2 for FREE tier (1 symbol × 2 timeframes)', () => {
    expect(getChartCombinations('FREE')).toBe(2);
  });

  it('should return 2 for PRO tier (1 symbol × 2 timeframes)', () => {
    expect(getChartCombinations('PRO')).toBe(2);
  });

  it('should throw error for invalid tier', () => {
    expect(() => getChartCombinations('INVALID' as Tier)).toThrow(
      'Invalid tier'
    );
  });
});

describe('canAccessSymbol (V8: XAUUSD only, any tier)', () => {
  it('should allow XAUUSD for FREE tier', () => {
    expect(canAccessSymbol('XAUUSD', 'FREE')).toBe(true);
  });

  it('should allow XAUUSD for PRO tier', () => {
    expect(canAccessSymbol('XAUUSD', 'PRO')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(canAccessSymbol('xauusd', 'FREE')).toBe(true);
  });

  it('should reject former symbols for BOTH tiers', () => {
    for (const symbol of ['EURUSD', 'BTCUSD', 'US30', 'XAGUSD', 'NDX100']) {
      expect(canAccessSymbol(symbol, 'FREE')).toBe(false);
      expect(canAccessSymbol(symbol, 'PRO')).toBe(false);
    }
  });
});

describe('canAccessTimeframe (V8: M5/M15 only, any tier)', () => {
  it('should allow M5 and M15 for both tiers', () => {
    for (const tf of ['M5', 'M15']) {
      expect(canAccessTimeframe(tf, 'FREE')).toBe(true);
      expect(canAccessTimeframe(tf, 'PRO')).toBe(true);
    }
  });

  it('should be case insensitive', () => {
    expect(canAccessTimeframe('m5', 'FREE')).toBe(true);
  });

  it('should reject former timeframes for BOTH tiers', () => {
    for (const tf of ['M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']) {
      expect(canAccessTimeframe(tf, 'FREE')).toBe(false);
      expect(canAccessTimeframe(tf, 'PRO')).toBe(false);
    }
  });
});
