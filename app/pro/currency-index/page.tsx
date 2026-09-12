import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import type { Tier } from '@/lib/tier-config';
import { ProCurrencyIndexCockpit } from '@/components/currency-index-pro/pro-currency-index-cockpit';

export const metadata: Metadata = {
  title: 'Currency Index PRO | DavinTrade',
  description:
    '28-pair relative-strength screener across the G8 currency basket.',
};

/**
 * `/pro/currency-index` -- PRO-only, matching `app/terminal/page.tsx`'s own
 * pattern (page-level tier check, not layout-level). Redirects a non-PRO
 * viewer to `/pricing` rather than a FREE-tier equivalent page -- unlike
 * `/terminal` -> `/free`, there is no FREE version of this cockpit; the
 * FREE equivalent is the landing-page Hero widget (Lane 4), a different
 * page entirely, matching `MtfToggle.tsx`'s own upsell-click destination.
 */
export default async function CurrencyIndexProPage(): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const tier = (session.user.tier || 'FREE') as Tier;

  if (tier !== 'PRO') {
    redirect('/pricing');
  }

  return <ProCurrencyIndexCockpit />;
}
