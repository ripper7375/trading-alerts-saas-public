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
 * Session 9-7b: mounts the same shared <AffiliateNav /> as
 * dashboard/layout.tsx (Decision 5) and picks up the same F79 DB-fallback
 * fix, since this route tree hits the identical JWT-staleness race.
 *
 * @module app/affiliate/settings/layout
 */

import React from 'react';
import { redirect } from 'next/navigation';

import { getSession, requireAffiliate } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import AffiliateNav from '@/components/affiliate/affiliate-nav';

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

  try {
    await requireAffiliate();
  } catch (err) {
    if (err instanceof AuthError) {
      redirect('/affiliate/register');
    }
    throw err;
  }

  return (
    <div className="min-h-screen bg-background">
      <AffiliateNav />

      <main className="mx-auto max-w-4xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">{children}</div>
      </main>
    </div>
  );
}
