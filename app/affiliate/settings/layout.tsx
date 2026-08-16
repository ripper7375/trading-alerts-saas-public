/**
 * Affiliate Settings Layout (Session 4A-W3b)
 *
 * Protected layout for affiliate self-service settings pages (e.g. payout
 * details). Mirrors app/affiliate/dashboard/layout.tsx's auth check — kept
 * as a separate route tree per F39's recorded URL (/affiliate/settings/payout,
 * DECISION-LOG.md) rather than nested under dashboard/, but the real
 * security boundary is each API route's own requireAffiliate() call, not
 * this layout.
 *
 * @module app/affiliate/settings/layout
 */

import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default async function AffiliateSettingsLayout({
  children,
}: SettingsLayoutProps): Promise<React.ReactElement> {
  const session = await getSession();

  if (!session || !session.user) {
    redirect('/login?callbackUrl=/affiliate/settings/payout');
  }

  // Redirect admin users to Admin Executive Dashboard
  if (session.user.role === 'ADMIN') {
    redirect('/admin');
  }

  if (!session.user.isAffiliate) {
    redirect('/affiliate/register');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link
              href="/affiliate/dashboard"
              className="text-xl font-bold text-gray-900"
            >
              Affiliate Portal
            </Link>
            <Link
              href="/affiliate/dashboard"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">{children}</div>
      </main>
    </div>
  );
}
