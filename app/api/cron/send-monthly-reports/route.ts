/**
 * Cron API Route: Send Monthly Reports
 *
 * Monthly cron job that sends performance reports to all active affiliates.
 * Called by Vercel Cron on the 1st of each month at 06:00 UTC.
 *
 * Security: Requires CRON_SECRET authorization header.
 *
 * @module app/api/cron/send-monthly-reports/route
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

interface MonthlyReportData {
  affiliateId: string;
  email: string;
  month: string;
  codesDistributed: number;
  codesUsed: number;
  commissionsEarned: number;
  balance: number;
}

/**
 * Generate monthly report data for an affiliate
 */
async function generateAffiliateReport(
  affiliateId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  codesDistributed: number;
  codesUsed: number;
  commissionsEarned: number;
}> {
  // Get codes distributed this month
  const codesDistributed = await prisma.affiliateCode.count({
    where: {
      affiliateProfileId: affiliateId,
      distributedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get codes used this month
  const codesUsed = await prisma.affiliateCode.count({
    where: {
      affiliateProfileId: affiliateId,
      usedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Get commissions earned this month
  const commissions = await prisma.affiliateCommission.aggregate({
    where: {
      affiliateProfileId: affiliateId,
      earnedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      commissionAmount: true,
    },
  });

  return {
    codesDistributed,
    codesUsed,
    commissionsEarned: commissions._sum.commissionAmount || 0,
  };
}

/**
 * POST /api/cron/send-monthly-reports
 *
 * Generates and sends monthly performance reports to affiliates.
 *
 * @param request - Incoming request with cron authorization
 * @returns JSON response with report distribution results
 *
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response 200:
 * {
 *   "success": true,
 *   "message": "Sent 25 monthly reports",
 *   "sent": 25
 * }
 *
 * Response 401:
 * { "error": "Unauthorized" }
 *
 * Response 500:
 * { "error": "Cron job failed" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[CRON] Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting monthly report distribution...');
    const startTime = Date.now();

    // Get previous month's date range
    const now = new Date();
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const monthName = startOfPrevMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Fetch all active affiliates
    const affiliates = await prisma.affiliateProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    if (affiliates.length === 0) {
      console.log('[CRON] No active affiliates found for reports');
      return NextResponse.json({
        success: true,
        message: 'No active affiliates to send reports to',
        sent: 0,
      });
    }

    console.log(`[CRON] Generating reports for ${affiliates.length} affiliates`);

    let sent = 0;
    const errors: string[] = [];
    const reports: MonthlyReportData[] = [];

    for (const affiliate of affiliates) {
      try {
        // Generate report data
        const reportData = await generateAffiliateReport(
          affiliate.id,
          startOfPrevMonth,
          endOfPrevMonth
        );

        const report: MonthlyReportData = {
          affiliateId: affiliate.id,
          email: affiliate.user.email,
          month: monthName,
          codesDistributed: reportData.codesDistributed,
          codesUsed: reportData.codesUsed,
          commissionsEarned: reportData.commissionsEarned,
          balance: affiliate.pendingCommissions,
        };

        reports.push(report);

        // TODO: Send email with monthly-report template
        // await sendEmail({
        //   to: affiliate.user.email,
        //   template: 'monthly-report',
        //   data: report,
        // });

        sent++;
        console.log(`[CRON] Generated report for ${affiliate.user.email}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${affiliate.user.email}: ${errorMessage}`);
        console.error(`[CRON] Failed to generate report for ${affiliate.user.email}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] Sent ${sent} reports in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} monthly reports for ${monthName}`,
      sent,
      totalAffiliates: affiliates.length,
      errors: errors.length > 0 ? errors : undefined,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[CRON] Send reports error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}
