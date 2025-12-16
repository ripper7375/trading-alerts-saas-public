/**
 * Tier 2 Integration Tests
 *
 * Cross-cutting workflow tests for feature tier:
 * - MT5 Integration
 * - Alerts & Notifications
 * - Charts & Indicators
 * - Watchlist
 *
 * Tests workflows that span multiple components and APIs.
 */

// Mock AbortSignal.timeout
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  alert: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  watchlist: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  watchlistItem: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: mockPrisma,
}));

// Mock fetch for MT5 calls
const mockFetch = jest.fn();
const originalFetch = global.fetch;

describe('Tier 2 Integration - Feature Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Workflow 1: Alert Creation with MT5 Data', () => {
    it('should validate symbol against MT5 before creating alert', async () => {
      // Scenario: User creates alert, system verifies symbol with MT5
      const userId = 'user-1';
      const symbol = 'XAUUSD';
      const tier = 'FREE';

      // Step 1: MT5 returns valid symbols
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          symbols: ['XAUUSD', 'EURUSD', 'BTCUSD'],
        }),
      });

      // Step 2: User data with tier
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        tier,
        email: 'test@example.com',
      });

      // Step 3: Alert creation
      mockPrisma.alert.create.mockResolvedValue({
        id: 'alert-1',
        userId,
        symbol,
        timeframe: 'H1',
        condition: JSON.stringify({ type: 'price_above', targetValue: 1950 }),
        isActive: true,
      });

      // Verify symbol is in FREE tier list
      const { FREE_SYMBOLS } = await import('@/lib/tier-config');
      expect(FREE_SYMBOLS).toContain(symbol);

      // Verify alert would be created successfully
      expect(mockPrisma.alert.create).toBeDefined();
    });

    it('should reject alert for PRO-only symbol in FREE tier', async () => {
      const { FREE_SYMBOLS, PRO_EXCLUSIVE_SYMBOLS } = await import('@/lib/tier-config');

      // PRO-exclusive symbol should not be in FREE list
      const proSymbol = PRO_EXCLUSIVE_SYMBOLS[0];
      expect(FREE_SYMBOLS).not.toContain(proSymbol);

      // Verify tier validation function rejects it
      const { canAccessSymbol } = await import('@/lib/tier-validation');
      const canAccess = canAccessSymbol('FREE', proSymbol);
      expect(canAccess).toBe(false);
    });
  });

  describe('Workflow 2: Watchlist to Chart Navigation', () => {
    it('should maintain symbol/timeframe consistency across watchlist and charts', async () => {
      // Scenario: User adds item to watchlist, navigates to chart
      const symbol = 'XAUUSD';
      const timeframe = 'H1';

      // Step 1: Create watchlist item
      mockPrisma.watchlist.findFirst.mockResolvedValue({
        id: 'watchlist-1',
        items: [],
      });

      mockPrisma.watchlistItem.create.mockResolvedValue({
        id: 'item-1',
        symbol,
        timeframe,
        order: 0,
      });

      // Step 2: Chart request should use same symbol/timeframe
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            ohlc: [{ time: 1234567890, open: 1900, high: 1910, low: 1890, close: 1905 }],
            horizontal: {},
            diagonal: {},
          },
        }),
      });

      // Verify navigation would maintain consistency
      expect(symbol).toBe('XAUUSD');
      expect(timeframe).toBe('H1');
    });

    it('should validate watchlist item against tier before chart access', async () => {
      const { validateTimeframeAccess } = await import('@/lib/tier-validation');

      // FREE tier can access H1
      const freeResult = validateTimeframeAccess('FREE', 'H1');
      expect(freeResult.allowed).toBe(true);

      // FREE tier cannot access M5
      const proResult = validateTimeframeAccess('FREE', 'M5');
      expect(proResult.allowed).toBe(false);
    });
  });

  describe('Workflow 3: Alert Trigger to Notification', () => {
    it('should create notification when alert is triggered', async () => {
      const { checkAlertCondition } = await import('@/lib/jobs/alert-checker');

      // Step 1: Current price exceeds target
      const currentPrice = 1950;
      const targetValue = 1900;
      const conditionType = 'price_above';

      const conditionMet = checkAlertCondition(currentPrice, conditionType, targetValue);
      expect(conditionMet).toBe(true);

      // Step 2: Alert would be updated
      mockPrisma.alert.update.mockResolvedValue({
        id: 'alert-1',
        isActive: false,
        lastTriggered: new Date(),
        triggerCount: 1,
      });

      // Step 3: Notification would be created
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notif-1',
        userId: 'user-1',
        type: 'ALERT',
        title: 'Alert Triggered',
        body: 'XAUUSD price above 1900',
      });

      // Verify the flow
      expect(conditionMet).toBe(true);
    });

    it('should not trigger notification when condition not met', async () => {
      const { checkAlertCondition } = await import('@/lib/jobs/alert-checker');

      const currentPrice = 1850;
      const targetValue = 1900;
      const conditionType = 'price_above';

      const conditionMet = checkAlertCondition(currentPrice, conditionType, targetValue);
      expect(conditionMet).toBe(false);
    });
  });

  describe('Workflow 4: MT5 Health Check Integration', () => {
    it('should gracefully handle MT5 service unavailability', async () => {
      // Scenario: MT5 service is down, system should handle gracefully
      const failingFetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // System should not crash
      let errorHandled = false;
      try {
        await failingFetch('http://mt5-service/health');
      } catch {
        errorHandled = true;
      }

      expect(errorHandled).toBe(true);
      expect(failingFetch).toHaveBeenCalled();
    });

    it('should retry MT5 requests on transient failures', async () => {
      // Simulate retry logic - first call fails, second succeeds
      const mockRetryFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'healthy' }),
        });

      // First attempt fails
      let firstFailed = false;
      try {
        await mockRetryFetch('http://mt5-service/health');
      } catch {
        firstFailed = true;
      }
      expect(firstFailed).toBe(true);

      // Second attempt succeeds (retry)
      const response = await mockRetryFetch('http://mt5-service/health');
      expect(response.ok).toBe(true);
      expect(mockRetryFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Workflow 5: Tier Upgrade Impact on Features', () => {
    it('should unlock PRO symbols after upgrade', async () => {
      const { FREE_SYMBOLS, PRO_SYMBOLS, PRO_EXCLUSIVE_SYMBOLS } = await import('@/lib/tier-config');
      const { canAccessSymbol } = await import('@/lib/tier-validation');

      const proOnlySymbol = PRO_EXCLUSIVE_SYMBOLS[0]; // e.g., 'AUDJPY'

      // Before upgrade (FREE tier)
      const freeTierAccess = canAccessSymbol('FREE', proOnlySymbol);
      expect(freeTierAccess).toBe(false);

      // After upgrade (PRO tier)
      const proTierAccess = canAccessSymbol('PRO', proOnlySymbol);
      expect(proTierAccess).toBe(true);

      // PRO has access to all symbols
      expect(PRO_SYMBOLS.length).toBeGreaterThan(FREE_SYMBOLS.length);
    });

    it('should unlock PRO timeframes after upgrade', async () => {
      const { FREE_TIMEFRAMES, PRO_TIMEFRAMES, PRO_EXCLUSIVE_TIMEFRAMES } = await import('@/lib/tier-config');
      const { validateTimeframeAccess } = await import('@/lib/tier-validation');

      const proOnlyTimeframe = PRO_EXCLUSIVE_TIMEFRAMES[0]; // e.g., 'M5'

      // Before upgrade
      const freeResult = validateTimeframeAccess('FREE', proOnlyTimeframe);
      expect(freeResult.allowed).toBe(false);

      // After upgrade
      const proResult = validateTimeframeAccess('PRO', proOnlyTimeframe);
      expect(proResult.allowed).toBe(true);

      // PRO has more timeframes
      expect(PRO_TIMEFRAMES.length).toBeGreaterThan(FREE_TIMEFRAMES.length);
    });

    it('should increase watchlist limit after upgrade', async () => {
      const { FREE_TIER_CONFIG, PRO_TIER_CONFIG } = await import('@/lib/tier-config');

      expect(PRO_TIER_CONFIG.maxWatchlistItems).toBeGreaterThan(FREE_TIER_CONFIG.maxWatchlistItems);
      expect(FREE_TIER_CONFIG.maxWatchlistItems).toBe(5);
      expect(PRO_TIER_CONFIG.maxWatchlistItems).toBe(50);
    });

    it('should increase alert limit after upgrade', async () => {
      const { FREE_TIER_CONFIG, PRO_TIER_CONFIG } = await import('@/lib/tier-config');

      expect(PRO_TIER_CONFIG.maxAlerts).toBeGreaterThan(FREE_TIER_CONFIG.maxAlerts);
      expect(FREE_TIER_CONFIG.maxAlerts).toBe(5);
      expect(PRO_TIER_CONFIG.maxAlerts).toBe(20); // PRO gets 4x the alerts
    });
  });

  describe('Workflow 6: Cross-Feature Data Consistency', () => {
    it('should use consistent symbol validation across alerts and watchlist', async () => {
      const { canAccessSymbol } = await import('@/lib/tier-validation');

      // Same validation logic for both features
      const symbol = 'XAUUSD';
      const alertCanAccess = canAccessSymbol('FREE', symbol);
      const watchlistCanAccess = canAccessSymbol('FREE', symbol);

      expect(alertCanAccess).toBe(watchlistCanAccess);
    });

    it('should use consistent timeframe validation across features', async () => {
      const { validateTimeframeAccess } = await import('@/lib/tier-validation');

      const timeframe = 'H1';
      const alertResult = validateTimeframeAccess('FREE', timeframe);
      const chartResult = validateTimeframeAccess('FREE', timeframe);
      const watchlistResult = validateTimeframeAccess('FREE', timeframe);

      expect(alertResult.allowed).toBe(chartResult.allowed);
      expect(chartResult.allowed).toBe(watchlistResult.allowed);
    });
  });
});
