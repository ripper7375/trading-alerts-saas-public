import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { LoginTracker } from '@/components/auth/login-tracker';
import { TokenRefreshProvider } from '@/components/auth/token-refresh-provider';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { authOptions } from '@/lib/auth/auth-options';
import { getServerAppearance } from '@/lib/appearance/server-appearance';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

/**
 * Dashboard Layout (core) — `/dashboard`, `/alerts`, `/alerts/new`,
 * `/alerts/[id]/edit`, `/notifications`.
 *
 * Session 9-4: this is now a thin wrapper, not a chrome-rendering shell.
 * Every seed-code page under `app/(dashboard)/` mounts its own `<AppHeader
 * />` directly (confirmed by reading all 5 source files — none of them
 * consume a shared header/sidebar from a parent layout, and none of them use
 * `ChatSidebar` at all). This layout's only job is the server-side auth gate
 * (defense-in-depth alongside middleware.ts, LESSONS-LEARNED.md L17) plus the
 * zero-FOUC appearance/theme context every dashboard page needs.
 *
 * `/terminal` and `/free` deliberately live OUTSIDE this route group (see
 * app/terminal/layout.tsx, app/free/layout.tsx) — seed-code's own versions
 * of those two pages are full-screen 4-panel workspaces that mount
 * `ChatSidebar` themselves as an internal resizable panel and never use
 * `AppHeader`; nesting them under this layout would double the sidebar and
 * add a header bar neither page's real design has.
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
        className="min-h-screen bg-background"
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

        {children}
      </div>
    </AppearanceProvider>
  );
}
