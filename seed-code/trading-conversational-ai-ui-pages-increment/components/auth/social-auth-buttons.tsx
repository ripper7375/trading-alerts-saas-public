'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLocale } from '@/lib/context/locale-context';

type Provider = 'google' | 'twitter';
type LoadingProvider = Provider | null;

export default function SocialAuthButtons({
  redirectTo = '/dashboard',
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [loadingProvider, setLoadingProvider] = useState<LoadingProvider>(null);

  const handleSocialSignIn = (provider: Provider): void => {
    setLoadingProvider(provider);
    // This increment is frontend-only (no next-auth/OAuth backend), so these
    // buttons mirror the mocked-success pattern the rest of the auth flow
    // already uses rather than being dead/non-functional.
    setTimeout(() => {
      setLoadingProvider(null);
      router.push(redirectTo);
    }, 800);
  };

  const isLoading = loadingProvider !== null;

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => handleSocialSignIn('google')}
        disabled={isLoading}
        className="dark:border-slate-750 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#0d1019] dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        {loadingProvider === 'google' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg
            className="h-4 w-4"
            viewBox="0 0 48 48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#FFC107"
              d="M43.6,20.1H42V20H24v8h11.3C34.4,31.9,30,34,24,34c-9.9,0-18-8.1-18-18S14.1,16,24,16c3.1,0,6.3,0.8,9.1,2.3l6-6C37.1,9.1,30.9,6,24,6C12.9,6,4,18.9,4,30s8.9,24,20,24c7.5,0,13.8-3.6,16.6-8.6L43.6,20.1z"
            />
            <path
              fill="#FF3D00"
              d="M6.3,14.7l6.6,4.8C14.6,15.7,18.9,12,24,12c3.1,0,6.3,0.8,9.1,2.3l6-6C33.1,4.1,26.9,1,20,1C10.9,1,1,10.9,1,20s9.9,19,19,19l6-6L6.3,14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24,43c4.9,0,9.6-1.9,13-5.2l-6-5.2C28.9,34.9,26.6,35,24,35c-6,0-11-4.9-11-11s5-11,11-11c2.7,0,5.2,1,7.1,2.8l6,5.2C29.6,16.9,26.9,16,24,16c-7.5,0-13.8,3.6-16.6,8.6L8.7,14.7l6.6,4.8L24,43z"
            />
            <path
              fill="#1976D2"
              d="M43.6,20.1H42V20H24v8h11.3C34.4,31.9,30,34,24,34c-9.9,0-18-8.1-18-18S14.1,16,24,16c3.1,0,6.3,0.8,9.1,2.3l6-6C37.1,9.1,30.9,6,24,6C12.9,6,4,18.9,4,30s8.9,24,20,24c7.5,0,13.8-3.6,16.6-8.6L43.6,20.1z"
            />
          </svg>
        )}
        {t('Sign in with Google')}
      </button>

      <button
        type="button"
        onClick={() => handleSocialSignIn('twitter')}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800"
      >
        {loadingProvider === 'twitter' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        )}
        {t('Continue with X')}
      </button>
    </div>
  );
}
