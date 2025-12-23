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
  { id: 'overview', icon: '📊', label: 'Overview', href: '/admin/disbursement' },
  { id: 'affiliates', icon: '👥', label: 'Payable Affiliates', href: '/admin/disbursement/affiliates' },
  { id: 'batches', icon: '📦', label: 'Payment Batches', href: '/admin/disbursement/batches' },
  { id: 'transactions', icon: '💸', label: 'Transactions', href: '/admin/disbursement/transactions' },
  { id: 'accounts', icon: '🔗', label: 'RiseWorks Accounts', href: '/admin/disbursement/accounts' },
  { id: 'audit', icon: '📋', label: 'Audit Logs', href: '/admin/disbursement/audit' },
  { id: 'config', icon: '⚙️', label: 'Configuration', href: '/admin/disbursement/config' },
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
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-bold">Disbursement Admin</h1>
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs px-2 py-0.5">
              RiseWorks
            </Badge>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-gray-400 text-sm hidden sm:inline">
              {userName}
            </span>
            <Link
              href="/admin"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              ← Admin Panel
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-16 sm:w-64 bg-gray-800 min-h-[calc(100vh-65px)] p-2 sm:p-4 shrink-0">
          <nav className="space-y-1 sm:space-y-2">
            {disbursementNavItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-2 sm:px-4 py-3 rounded-lg',
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
          <div className="border-t border-gray-700 my-4" />

          {/* System Info */}
          <div className="hidden sm:block px-4 py-3 bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              Payment Provider
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">
                RiseWorks (USDC)
              </span>
            </div>
          </div>

          {/* Back to App */}
          <div className="mt-4 hidden sm:block">
            <Link
              href="/dashboard"
              className="block px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to App
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
