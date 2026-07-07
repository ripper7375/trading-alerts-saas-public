import {
  hasChartAccess,
  getAvailableSymbols,
  getAvailableTimeframes,
  getChartCombinations,
  allowsCombination,
  getTierDisplayName,
  canUpgradeTier,
  getUpgradePath,
} from '@/lib/tier-helpers';

// V8: symbol/timeframe access is identical for both tiers (XAUUSD, M5/M15
// only) — see lib/tier-validation.ts. The old multi-symbol/timeframe tier
// gating tested here has been removed; these describe the current shared
// access instead.
describe('Tier Helpers - hasChartAccess', () => {
  it('should allow FREE tier access to XAUUSD M5', () => {
    expect(hasChartAccess('FREE', 'XAUUSD', 'M5')).toBe(true);
  });

  it('should allow PRO tier access to XAUUSD M15', () => {
    expect(hasChartAccess('PRO', 'XAUUSD', 'M15')).toBe(true);
  });

  it('should deny access to unsupported symbols for any tier', () => {
    expect(hasChartAccess('FREE', 'EURUSD', 'M5')).toBe(false);
    expect(hasChartAccess('PRO', 'EURUSD', 'M5')).toBe(false);
  });

  it('should deny access to unsupported timeframes for any tier', () => {
    expect(hasChartAccess('FREE', 'XAUUSD', 'H1')).toBe(false);
    expect(hasChartAccess('PRO', 'XAUUSD', 'H1')).toBe(false);
  });
});

describe('Tier Helpers - getAvailableSymbols', () => {
  it('should return only XAUUSD for FREE tier', () => {
    const symbols = getAvailableSymbols('FREE');
    expect(symbols).toEqual(['XAUUSD']);
  });

  it('should return only XAUUSD for PRO tier', () => {
    const symbols = getAvailableSymbols('PRO');
    expect(symbols).toEqual(['XAUUSD']);
  });
});

describe('Tier Helpers - getAvailableTimeframes', () => {
  it('should return M5 and M15 for FREE tier', () => {
    const timeframes = getAvailableTimeframes('FREE');
    expect(timeframes).toEqual(['M5', 'M15']);
  });

  it('should return M5 and M15 for PRO tier', () => {
    const timeframes = getAvailableTimeframes('PRO');
    expect(timeframes).toEqual(['M5', 'M15']);
  });
});

describe('Tier Helpers - getChartCombinations', () => {
  it('should return 2 combinations for FREE tier (1 symbol x 2 timeframes)', () => {
    expect(getChartCombinations('FREE')).toBe(2);
  });

  it('should return 2 combinations for PRO tier (1 symbol x 2 timeframes)', () => {
    expect(getChartCombinations('PRO')).toBe(2);
  });
});

describe('Tier Helpers - allowsCombination', () => {
  it('should allow the supported combination for any tier', () => {
    expect(allowsCombination('FREE', 'XAUUSD', 'M5')).toBe(true);
    expect(allowsCombination('PRO', 'XAUUSD', 'M15')).toBe(true);
  });

  it('should deny unsupported symbols for any tier', () => {
    expect(allowsCombination('FREE', 'GBPUSD', 'M5')).toBe(false);
    expect(allowsCombination('PRO', 'ETHUSD', 'M5')).toBe(false);
  });

  it('should deny unsupported timeframes for any tier', () => {
    expect(allowsCombination('FREE', 'XAUUSD', 'H1')).toBe(false);
    expect(allowsCombination('PRO', 'XAUUSD', 'D1')).toBe(false);
  });
});

describe('Tier Helpers - getTierDisplayName', () => {
  it('should return "Free" for FREE tier', () => {
    expect(getTierDisplayName('FREE')).toBe('Free');
  });

  it('should return "Pro" for PRO tier', () => {
    expect(getTierDisplayName('PRO')).toBe('Pro');
  });

  it('should return "Unknown" for invalid tier', () => {
    // @ts-expect-error - testing invalid input
    expect(getTierDisplayName('INVALID')).toBe('Unknown');
  });
});

describe('Tier Helpers - canUpgradeTier', () => {
  it('should allow FREE to PRO upgrade', () => {
    expect(canUpgradeTier('FREE', 'PRO')).toBe(true);
  });

  it('should not allow PRO to FREE downgrade', () => {
    expect(canUpgradeTier('PRO', 'FREE')).toBe(false);
  });

  it('should not allow same tier upgrade', () => {
    expect(canUpgradeTier('FREE', 'FREE')).toBe(false);
    expect(canUpgradeTier('PRO', 'PRO')).toBe(false);
  });
});

describe('Tier Helpers - getUpgradePath', () => {
  it('should return ["PRO"] for FREE tier', () => {
    expect(getUpgradePath('FREE')).toEqual(['PRO']);
  });

  it('should return empty array for PRO tier', () => {
    expect(getUpgradePath('PRO')).toEqual([]);
  });

  it('should return empty array for invalid tier', () => {
    // @ts-expect-error - testing invalid input
    expect(getUpgradePath('INVALID')).toEqual([]);
  });
});
