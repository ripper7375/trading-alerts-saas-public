import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { Badge } from '@/components/ui/badge';
import { authOptions } from '@/lib/auth/auth-options';
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
  { id: 'users', icon: '👥', label: 'Users', href: '/admin/users' },
  { id: 'api-usage', icon: '🔌', label: 'API Usage', href: '/admin/api-usage' },
  { id: 'errors', icon: '🚨', label: 'Error Logs', href: '/admin/errors' },
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN LAYOUT COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Layout - Server Component
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
            <h1 className="text-lg sm:text-xl font-bold">Admin Panel</h1>
            <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-2 py-0.5">
              ADMIN
            </Badge>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-gray-400 text-sm hidden sm:inline">
              {userName}
            </span>
            <Link
              href="/dashboard"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              ← Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-16 sm:w-64 bg-gray-800 min-h-[calc(100vh-65px)] p-2 sm:p-4 shrink-0">
          <nav className="space-y-1 sm:space-y-2">
            {adminNavItems.map((item) => (
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

          {/* Quick Stats Summary */}
          <div className="hidden sm:block px-4 py-3 bg-gray-700/50 rounded-lg">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
              System Status
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">All systems operational</span>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
