'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';

export default function ClientProviders({
  children,
  initialPreferences = defaultPreferences,
}: {
  children: React.ReactNode;
  initialPreferences?: LocalePreferences;
}) {
  return (
    <LocaleProvider initialPreferences={initialPreferences}>
      {children}
    </LocaleProvider>
  );
}
