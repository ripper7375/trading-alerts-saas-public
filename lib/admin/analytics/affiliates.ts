/**
 * BI Dashboard 4 -- Affiliate Partner Network & Privacy-Preserving
 * Leaderboard. Metrics #20 (partner count + MoM), #21 (MoM growth %),
 * #22 (country contribution), #23 (tier ratio), #24 (avg monthly
 * commission), #25 (Top 20 leaderboard, PII-redacted).
 *
 * `AffiliateProfile` carries no `user` relation object (schema's
 * "relation only where used" convention, same as `sales-performance
 * /route.ts`) -- tiers are batch-fetched by userId, not joined.
 * `AffiliateProfile.country` is a clean, Zod-validated 2-letter ISO code
 * (see lib/affiliate/validators.ts), so jurisdiction resolution here is
 * plain JS (`resolveJurisdictionIso`), not raw SQL -- unlike regional.ts's
 * free-text `UserSession.country`.
 *
 * @module lib/admin/analytics/affiliates
 */

import { createHash } from 'crypto';

import { unstable_cache } from 'next/cache';

import { prisma } from '@/lib/db/prisma';
import { getReportingPeriod } from '@/lib/admin/pnl-calculator';
import {
  JURISDICTIONS,
  OTHERS_ISO,
  OTHERS_NAME,
  resolveJurisdictionIso,
} from './jurisdictions';
import { growthPct, round2 } from './date-windows';

export type AffiliateReportPeriod = '3months' | '6months' | '1year';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AffiliatesAnalyticsResponse {
  summary: {
    totalAffiliates: number;
    prevMonthAffiliates: number | null;
    momGrowthPct: number | null;
    affiliateFreeCount: number;
    affiliateProCount: number;
    tierRatio: string;
    freePercentage: number;
    proPercentage: number;
    avgMonthlyCommission: number;
    totalCommissionsPaidUsd: number;
  };
  geographicDistribution: Array<{
    countryName: string;
    isoCode: string;
    totalAffiliates: number;
    sharePct: number;
    affiliateFree: number;
    affiliatePro: number;
    tierRatio: string;
    totalCommissionsUsd: number;
  }>;
  top20Leaderboard: Array<{
    rank: number;
    anonymizedPartnerId: string;
    country: string;
    countryIso: string;
    saasTier: 'FREE' | 'PRO';
    activeCode: string;
    codesUsed: number;
    subscribersReferred: number;
    grossSalesUsd: number;
    commissionEarnedUsd: number;
    payoutStatus: 'APPROVED' | 'PAID' | 'PENDING';
  }>;
}

function tierRatioString(freeCount: number, proCount: number): string {
  if (proCount === 0) return freeCount > 0 ? `${freeCount} : 0` : '0 : 0';
  const ratio = freeCount / proCount;
  return `${round2(ratio)} : 1`;
}

/** Deterministic, non-reversible 4-digit suffix for a masked partner ID. */
function hash4(profileId: string): string {
  const digest = createHash('sha256').update(profileId).digest('hex');
  const num = parseInt(digest.slice(0, 8), 16) % 10000;
  return String(num).padStart(4, '0');
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUERY
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchAffiliatesAnalytics(
  period: AffiliateReportPeriod = '3months'
): Promise<AffiliatesAnalyticsResponse> {
  const { start, end } = getReportingPeriod(period);
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);

  const [profiles, activeCodes, periodCommissions, monthCommissions] =
    await Promise.all([
      prisma.affiliateProfile.findMany({
        select: {
          id: true,
          userId: true,
          country: true,
          createdAt: true,
          totalCodesUsed: true,
          totalEarnings: true,
        },
      }),
      prisma.affiliateCode.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { distributedAt: 'desc' },
        select: { affiliateProfileId: true, code: true },
      }),
      prisma.commission.findMany({
        where: { earnedAt: { gte: start, lte: end } },
        select: {
          affiliateProfileId: true,
          commissionAmount: true,
          grossRevenue: true,
          status: true,
        },
      }),
      prisma.commission.findMany({
        where: {
          earnedAt: { gte: currentMonthStart },
          status: { not: 'CANCELLED' },
        },
        select: { affiliateProfileId: true, commissionAmount: true },
      }),
    ]);

  // AffiliateProfile carries no `user` relation -- batch-fetch tiers.
  const users = await prisma.user.findMany({
    where: { id: { in: profiles.map((p) => p.userId) } },
    select: { id: true, tier: true },
  });
  const tierByUserId = new Map(users.map((u) => [u.id, u.tier]));

  // Most-recently-distributed ACTIVE code per affiliate (first hit wins --
  // `activeCodes` is already ordered by distributedAt desc).
  const activeCodeByProfileId = new Map<string, string>();
  for (const code of activeCodes) {
    if (!activeCodeByProfileId.has(code.affiliateProfileId)) {
      activeCodeByProfileId.set(code.affiliateProfileId, code.code);
    }
  }

  // Period-scoped commission aggregates per affiliate (for the leaderboard).
  const periodStatsByProfileId = new Map<
    string,
    {
      grossSales: number;
      commissionEarned: number;
      subscribersReferred: number;
      hasPending: boolean;
      hasApproved: boolean;
    }
  >();
  for (const c of periodCommissions) {
    const existing = periodStatsByProfileId.get(c.affiliateProfileId) ?? {
      grossSales: 0,
      commissionEarned: 0,
      subscribersReferred: 0,
      hasPending: false,
      hasApproved: false,
    };
    if (c.status !== 'CANCELLED') {
      existing.grossSales += Number(c.grossRevenue);
      existing.commissionEarned += Number(c.commissionAmount);
      existing.subscribersReferred += 1;
    }
    if (c.status === 'PENDING') existing.hasPending = true;
    if (c.status === 'APPROVED') existing.hasApproved = true;
    periodStatsByProfileId.set(c.affiliateProfileId, existing);
  }

  // Current-calendar-month commission totals (Metric #24).
  const monthCommissionByProfileId = new Map<string, number>();
  for (const c of monthCommissions) {
    monthCommissionByProfileId.set(
      c.affiliateProfileId,
      (monthCommissionByProfileId.get(c.affiliateProfileId) ?? 0) +
        Number(c.commissionAmount)
    );
  }
  const totalCommissionsPaidThisMonth = [
    ...monthCommissionByProfileId.values(),
  ].reduce((sum, v) => sum + v, 0);
  const activeEarningAffiliatesThisMonth = monthCommissionByProfileId.size;
  const avgMonthlyCommission =
    activeEarningAffiliatesThisMonth > 0
      ? round2(totalCommissionsPaidThisMonth / activeEarningAffiliatesThisMonth)
      : 0;

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Summary (Metrics #20, #21, #23, #24)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const totalAffiliates = profiles.length;
  const prevMonthAffiliates = profiles.filter(
    (p) => p.createdAt < currentMonthStart
  ).length;
  const affiliateFreeCount = profiles.filter(
    (p) => tierByUserId.get(p.userId) === 'FREE'
  ).length;
  const affiliateProCount = profiles.filter(
    (p) => tierByUserId.get(p.userId) === 'PRO'
  ).length;
  const totalCommissionsPaidUsd = round2(
    profiles.reduce((sum, p) => sum + Number(p.totalEarnings), 0)
  );

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Geographic distribution (Metrics #22, #23 per country)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  type GeoBucket = {
    total: number;
    free: number;
    pro: number;
    commissionsUsd: number;
  };
  const geoBuckets = new Map<string, GeoBucket>();
  for (const p of profiles) {
    const iso = resolveJurisdictionIso(p.country);
    const bucket = geoBuckets.get(iso) ?? {
      total: 0,
      free: 0,
      pro: 0,
      commissionsUsd: 0,
    };
    bucket.total += 1;
    if (tierByUserId.get(p.userId) === 'FREE') bucket.free += 1;
    if (tierByUserId.get(p.userId) === 'PRO') bucket.pro += 1;
    bucket.commissionsUsd += Number(p.totalEarnings);
    geoBuckets.set(iso, bucket);
  }

  const geoIsoCodes = [...JURISDICTIONS.map((j) => j.iso), OTHERS_ISO];
  const geographicDistribution = geoIsoCodes
    .map((iso) => {
      const jurisdiction = JURISDICTIONS.find((j) => j.iso === iso);
      const bucket = geoBuckets.get(iso) ?? {
        total: 0,
        free: 0,
        pro: 0,
        commissionsUsd: 0,
      };
      return {
        countryName: jurisdiction?.name ?? OTHERS_NAME,
        isoCode: iso,
        totalAffiliates: bucket.total,
        sharePct:
          totalAffiliates > 0
            ? round2((bucket.total / totalAffiliates) * 100)
            : 0,
        affiliateFree: bucket.free,
        affiliatePro: bucket.pro,
        tierRatio: tierRatioString(bucket.free, bucket.pro),
        totalCommissionsUsd: round2(bucket.commissionsUsd),
      };
    })
    .filter((row) => row.totalAffiliates > 0)
    .sort((a, b) => b.totalAffiliates - a.totalAffiliates);

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Top 20 privacy-preserving leaderboard (Metric #25)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const top20Leaderboard = profiles
    .map((p) => {
      const iso = resolveJurisdictionIso(p.country);
      const jurisdiction = JURISDICTIONS.find((j) => j.iso === iso);
      const periodStats = periodStatsByProfileId.get(p.id);
      const payoutStatus: 'APPROVED' | 'PAID' | 'PENDING' =
        periodStats?.hasPending
          ? 'PENDING'
          : periodStats?.hasApproved
            ? 'APPROVED'
            : 'PAID';

      return {
        anonymizedPartnerId: `Partner #${iso}-${hash4(p.id)}`,
        country: jurisdiction?.name ?? OTHERS_NAME,
        countryIso: iso,
        saasTier: (tierByUserId.get(p.userId) ?? 'FREE') as 'FREE' | 'PRO',
        activeCode: activeCodeByProfileId.get(p.id) ?? '-',
        codesUsed: p.totalCodesUsed,
        subscribersReferred: periodStats?.subscribersReferred ?? 0,
        grossSalesUsd: round2(periodStats?.grossSales ?? 0),
        commissionEarnedUsd: round2(periodStats?.commissionEarned ?? 0),
        payoutStatus,
      };
    })
    .filter((row) => row.commissionEarnedUsd > 0)
    .sort((a, b) => b.commissionEarnedUsd - a.commissionEarnedUsd)
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  return {
    summary: {
      totalAffiliates,
      prevMonthAffiliates,
      momGrowthPct: growthPct(totalAffiliates, prevMonthAffiliates),
      affiliateFreeCount,
      affiliateProCount,
      tierRatio: tierRatioString(affiliateFreeCount, affiliateProCount),
      freePercentage:
        totalAffiliates > 0
          ? round2((affiliateFreeCount / totalAffiliates) * 100)
          : 0,
      proPercentage:
        totalAffiliates > 0
          ? round2((affiliateProCount / totalAffiliates) * 100)
          : 0,
      avgMonthlyCommission,
      totalCommissionsPaidUsd,
    },
    geographicDistribution,
    top20Leaderboard,
  };
}

/**
 * Cached BI affiliates analytics getter -- shared by the API route and the
 * Server Component dashboard page.
 */
export const getAffiliatesAnalytics = unstable_cache(
  fetchAffiliatesAnalytics,
  ['admin-analytics-affiliates'],
  { revalidate: 300, tags: ['admin-analytics-affiliates'] }
);
