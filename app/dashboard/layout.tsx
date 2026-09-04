import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * `/dashboard` layout -- deliberately NOT under `app/(dashboard)/`.
 *
 * Session 9-4 (Deviation 6/7 extended): `app/(dashboard)/layout.tsx` was
 * restored to its original form (legacy Header/Sidebar/Footer) because it
 * still wraps `/settings/*` and `/admin/*` (untouched this session, owned
 * by 9-5/9-8). `/dashboard` mounts its own `AppHeader` directly (matching
 * seed-code, Deviation 7) -- staying under the shared route group would
 * have doubled the chrome (legacy Header/Sidebar plus AppHeader). Moved
 * out instead, mirroring `/terminal` and `/free`'s own move. URL is
 * unaffected (route groups are URL-neutral).
 *
 * Protected route - requires valid session.
 */
export default async function DashboardPageLayout({
  children,
}: DashboardLayoutProps): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const appearance = await getServerAppearance();

  return (
    <div
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
      {children}
    </div>
  );
}
