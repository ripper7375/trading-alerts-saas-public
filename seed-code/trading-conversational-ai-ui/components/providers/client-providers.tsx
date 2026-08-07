'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LocaleProvider>{children}</LocaleProvider>;
}
