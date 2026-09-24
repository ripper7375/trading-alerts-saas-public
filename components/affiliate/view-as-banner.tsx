'use client';

/**
 * Banner shown across the affiliate dashboard while an admin is viewing an
 * affiliate read-only. Renders nothing for a real affiliate.
 *
 * @module components/affiliate/view-as-banner
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';

import { useAffiliateViewAs } from './view-as-context';

export default function AffiliateViewAsBanner(): React.ReactElement | null {
  const viewAs = useAffiliateViewAs();
  const { t } = useLocale();
  const [exiting, setExiting] = useState(false);

  if (!viewAs) return null;

  const handleExit = async (): Promise<void> => {
    setExiting(true);
    try {
      await fetch('/api/admin/affiliates/view-as', { method: 'DELETE' });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation is deliberate: the next page must re-read the cleared cookie
      window.location.assign('/admin/affiliates/view-as');
    }
  };

  return (
    <div
      role="status"
      className="border-b border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-100"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {t('affiliate.view_as.banner_prefix', 'Admin view (read-only):')}{' '}
            <strong className="font-bold">{viewAs.fullName}</strong>
            {viewAs.email && (
              <span className="text-blue-800/80 dark:text-blue-200/80">
                {' '}
                ({viewAs.email})
              </span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/affiliates/view-as"
            className="rounded-md border border-blue-500/40 bg-background px-2.5 py-1 font-medium text-foreground hover:bg-accent"
          >
            {t('affiliate.view_as.switch', 'Switch affiliate')}
          </Link>
          <button
            type="button"
            onClick={() => void handleExit()}
            disabled={exiting}
            className="rounded-md bg-blue-600 px-2.5 py-1 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {t('affiliate.view_as.exit', 'Exit view')}
          </button>
        </div>
      </div>
    </div>
  );
}
