import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { CURRENCY_INDEX_COMPARE_PATH } from '@/lib/currency-index-comparison/series';
import { CurrencyIndexComparisonWorkspace } from '@/components/currency-index-comparison/currency-index-comparison-workspace';

export const metadata: Metadata = {
  title: 'Currency Index Comparison PRO | DavinTrade',
  description:
    'Compare any 2 of the 9 DavinTrade currency and gold indices with OHLC, Heiken Ashi, HRMA and SMMA.',
};

/**
 * `/pro/currency-index/compare` -- the PRO counterpart of the public
 * `/xaux-vs-usdx` page.
 *
 * Authentication is enforced by the parent `app/pro/currency-index/layout.tsx`.
 * The PRO check is page-level, like `/pro/currency-index` itself, with one
 * addition: when the JWT says FREE the tier is re-read from the database
 * before refusing, the same fallback the comparison API route uses. The JWT
 * carries the tier from sign-in, so without this a user who has just upgraded
 * would be sent to /pricing for a feature they have already paid for.
 */
export default async function CurrencyIndexComparePage(): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(CURRENCY_INDEX_COMPARE_PATH)}`
    );
  }

  if (session.user.tier !== 'PRO') {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });
    if (dbUser?.tier !== 'PRO') {
      redirect('/pricing');
    }
  }

  return <CurrencyIndexComparisonWorkspace />;
}
