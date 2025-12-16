import {
  validateTierAccess,
  canAccessSymbol,
  getSymbolLimit,
  getAlertLimit,
  canCreateAlert,
  validateTimeframeAccess,
  type Tier,
} from '@/lib/tier-validation';

describe('Tier Validation - validateTierAccess', () => {
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

describe('Tier Validation - canAccessSymbol', () => {
  it('should return true for FREE tier with XAUUSD', () => {
    expect(canAccessSymbol('FREE', 'XAUUSD')).toBe(true);
  });

  it('should return true for FREE tier with EURUSD', () => {
    expect(canAccessSymbol('FREE', 'EURUSD')).toBe(true);
  });

  it('should return true for FREE tier with BTCUSD', () => {
    expect(canAccessSymbol('FREE', 'BTCUSD')).toBe(true);
  });

  it('should return false for FREE tier with GBPUSD (PRO only)', () => {
    expect(canAccessSymbol('FREE', 'GBPUSD')).toBe(false);
  });

  it('should return true for PRO tier with any symbol', () => {
    expect(canAccessSymbol('PRO', 'EURUSD')).toBe(true);
    expect(canAccessSymbol('PRO', 'BTCUSD')).toBe(true);
    expect(canAccessSymbol('PRO', 'GBPUSD')).toBe(true);
    expect(canAccessSymbol('PRO', 'AUDUSD')).toBe(true);
  });
});

describe('Tier Validation - getSymbolLimit', () => {
  it('should return 5 for FREE tier', () => {
    expect(getSymbolLimit('FREE')).toBe(5);
  });

  it('should return 15 for PRO tier', () => {
    expect(getSymbolLimit('PRO')).toBe(15);
  });
});

describe('Tier Validation - getAlertLimit', () => {
  it('should return 5 for FREE tier', () => {
    expect(getAlertLimit('FREE')).toBe(5);
  });

  it('should return 20 for PRO tier', () => {
    expect(getAlertLimit('PRO')).toBe(20);
  });
});

describe('Tier Validation - canCreateAlert', () => {
  describe('FREE tier', () => {
    it('should allow creating alerts under limit', () => {
      const result = canCreateAlert('FREE', 3);
      expect(result.allowed).toBe(true);
    });

    it('should block creating alerts at limit', () => {
      const result = canCreateAlert('FREE', 5);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Alert limit reached');
      expect(result.reason).toContain('5');
    });

    it('should block creating alerts over limit', () => {
      const result = canCreateAlert('FREE', 6);
      expect(result.allowed).toBe(false);
    });

    it('should allow first alert', () => {
      const result = canCreateAlert('FREE', 0);
      expect(result.allowed).toBe(true);
    });
  });

  describe('PRO tier', () => {
    it('should allow creating alerts under limit', () => {
      const result = canCreateAlert('PRO', 15);
      expect(result.allowed).toBe(true);
    });

    it('should block creating alerts at limit', () => {
      const result = canCreateAlert('PRO', 20);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('20');
    });

    it('should allow creating first alert', () => {
      const result = canCreateAlert('PRO', 0);
      expect(result.allowed).toBe(true);
    });
  });
});

describe('Tier Validation - validateTimeframeAccess', () => {
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
