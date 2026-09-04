import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface TerminalLayoutProps {
  children: React.ReactNode;
}

/**
 * `/terminal` layout -- deliberately NOT under `app/(dashboard)/`.
 *
 * Session 9-4 (Deviation 6, `AskUserQuestion`, Davin's live decision):
 * seed-code's real `/terminal` page is a full-screen 4-panel workspace that
 * mounts `ChatSidebar` itself as an internal resizable panel and never uses
 * `AppHeader` -- nesting it under `(dashboard)/layout.tsx`'s chrome would
 * double the sidebar. This layout only does the same auth gate + appearance
 * context `(dashboard)/layout.tsx` provides, with zero chrome of its own.
 *
 * Protected route - requires valid session (PRO tier gate enforced by the
 * page itself, matching `/free`'s equivalent FREE-tier page).
 */
export default async function TerminalLayout({
  children,
}: TerminalLayoutProps): Promise<React.ReactElement> {
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
