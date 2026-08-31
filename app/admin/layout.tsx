import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { Badge } from '@/components/ui/badge';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';
import { prisma } from '@/lib/db/prisma';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface AdminNavItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NAVIGATION CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const adminNavItems: AdminNavItem[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard', href: '/admin' },
  {
    id: 'bi-dashboards',
    icon: '📈',
    label: 'Business Intelligence',
    href: '/admin/dashboards/executive',
  },
  { id: 'users', icon: '👥', label: 'Users', href: '/admin/users' },
  {
    id: 'fraud-alerts',
    icon: '🚩',
    label: 'Fraud Alerts',
    href: '/admin/fraud-alerts',
  },
  { id: 'api-usage', icon: '🔌', label: 'API Usage', href: '/admin/api-usage' },
  { id: 'status', icon: '🟢', label: 'System Status', href: '/status' },
  { id: 'errors', icon: '🚨', label: 'System Errors', href: '/admin/errors' },
  {
    id: 'affiliates',
    icon: '🤝',
    label: 'Affiliates & Reports',
    href: '/admin/affiliates',
  },
  {
    id: 'disbursement',
    icon: '💸',
    label: 'Disbursements',
    href: '/admin/disbursement',
  },
  {
    id: 'affiliate-settings',
    icon: '⚙️',
    label: 'Affiliate Settings',
    href: '/admin/settings/affiliate',
  },
  {
    id: 'system-terminals',
    icon: '🖥️',
    label: 'Terminals & Flask API',
    href: '/admin/system/terminals',
  },
  {
    id: 'system-jobs',
    icon: '⏱️',
    label: 'Scheduled Jobs',
    href: '/admin/system/jobs',
  },
  {
    id: 'system-outbox',
    icon: '📤',
    label: 'Outbox Queue',
    href: '/admin/system/outbox',
  },
  {
    id: 'system-config-history',
    icon: '📜',
    label: 'Config History',
    href: '/admin/system/config-history',
  },
  {
    id: 'notifications-broadcast',
    icon: '📢',
    label: 'Broadcast',
    href: '/admin/notifications/broadcast',
  },
  {
    id: 'resources',
    icon: '🎨',
    label: 'Marketing Resources',
    href: '/admin/resources',
  },
  {
    id: 'tutorials',
    icon: '🎓',
    label: 'Academy Tutorials',
    href: '/admin/tutorials',
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN LAYOUT COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Layout - Server Component
 *
 * `/admin` -- deliberately NOT under `app/(dashboard)/` (moved there Session
 * 9-10). `app/(dashboard)/layout.tsx` (legacy Header/Sidebar/Footer, still
 * "Trading Alerts"-branded) used to wrap this layout, giving every admin
 * route double chrome -- flagged by Session 9-4's own migration-stack-
 * analysis.md entry and confirmed live at 9-10's CONFIRM (2 <header>s, 2
 * <aside>s, 1 legacy <footer>, real non-zero layout). Promoted to a
 * top-level route mirroring 9-5's `/settings` precedent (see
 * app/settings/layout.tsx's own doc comment) and app/dashboard/layout.tsx's
 * `/dashboard` precedent; `app/(dashboard)/` retired entirely.
 *
 * Features:
 * - Admin role verification (403 if not admin)
 * - Dark theme sidebar with navigation
 * - Top bar with admin badge and user info
 * - "Back to App" link
 *
 * Security:
 * - Checks session exists (redirects to login if not)
 * - Checks user role is ADMIN (redirects to dashboard with error if not)
 */
export default async function AdminLayout({
  children,
}: AdminLayoutProps): Promise<React.ReactElement> {
  // Get session
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  // Check admin role -- fall back to the DB directly if the JWT role claim
  // hasn't caught up yet (Session 9-8a, same DB-fallback pattern as
  // requireAffiliate()/DECISION-LOG.md F79 -- a freshly-promoted admin's
  // stale JWT would otherwise bounce them straight back to /dashboard).
  if (session.user.role !== 'ADMIN') {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (dbUser?.role !== 'ADMIN') {
      redirect('/dashboard?error=forbidden');
    }
  }

  const userName = session.user.name || session.user.email || 'Admin';
  const appearance = await getServerAppearance();

  return (
    <AppearanceProvider initialSettings={appearance}>
      <div
        className="min-h-screen bg-background text-foreground"
        data-accent={appearance.accent}
        style={
          {
            '--chart-candle-up': appearance.chartUpColor,
            '--chart-candle-down': appearance.chartDownColor,
            '--chart-grid-opacity': (appearance.gridOpacity / 100).toString(),
          } as React.CSSProperties
        }
      >
        <LoginTracker />
        <TokenRefreshProvider />

        {/* Top Bar */}
        <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <h1 className="text-lg font-bold sm:text-xl">Admin Panel</h1>
              <Badge className="bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-700 hover:bg-amber-500/15 dark:text-amber-300">
                ADMIN
              </Badge>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {userName}
              </span>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Back to App
              </Link>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside
            aria-label="Admin navigation"
            className="min-h-[calc(100vh-65px)] w-16 shrink-0 border-r border-border bg-card p-2 sm:w-64 sm:p-4"
          >
            <nav aria-label="Admin sections" className="space-y-1 sm:space-y-2">
              {adminNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-3 sm:px-4',
                    'text-muted-foreground hover:bg-accent hover:text-foreground',
                    'transition-colors'
                  )}
                >
                  <span className="text-lg sm:text-xl">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Divider */}
            <div className="my-4 border-t border-border" />

            {/* System Status -- links to a real check, does not claim one */}
            <Link
              href="/admin/system/terminals"
              className="bg-accent/50 hidden rounded-lg px-4 py-3 transition-colors hover:bg-accent sm:block"
            >
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                System Status
              </p>
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Check terminals &amp; jobs →
              </span>
            </Link>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </AppearanceProvider>
  );
}
