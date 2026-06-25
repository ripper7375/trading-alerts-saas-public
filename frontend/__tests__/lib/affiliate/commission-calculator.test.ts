/**
 * Unit Tests: Commission Calculator
 *
 * Tests percentage-based commission calculations for affiliate system.
 * Uses TDD approach: These tests are written FIRST (RED phase).
 *
 * COMMISSION MODEL:
 * - 20% discount for customers ($29.00 → $23.20)
 * - 20% commission on net revenue ($23.20 × 20% = $4.64)
 *
 * @module __tests__/lib/affiliate/commission-calculator.test
 */

import { describe, it, expect } from '@jest/globals';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

// Import will fail initially (RED phase) - this is expected!
import {
  calculateCommission,
  calculateDiscount,
  calculateNetRevenue,
  calculateFullBreakdown,
} from '@/lib/affiliate/commission-calculator';

describe('Commission Calculator', () => {
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // calculateDiscount
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('calculateDiscount', () => {
    it('should calculate 20% discount on $29.00', () => {
      const grossAmount = 29.0;
      const discount = calculateDiscount(grossAmount);

      // 20% of $29.00 = $5.80
      expect(discount).toBe(5.8);
    });

    it('should calculate discount using AFFILIATE_CONFIG percentage', () => {
      const grossAmount = 100.0;
      const discount = calculateDiscount(grossAmount);
      const expected = (grossAmount * AFFILIATE_CONFIG.DISCOUNT_PERCENT) / 100;

      expect(discount).toBe(expected);
    });

    it('should return 0 for zero amount', () => {
      expect(calculateDiscount(0)).toBe(0);
    });

    it('should handle custom discount percentage', () => {
      const grossAmount = 100.0;
      const customDiscountPercent = 15.0;
      const discount = calculateDiscount(grossAmount, customDiscountPercent);

      expect(discount).toBe(15.0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // calculateNetRevenue
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('calculateNetRevenue', () => {
    it('should calculate net revenue after discount', () => {
      const grossAmount = 29.0;
      const netRevenue = calculateNetRevenue(grossAmount);

      // $29.00 - 20% = $23.20
      expect(netRevenue).toBe(23.2);
    });

    it('should use AFFILIATE_CONFIG discount percentage', () => {
      const grossAmount = 100.0;
      const netRevenue = calculateNetRevenue(grossAmount);
      const expected =
        grossAmount * (1 - AFFILIATE_CONFIG.DISCOUNT_PERCENT / 100);

      expect(netRevenue).toBe(expected);
    });

    it('should return 0 for zero amount', () => {
      expect(calculateNetRevenue(0)).toBe(0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // calculateCommission
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('calculateCommission', () => {
    it('should calculate 20% commission on net revenue', () => {
      const netRevenue = 23.2; // After 20% discount from $29.00
      const commission = calculateCommission(netRevenue);

      // 20% of $23.20 = $4.64
      expect(commission).toBe(4.64);
    });

    it('should handle different net revenues correctly', () => {
      expect(calculateCommission(100.0)).toBe(20.0);
      expect(calculateCommission(50.0)).toBe(10.0);
      expect(calculateCommission(23.2)).toBe(4.64);
    });

    it('should use AFFILIATE_CONFIG commission percentage', () => {
      const netRevenue = 100.0;
      const commission = calculateCommission(netRevenue);
      const expected = (netRevenue * AFFILIATE_CONFIG.COMMISSION_PERCENT) / 100;

      expect(commission).toBe(expected);
    });

    it('should handle zero revenue', () => {
      expect(calculateCommission(0)).toBe(0);
    });

    it('should handle custom commission percentage', () => {
      const netRevenue = 100.0;
      const customCommissionPercent = 25.0;
      const commission = calculateCommission(
        netRevenue,
        customCommissionPercent
      );

      expect(commission).toBe(25.0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // calculateFullBreakdown
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('calculateFullBreakdown', () => {
    it('should return complete commission breakdown for $29.00', () => {
      const breakdown = calculateFullBreakdown(29.0);

      expect(breakdown).toEqual({
        grossRevenue: 29.0,
        discountPercent: AFFILIATE_CONFIG.DISCOUNT_PERCENT,
        discountAmount: 5.8,
        netRevenue: 23.2,
        commissionPercent: AFFILIATE_CONFIG.COMMISSION_PERCENT,
        commissionAmount: 4.64,
        companyRevenue: 18.56,
      });
    });

    it('should return complete breakdown for $100.00', () => {
      const breakdown = calculateFullBreakdown(100.0);

      expect(breakdown).toEqual({
        grossRevenue: 100.0,
        discountPercent: 20.0,
        discountAmount: 20.0,
        netRevenue: 80.0,
        commissionPercent: 20.0,
        commissionAmount: 16.0,
        companyRevenue: 64.0,
      });
    });

    it('should handle custom percentages', () => {
      const breakdown = calculateFullBreakdown(100.0, 10.0, 30.0);

      expect(breakdown).toEqual({
        grossRevenue: 100.0,
        discountPercent: 10.0,
        discountAmount: 10.0,
        netRevenue: 90.0,
        commissionPercent: 30.0,
        commissionAmount: 27.0,
        companyRevenue: 63.0,
      });
    });

    it('should ensure all values sum correctly', () => {
      const breakdown = calculateFullBreakdown(29.0);

      // Discount + netRevenue = grossRevenue
      expect(breakdown.discountAmount + breakdown.netRevenue).toBeCloseTo(
        breakdown.grossRevenue,
        2
      );

      // Commission + companyRevenue = netRevenue
      expect(breakdown.commissionAmount + breakdown.companyRevenue).toBeCloseTo(
        breakdown.netRevenue,
        2
      );
    });
  });
});
