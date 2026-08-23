import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { Badge } from '@/components/ui/badge';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { getDefaultProvider } from '@/lib/disbursement/constants';
import { cn } from '@/lib/utils';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DisbursementLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  icon: string;
  label: string;
  href: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NAVIGATION CONFIGURATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const disbursementNavItems: NavItem[] = [
  {
    id: 'overview',
    icon: '📊',
    label: 'Overview',
    href: '/admin/disbursement',
  },
  {
    id: 'affiliates',
    icon: '👥',
    label: 'Payable Affiliates',
    href: '/admin/disbursement/affiliates',
  },
  {
    id: 'batches',
    icon: '📦',
    label: 'Payment Batches',
    href: '/admin/disbursement/batches',
  },
  {
    id: 'transactions',
    icon: '💸',
    label: 'Transactions',
    href: '/admin/disbursement/transactions',
  },
  {
    id: 'recipients',
    icon: '🏦',
    label: 'Payout Accounts',
    href: '/admin/disbursement/recipients',
  },
  {
    id: 'audit',
    icon: '📋',
    label: 'Audit Logs',
    href: '/admin/disbursement/audit',
  },
  {
    id: 'config',
    icon: '⚙️',
    label: 'Configuration',
    href: '/admin/disbursement/config',
  },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISBURSEMENT LAYOUT COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Disbursement Admin Layout - Server Component
 *
 * Features:
 * - Admin role verification (403 if not admin)
 * - Dark theme sidebar with disbursement navigation
 * - Top bar with disbursement badge
 * - Back links to main admin and app
 *
 * Security:
 * - Checks session exists (redirects to login if not)
 * - Checks user role is ADMIN (redirects to dashboard with error if not)
 */
export default async function DisbursementLayout({
  children,
}: DisbursementLayoutProps): Promise<React.ReactElement> {
  // Get session
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/disbursement');
  }

  // Check admin role -- fall back to the DB directly if the JWT role claim
  // hasn't caught up yet (same DB-fallback pattern as admin/layout.tsx,
  // Session 9-8a / DECISION-LOG.md F79 -- a freshly-promoted admin's stale
  // JWT would otherwise bounce them straight back to /dashboard).
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
  const activeProvider = getDefaultProvider();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <h1 className="text-lg font-bold sm:text-xl">Disbursement Admin</h1>
            <Badge className="bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
              {activeProvider}
            </Badge>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {userName}
            </span>
            <Link
              href="/admin"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Admin Panel
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="min-h-[calc(100vh-65px)] w-16 shrink-0 border-r border-border bg-card p-2 sm:w-64 sm:p-4">
          <nav className="space-y-1 sm:space-y-2">
            {disbursementNavItems.map((item) => (
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

          {/* System Info */}
          <div className="bg-accent/50 hidden rounded-lg px-4 py-3 sm:block">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              Payment Provider
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-sm text-foreground">
                {activeProvider === 'WISE'
                  ? 'Wise'
                  : activeProvider === 'RISE'
                    ? 'RiseWorks (archived)'
                    : 'MOCK (testing)'}
              </span>
            </div>
          </div>

          {/* Back to App */}
          <div className="mt-4 hidden sm:block">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to App
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
