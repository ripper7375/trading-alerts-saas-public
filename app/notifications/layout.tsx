import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface NotificationsLayoutProps {
  children: React.ReactNode;
}

/**
 * `/notifications` layout -- see app/dashboard/layout.tsx's own doc comment
 * for why this moved out of `app/(dashboard)/` (Deviation 6/7 extended,
 * same reasoning).
 *
 * Protected route - requires valid session.
 */
export default async function NotificationsLayout({
  children,
}: NotificationsLayoutProps): Promise<React.ReactElement> {
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
