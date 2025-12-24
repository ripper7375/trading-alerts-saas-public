/**
 * Admin P&L Report API Route
 *
 * GET: Generate profit and loss report for affiliate program
 *
 * @module app/api/admin/affiliates/reports/profit-loss/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { prisma } from '@/lib/db/prisma';
import { getAffiliateConfigFromDB } from '@/lib/affiliate/constants';
import { getReportingPeriod } from '@/lib/admin/pnl-calculator';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION SCHEMAS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const querySchema = z.object({
  period: z.enum(['3months', '6months', '1year']).default('3months'),
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET - P&L Report
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/admin/affiliates/reports/profit-loss
 *
 * Generate profit and loss report showing:
 * - Gross revenue
 * - Discounts given
 * - Net revenue
 * - Commissions (paid + pending)
 * - Net profit
 * - Profit margin
 *
 * Query params:
 * - period: 3months | 6months | 1year (default: 3months)
 *
 * @returns 200 - P&L report
 * @returns 401 - Unauthorized
 * @returns 403 - Forbidden (not admin)
 * @returns 500 - Server error
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdmin();

    // Parse query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { period } = validation.data;
    const { start, end } = getReportingPeriod(period as '3months' | '6months' | '1year');

    // Fetch dynamic config from SystemConfig
    const affiliateConfig = await getAffiliateConfigFromDB();

    // Get commissions for the period
    const commissions = await prisma.commission.findMany({
      where: {
        earnedAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        grossRevenue: true,
        discountAmount: true,
        netRevenue: true,
        commissionAmount: true,
        status: true,
      },
    });

    // Calculate totals using dynamic config
    const totalSales = commissions.length;
    const regularPrice = affiliateConfig.basePriceUsd;
    const discountPercent = affiliateConfig.discountPercent;
    const commissionPercent = affiliateConfig.commissionPercent;

    // Sum financials
    const grossRevenue = commissions.reduce(
      (sum: number, c) => sum + Number(c.grossRevenue),
      0
    );
    const totalDiscounts = commissions.reduce(
      (sum: number, c) => sum + Number(c.discountAmount),
      0
    );
    const netRevenue = commissions.reduce(
      (sum: number, c) => sum + Number(c.netRevenue),
      0
    );

    // Commission breakdown by status
    const paidCommissions = commissions
      .filter((c) => c['status'] === 'PAID')
      .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
    const pendingCommissions = commissions
      .filter((c) => c['status'] === 'PENDING')
      .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
    const approvedCommissions = commissions
      .filter((c) => c['status'] === 'APPROVED')
      .reduce((sum: number, c) => sum + Number(c.commissionAmount), 0);
    const totalCommissions = paidCommissions + pendingCommissions + approvedCommissions;

    // Calculate profit metrics
    const netProfit = netRevenue - totalCommissions;
    const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    const averageCommission = totalSales > 0 ? totalCommissions / totalSales : 0;

    return NextResponse.json({
      period: {
        start,
        end,
        name: period,
      },
      revenue: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        discounts: Math.round(totalDiscounts * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        discountPercent,
        averageTicket: totalSales > 0 ? Math.round((netRevenue / totalSales) * 100) / 100 : 0,
      },
      costs: {
        paidCommissions: Math.round(paidCommissions * 100) / 100,
        pendingCommissions: Math.round(pendingCommissions * 100) / 100,
        approvedCommissions: Math.round(approvedCommissions * 100) / 100,
        totalCommissions: Math.round(totalCommissions * 100) / 100,
        commissionPercent,
        averageCommission: Math.round(averageCommission * 100) / 100,
      },
      profit: {
        netProfit: Math.round(netProfit * 100) / 100,
        margin: Math.round(profitMargin * 10) / 10,
      },
      volume: {
        totalSales,
        regularPrice,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error('Admin P&L report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate P&L report' },
      { status: 500 }
    );
  }
}
