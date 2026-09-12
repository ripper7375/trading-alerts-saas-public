import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface CurrencyIndexProLayoutProps {
  children: React.ReactNode;
}

/**
 * `/pro/currency-index` layout -- auth-only gate, mirroring
 * `app/terminal/layout.tsx` exactly (PRO tier gate enforced by the page
 * itself, not here). Not nested under `(dashboard)/` for the same reason
 * `/terminal` isn't: this is its own full-width cockpit, not a page that
 * wants the dashboard chrome.
 */
export default async function CurrencyIndexProLayout({
  children,
}: CurrencyIndexProLayoutProps): Promise<React.ReactElement> {
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
