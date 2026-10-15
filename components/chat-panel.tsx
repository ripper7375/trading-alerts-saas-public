'use client';

/**
 * AI Analyst chat panel (Panel B of the workspace; build step 7 part 8).
 *
 * The shell the workspace mounts. It keeps the props and the file the workspace already uses
 * (`ChatPanelProps`), and draws the live copilot of `components/chat/`:
 *
 *  - PRO: the model picker (the models that PASSED their evaluation, with their measured cost, or
 *    none), the cycle and profile badges, the conversation (the progress stages, Report 1, short
 *    answers, refusals, errors), the monthly allowance as a share and "about N analyses left", and the
 *    composer (500 characters, Enter sends, Shift+Enter adds a line);
 *  - FREE: no chat (ADR-072): the recorded example, a locked picker and the upgrade call to action.
 *
 * Nothing about a model, a price, an allowance or a reply is written in this file. The models and the
 * balance come from `GET /api/chat/state`, the answers from `POST /api/chat/message`, every word from
 * the `chat.*` dictionary keys, and the server decides who may ask, with which model, and for how much.
 * While `REPLY_ENABLED` is off the routes answer 404 and the panel says the analyst is not switched on.
 *
 * The state lives in a `ChatProvider`. This shell mounts its own unless one is already above it (build
 * step 7 part 9 hoists one into the workspace so Panels A, B and C share it).
 *
 * @module components/chat-panel
 */

import { useMemo } from 'react';

import { ChatPanelView } from '@/components/chat/chat-panel-view';
import { ChatProvider, useOptionalChat } from '@/components/chat/chat-provider';
import { loadDemo } from '@/components/chat/demo-source';
import { useTradeSetupLauncher } from '@/components/chat/trade-setup-launcher';
import { useLocale } from '@/lib/context/locale-context';
import type { Tier } from '@/lib/tier-config';

export interface ChatPanelProps {
  tier: Tier;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: () => void;
  symbol?: string;
  timeframe?: string;
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
}

export default function ChatPanel({
  tier,
  onCollapsePanel,
  onOpenUpgradeModal,
  pendingPrompt,
  onClearPendingPrompt,
}: ChatPanelProps): React.JSX.Element {
  const { language } = useLocale();
  const inherited = useOptionalChat();
  const launcher = useTradeSetupLauncher();
  const demo = useMemo(() => loadDemo(language), [language]);
  const chatTier = tier === 'PRO' ? 'PRO' : 'FREE';

  const view = (
    <ChatPanelView
      tier={chatTier}
      demo={demo}
      overlay={launcher.element}
      {...(onCollapsePanel === undefined ? {} : { onCollapsePanel })}
      {...(onOpenUpgradeModal === undefined ? {} : { onOpenUpgradeModal })}
      {...(pendingPrompt === undefined ? {} : { pendingPrompt })}
      {...(onClearPendingPrompt === undefined ? {} : { onClearPendingPrompt })}
    />
  );

  return inherited !== null ? (
    view
  ) : (
    <ChatProvider tier={chatTier} onOpenTradeSetup={launcher.open}>
      {view}
    </ChatProvider>
  );
}
