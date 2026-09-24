'use client';

/**
 * In admin "view as user" mode only Billing, Security and Security Activity
 * show the viewed user. Every other settings page reads the signed-in
 * account, so under a "viewing <user>" banner it would show the ADMIN's own
 * profile as if it were the customer's. This gate replaces those pages with
 * a short explanation instead. Outside view mode it renders children as-is.
 *
 * @module components/admin/user-view-as/user-view-as-gate
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EyeOff } from 'lucide-react';

import { isUserViewAsPath } from '@/lib/admin/user-view-as-paths';
import { useLocale } from '@/lib/context/locale-context';

import { useUserViewAs } from './user-view-as-context';

const LINK_CLASS =
  'rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent';

export default function UserViewAsGate({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const viewAs = useUserViewAs();
  const pathname = usePathname();
  const { t } = useLocale();

  if (!viewAs || isUserViewAsPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <EyeOff className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        {t(
          'admin.user_view_as.unavailable_title',
          'Not available in admin view'
        )}
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {t(
          'admin.user_view_as.unavailable_body',
          "Only Billing, Security and Security Activity show the viewed user's data. This page would show your own account."
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/settings/billing" className={LINK_CLASS}>
          {t('nav.billing', 'Billing')}
        </Link>
        <Link href="/settings/security" className={LINK_CLASS}>
          {t('nav.security', 'Security')}
        </Link>
        <Link href="/settings/security/activity" className={LINK_CLASS}>
          {t('admin.user_view_as.security_activity', 'Security Activity')}
        </Link>
      </div>
    </div>
  );
}
