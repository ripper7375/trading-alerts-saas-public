/**
 * Unit Tests: Tier Configuration
 * Tests tier constants and configuration functions in lib/tier-config.ts
 */

import { describe, it, expect } from '@jest/globals';

import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  TIER_CONFIGS,
  FREE_SYMBOLS,
  PRO_EXCLUSIVE_SYMBOLS,
  PRO_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_EXCLUSIVE_TIMEFRAMES,
  PRO_TIMEFRAMES,
  TRIAL_CONFIG,
  getTierConfig,
  getAccessibleSymbols,
  getAccessibleTimeframes,
  getChartCombinations,
  type Tier,
  type TierConfig,
} from '@/lib/tier-config';

describe('Tier Configuration Constants', () => {
  describe('FREE_TIER_CONFIG', () => {
    it('should have correct name', () => {
      expect(FREE_TIER_CONFIG.name).toBe('FREE');
    });

    it('should have $0 price', () => {
      expect(FREE_TIER_CONFIG.price).toBe(0);
    });

    it('should have 5 symbols', () => {
      expect(FREE_TIER_CONFIG.symbols).toBe(5);
    });

    it('should have 3 timeframes', () => {
      expect(FREE_TIER_CONFIG.timeframes).toBe(3);
    });

    it('should have 15 chart combinations (5 × 3)', () => {
      expect(FREE_TIER_CONFIG.chartCombinations).toBe(15);
    });

    it('should have 5 max alerts', () => {
      expect(FREE_TIER_CONFIG.maxAlerts).toBe(5);
    });

    it('should have 5 max watchlist items', () => {
      expect(FREE_TIER_CONFIG.maxWatchlistItems).toBe(5);
    });

    it('should have 60 requests/hour rate limit', () => {
      expect(FREE_TIER_CONFIG.rateLimit).toBe(60);
    });
  });

  describe('PRO_TIER_CONFIG', () => {
    it('should have correct name', () => {
      expect(PRO_TIER_CONFIG.name).toBe('PRO');
    });

    it('should have $29 price', () => {
      expect(PRO_TIER_CONFIG.price).toBe(29);
    });

    it('should have 15 symbols', () => {
      expect(PRO_TIER_CONFIG.symbols).toBe(15);
    });

    it('should have 9 timeframes', () => {
      expect(PRO_TIER_CONFIG.timeframes).toBe(9);
    });

    it('should have 135 chart combinations (15 × 9)', () => {
      expect(PRO_TIER_CONFIG.chartCombinations).toBe(135);
    });

    it('should have 20 max alerts', () => {
      expect(PRO_TIER_CONFIG.maxAlerts).toBe(20);
    });

    it('should have 50 max watchlist items', () => {
      expect(PRO_TIER_CONFIG.maxWatchlistItems).toBe(50);
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

describe('Symbol Constants', () => {
  describe('FREE_SYMBOLS', () => {
    it('should contain exactly 5 symbols', () => {
      expect(FREE_SYMBOLS).toHaveLength(5);
    });

    it('should contain BTCUSD (crypto)', () => {
      expect(FREE_SYMBOLS).toContain('BTCUSD');
    });

    it('should contain EURUSD (forex major)', () => {
      expect(FREE_SYMBOLS).toContain('EURUSD');
    });

    it('should contain USDJPY (forex major)', () => {
      expect(FREE_SYMBOLS).toContain('USDJPY');
    });

    it('should contain US30 (index)', () => {
      expect(FREE_SYMBOLS).toContain('US30');
    });

    it('should contain XAUUSD (gold)', () => {
      expect(FREE_SYMBOLS).toContain('XAUUSD');
    });
  });

  describe('PRO_EXCLUSIVE_SYMBOLS', () => {
    it('should contain exactly 10 symbols', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toHaveLength(10);
    });

    it('should contain AUDJPY (forex cross)', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('AUDJPY');
    });

    it('should contain ETHUSD (crypto)', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('ETHUSD');
    });

    it('should contain GBPUSD (forex major)', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('GBPUSD');
    });

    it('should contain NDX100 (index)', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('NDX100');
    });

    it('should contain XAGUSD (silver)', () => {
      expect(PRO_EXCLUSIVE_SYMBOLS).toContain('XAGUSD');
    });

    it('should not overlap with FREE_SYMBOLS', () => {
      PRO_EXCLUSIVE_SYMBOLS.forEach((symbol) => {
        expect(FREE_SYMBOLS).not.toContain(symbol);
      });
    });
  });

  describe('PRO_SYMBOLS', () => {
    it('should contain exactly 15 symbols', () => {
      expect(PRO_SYMBOLS).toHaveLength(15);
    });

    it('should include all FREE_SYMBOLS', () => {
      FREE_SYMBOLS.forEach((symbol) => {
        expect(PRO_SYMBOLS).toContain(symbol);
      });
    });

    it('should include all PRO_EXCLUSIVE_SYMBOLS', () => {
      PRO_EXCLUSIVE_SYMBOLS.forEach((symbol) => {
        expect(PRO_SYMBOLS).toContain(symbol);
      });
    });
  });
});

describe('Timeframe Constants', () => {
  describe('FREE_TIMEFRAMES', () => {
    it('should contain exactly 3 timeframes', () => {
      expect(FREE_TIMEFRAMES).toHaveLength(3);
    });

    it('should contain H1 (1 hour)', () => {
      expect(FREE_TIMEFRAMES).toContain('H1');
    });

    it('should contain H4 (4 hours)', () => {
      expect(FREE_TIMEFRAMES).toContain('H4');
    });

    it('should contain D1 (daily)', () => {
      expect(FREE_TIMEFRAMES).toContain('D1');
    });
  });

  describe('PRO_EXCLUSIVE_TIMEFRAMES', () => {
    it('should contain exactly 6 timeframes', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toHaveLength(6);
    });

    it('should contain M5 (5 minutes)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M5');
    });

    it('should contain M15 (15 minutes)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M15');
    });

    it('should contain M30 (30 minutes)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('M30');
    });

    it('should contain H2 (2 hours)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H2');
    });

    it('should contain H8 (8 hours)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H8');
    });

    it('should contain H12 (12 hours)', () => {
      expect(PRO_EXCLUSIVE_TIMEFRAMES).toContain('H12');
    });

    it('should not overlap with FREE_TIMEFRAMES', () => {
      PRO_EXCLUSIVE_TIMEFRAMES.forEach((tf) => {
        expect(FREE_TIMEFRAMES).not.toContain(tf);
      });
    });
  });

  describe('PRO_TIMEFRAMES', () => {
    it('should contain exactly 9 timeframes', () => {
      expect(PRO_TIMEFRAMES).toHaveLength(9);
    });

    it('should include all FREE_TIMEFRAMES', () => {
      FREE_TIMEFRAMES.forEach((tf) => {
        expect(PRO_TIMEFRAMES).toContain(tf);
      });
    });

    it('should include all PRO_EXCLUSIVE_TIMEFRAMES', () => {
      PRO_EXCLUSIVE_TIMEFRAMES.forEach((tf) => {
        expect(PRO_TIMEFRAMES).toContain(tf);
      });
    });
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
    const config = getTierConfig('FREE');
    expect(config).toBe(FREE_TIER_CONFIG);
  });

  it('should return PRO_TIER_CONFIG for PRO tier', () => {
    const config = getTierConfig('PRO');
    expect(config).toBe(PRO_TIER_CONFIG);
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

describe('getAccessibleSymbols', () => {
  it('should return FREE_SYMBOLS for FREE tier', () => {
    const symbols = getAccessibleSymbols('FREE');
    expect(symbols).toBe(FREE_SYMBOLS);
  });

  it('should return PRO_SYMBOLS for PRO tier', () => {
    const symbols = getAccessibleSymbols('PRO');
    expect(symbols).toBe(PRO_SYMBOLS);
  });

  it('should return 5 symbols for FREE tier', () => {
    const symbols = getAccessibleSymbols('FREE');
    expect(symbols).toHaveLength(5);
  });

  it('should return 15 symbols for PRO tier', () => {
    const symbols = getAccessibleSymbols('PRO');
    expect(symbols).toHaveLength(15);
  });

  it('should throw error for invalid tier', () => {
    expect(() => getAccessibleSymbols('INVALID' as Tier)).toThrow('Invalid tier');
  });
});

describe('getAccessibleTimeframes', () => {
  it('should return FREE_TIMEFRAMES for FREE tier', () => {
    const timeframes = getAccessibleTimeframes('FREE');
    expect(timeframes).toBe(FREE_TIMEFRAMES);
  });

  it('should return PRO_TIMEFRAMES for PRO tier', () => {
    const timeframes = getAccessibleTimeframes('PRO');
    expect(timeframes).toBe(PRO_TIMEFRAMES);
  });

  it('should return 3 timeframes for FREE tier', () => {
    const timeframes = getAccessibleTimeframes('FREE');
    expect(timeframes).toHaveLength(3);
  });

  it('should return 9 timeframes for PRO tier', () => {
    const timeframes = getAccessibleTimeframes('PRO');
    expect(timeframes).toHaveLength(9);
  });

  it('should throw error for invalid tier', () => {
    expect(() => getAccessibleTimeframes('INVALID' as Tier)).toThrow(
      'Invalid tier'
    );
  });
});

describe('getChartCombinations', () => {
  it('should return 15 for FREE tier (5 symbols × 3 timeframes)', () => {
    const combinations = getChartCombinations('FREE');
    expect(combinations).toBe(15);
  });

  it('should return 135 for PRO tier (15 symbols × 9 timeframes)', () => {
    const combinations = getChartCombinations('PRO');
    expect(combinations).toBe(135);
  });

  it('should throw error for invalid tier', () => {
    expect(() => getChartCombinations('INVALID' as Tier)).toThrow('Invalid tier');
  });
});
