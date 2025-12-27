/**
 * Unit Tests: Admin P&L Calculator
 *
 * Tests profit and loss calculation for affiliate reports.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * @module __tests__/lib/admin/pnl-calculator.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { prismaMock, testFactories } from '../../setup';
import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

// Import will fail initially (RED phase) - this is expected!
import {
  calculatePnL,
  type PnLReport,
  type SalesData,
} from '@/lib/admin/pnl-calculator';

describe('Admin P&L Calculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // calculatePnL
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
});
