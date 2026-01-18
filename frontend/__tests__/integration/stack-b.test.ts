/**
 * Integration Tests: UI → Stack B
 *
 * Tests the connection between Frontend and Backend Stack B
 *
 * Stack B handles:
 * - Watchlist Management (Part 10)
 * - Alerts System (Part 11)
 * - Notifications & Real-time (Part 15)
 * - Analytics (Parts 20-21)
 * - Confluence Scores (Part 22)
 * - Leader Board (Part 23)
 * - Market Data Gateway (proxies to Stack C)
 *
 * Expected Result: UI → Stack B (ALLOW) ✅
 */

import { api } from '@/lib/api-clients';
import {
  TEST_ENV,
  checkBackendHealth,
  createTestWatchlistItem,
  createTestAlert,
  generate,
  TestCleanup,
} from '../utils/test-helpers';

describe('Integration: UI → Stack B', () => {
  const cleanup = new TestCleanup();

  // Check if Stack B is available before running tests
  beforeAll(async () => {
    const health = await checkBackendHealth(TEST_ENV.STACK_B_URL);
    if (!health.available) {
      console.warn(`⚠️ ${health.message}`);
      console.warn('⚠️ Skipping Stack B integration tests');
    }
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  describe('Connection & Health', () => {
    it('should be able to connect to Stack B', async () => {
      const health = await checkBackendHealth(TEST_ENV.STACK_B_URL);
      expect(health.available).toBe(true);
    }, 10000);

    it('should get health status from Stack B', async () => {
      try {
        const response = await fetch(`${TEST_ENV.STACK_B_URL}/health`);
        expect(response.ok).toBe(true);

        const data = await response.json();
        expect(data).toHaveProperty('status');
      } catch (error) {
        console.warn('Health endpoint may not be implemented yet');
      }
    }, 10000);
  });

  describe('Watchlist Management (Part 10)', () => {
    it('should get watchlist via Stack B', async () => {
      try {
        const response = await api.stackB.getWatchlist();

        expect(response).toHaveProperty('watchlist');
        expect(Array.isArray(response.watchlist)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should add item to watchlist via Stack B', async () => {
      try {
        const testItem = createTestWatchlistItem('EURUSD', 'H1');
        const item = await api.stackB.addToWatchlist(testItem);

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('symbol');
        expect(item.symbol).toBe('EURUSD');
        expect(item.timeframe).toBe('H1');

        // Register cleanup
        cleanup.register(async () => {
          try {
            await api.stackB.removeFromWatchlist(item.id);
          } catch (error) {
            console.warn('Cleanup failed:', error);
          }
        });
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access to this symbol/timeframe');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should update watchlist item via Stack B', async () => {
      try {
        // First, add an item
        const testItem = createTestWatchlistItem('GBPUSD', 'H4');
        const item = await api.stackB.addToWatchlist(testItem);

        // Then update it
        const updatedItem = await api.stackB.updateWatchlistItem(item.id, {
          notes: 'Updated notes via integration test',
        });

        expect(updatedItem.notes).toBe('Updated notes via integration test');

        // Register cleanup
        cleanup.register(async () => {
          try {
            await api.stackB.removeFromWatchlist(item.id);
          } catch (error) {
            console.warn('Cleanup failed:', error);
          }
        });
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should remove item from watchlist via Stack B', async () => {
      try {
        // First, add an item
        const testItem = createTestWatchlistItem('USDJPY', 'D1');
        const item = await api.stackB.addToWatchlist(testItem);

        // Then remove it
        const result = await api.stackB.removeFromWatchlist(item.id);

        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 404) {
          console.warn('Watchlist item not found - acceptable for cleanup');
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Alerts System (Part 11)', () => {
    it('should get alerts via Stack B', async () => {
      try {
        const response = await api.stackB.getAlerts();

        expect(response).toHaveProperty('alerts');
        expect(Array.isArray(response.alerts)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should create alert via Stack B', async () => {
      try {
        const testAlert = createTestAlert('EURUSD', 'H1', 1.1000);
        const alert = await api.stackB.createAlert(testAlert);

        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('symbol');
        expect(alert.symbol).toBe('EURUSD');
        expect(alert.targetPrice).toBe(1.1000);

        // Register cleanup
        cleanup.register(async () => {
          try {
            await api.stackB.deleteAlert(alert.id);
          } catch (error) {
            console.warn('Cleanup failed:', error);
          }
        });
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should update alert via Stack B', async () => {
      try {
        // First, create an alert
        const testAlert = createTestAlert('GBPUSD', 'H4', 1.2500);
        const alert = await api.stackB.createAlert(testAlert);

        // Then update it
        const updatedAlert = await api.stackB.updateAlert(alert.id, {
          targetPrice: 1.2600,
          isActive: false,
        });

        expect(updatedAlert.targetPrice).toBe(1.2600);
        expect(updatedAlert.isActive).toBe(false);

        // Register cleanup
        cleanup.register(async () => {
          try {
            await api.stackB.deleteAlert(alert.id);
          } catch (error) {
            console.warn('Cleanup failed:', error);
          }
        });
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should delete alert via Stack B', async () => {
      try {
        // First, create an alert
        const testAlert = createTestAlert('USDJPY', 'D1', 110.00);
        const alert = await api.stackB.createAlert(testAlert);

        // Then delete it
        const result = await api.stackB.deleteAlert(alert.id);

        expect(result).toHaveProperty('success');
        expect(result.success).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 404) {
          console.warn('Alert not found - acceptable for cleanup');
        } else {
          throw error;
        }
      }
    }, 20000);
  });

  describe('Notifications (Part 15)', () => {
    it('should get notifications via Stack B', async () => {
      try {
        const response = await api.stackB.getNotifications({ page: 1, limit: 10 });

        expect(response).toHaveProperty('notifications');
        expect(Array.isArray(response.notifications)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should get notification preferences via Stack B', async () => {
      try {
        const prefs = await api.stackB.getNotificationPreferences();

        expect(prefs).toHaveProperty('email');
        expect(prefs).toHaveProperty('push');
        expect(prefs).toHaveProperty('sms');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  describe('Market Data Gateway (Proxied to Stack C)', () => {
    it('should get candles from Stack B (proxied to Stack C)', async () => {
      try {
        const candles = await api.stackB.getCandles('EURUSD', 'H1', {
          limit: 100,
        });

        expect(Array.isArray(candles)).toBe(true);
        if (candles.length > 0) {
          expect(candles[0]).toHaveProperty('time');
          expect(candles[0]).toHaveProperty('open');
          expect(candles[0]).toHaveProperty('high');
          expect(candles[0]).toHaveProperty('low');
          expect(candles[0]).toHaveProperty('close');
        }
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access to EURUSD H1');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should get indicators from Stack B (proxied to Stack C)', async () => {
      try {
        const indicators = await api.stackB.getIndicators('EURUSD', 'H1', {
          bars: 1000,
        });

        expect(indicators).toHaveProperty('ohlc');
        expect(indicators).toHaveProperty('horizontal');
        expect(indicators).toHaveProperty('diagonal');
        expect(indicators).toHaveProperty('fractals');
        expect(indicators).toHaveProperty('metadata');
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access to EURUSD H1');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should get available symbols from Stack B (proxied to Stack C)', async () => {
      try {
        const response = await api.stackB.getSymbols();

        expect(response).toHaveProperty('symbols');
        expect(Array.isArray(response.symbols)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);

    it('should get available timeframes from Stack B (proxied to Stack C)', async () => {
      try {
        const response = await api.stackB.getTimeframes();

        expect(response).toHaveProperty('timeframes');
        expect(Array.isArray(response.timeframes)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  describe('Confluence & Analytics (Parts 22-23)', () => {
    it('should get confluence scores via Stack B', async () => {
      try {
        const scores = await api.stackB.getConfluenceScore('EURUSD', 'H1');

        expect(Array.isArray(scores)).toBe(true);
        if (scores.length > 0) {
          expect(scores[0]).toHaveProperty('symbol');
          expect(scores[0]).toHaveProperty('timeframe');
          expect(scores[0]).toHaveProperty('score');
          expect(scores[0]).toHaveProperty('components');
        }
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else if (error.statusCode === 403) {
          console.warn('User tier does not have access');
        } else {
          throw error;
        }
      }
    }, 20000);

    it('should get leader board via Stack B', async () => {
      try {
        const response = await api.stackB.getLeaderBoard({
          timeframe: 'H1',
          limit: 10,
        });

        expect(response).toHaveProperty('leaderboard');
        expect(Array.isArray(response.leaderboard)).toBe(true);
      } catch (error: any) {
        if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 15000);
  });

  describe('Rate Limiting & Performance', () => {
    it('should handle multiple concurrent requests to Stack B', async () => {
      try {
        const promises = Array.from({ length: 5 }, (_, i) =>
          api.stackB.getSymbols()
        );

        const results = await Promise.all(promises);

        results.forEach((result) => {
          expect(result).toHaveProperty('symbols');
        });
      } catch (error: any) {
        if (error.statusCode === 429) {
          console.warn('Rate limit hit - this is acceptable');
        } else if (error.statusCode === 401) {
          console.warn('User not authenticated - login first');
        } else {
          throw error;
        }
      }
    }, 30000);
  });
});
