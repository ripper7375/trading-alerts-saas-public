'use client';

/**
 * Panel B, drawn (build step 7 part 8): the header (the model picker or its locked stand-in, the
 * collapse control), the cycle and profile badges, the conversation or the recorded example, the quota
 * meter and the composer.
 *
 * `components/chat-panel.tsx` is the shell the workspace mounts; this is what it draws, split out so
 * the development preview and the tests can render the panel over a chat state they choose. It reads
 * the chat through `useChat()` (a provider above it), and everything it is told about the tier, the
 * demo and the buttons comes in as props.
 *
 * PRO: the live copilot. FREE: no chat at all (ADR-072): the recorded example, a model picker that is
 * locked, and the upgrade call to action. A panel whose server side is not switched on yet (the state
 * route answers 404) says so, and shows no composer.
 *
 * @module components/chat/chat-panel-view
 */

import Link from 'next/link';
import { Bot, ChevronDown, ChevronLeft, Lock, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/context/locale-context';
import { cn } from '@/lib/utils';

import { chosenModel } from './chat-state';
import { useChat } from './chat-provider';
import { Composer } from './composer';
import { CycleBadges } from './cycle-badges';
import { DemoReplay } from './demo-replay';
import { MessageList } from './message-list';
import { ModelPicker } from './model-picker';
import { QuotaMeter } from './quota-meter';
import type { DemoRecording } from './types';
import { useChatWords } from './use-chat-words';

export interface ChatPanelViewProps {
  tier: 'FREE' | 'PRO';
  /** the recorded example for a Free trader; null when there is none yet */
  demo: DemoRecording | null;
  onCollapsePanel?: () => void;
  onOpenUpgradeModal?: () => void;
  /** a prompt from Panel C that is waiting to be put in the composer */
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
  /** the Trade Setup notice or modal, drawn above the meter */
  overlay?: ReactNode;
}

function Header({
  tier,
  onCollapsePanel,
}: Pick<ChatPanelViewProps, 'tier' | 'onCollapsePanel'>): ReactElement {
  const { t } = useLocale();
  const { tr } = useChatWords();
  const chat = useChat();
  const { state } = chat;
  const models = state.info?.models ?? [];

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3.5">
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="truncate text-xs font-bold text-foreground">
          {t('AI Analyst')}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        {tier === 'FREE' ? (
          <Link
            href="/pricing"
            aria-label={tr('chat.model.locked')}
            data-testid="model-picker-locked"
            className="shadow-xs group relative flex h-7 w-[150px] min-w-0 max-w-full shrink items-center justify-center overflow-hidden rounded-md border border-border"
          >
            <span
              aria-hidden="true"
              className="flex w-full select-none items-center justify-between px-2 text-xs font-semibold text-foreground blur-[1.5px]"
            >
              <span>{tr('chat.model.label')}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'absolute inset-0 flex items-center justify-center gap-1 backdrop-blur-[2px] transition-colors',
                'bg-white/45 group-hover:bg-white/60 dark:bg-slate-950/45 dark:group-hover:bg-slate-950/60'
              )}
            >
              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
              </span>
            </span>
          </Link>
        ) : (
          <ModelPicker
            models={models}
            chosen={chosenModel(state)}
            info={state.info}
            onSelect={chat.selectModel}
            disabled={chat.busy}
          />
        )}

        {onCollapsePanel === undefined ? null : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapsePanel}
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            title={t('Collapse panel')}
            aria-label={t('Collapse panel')}
          >
            <ChevronLeft
              className="h-4 w-4 rtl:rotate-180"
              aria-hidden="true"
            />
          </Button>
        )}
      </div>
    </div>
  );
}

function Unavailable(): ReactElement {
  const { tr } = useChatWords();
  return (
    <div
      role="status"
      data-testid="unavailable"
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Bot className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-sm font-bold text-foreground">
        {tr('chat.unavailable.title')}
      </p>
      <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        {tr('chat.unavailable.body')}
      </p>
    </div>
  );
}

function FreeFooter({
  onOpenUpgradeModal,
}: Pick<ChatPanelViewProps, 'onOpenUpgradeModal'>): ReactElement {
  const { t } = useLocale();
  const { tr } = useChatWords();
  return (
    <div
      className="shrink-0 border-t border-border bg-card p-3"
      data-testid="free-footer"
    >
      <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 sm:flex-row">
        <div className="flex items-center gap-2">
          <Lock
            className="h-4 w-4 shrink-0 text-amber-500"
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-bold text-foreground">
              {tr('chat.free.title')}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {tr('chat.free.body')}
            </div>
          </div>
        </div>
        {onOpenUpgradeModal === undefined ? null : (
          <Button
            size="sm"
            onClick={onOpenUpgradeModal}
            className="h-6 shrink-0 bg-amber-500 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
          >
            <Sparkles className="me-1 h-3 w-3 fill-black" aria-hidden="true" />
            {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChatPanelView({
  tier,
  demo,
  onCollapsePanel,
  onOpenUpgradeModal,
  pendingPrompt,
  onClearPendingPrompt,
  overlay,
}: ChatPanelViewProps): ReactElement {
  const { tr } = useChatWords();
  const chat = useChat();
  const { state } = chat;
  const [input, setInput] = useState('');

  // a prompt a Panel C badge left: it goes into the composer for the trader to read and send
  useEffect(() => {
    if (pendingPrompt && tier === 'PRO') {
      setInput(pendingPrompt);
      onClearPendingPrompt?.();
    }
  }, [pendingPrompt, tier, onClearPendingPrompt]);

  const unavailable = state.infoStatus === 'unavailable';
  const loading = state.info === null && state.infoStatus === 'loading';
  const failed = state.infoStatus === 'error' && state.info === null;

  return (
    <div
      data-testid="chat-panel"
      data-tier={tier}
      className="flex h-full w-full min-w-0 flex-col overflow-hidden border-e border-border bg-card"
      role="region"
      aria-label={tr('chat.panel.label')}
    >
      <Header tier={tier} onCollapsePanel={onCollapsePanel} />

      {tier === 'FREE' ? (
        <>
          <DemoReplay demo={demo} />
          <FreeFooter onOpenUpgradeModal={onOpenUpgradeModal} />
        </>
      ) : (
        <>
          <CycleBadges info={state.info} />
          {unavailable ? (
            <Unavailable />
          ) : loading ? (
            <p
              role="status"
              data-testid="loading"
              className="flex-1 p-6 text-center text-xs text-muted-foreground"
            >
              {tr('chat.loading')}
            </p>
          ) : (
            <>
              {failed ? (
                <div
                  role="alert"
                  data-testid="state-failed"
                  className="m-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-xs"
                >
                  <span>{tr('chat.state_failed')}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={chat.reloadInfo}
                    className="h-6 text-[11px]"
                  >
                    {tr('chat.retry')}
                  </Button>
                </div>
              ) : null}
              <MessageList
                state={state}
                onRetry={chat.retry}
                onStop={chat.stop}
                {...(onOpenUpgradeModal === undefined
                  ? {}
                  : { onUpgrade: onOpenUpgradeModal })}
                onOpenTradeSetup={chat.openTradeSetup}
                onReopen={() => {
                  if (state.threadId !== null)
                    chat.selectThread(state.threadId);
                }}
              />
            </>
          )}
          {overlay}
          {unavailable ? null : (
            <QuotaMeter info={state.info} model={chosenModel(state)} />
          )}
          {unavailable ? null : (
            <div className="shrink-0 border-t border-border bg-card p-3">
              <Composer
                value={input}
                onChange={setInput}
                busy={chat.busy}
                onSubmit={() => chat.ask({ kind: 'TYPED', question: input })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
