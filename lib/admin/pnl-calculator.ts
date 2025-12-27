/**
 * Admin P&L Calculator
 *
 * Calculates profit and loss metrics for affiliate reports.
 * Uses the percentage-based commission model from constants.
 *
 * @module lib/admin/pnl-calculator
 */

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SalesData {
  regularPrice: number;
  netRevenue: number;
  commission: number;
}

export interface PnLReport {
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  totalCommissions: number;
  netProfit: number;
  margin: number;
  averageCommission: number;
  salesCount: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// P&L CALCULATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate P&L metrics from sales data
 *
 * Uses the percentage-based commission model:
 * - Regular price: $29.00
 * - Discount (20%): $5.80
 * - Net revenue: $23.20
 * - Commission (20% of net): $4.64
 *
 * @param sales - Array of sales data
 * @returns P&L report with all metrics
 */
export function calculatePnL(sales: SalesData[]): PnLReport {
  if (sales.length === 0) {
    return {
      grossRevenue: 0,
      discounts: 0,
      netRevenue: 0,
      totalCommissions: 0,
      netProfit: 0,
      margin: 0,
      averageCommission: 0,
      salesCount: 0,
    };
  }

  // Sum up all values
  const grossRevenue = sales.reduce((sum, s) => sum + s.regularPrice, 0);
  const netRevenue = sales.reduce((sum, s) => sum + s.netRevenue, 0);
  const totalCommissions = sales.reduce((sum, s) => sum + s.commission, 0);
  const discounts = grossRevenue - netRevenue;

  // Calculate derived metrics
  const netProfit = netRevenue - totalCommissions;
  const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const averageCommission =
    sales.length > 0 ? totalCommissions / sales.length : 0;

  return {
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    margin: Math.round(margin * 10) / 10,
    averageCommission: Math.round(averageCommission * 100) / 100,
    salesCount: sales.length,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calculate standard sales data from base price
 *
 * @param regularPrice - Base subscription price
 * @returns Sales data with standard discount and commission
 */
export function calculateStandardSale(
  regularPrice: number = AFFILIATE_CONFIG.BASE_PRICE_USD
): SalesData {
  const discountPercent = AFFILIATE_CONFIG.DISCOUNT_PERCENT;
  const commissionPercent = AFFILIATE_CONFIG.COMMISSION_PERCENT;

  const discount = (regularPrice * discountPercent) / 100;
  const netRevenue = regularPrice - discount;
  const commission = (netRevenue * commissionPercent) / 100;

  return {
    regularPrice,
    netRevenue,
    commission,
  };
}

/**
 * Get date range for reporting periods
 *
 * @param period - Period type (3months, 6months, 1year)
 * @returns Start and end dates
 */
export function getReportingPeriod(period: '3months' | '6months' | '1year'): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case '3months':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6months':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start, end };
}
