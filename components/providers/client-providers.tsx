'use client';

import React from 'react';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { AppearanceSettings } from '@/lib/appearance/types';
import { SupportChatProvider } from '@/components/chat-widget/chat-context';
import { FloatingChatTrigger } from '@/components/chat-widget/floating-chat-trigger';
import { SupportChatWidget } from '@/components/chat-widget/support-chat-widget';

/**
 * Support-chat widget mounted site-wide (Session 14-2, Decision 4). If
 * NEXT_PUBLIC_SOCKET_CHAT_URL is unset, lib/socket-client.ts's
 * chatSocketManager degrades to its existing canned-response generator
 * rather than throwing -- zero-downtime rollback is unsetting that one
 * env var (Session 14-2's own rollback invariant).
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
        <SupportChatProvider>
          {children}
          <FloatingChatTrigger />
          <SupportChatWidget />
        </SupportChatProvider>
      </AppearanceProvider>
    </LocaleProvider>
  );
}
