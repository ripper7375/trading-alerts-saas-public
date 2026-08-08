'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';

export default function ClientProviders({
  children,
  initialLocale = 'en-GB',
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>{children}</LocaleProvider>
  );
}
