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

describe('Tier Helpers - hasChartAccess', () => {
  it('should allow FREE tier access to XAUUSD H1', () => {
    expect(hasChartAccess('FREE', 'XAUUSD', 'H1')).toBe(true);
  });

  it('should allow FREE tier access to BTCUSD D1', () => {
    expect(hasChartAccess('FREE', 'BTCUSD', 'D1')).toBe(true);
  });

  it('should deny FREE tier access to GBPUSD H1 (PRO symbol)', () => {
    expect(hasChartAccess('FREE', 'GBPUSD', 'H1')).toBe(false);
  });

  it('should deny FREE tier access to XAUUSD M5 (PRO timeframe)', () => {
    expect(hasChartAccess('FREE', 'XAUUSD', 'M5')).toBe(false);
  });

  it('should allow PRO tier access to any combination', () => {
    expect(hasChartAccess('PRO', 'GBPUSD', 'M5')).toBe(true);
    expect(hasChartAccess('PRO', 'ETHUSD', 'M15')).toBe(true);
  });
});

describe('Tier Helpers - getAvailableSymbols', () => {
  it('should return 5 symbols for FREE tier', () => {
    const symbols = getAvailableSymbols('FREE');
    expect(symbols).toHaveLength(5);
    expect(symbols).toContain('XAUUSD');
    expect(symbols).toContain('BTCUSD');
  });

  it('should return wildcard for PRO tier (unlimited access)', () => {
    const symbols = getAvailableSymbols('PRO');
    expect(symbols).toContain('*');
  });
});

describe('Tier Helpers - getAvailableTimeframes', () => {
  it('should return 3 timeframes for FREE tier', () => {
    const timeframes = getAvailableTimeframes('FREE');
    expect(timeframes).toHaveLength(3);
    expect(timeframes).toContain('H1');
    expect(timeframes).toContain('H4');
    expect(timeframes).toContain('D1');
  });

  it('should return wildcard for PRO tier (unlimited access)', () => {
    const timeframes = getAvailableTimeframes('PRO');
    expect(timeframes).toContain('*');
  });
});

describe('Tier Helpers - getChartCombinations', () => {
  it('should return 15 combinations for FREE tier (5 symbols x 3 timeframes)', () => {
    expect(getChartCombinations('FREE')).toBe(15);
  });

  it('should return -1 (unlimited) for PRO tier', () => {
    expect(getChartCombinations('PRO')).toBe(-1);
  });
});

describe('Tier Helpers - allowsCombination', () => {
  it('should allow FREE tier valid combinations', () => {
    expect(allowsCombination('FREE', 'XAUUSD', 'H1')).toBe(true);
    expect(allowsCombination('FREE', 'EURUSD', 'H4')).toBe(true);
    expect(allowsCombination('FREE', 'BTCUSD', 'D1')).toBe(true);
  });

  it('should deny FREE tier PRO symbols', () => {
    expect(allowsCombination('FREE', 'GBPUSD', 'H1')).toBe(false);
    expect(allowsCombination('FREE', 'ETHUSD', 'H4')).toBe(false);
  });

  it('should deny FREE tier PRO timeframes', () => {
    expect(allowsCombination('FREE', 'XAUUSD', 'M5')).toBe(false);
    expect(allowsCombination('FREE', 'BTCUSD', 'M15')).toBe(false);
  });

  it('should allow PRO tier all combinations', () => {
    expect(allowsCombination('PRO', 'GBPUSD', 'M5')).toBe(true);
    expect(allowsCombination('PRO', 'ETHUSD', 'M15')).toBe(true);
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
