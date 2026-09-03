/**
 * Notifications Page (Server Component)
 *
 * Mounts the full notifications list — status tabs, type filters,
 * pagination, mark-read/mark-all-read/delete — against the live
 * `/api/notifications/*` routes (Session 4B-9, CUT-OVER & LIVE). No tier
 * gating: notifications are a core platform capability for every
 * authenticated user (`app/api/notifications/route.ts` has no tier check).
 *
 * @module app/(dashboard)/notifications/page
 */

import { redirect } from 'next/navigation';

import AppHeader from '@/components/layout/app-header';
import { NotificationList } from '@/components/notifications/notification-list';
import { getSession } from '@/lib/auth/session';
import type { Tier } from '@/lib/tier-config';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';
  const dict = getDictionary(await getServerLanguage());

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-background">
      <AppHeader
        title={dict['notifications.page_title'] || 'Notifications Centre'}
        subtitle={
          dict['notifications.page_subtitle'] ||
          'Live Signal Alerts, System Announcements & Security Events'
        }
        tier={tier}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6">
        <NotificationList />
      </main>
    </div>
  );
}
