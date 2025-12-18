/**
 * Alert Checker Job Tests
 *
 * Tests for the background job that checks alert conditions.
 */

import { checkAlertCondition } from '@/lib/jobs/alert-checker';

// Mock AbortSignal.timeout which is not available in Jest
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Mock Prisma
const mockAlertFindMany = jest.fn();
const mockAlertUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    alert: {
      findMany: (...args: unknown[]) => mockAlertFindMany(...args),
      update: (...args: unknown[]) => mockAlertUpdate(...args),
    },
  },
}));

// Mock fetch for price fetching
const originalFetch = global.fetch;
const mockFetch = jest.fn();

describe('Alert Checker Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('checkAlertCondition', () => {
    describe('price_above condition', () => {
      it('should return true when current price is above target', () => {
        expect(checkAlertCondition(1950.5, 'price_above', 1900)).toBe(true);
      });

      it('should return false when current price is below target', () => {
        expect(checkAlertCondition(1850.0, 'price_above', 1900)).toBe(false);
      });

      it('should return false when current price equals target', () => {
        expect(checkAlertCondition(1900.0, 'price_above', 1900)).toBe(false);
      });

      it('should handle small differences correctly', () => {
        expect(checkAlertCondition(1900.01, 'price_above', 1900)).toBe(true);
        expect(checkAlertCondition(1899.99, 'price_above', 1900)).toBe(false);
      });
    });

    describe('price_below condition', () => {
      it('should return true when current price is below target', () => {
        expect(checkAlertCondition(1850.0, 'price_below', 1900)).toBe(true);
      });

      it('should return false when current price is above target', () => {
        expect(checkAlertCondition(1950.5, 'price_below', 1900)).toBe(false);
      });

      it('should return false when current price equals target', () => {
        expect(checkAlertCondition(1900.0, 'price_below', 1900)).toBe(false);
      });

      it('should handle small differences correctly', () => {
        expect(checkAlertCondition(1899.99, 'price_below', 1900)).toBe(true);
        expect(checkAlertCondition(1900.01, 'price_below', 1900)).toBe(false);
      });
    });

    describe('price_equals condition', () => {
      it('should return true when price equals target exactly', () => {
        expect(checkAlertCondition(1900.0, 'price_equals', 1900)).toBe(true);
      });

      it('should return true within 0.5% tolerance', () => {
        // 0.5% of 1900 = 9.5
        expect(checkAlertCondition(1905.0, 'price_equals', 1900)).toBe(true);
        expect(checkAlertCondition(1895.0, 'price_equals', 1900)).toBe(true);
      });

      it('should return false outside 0.5% tolerance', () => {
        // More than 9.5 away from 1900
        expect(checkAlertCondition(1915.0, 'price_equals', 1900)).toBe(false);
        expect(checkAlertCondition(1885.0, 'price_equals', 1900)).toBe(false);
      });

      it('should handle edge cases at tolerance boundary', () => {
        // Exactly at 0.5% boundary (9.5)
        expect(checkAlertCondition(1909.5, 'price_equals', 1900)).toBe(true);
        expect(checkAlertCondition(1890.5, 'price_equals', 1900)).toBe(true);
        // Just outside
        expect(checkAlertCondition(1909.51, 'price_equals', 1900)).toBe(false);
        expect(checkAlertCondition(1890.49, 'price_equals', 1900)).toBe(false);
      });
    });

    describe('unknown condition type', () => {
      it('should return false for unknown condition types', () => {
        expect(checkAlertCondition(1900, 'price_crosses', 1900)).toBe(false);
        expect(checkAlertCondition(1900, 'invalid', 1900)).toBe(false);
        expect(checkAlertCondition(1900, '', 1900)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle zero values', () => {
        expect(checkAlertCondition(0, 'price_above', 0)).toBe(false);
        expect(checkAlertCondition(0, 'price_below', 0)).toBe(false);
        expect(checkAlertCondition(0, 'price_equals', 0)).toBe(true);
      });

      it('should handle negative values', () => {
        expect(checkAlertCondition(-10, 'price_above', -20)).toBe(true);
        expect(checkAlertCondition(-30, 'price_below', -20)).toBe(true);
      });

      it('should handle very large numbers', () => {
        expect(checkAlertCondition(1000000, 'price_above', 999999)).toBe(true);
        expect(checkAlertCondition(999998, 'price_below', 999999)).toBe(true);
      });

      it('should handle decimal precision', () => {
        expect(checkAlertCondition(1.23456789, 'price_above', 1.23456788)).toBe(
          true
        );
        expect(checkAlertCondition(1.23456787, 'price_below', 1.23456788)).toBe(
          true
        );
      });
    });
  });

  describe('checkAlerts integration', () => {
    beforeEach(() => {
      mockAlertFindMany.mockReset();
      mockAlertUpdate.mockReset();
      mockFetch.mockReset();
    });

    it('should handle no active alerts gracefully', async () => {
      mockAlertFindMany.mockResolvedValue([]);

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      expect(mockAlertFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch price for each unique symbol', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: JSON.stringify({ type: 'price_above', targetValue: 1900 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
        {
          id: 'alert-2',
          userId: 'user-1',
          symbol: 'XAUUSD', // Same symbol - should only fetch once
          timeframe: 'H4',
          condition: JSON.stringify({ type: 'price_below', targetValue: 2000 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
        {
          id: 'alert-3',
          userId: 'user-2',
          symbol: 'EURUSD', // Different symbol
          timeframe: 'M15',
          condition: JSON.stringify({ type: 'price_above', targetValue: 1.08 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test2@example.com', name: 'Test 2' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ price: 1950 }),
      });

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      // Should have made 2 fetch calls (one for each unique symbol)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should trigger alert when condition is met', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: JSON.stringify({ type: 'price_above', targetValue: 1900 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ price: 1950 }), // Above target
      });
      mockAlertUpdate.mockResolvedValue({});

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      expect(mockAlertUpdate).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: {
          isActive: false,
          lastTriggered: expect.any(Date),
          triggerCount: { increment: 1 },
        },
      });
    });

    it('should not trigger alert when condition is not met', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: JSON.stringify({ type: 'price_above', targetValue: 2000 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ price: 1950 }), // Below target
      });

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      expect(mockAlertUpdate).not.toHaveBeenCalled();
    });

    it('should skip symbols when price fetch fails', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: JSON.stringify({ type: 'price_above', targetValue: 1900 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      expect(mockAlertUpdate).not.toHaveBeenCalled();
    });

    it('should skip alerts with invalid condition JSON', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: 'invalid json',
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ price: 1950 }),
      });

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');
      await checkAlerts();

      expect(mockAlertUpdate).not.toHaveBeenCalled();
    });

    it('should handle fetch network errors gracefully', async () => {
      const alerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: JSON.stringify({ type: 'price_above', targetValue: 1900 }),
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          user: { email: 'test@example.com', name: 'Test' },
        },
      ];

      mockAlertFindMany.mockResolvedValue(alerts);
      mockFetch.mockRejectedValue(new Error('Network error'));

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');

      // Should not throw
      await expect(checkAlerts()).resolves.not.toThrow();
      expect(mockAlertUpdate).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockAlertFindMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      jest.resetModules();
      const { checkAlerts } = await import('@/lib/jobs/alert-checker');

      // Should not throw
      await expect(checkAlerts()).resolves.not.toThrow();
    });
  });

  describe('runOnce', () => {
    it('should call checkAlerts once', async () => {
      mockAlertFindMany.mockResolvedValue([]);

      jest.resetModules();
      const { runOnce } = await import('@/lib/jobs/alert-checker');
      await runOnce();

      expect(mockAlertFindMany).toHaveBeenCalledTimes(1);
    });
  });
});
