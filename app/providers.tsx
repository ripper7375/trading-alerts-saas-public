'use client';

import { SessionProvider } from 'next-auth/react';
import ClientProviders from '@/components/providers/client-providers';
import type { LocalePreferences } from '@/lib/i18n/locale-resolver';
import type { AppearanceSettings } from '@/lib/appearance/types';
import type { DisplayUsdRates } from '@/lib/country-config';

/**
 * No next-themes <ThemeProvider> here: AppearanceProvider (inside
 * ClientProviders) owns the <html> light/dark class. next-themes kept its
 * own theme state, seeded from localStorage, and re-applied it in a passive
 * effect AFTER AppearanceProvider's layout effect -- so whenever
 * localStorage and the server-resolved theme disagreed, the page chrome
 * ended up in one theme while components reading `resolvedTheme` (the
 * landing hero image, charts) rendered the other, until a reload.
 */
export function Providers({
  children,
  initialPreferences,
  initialAppearance,
  detectedTimezone,
  initialUsdRates,
}: {
  children: React.ReactNode;
  initialPreferences?: LocalePreferences;
  initialAppearance?: AppearanceSettings;
  detectedTimezone?: string | null;
  initialUsdRates?: DisplayUsdRates | null;
}) {
  return (
    <SessionProvider>
      <ClientProviders
        initialPreferences={initialPreferences}
        initialAppearance={initialAppearance}
        detectedTimezone={detectedTimezone}
        initialUsdRates={initialUsdRates}
      >
        {children}
      </ClientProviders>
    </SessionProvider>
  );
}
