/**
 * Alerts List Page (Server Component) — V8
 *
 * Alerts are a PRO-exclusive feature: FREE users see a dedicated
 * PRO-upgrade landing instead of the alerts UI.
 * PRO limit: 100 alerts on XAUUSD M5/M15.
 *
 * @module app/(dashboard)/alerts/page
 */

import { redirect } from 'next/navigation';

import AppHeader from '@/components/layout/app-header';
import { AlertsProUpgrade } from '@/components/alerts/alerts-pro-upgrade';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { PRO_TIER_CONFIG, type Tier } from '@/lib/tier-config';

import { AlertsClient } from './alerts-client';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

/**
 * Prisma Alert type
 */
interface PrismaAlert {
  id: string;
  userId: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string;
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get alert counts by status
 */
interface AlertCounts {
  active: number;
  paused: number;
  triggered: number;
}

/**
 * Alert with computed status
 */
export interface AlertWithStatus {
  id: string;
  name: string | null;
  symbol: string;
  timeframe: string;
  condition: string;
  alertType: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'paused' | 'triggered';
}

/**
 * Compute alert status from isActive and lastTriggered fields
 */
function computeAlertStatus(
  isActive: boolean,
  lastTriggered: Date | null
): 'active' | 'paused' | 'triggered' {
  if (lastTriggered && !isActive) {
    return 'triggered';
  }
  if (!isActive) {
    return 'paused';
  }
  return 'active';
}

/**
 * Alerts Page
 *
 * Server component that fetches initial alerts data and renders
 * the client-side interactive alerts management component.
 */
export default async function AlertsPage(): Promise<React.JSX.Element> {
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
          title="Real-Time Alerts Manager"
          subtitle="Configure & Monitor Server-Side Price & Line Triggers"
          tier={tier}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <AlertsProUpgrade />
        </main>
      </div>
    );
  }

  const limit = PRO_TIER_CONFIG.maxAlerts;

  // Fetch user's alerts
  const alerts = await prisma.alert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  // Transform alerts with computed status
  const alertsWithStatus: AlertWithStatus[] = (alerts as PrismaAlert[]).map(
    (alert) => ({
      id: alert.id,
      name: alert.name,
      symbol: alert.symbol,
      timeframe: alert.timeframe,
      condition: alert.condition,
      alertType: alert.alertType,
      isActive: alert.isActive,
      lastTriggered: alert.lastTriggered,
      triggerCount: alert.triggerCount,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      status: computeAlertStatus(alert.isActive, alert.lastTriggered),
    })
  );

  // Calculate counts
  const counts: AlertCounts = {
    active: alertsWithStatus.filter((a) => a.status === 'active').length,
    paused: alertsWithStatus.filter((a) => a.status === 'paused').length,
    triggered: alertsWithStatus.filter((a) => a.status === 'triggered').length,
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
      <AppHeader
        title="Real-Time Alerts Manager"
        subtitle="Configure & Monitor Server-Side Price & Line Triggers"
        tier={tier}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
        <AlertsClient
          initialAlerts={alertsWithStatus}
          counts={counts}
          userTier={tier}
          limit={limit}
        />
      </main>
    </div>
  );
}
