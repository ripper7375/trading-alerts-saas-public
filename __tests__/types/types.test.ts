/**
 * TypeScript Types Tests (Tier 3 - Minimal Coverage)
 *
 * Tests that verify TypeScript types are correctly defined and exported.
 */

describe('TypeScript Types', () => {
  describe('Tier Types', () => {
    it('should export TIER_CONFIG constant', async () => {
      const { TIER_CONFIG } = await import('@/types/tier');
      expect(TIER_CONFIG).toBeDefined();
      expect(TIER_CONFIG.FREE).toBeDefined();
      expect(TIER_CONFIG.PRO).toBeDefined();
    });

    it('should export ALL_SYMBOLS constant (V8: XAUUSD only)', async () => {
      const { ALL_SYMBOLS } = await import('@/types/tier');
      expect(ALL_SYMBOLS).toBeDefined();
      expect([...ALL_SYMBOLS]).toEqual(['XAUUSD']);
    });

    it('should export TIMEFRAME_LABELS (V8: M5/M15 only)', async () => {
      const { TIMEFRAME_LABELS } = await import('@/types/tier');
      expect(TIMEFRAME_LABELS).toBeDefined();
      expect(TIMEFRAME_LABELS.M5).toBe('5 Minutes');
      expect(TIMEFRAME_LABELS.M15).toBe('15 Minutes');
    });
  });

  describe('Alert Types', () => {
    it('should export alert types', async () => {
      const alertModule = await import('@/types/alert');
      expect(alertModule).toBeDefined();
    });
  });

  describe('User Types', () => {
    it('should export user types', async () => {
      const userModule = await import('@/types/user');
      expect(userModule).toBeDefined();
    });
  });

  describe('Payment Types', () => {
    it('should export payment types', async () => {
      const paymentModule = await import('@/types/payment');
      expect(paymentModule).toBeDefined();
    });
  });

  describe('Indicator Types', () => {
    it('should export indicator types', async () => {
      const indicatorModule = await import('@/types/indicator');
      expect(indicatorModule).toBeDefined();
    });
  });

  describe('API Types', () => {
    it('should export API types', async () => {
      const apiModule = await import('@/types/api');
      expect(apiModule).toBeDefined();
    });
  });

  describe('Index Exports', () => {
    it('should export all types from index', async () => {
      const indexModule = await import('@/types/index');
      expect(indexModule).toBeDefined();
    });
  });
});
