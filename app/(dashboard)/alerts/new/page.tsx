/**
 * Create Alert Page (Server Component) — V8
 *
 * Alerts are a PRO-exclusive feature: FREE users see the PRO-upgrade
 * landing. PRO users create alerts on XAUUSD (fixed) with M5/M15.
 *
 * @module app/(dashboard)/alerts/new/page
 */

import { redirect } from 'next/navigation';

import AppHeader from '@/components/layout/app-header';
import { AlertsProUpgrade } from '@/components/alerts/alerts-pro-upgrade';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  PRO_TIER_CONFIG,
  SYMBOLS,
  TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

import { CreateAlertClient } from './create-alert-client';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

/**
 * Create Alert Page
 */
export default async function CreateAlertPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';

  // V8: Alerts are PRO-exclusive — show upgrade landing to FREE users
  if (tier !== 'PRO') {
    return (
      <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
        <AppHeader
          title="New Alert Rule Wizard"
          subtitle="Define Technical Channel & Line Breach Triggers"
          tier={tier}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <AlertsProUpgrade />
        </main>
      </div>
    );
  }

  const limit = PRO_TIER_CONFIG.maxAlerts;

  // Count existing active alerts
  const activeAlertCount = await prisma.alert.count({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  const canCreate = activeAlertCount < limit;

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
      <AppHeader
        title="New Alert Rule Wizard"
        subtitle="Define Technical Channel & Line Breach Triggers"
        tier={tier}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <CreateAlertClient
          userTier={tier}
          limit={limit}
          currentCount={activeAlertCount}
          canCreate={canCreate}
          availableSymbols={[...SYMBOLS]}
          availableTimeframes={[...TIMEFRAMES]}
        />
      </main>
    </div>
  );
}
