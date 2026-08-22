'use client';

import { Suspense } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import ClientProviders from '@/components/providers/client-providers';
import { ThemeSync } from '@/components/theme-sync';
import type { LocalePreferences } from '@/lib/i18n/locale-resolver';
import type { AppearanceSettings } from '@/lib/appearance/types';

export function Providers({
  children,
  initialTheme,
  initialPreferences,
  initialAppearance,
}: {
  children: React.ReactNode;
  initialTheme?: 'light' | 'dark' | 'system';
  initialPreferences?: LocalePreferences;
  initialAppearance?: AppearanceSettings;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={initialTheme ?? 'system'}
      enableSystem
      storageKey="davintrade-theme"
      disableTransitionOnChange
    >
      <SessionProvider>
        <Suspense fallback={null}>
          <ThemeSync />
        </Suspense>
        <ClientProviders
          initialPreferences={initialPreferences}
          initialAppearance={initialAppearance}
        >
          {children}
        </ClientProviders>
      </SessionProvider>
    </ThemeProvider>
  );
}
