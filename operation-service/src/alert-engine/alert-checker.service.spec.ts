/**
 * Alert Checker Job Tests
 *
 * Ported from __tests__/lib/jobs/alert-checker.test.ts (Session 4B-2, File
 * 9/13) — assertions unchanged. Restructured from the source's
 * jest.mock('@/lib/db/prisma')/jest.mock('@/lib/db/market-prisma') module
 * singleton mocking to DI-based construction (new AlertCheckerService(mock))
 * — operation-service's port is @Injectable() with a single unified
 * PrismaService (both alert and marketDataV6 live on it, unlike the
 * monolith's separate prisma/marketPrisma clients), same pattern as File
 * 7's dispatcher.service.spec.ts. checkAlertCondition stays a plain
 * exported function (pure, no DI needed), matching source exactly.
 */

import {
  AlertCheckerService,
  checkAlertCondition,
} from './alert-checker.service';

describe('Alert Checker Job', () => {
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
      };

      let fetchSpy: jest.SpyInstance;
      let findMany: jest.Mock;
      let update: jest.Mock;
      let marketDataFindFirst: jest.Mock;
      let service: AlertCheckerService;

      beforeEach(() => {
        fetchSpy = jest.spyOn(global, 'fetch');
        findMany = jest.fn().mockResolvedValue([mockAlert]);
        update = jest.fn().mockResolvedValue({});
        marketDataFindFirst = jest.fn();
        const prisma = {
          alert: { findMany, update },
          marketDataV6: { findFirst: marketDataFindFirst },
        } as unknown as ConstructorParameters<typeof AlertCheckerService>[0];
        service = new AlertCheckerService(prisma);
      });

      afterEach(() => {
        fetchSpy.mockRestore();
      });

      it('uses market_data_v6 and never calls Flask when a synced row exists', async () => {
        marketDataFindFirst.mockResolvedValue({ close: 1950.5 });

        await service.checkAlerts();

        expect(marketDataFindFirst).toHaveBeenCalledWith({
          where: { symbol: 'XAUUSD', timeframe: 'M5' },
          orderBy: { timestamp: 'desc' },
        });
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'alert-1' } })
        );
      });

      it('falls back to Flask when market_data_v6 has no synced row yet', async () => {
        marketDataFindFirst.mockResolvedValue(null);
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ohlcv: [{ close: 1949.0 }, { close: 1950.5 }] },
            }),
        } as Response);

        await service.checkAlerts();

        expect(marketDataFindFirst).toHaveBeenCalled();
        // Real Flask route: /api/indicators/{symbol}/{timeframe} (there is no
        // /api/mt5/price endpoint in mt5-service — 2026-07-05 audit fix).
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/indicators/XAUUSD/M5'),
          expect.objectContaining({
            headers: expect.objectContaining({ 'X-User-Tier': 'PRO' }),
          })
        );
        // Latest bar's close is used as the current price.
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'alert-1' } })
        );
      });

      it('falls back to Flask when market_data_v6 query throws', async () => {
        marketDataFindFirst.mockRejectedValue(new Error('db unreachable'));
        fetchSpy.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ohlcv: [{ close: 1950.5 }] },
            }),
        } as Response);

        await service.checkAlerts();

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
