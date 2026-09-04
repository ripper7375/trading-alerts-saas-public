'use client';

import { LogOut, LineChart, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

import LoginForm from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';
import { isAuthBridgeEnabled } from '@/lib/auth/auth-bridge-flag';
import { useLocale } from '@/lib/context/locale-context';

// Same bridge-aware logout as components/layout/app-header.tsx — calling
// next-auth/react's signOut() alone leaves the operation-service refresh-
// token cookie (and, for any session established before a past cookie-
// domain change, an orphaned host-only session-token cookie signOut() can
// no longer reach) uncleared, so this screen kept showing "Already Signed
// In" no matter how many times Sign Out was clicked.
async function handleSignOut(): Promise<void> {
  if (isAuthBridgeEnabled()) {
    await fetch('/api/auth/token-logout', { method: 'POST' });
  }
  await signOut({ redirect: false });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full browser navigation is deliberate, matches app-header.tsx
  window.location.href = '/login';
}

export default function LoginPage(): JSX.Element {
  const { t } = useLocale();
  const { data: session, status } = useSession();

  if (status === 'authenticated' && session?.user) {
    const userTier = (session.user as { tier?: string } | undefined)?.tier;
    const workbenchHref = userTier === 'PRO' ? '/terminal' : '/free';

    return (
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl dark:border-slate-800/80 dark:bg-[#0b0e17]">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <UserCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('auth.login.already_signed_in', 'Already Signed In')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              'auth.login.signed_in_as_prefix',
              'You are currently signed in as'
            )}{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {session.user.name || session.user.email}
            </span>
            .
          </p>
        </div>
        <div className="space-y-3 pt-2">
          <Button asChild className="w-full" size="lg">
            <Link
              href={workbenchHref}
              className="flex items-center justify-center gap-2"
            >
              <LineChart className="h-4 w-4" />
              {t('auth.login.go_to_workbench', 'Go to Workbench')}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="flex w-full items-center justify-center gap-2"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" />
            {t('auth.login.sign_out', 'Sign Out')}
          </Button>
        </div>
      </div>
    );
  }

  return <LoginForm />;
}
