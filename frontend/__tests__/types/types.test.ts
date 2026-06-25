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

    it('should export FREE_TIER_SYMBOLS constant', async () => {
      const { FREE_TIER_SYMBOLS } = await import('@/types/tier');
      expect(FREE_TIER_SYMBOLS).toBeDefined();
      expect(FREE_TIER_SYMBOLS.length).toBeGreaterThan(0);
    });

    it('should export TIMEFRAME_LABELS', async () => {
      const { TIMEFRAME_LABELS } = await import('@/types/tier');
      expect(TIMEFRAME_LABELS).toBeDefined();
      expect(TIMEFRAME_LABELS.H1).toBe('1 Hour');
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

  describe('Watchlist Types', () => {
    it('should export watchlist types', async () => {
      const watchlistModule = await import('@/types/watchlist');
      expect(watchlistModule).toBeDefined();
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
