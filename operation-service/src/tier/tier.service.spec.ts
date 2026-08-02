import { TierService } from './tier.service';

// No Prisma dependency -- this domain is pure config/constants, so plain
// construction (no DI mocking) suffices.
describe('TierService', () => {
  function makeService() {
    return new TierService();
  }

  describe('getSymbols', () => {
    it('returns XAUUSD for a FREE user, identical shape regardless of tier', () => {
      const service = makeService();
      const result = service.getSymbols('FREE');

      expect(result).toEqual({
        success: true,
        tier: 'FREE',
        symbols: ['XAUUSD'],
        symbolsInfo: [
          {
            symbol: 'XAUUSD',
            name: 'Gold/US Dollar',
            category: 'commodity',
            proOnly: false,
          },
        ],
        count: 1,
        totalAvailable: 1,
      });
    });

    it('returns the identical symbol list for a PRO user', () => {
      const service = makeService();
      const free = service.getSymbols('FREE');
      const pro = service.getSymbols('PRO');

      expect(pro.symbols).toEqual(free.symbols);
      expect(pro.tier).toBe('PRO');
    });
  });

  describe('checkSymbolAccess', () => {
    it('allows XAUUSD regardless of tier', () => {
      const service = makeService();

      expect(service.checkSymbolAccess('FREE', 'xauusd')).toEqual({
        success: true,
        symbol: 'XAUUSD',
        allowed: true,
        tier: 'FREE',
      });
      expect(service.checkSymbolAccess('PRO', 'XAUUSD').allowed).toBe(true);
    });

    it('denies an unsupported symbol and includes a reason + accessibleSymbols', () => {
      const service = makeService();
      const result = service.checkSymbolAccess('PRO', 'EURUSD');

      expect(result).toEqual({
        success: true,
        symbol: 'EURUSD',
        allowed: false,
        tier: 'PRO',
        reason:
          'Symbol EURUSD is not supported. This platform provides XAUUSD data only.',
        accessibleSymbols: ['XAUUSD'],
      });
    });
  });

  describe('getCombinations', () => {
    it('returns the 2 XAUUSD x M5/M15 combinations, identical for both tiers', () => {
      const service = makeService();
      const result = service.getCombinations('FREE');

      expect(result).toEqual({
        success: true,
        tier: 'FREE',
        combinations: [
          { symbol: 'XAUUSD', timeframe: 'M5' },
          { symbol: 'XAUUSD', timeframe: 'M15' },
        ],
        count: 2,
        totalPossible: 2,
        symbols: ['XAUUSD'],
        timeframes: [
          { value: 'M5', label: '5 Minutes', proOnly: false },
          { value: 'M15', label: '15 Minutes', proOnly: false },
        ],
        limits: {
          symbolCount: 1,
          timeframeCount: 2,
          totalCombinations: 2,
        },
      });
    });

    it('returns the identical combinations for a PRO user', () => {
      const service = makeService();
      const free = service.getCombinations('FREE');
      const pro = service.getCombinations('PRO');

      expect(pro.combinations).toEqual(free.combinations);
    });
  });
});
