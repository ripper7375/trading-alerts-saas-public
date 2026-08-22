'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { AppearanceSettings } from '@/lib/appearance/types';

/**
 * Support-chat widget (SupportChatProvider/SupportChatWidget/FloatingChatTrigger
 * in seed-code) is deliberately NOT wired here. Its implementation falls back to
 * a hardcoded canned-response generator with no real backend (lib/socket-client.ts
 * points at NEXT_PUBLIC_SOCKET_CHAT_URL, which doesn't exist until Phase 14 builds
 * the Contabo Socket.io stack) -- mounting it now would present a fake "AI Support
 * Specialist" site-wide. Davin approved deferring it to Phase 14, Session 9-1.
 */
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
