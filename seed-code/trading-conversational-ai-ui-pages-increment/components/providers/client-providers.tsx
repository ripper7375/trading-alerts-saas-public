'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { AppearanceSettings } from '@/lib/appearance/types';

export default function ClientProviders({
  children,
  initialPreferences = defaultPreferences,
  initialAppearance,
}: {
  children: React.ReactNode;
  initialPreferences?: LocalePreferences;
  initialAppearance?: AppearanceSettings;
}) {
  return (
    <LocaleProvider initialPreferences={initialPreferences}>
      <AppearanceProvider initialSettings={initialAppearance}>
        {children}
      </AppearanceProvider>
    </LocaleProvider>
  );
}
