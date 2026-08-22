import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface FreeLayoutProps {
  children: React.ReactNode;
}

/**
 * `/free` layout -- see app/terminal/layout.tsx's own doc comment for why
 * this is deliberately outside `app/(dashboard)/` (Deviation 6, same
 * reasoning, mirrored for the FREE-tier workspace).
 *
 * Protected route - requires valid session.
 */
export default async function FreeLayout({
  children,
}: FreeLayoutProps): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const appearance = await getServerAppearance();

  return (
    <AppearanceProvider initialSettings={appearance}>
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
    </AppearanceProvider>
  );
}
