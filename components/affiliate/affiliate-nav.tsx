'use client';

/**
 * AffiliateNav — shared chrome for the authenticated affiliate portal
 * (Session 9-7b, Decision 5). Mounted by both app/affiliate/dashboard/layout.tsx
 * and app/affiliate/settings/layout.tsx (two separate route trees per F39 --
 * see settings/layout.tsx's own header comment) so partners get one
 * consistent nav regardless of which layout wraps the current page.
 *
 * DavinTrade semantic tokens throughout (bg-card/border-border/text-foreground/
 * text-muted-foreground/bg-accent), amber active-state per components/layout/
 * app-header.tsx's established pattern.
 *
 * @module components/affiliate/affiliate-nav
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, ChevronRight } from 'lucide-react';

import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';

const NAV_LINKS = [
  {
    href: '/affiliate/dashboard',
    labelKey: 'nav.affiliate.overview',
    fallback: 'Overview',
  },
  {
    href: '/affiliate/dashboard/codes',
    labelKey: 'nav.affiliate.my_codes',
    fallback: 'My Codes',
  },
  {
    href: '/affiliate/dashboard/code-inventory',
    labelKey: 'nav.affiliate.code_inventory',
    fallback: 'Code Inventory',
  },
  {
    href: '/affiliate/dashboard/commissions',
    labelKey: 'nav.affiliate.commissions',
    fallback: 'Commissions',
  },
  {
    href: '/affiliate/dashboard/payouts',
    labelKey: 'nav.affiliate.payouts',
    fallback: 'Payouts',
  },
  {
    href: '/affiliate/dashboard/statements',
    labelKey: 'nav.affiliate.statements',
    fallback: 'Statements',
  },
  {
    href: '/affiliate/dashboard/resources',
    labelKey: 'nav.affiliate.resources',
    fallback: 'Resources',
  },
  {
    href: '/affiliate/dashboard/profile',
    labelKey: 'nav.affiliate.profile',
    fallback: 'Profile',
  },
  {
    href: '/affiliate/settings/payout',
    labelKey: 'nav.affiliate.payout_settings',
    fallback: 'Payout Settings',
  },
] as const;

export default function AffiliateNav(): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useLocale();

  // Same bridge-aware logout as components/layout/app-header.tsx.
  const handleLogout = async (): Promise<void> => {
    if (isAuthBridgeEnabled()) {
      await fetch('/api/auth/token-logout', { method: 'POST' });
    }
    await signOut({ redirect: false });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full browser navigation is deliberate, matches app-header.tsx
    window.location.href = '/login';
  };

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-card shadow-sm">
      {/* Top row: brand + user */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/affiliate/dashboard" className="flex items-center gap-2">
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-500/40">
              <Image
                src="/DavinTrade_Logo.jpg"
                alt="DavinTrade Logo"
                fill
                className="object-cover"
              />
            </div>
            <span className="hidden bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-sm font-extrabold tracking-tight text-transparent sm:inline">
              DavinTrade
            </span>
          </Link>
          <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:inline" />
          <span className="text-xs font-bold text-foreground sm:text-sm">
            {t('nav.affiliate.portal_title', 'Affiliate Partner Portal')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {session?.user?.email}
          </span>
          <Link
            href="/dashboard"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {t('nav.affiliate.back_to_app', 'Back to App')}
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-rose-600 dark:hover:text-rose-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {t('nav.affiliate.log_out', 'Log out')}
            </span>
          </button>
        </div>
      </div>

      {/* Second row: scrollable nav tabs */}
      <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 pb-2">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === '/affiliate/dashboard'
                ? pathname === link.href
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/15 font-bold text-amber-700 dark:text-amber-300'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {t(link.labelKey, link.fallback)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
