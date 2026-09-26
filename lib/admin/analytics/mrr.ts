/**
 * Monthly recurring revenue, weighted by each PRO subscriber's billing
 * interval: a monthly subscriber contributes the monthly price, an annual
 * subscriber the annual price / 12. Both prices come from SystemConfig.
 *
 *   MRR = monthly PRO users x monthly price + annual PRO users x annual price / 12
 *   ARR = MRR x 12
 *
 * A PRO user counts as annual when their Subscription row has
 * planType 'YEARLY' (set by both the Stripe webhook and dLocal); every other
 * PRO user counts as monthly. Mirrored in
 * money-service/src/admin/admin-mrr.ts.
 *
 * @module lib/admin/analytics/mrr
 */

import { getAnnualPriceUsd, getBasePriceUsd } from '@/lib/affiliate/db';
import { prisma } from '@/lib/db/prisma';

import { round2 } from './date-windows';

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
export async function countAnnualProUsers(): Promise<number> {
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
export async function getProMrr(proUsers: number): Promise<MrrResult> {
  const [annualProUsers, monthlyPriceUsd, annualPriceUsd] = await Promise.all([
    countAnnualProUsers(),
    getBasePriceUsd(),
    getAnnualPriceUsd(),
  ]);
  return computeMrr({
    monthlyProUsers: Math.max(0, proUsers - annualProUsers),
    annualProUsers: Math.min(annualProUsers, proUsers),
    monthlyPriceUsd,
    annualPriceUsd,
  });
}
