/**
 * Admin P&L Calculator Tests (Session 4A-6, File 2/3)
 *
 * calculatePnL assertions ported unchanged from
 * __tests__/lib/admin/pnl-calculator.test.ts. calculateStandardSale and
 * getReportingPeriod are NEW backfill coverage — the source test file
 * only ever tested calculatePnL, confirmed at CONFIRM (same
 * zero-coverage-backfill precedent as Session 4A-4).
 */
import {
  calculatePnL,
  calculateStandardSale,
  getReportingPeriod,
  type SalesData,
} from './pnl-calculator';

describe('Admin P&L Calculator', () => {
  describe('calculatePnL', () => {
    it('should calculate P&L with percentage-based commission', () => {
      // Using the configured percentages:
      // Regular price: $29.00
      // Discount (20%): $5.80
      // Net revenue: $23.20
      // Commission (20% of net): $4.64
      const sales: SalesData[] = [
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      ];

      const result = calculatePnL(sales);

      expect(result.grossRevenue).toBe(87.0);
      expect(result.discounts).toBe(17.4); // 3 * 5.80
      expect(result.netRevenue).toBe(69.6); // 3 * 23.20
      expect(result.totalCommissions).toBe(13.92); // 3 * 4.64
      expect(result.netProfit).toBe(55.68); // 69.60 - 13.92
      expect(result.margin).toBeCloseTo(80.0, 1); // (55.68 / 69.60) * 100
    });

    it('should handle different discount percentages', () => {
      const regularPrice = 29.0;
      const discountPercent = 15.0;
      const discount = (regularPrice * discountPercent) / 100;
      const netRevenue = regularPrice - discount;
      const commission = (netRevenue * 20.0) / 100;

      const sales: SalesData[] = [{ regularPrice, netRevenue, commission }];

      const result = calculatePnL(sales);

      expect(result.grossRevenue).toBe(29.0);
      expect(result.discounts).toBeCloseTo(4.35, 2);
      expect(result.netRevenue).toBeCloseTo(24.65, 2);
      expect(result.totalCommissions).toBeCloseTo(4.93, 2);
    });

    it('should handle zero sales', () => {
      const result = calculatePnL([]);

      expect(result.grossRevenue).toBe(0);
      expect(result.discounts).toBe(0);
      expect(result.netRevenue).toBe(0);
      expect(result.totalCommissions).toBe(0);
      expect(result.netProfit).toBe(0);
      expect(result.margin).toBe(0);
    });

    it('should calculate average commission correctly', () => {
      const sales: SalesData[] = [
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      ];

      const result = calculatePnL(sales);

      expect(result.averageCommission).toBe(4.64);
      expect(result.salesCount).toBe(2);
    });

    it('should calculate correct margin percentage', () => {
      const sales: SalesData[] = [
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      ];

      const result = calculatePnL(sales);

      // Margin = (netRevenue - commissions) / netRevenue * 100
      // = (23.20 - 4.64) / 23.20 * 100
      // = 18.56 / 23.20 * 100
      // = 80%
      expect(result.margin).toBeCloseTo(80.0, 1);
    });

    it('should handle single sale', () => {
      const sales: SalesData[] = [
        { regularPrice: 29.0, netRevenue: 23.2, commission: 4.64 },
      ];

      const result = calculatePnL(sales);

      expect(result.grossRevenue).toBe(29.0);
      expect(result.netRevenue).toBe(23.2);
      expect(result.netProfit).toBeCloseTo(18.56, 2);
      expect(result.salesCount).toBe(1);
    });

    it('should handle high volume sales', () => {
      // 100 sales at standard rate
      const sales: SalesData[] = Array(100).fill({
        regularPrice: 29.0,
        netRevenue: 23.2,
        commission: 4.64,
      });

      const result = calculatePnL(sales);

      expect(result.grossRevenue).toBe(2900.0);
      expect(result.netRevenue).toBe(2320.0);
      expect(result.totalCommissions).toBe(464.0);
      expect(result.netProfit).toBe(1856.0);
      expect(result.salesCount).toBe(100);
    });
  });

  describe('calculateStandardSale', () => {
    it('derives net revenue and commission from AFFILIATE_CONFIG defaults', () => {
      const result = calculateStandardSale();

      expect(result.regularPrice).toBe(29.0);
      expect(result.netRevenue).toBeCloseTo(23.2, 2); // 29 - 20% discount
      expect(result.commission).toBeCloseTo(4.64, 2); // 23.20 * 20%
    });

    it('accepts a custom regular price and scales discount/commission accordingly', () => {
      const result = calculateStandardSale(100);

      expect(result.regularPrice).toBe(100);
      expect(result.netRevenue).toBeCloseTo(80, 2); // 100 - 20%
      expect(result.commission).toBeCloseTo(16, 2); // 80 * 20%
    });
  });

  describe('getReportingPeriod', () => {
    it('3months returns a start date 3 months before now', () => {
      const { start, end } = getReportingPeriod('3months');
      const expectedStart = new Date();
      expectedStart.setMonth(expectedStart.getMonth() - 3);

      expect(start.getMonth()).toBe(expectedStart.getMonth());
      expect(start.getFullYear()).toBe(expectedStart.getFullYear());
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });

    it('6months returns a start date 6 months before now', () => {
      const { start } = getReportingPeriod('6months');
      const expectedStart = new Date();
      expectedStart.setMonth(expectedStart.getMonth() - 6);

      expect(start.getMonth()).toBe(expectedStart.getMonth());
      expect(start.getFullYear()).toBe(expectedStart.getFullYear());
    });

    it('1year returns a start date 1 year before now', () => {
      const { start } = getReportingPeriod('1year');
      const expectedStart = new Date();
      expectedStart.setFullYear(expectedStart.getFullYear() - 1);

      expect(start.getFullYear()).toBe(expectedStart.getFullYear());
      expect(start.getMonth()).toBe(expectedStart.getMonth());
    });

    it('end always resolves to (approximately) now', () => {
      const before = Date.now();
      const { end } = getReportingPeriod('3months');
      const after = Date.now();

      expect(end.getTime()).toBeGreaterThanOrEqual(before);
      expect(end.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
