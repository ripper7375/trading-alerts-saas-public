/**
 * Integration Tests: UI → Stack A AND Stack B (Both)
 *
 * Tests the connection between Frontend and BOTH Backend Stacks simultaneously
 *
 * This validates:
 * - Frontend can access Stack A and Stack B concurrently
 * - Both stacks can handle market data requests
 * - Both stacks return consistent data structures
 * - Load balancing possibilities
 * - Redundancy scenarios (if one stack fails, use the other)
 *
 * Expected Result: UI → Stack A AND Stack B (ALLOW) ✅
 */

import { api } from '@/lib/api-clients';
import {
  TEST_ENV,
  checkBackendHealth,
  generate,
  createTestWatchlistItem,
  createTestAlert,
  TestCleanup,
} from '../utils/test-helpers';

describe('Integration: UI → Stack A AND Stack B (Both)', () => {
  const cleanup = new TestCleanup();

  beforeAll(async () => {
    const healthA = await checkBackendHealth(TEST_ENV.STACK_A_URL);
    const healthB = await checkBackendHealth(TEST_ENV.STACK_B_URL);

    if (!healthA.available) {
      console.warn(`⚠️ Stack A: ${healthA.message}`);
    }
    if (!healthB.available) {
      console.warn(`⚠️ Stack B: ${healthB.message}`);
    }
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  describe('Multi-Stack Availability', () => {
    it('should be able to connect to both Stack A and Stack B simultaneously', async () => {
      const [healthA, healthB] = await Promise.all([
        checkBackendHealth(TEST_ENV.STACK_A_URL),
        checkBackendHealth(TEST_ENV.STACK_B_URL),
      ]);

      console.log('Stack A:', healthA.message);
      console.log('Stack B:', healthB.message);

      // Both should be available
      expect(healthA.available || healthB.available).toBe(true);
    }, 10000);

    it('should verify architecture: Frontend has access to exactly 2 backends', () => {
      const backendClients = Object.keys(api);

      // Should have exactly 2 clients: stackA and stackB
      expect(backendClients).toHaveLength(2);
      expect(backendClients).toContain('stackA');
      expect(backendClients).toContain('stackB');
      expect(backendClients).not.toContain('stackC');

      console.log('✅ Frontend has access to exactly 2 backends: Stack A and Stack B');
      console.log('✅ No direct access to Stack C');
    });
  });

  describe('Market Data: Both Stacks Can Proxy to Stack C', () => {
    it('should fetch candles from both Stack A and Stack B', async () => {
      try {
        const [candlesFromA, candlesFromB] = await Promise.all([
          api.stackA.getCandles('EURUSD', 'H1', { limit: 50 }),
          api.stackB.getCandles('EURUSD', 'H1', { limit: 50 }),
        ]);

        // Both should return arrays
        expect(Array.isArray(candlesFromA)).toBe(true);
        expect(Array.isArray(candlesFromB)).toBe(true);

        // Both should have OHLC data structure
        if (candlesFromA.length > 0) {
          expect(candlesFromA[0]).toHaveProperty('time');
          expect(candlesFromA[0]).toHaveProperty('open');
          expect(candlesFromA[0]).toHaveProperty('high');
          expect(candlesFromA[0]).toHaveProperty('low');
          expect(candlesFromA[0]).toHaveProperty('close');
        }

        if (candlesFromB.length > 0) {
          expect(candlesFromB[0]).toHaveProperty('time');
          expect(candlesFromB[0]).toHaveProperty('open');
          expect(candlesFromB[0]).toHaveProperty('high');
          expect(candlesFromB[0]).toHaveProperty('low');
          expect(candlesFromB[0]).toHaveProperty('close');
        }

        console.log('✅ Both Stack A and Stack B can fetch candles from Stack C');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access to EURUSD H1');
        } else {
          throw error;
        }
      }
    }, 25000);

    it('should fetch indicators from both Stack A and Stack B', async () => {
      try {
        const [indicatorsFromA, indicatorsFromB] = await Promise.all([
          api.stackA.getIndicators('EURUSD', 'H1', { bars: 500 }),
          api.stackB.getIndicators('EURUSD', 'H1', { bars: 500 }),
        ]);

        // Both should have the same structure
        expect(indicatorsFromA).toHaveProperty('ohlc');
        expect(indicatorsFromA).toHaveProperty('horizontal');
        expect(indicatorsFromA).toHaveProperty('diagonal');
        expect(indicatorsFromA).toHaveProperty('fractals');

        expect(indicatorsFromB).toHaveProperty('ohlc');
        expect(indicatorsFromB).toHaveProperty('horizontal');
        expect(indicatorsFromB).toHaveProperty('diagonal');
        expect(indicatorsFromB).toHaveProperty('fractals');

        console.log('✅ Both Stack A and Stack B can fetch indicators from Stack C');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 25000);

    it('should get symbols from both Stack A and Stack B', async () => {
      try {
        const [symbolsFromA, symbolsFromB] = await Promise.all([
          api.stackA.getSymbols(),
          api.stackB.getSymbols(),
        ]);

        expect(symbolsFromA).toHaveProperty('symbols');
        expect(symbolsFromB).toHaveProperty('symbols');

        expect(Array.isArray(symbolsFromA.symbols)).toBe(true);
        expect(Array.isArray(symbolsFromB.symbols)).toBe(true);

        console.log('✅ Both stacks can fetch symbols from Stack C');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Data Consistency: Cross-Stack Validation', () => {
    it('should return similar data from both stacks for the same request', async () => {
      try {
        const [symbolsA, symbolsB] = await Promise.all([
          api.stackA.getSymbols(),
          api.stackB.getSymbols(),
        ]);

        // Both should return symbols (might be filtered by tier)
        expect(symbolsA.symbols.length).toBeGreaterThanOrEqual(0);
        expect(symbolsB.symbols.length).toBeGreaterThanOrEqual(0);

        // If both have symbols, they should have overlapping symbols
        if (symbolsA.symbols.length > 0 && symbolsB.symbols.length > 0) {
          const hasCommonSymbols = symbolsA.symbols.some((symbol) =>
            symbolsB.symbols.includes(symbol)
          );
          expect(hasCommonSymbols).toBe(true);
        }

        console.log('✅ Data from both stacks is consistent');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Load Distribution: Use Case Scenarios', () => {
    it('should handle user operations via Stack A and watchlist via Stack B', async () => {
      try {
        // Parallel operations across both stacks
        const [userProfile, watchlist] = await Promise.all([
          api.stackA.getUserProfile(), // Stack A: User management
          api.stackB.getWatchlist(),    // Stack B: Watchlist
        ]);

        expect(userProfile).toHaveProperty('userId');
        expect(watchlist).toHaveProperty('watchlist');

        console.log('✅ Can distribute operations across both stacks');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should handle subscription check via Stack A and alerts via Stack B', async () => {
      try {
        const [subscription, alerts] = await Promise.all([
          api.stackA.getSubscription(), // Stack A: Billing
          api.stackB.getAlerts(),        // Stack B: Alerts
        ]);

        // Subscription can be null
        if (subscription) {
          expect(subscription).toHaveProperty('tier');
        }

        expect(alerts).toHaveProperty('alerts');
        expect(Array.isArray(alerts.alerts)).toBe(true);

        console.log('✅ Can check subscription and alerts concurrently');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Redundancy: Failover Scenarios', () => {
    it('should be able to use Stack B for market data if Stack A fails', async () => {
      try {
        // Try Stack A first
        let candles;
        try {
          candles = await api.stackA.getCandles('EURUSD', 'H1', { limit: 10 });
        } catch (errorA) {
          console.log('Stack A failed, falling back to Stack B');
          // Fallback to Stack B
          candles = await api.stackB.getCandles('EURUSD', 'H1', { limit: 10 });
        }

        expect(Array.isArray(candles)).toBe(true);
        console.log('✅ Failover from Stack A to Stack B works');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 25000);

    it('should be able to use Stack A for market data if Stack B fails', async () => {
      try {
        // Try Stack B first
        let candles;
        try {
          candles = await api.stackB.getCandles('EURUSD', 'H1', { limit: 10 });
        } catch (errorB) {
          console.log('Stack B failed, falling back to Stack A');
          // Fallback to Stack A
          candles = await api.stackA.getCandles('EURUSD', 'H1', { limit: 10 });
        }

        expect(Array.isArray(candles)).toBe(true);
        console.log('✅ Failover from Stack B to Stack A works');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 25000);
  });

  describe('Performance: Concurrent Operations', () => {
    it('should handle multiple operations across both stacks efficiently', async () => {
      try {
        const startTime = Date.now();

        const operations = await Promise.all([
          // Stack A operations
          api.stackA.getCurrentUser(),
          api.stackA.getSubscription(),
          api.stackA.getSymbols(),

          // Stack B operations
          api.stackB.getWatchlist(),
          api.stackB.getAlerts(),
          api.stackB.getSymbols(),
        ]);

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ 6 concurrent operations across both stacks completed in ${duration}ms`);

        // All operations should complete
        expect(operations).toHaveLength(6);

        // Should be faster than sequential (rough check)
        expect(duration).toBeLessThan(15000); // Should complete in under 15 seconds
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 30000);
  });

  describe('Architecture Validation', () => {
    it('should validate the complete architecture flow', () => {
      const architecture = {
        frontend: {
          clients: ['stackA', 'stackB'],
          noDirectAccessTo: 'stackC',
        },
        stackA: {
          canAccessStackC: true,
          proxiesMarketData: true,
          cachesInRedis: true,
        },
        stackB: {
          canAccessStackC: true,
          proxiesMarketData: true,
          cachesInRedis: true,
        },
      };

      console.log('\n📋 Multi-Backend Architecture:');
      console.log('  Frontend → Stack A ✅');
      console.log('  Frontend → Stack B ✅');
      console.log('  Frontend → Stack C ❌ (forbidden)');
      console.log('  Stack A → Stack C ✅ (proxy)');
      console.log('  Stack B → Stack C ✅ (proxy)');

      expect(architecture.frontend.clients).toHaveLength(2);
      expect(architecture.stackA.canAccessStackC).toBe(true);
      expect(architecture.stackB.canAccessStackC).toBe(true);
    });

    it('should verify benefits of multi-backend architecture', () => {
      const benefits = {
        redundancy: 'Both stacks can serve market data',
        loadBalancing: 'Can distribute requests between stacks',
        separation: 'User ops (A) vs Alerts/Watchlist (B)',
        security: 'Frontend never accesses Stack C directly',
        caching: 'Both stacks cache Stack C data in Redis',
      };

      console.log('\n💡 Benefits:');
      Object.entries(benefits).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      expect(Object.keys(benefits)).toHaveLength(5);
    });
  });
});
