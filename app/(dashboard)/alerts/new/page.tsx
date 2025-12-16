/**
 * Create Alert Page (Server Component)
 *
 * Page for creating new price alerts with tier-based symbol filtering.
 * Validates tier limits before allowing creation.
 *
 * @module app/(dashboard)/alerts/new/page
 */

import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  FREE_SYMBOLS,
  PRO_SYMBOLS,
  FREE_TIMEFRAMES,
  PRO_TIMEFRAMES,
  type Tier,
} from '@/lib/tier-config';

import { CreateAlertClient } from './create-alert-client';

/**
 * Create Alert Page
 *
 * Server component that validates tier limits and renders
 * the create alert form.
 */
export default async function CreateAlertPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';
  const limit =
    tier === 'PRO' ? PRO_TIER_CONFIG.maxAlerts : FREE_TIER_CONFIG.maxAlerts;

  // Count existing active alerts
  const activeAlertCount = await prisma.alert.count({
    where: {
      userId: session.user.id,
      isActive: true,
    },
  });

  // Get tier-allowed symbols and timeframes
  const availableSymbols = tier === 'PRO' ? [...PRO_SYMBOLS] : [...FREE_SYMBOLS];
  const availableTimeframes =
    tier === 'PRO' ? [...PRO_TIMEFRAMES] : [...FREE_TIMEFRAMES];

  const canCreate = activeAlertCount < limit;

  return (
    <CreateAlertClient
      userTier={tier}
      limit={limit}
      currentCount={activeAlertCount}
      canCreate={canCreate}
      availableSymbols={availableSymbols}
      availableTimeframes={availableTimeframes}
    />
  );
}
