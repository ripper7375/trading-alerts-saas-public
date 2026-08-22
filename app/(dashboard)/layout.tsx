import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

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

  // This layout already gates on a per-request getServerSession() call
  // (dynamic rendering is unavoidable here), so resolving appearance here —
  // rather than in the root layout — gets zero-FOUC accent/chart tokens for
  // the dashboard at zero extra dynamic-rendering cost, without forcing
  // public/marketing pages (which have no accent-dependent UI) off static
  // generation. See lib/appearance/server-appearance.ts for the resolution
  // hierarchy (DB record -> cookie -> defaults).
  const appearance = await getServerAppearance();

  return (
    <AppearanceProvider initialSettings={appearance}>
      <div
        className="min-h-screen bg-gray-50 dark:bg-gray-900"
        data-accent={appearance.accent}
        style={
          {
            '--chart-candle-up': appearance.chartUpColor,
            '--chart-candle-down': appearance.chartDownColor,
            '--chart-grid-opacity': (appearance.gridOpacity / 100).toString(),
          } as React.CSSProperties
        }
      >
        {/* Login tracking - records device/location for security */}
        <LoginTracker />

        {/* Session 3-3: operation-service refresh-token rotation loop — no-op
            for sessions that only carry a NextAuth cookie (see the component's
            own doc comment) */}
        <TokenRefreshProvider />

        {/* Header - sticky at top */}
        <Header user={user} />

        <div className="flex">
          {/* Sidebar - hidden on mobile, fixed on desktop */}
          <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:pt-16">
            <Sidebar userTier={user.tier} userRole={user.role} />
          </aside>

          {/* Main content area */}
          <main className="min-h-[calc(100vh-4rem)] flex-1 pt-16 lg:pl-64">
            <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </div>

        {/* Footer */}
        <div className="lg:pl-64">
          <Footer />
        </div>
      </div>
    </AppearanceProvider>
  );
}
