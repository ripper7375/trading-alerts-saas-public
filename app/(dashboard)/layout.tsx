import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { authOptions } from '@/lib/auth/auth-options';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard Layout
 *
 * Wraps all dashboard pages with:
 * - Authentication check (redirects to /login if not authenticated)
 * - Header with user menu and notifications
 * - Sidebar navigation (desktop) / Mobile nav (mobile)
 * - Footer with links
 *
 * Protected route - requires valid session
 */
export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<React.ReactElement> {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  // Extract user info for components
  const user = {
    id: session.user.id,
    name: session.user.name || 'User',
    email: session.user.email || '',
    image: session.user.image,
    tier: session.user.tier || 'FREE',
    role: session.user.role || 'USER',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - sticky at top */}
      <Header user={user} />

      <div className="flex">
        {/* Sidebar - hidden on mobile, fixed on desktop */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:pt-16 lg:z-30">
          <Sidebar userTier={user.tier} />
        </aside>

        {/* Main content area */}
        <main className="flex-1 lg:pl-64 pt-16 min-h-[calc(100vh-4rem)]">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Footer */}
      <div className="lg:pl-64">
        <Footer />
      </div>

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
}
