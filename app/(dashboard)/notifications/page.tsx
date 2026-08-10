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

import { NotificationList } from '@/components/notifications/notification-list';
import { getSession } from '@/lib/auth/session';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

export default async function NotificationsPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <NotificationList />;
}
