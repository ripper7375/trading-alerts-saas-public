/**
 * Monthly recurring revenue, weighted by each PRO subscriber's billing
 * interval: a monthly subscriber contributes the monthly price, an annual
 * subscriber the annual price / 12. Both prices come from SystemConfig.
 *
 *   MRR = monthly PRO users x monthly price + annual PRO users x annual price / 12
 *   ARR = MRR x 12
 *
 * A PRO user counts as annual when their Subscription row has
 * planType 'YEARLY'; every other PRO user counts as monthly. Mirrors
 * lib/admin/analytics/mrr.ts in the Next app.
 */

import type { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import type { PrismaService } from '../prisma/prisma.service';

export interface MrrInput {
  monthlyProUsers: number;
  annualProUsers: number;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
}

export interface MrrResult {
  mrr: number;
  arr: number;
  monthlyProUsers: number;
  annualProUsers: number;
  /** The SystemConfig monthly price the MRR was computed at. */
  monthlyPriceUsd: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeMrr(input: MrrInput): MrrResult {
  const mrr =
    input.monthlyProUsers * input.monthlyPriceUsd +
    (input.annualProUsers * input.annualPriceUsd) / 12;
  return {
    mrr: round2(mrr),
    arr: round2(mrr * 12),
    monthlyProUsers: input.monthlyProUsers,
    annualProUsers: input.annualProUsers,
    monthlyPriceUsd: input.monthlyPriceUsd,
  };
}

/**
 * Number of PRO users whose subscription is billed yearly. Subscription has
 * no relation to User, so the yearly subscribers are read first and then
 * matched against PRO users.
 */
export async function countAnnualProUsers(
  prisma: PrismaService
): Promise<number> {
  const yearly = await prisma.subscription.findMany({
    where: { planType: 'YEARLY' },
    select: { userId: true },
  });
  if (yearly.length === 0) return 0;
  return prisma.user.count({
    where: { tier: 'PRO', id: { in: yearly.map((s) => s.userId) } },
  });
}

/** MRR and ARR for `proUsers` PRO users, at the SystemConfig prices. */
export async function getProMrr(
  prisma: PrismaService,
  affiliateConfig: AffiliateConfigService,
  proUsers: number
): Promise<MrrResult> {
  const [annualProUsers, monthlyPriceUsd, annualPriceUsd] = await Promise.all([
    countAnnualProUsers(prisma),
    affiliateConfig.getBasePriceUsd(),
    affiliateConfig.getAnnualPriceUsd(),
  ]);
  return computeMrr({
    monthlyProUsers: Math.max(0, proUsers - annualProUsers),
    annualProUsers: Math.min(annualProUsers, proUsers),
    monthlyPriceUsd,
    annualPriceUsd,
  });
}
