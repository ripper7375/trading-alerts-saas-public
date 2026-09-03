/**
 * Affiliate Dashboard Layout
 *
 * Protected layout for affiliate dashboard pages.
 * Requires authenticated affiliate access.
 * Provides navigation and common layout.
 *
 * DECISION-LOG.md F79 fix (Session 9-7b): a freshly-registered affiliate's
 * JWT doesn't carry `isAffiliate: true` until the token next rotates, so
 * trusting `session.user.isAffiliate` here bounced them straight back to
 * `/affiliate/register` in a redirect loop. `requireAffiliate()`
 * (lib/auth/session.ts) already re-checks the DB directly when the JWT
 * claim is false, closing the race.
 *
 * @module app/affiliate/dashboard/layout
 */

import React from 'react';
import { redirect } from 'next/navigation';

import { getSession, requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import AffiliateNav from '@/components/affiliate/affiliate-nav';
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

// Force dynamic rendering since this layout uses headers via getSession
export const dynamic = 'force-dynamic';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DashboardLayoutProps {
  children: React.ReactNode;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Dashboard Layout
 * Wraps dashboard pages with navigation and authentication check
 */
export default async function AffiliateDashboardLayout({
  children,
}: DashboardLayoutProps): Promise<React.ReactElement> {
  // Check authentication
  const session = await getSession();

  if (!session || !session.user) {
    redirect('/login?callbackUrl=/affiliate/dashboard');
  }

  // Redirect admin users to Admin Executive Dashboard
  if (session.user.role === 'ADMIN') {
    redirect('/admin');
  }

  // F79: re-check the DB when the JWT hasn't caught up yet, instead of
  // bouncing a genuine affiliate back to /register.
  try {
    await requireAffiliate();
  } catch (err) {
    if (err instanceof AuthError) {
      redirect('/affiliate/register');
    }
    throw err;
  }

  const dict = getDictionary(await getServerLanguage());

  return (
    <div className="min-h-screen bg-background">
      <AffiliateNav />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">{children}</div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            {dict['nav.affiliate.footer_tagline'] ??
              'DavinTrade Affiliate Partner Program'}
          </p>
        </div>
      </footer>
    </div>
  );
}
