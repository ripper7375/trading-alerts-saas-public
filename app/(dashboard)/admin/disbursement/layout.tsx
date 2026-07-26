import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { Badge } from '@/components/ui/badge';
import { authOptions } from '@/lib/auth/auth-options';
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
    id: 'accounts',
    icon: '🔗',
    label: 'RiseWorks Accounts',
    href: '/admin/disbursement/accounts',
  },
  {
    id: 'recipients',
    icon: '🏦',
    label: 'Wise Recipients',
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

  // Check admin role
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard?error=forbidden');
  }

  const userName = session.user.name || session.user.email || 'Admin';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar */}
      <header className="border-b border-gray-700 bg-gray-800 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <h1 className="text-lg font-bold sm:text-xl">Disbursement Admin</h1>
            <Badge className="bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-600">
              RiseWorks
            </Badge>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-sm text-gray-400 sm:inline">
              {userName}
            </span>
            <Link
              href="/admin"
              className="text-sm text-blue-400 transition-colors hover:text-blue-300"
            >
              ← Admin Panel
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="min-h-[calc(100vh-65px)] w-16 shrink-0 bg-gray-800 p-2 sm:w-64 sm:p-4">
          <nav className="space-y-1 sm:space-y-2">
            {disbursementNavItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-3 sm:px-4',
                  'text-gray-300 hover:bg-gray-700 hover:text-white',
                  'transition-colors'
                )}
              >
                <span className="text-lg sm:text-xl">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Divider */}
          <div className="my-4 border-t border-gray-700" />

          {/* System Info */}
          <div className="hidden rounded-lg bg-gray-700/50 px-4 py-3 sm:block">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">
              Payment Provider
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-sm text-gray-300">RiseWorks (USDC)</span>
            </div>
          </div>

          {/* Back to App */}
          <div className="mt-4 hidden sm:block">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-gray-400 transition-colors hover:text-white"
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
