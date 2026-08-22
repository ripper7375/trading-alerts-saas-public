import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

import { SettingsNav } from './_components/settings-nav';
import AppHeader from '@/components/layout/app-header';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

/**
 * `/settings/*` layout -- deliberately NOT under `app/(dashboard)/`, per
 * Session 9-4's own `/dashboard`, `/terminal`, `/free` precedent (see
 * app/dashboard/layout.tsx's doc comment for the full rationale). Unlike
 * those pages, the 11 settings pages genuinely share one nav shell, so
 * (unlike 9-4's own pattern of each page mounting AppHeader itself with no
 * shared layout content) this layout owns AppHeader + the settings sub-nav
 * once, and every page below it is a plain content fragment.
 *
 * `app/(dashboard)/layout.tsx` is untouched and keeps serving `/admin/*`
 * until Session 9-8.
 *
 * Protected route - requires valid session.
 */
export default async function SettingsLayout({
  children,
}: SettingsLayoutProps): Promise<React.ReactElement> {
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
        className="min-h-screen bg-background"
      >
        <LoginTracker />
        <TokenRefreshProvider />
        <AppHeader title="Settings" subtitle="Account & preferences" />

        <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row">
            <SettingsNav />

            <div className="flex-1">
              <div className="min-h-[600px] rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppearanceProvider>
  );
}
