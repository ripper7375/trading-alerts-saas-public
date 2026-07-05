/**
 * Alert Checker Job Tests
 *
 * Tests for the background job that checks alert conditions.
 *
 * Note: Integration tests removed after Part 20 migration.
 * Implementation now uses Flask MT5 service instead of PostgreSQL — except
 * for XAUUSD, which now also tries the v6 Railway Gateway pipeline's
 * market_data_v6 table first (see the "XAUUSD price source" suite below).
 */

import { checkAlertCondition, checkAlerts } from '@/lib/jobs/alert-checker';
import { prisma } from '@/lib/db/prisma';

describe('Alert Checker Job', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    describe('XAUUSD price source (v6 Gateway pipeline)', () => {
      const mockAlert = {
        id: 'alert-1',
        userId: 'user-1',
        symbol: 'XAUUSD',
        timeframe: 'M5',
        condition: JSON.stringify({ type: 'price_above', targetValue: 1900 }),
        isActive: true,
        lastTriggered: null,
        triggerCount: 0,
        user: { email: 'a@b.com', name: 'Test' },
      };

      let fetchSpy: jest.SpyInstance;

      beforeEach(() => {
        fetchSpy = jest.spyOn(global, 'fetch');
        (prisma.alert.findMany as jest.Mock).mockResolvedValue([mockAlert]);
        (prisma.alert.update as jest.Mock).mockResolvedValue({});
      });

      afterEach(() => {
        fetchSpy.mockRestore();
      });

      it('uses market_data_v6 and never calls Flask when a synced row exists', async () => {
        (prisma.marketDataV6.findFirst as jest.Mock).mockResolvedValue({
          close: 1950.5,
        });

        await checkAlerts();

        expect(prisma.marketDataV6.findFirst).toHaveBeenCalledWith({
          where: { symbol: 'XAUUSD', timeframe: 'M5' },
          orderBy: { timestamp: 'desc' },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(prisma.alert.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'alert-1' } })
        );
      });

      it('falls back to Flask when market_data_v6 has no synced row yet', async () => {
        (prisma.marketDataV6.findFirst as jest.Mock).mockResolvedValue(null);
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ price: 1950.5 }),
        } as Response);

        await checkAlerts();

        expect(prisma.marketDataV6.findFirst).toHaveBeenCalled();
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/mt5/price?symbol=XAUUSD'),
          expect.any(Object)
        );
      });

      it('falls back to Flask when market_data_v6 query throws', async () => {
        (prisma.marketDataV6.findFirst as jest.Mock).mockRejectedValue(
          new Error('db unreachable')
        );
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ price: 1950.5 }),
        } as Response);

        await checkAlerts();

        expect(fetchSpy).toHaveBeenCalled();
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

});
