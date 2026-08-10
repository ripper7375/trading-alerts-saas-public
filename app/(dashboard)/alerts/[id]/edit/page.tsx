/**
 * Edit Alert Page (Server Component) — V8
 *
 * Alerts are a PRO-exclusive feature: FREE users see the PRO-upgrade
 * landing. Unknown alert IDs and alerts owned by another user both
 * render the standard Next.js not-found boundary (app/not-found.tsx) —
 * ownership is never distinguished from non-existence in the response,
 * so a caller can't probe for other users' alert IDs.
 *
 * @module app/(dashboard)/alerts/[id]/edit/page
 */

import { notFound, redirect } from 'next/navigation';

import { AlertsProUpgrade } from '@/components/alerts/alerts-pro-upgrade';
import type { AlertFormData } from '@/components/alerts/alert-form';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { PRO_TIER_CONFIG, type Tier } from '@/lib/tier-config';

import { EditAlertClient } from './edit-alert-client';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

interface EditAlertPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Parse the stored condition JSON into its type/targetValue, defaulting
 * safely if the stored value is somehow malformed.
 */
function parseCondition(conditionJson: string): {
  type: AlertFormData['conditionType'];
  targetValue: number;
} {
  try {
    const parsed = JSON.parse(conditionJson);
    const type: AlertFormData['conditionType'] =
      parsed.type === 'price_below' || parsed.type === 'price_equals'
        ? parsed.type
        : 'price_above';
    const targetValue =
      typeof parsed.targetValue === 'number' ? parsed.targetValue : 0;
    return { type, targetValue };
  } catch {
    return { type: 'price_above', targetValue: 0 };
  }
}

/**
 * Edit Alert Page
 */
export default async function EditAlertPage({
  params,
}: EditAlertPageProps): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';

  // V8: Alerts are PRO-exclusive — show upgrade landing to FREE users
  if (tier !== 'PRO') {
    return <AlertsProUpgrade />;
  }

  const { id } = await params;

  const alert = await prisma.alert.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      symbol: true,
      timeframe: true,
      condition: true,
    },
  });

  // Non-existent alert AND wrong-owner both 404 — never distinguish
  // "doesn't exist" from "not yours" to another user.
  if (!alert || alert.userId !== session.user.id) {
    notFound();
  }

  const { type: conditionType, targetValue } = parseCondition(alert.condition);

  const initialData: AlertFormData = {
    symbol: alert.symbol,
    timeframe: alert.timeframe,
    conditionType,
    targetValue,
    name: alert.name || '',
  };

  return (
    <EditAlertClient
      alertId={alert.id}
      userTier={tier}
      limit={PRO_TIER_CONFIG.maxAlerts}
      initialData={initialData}
    />
  );
}
