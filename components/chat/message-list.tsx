'use client';

/**
 * The conversation (build step 7 part 8): the trader's bubbles, the analyst's cards, the stages of the
 * request in flight, and the empty state before the first question.
 *
 * It is a `role="log"` region, scrolled to the newest item whenever one arrives. It draws from the
 * chat state alone and adds nothing of its own: which card an item is, is the item's kind (the
 * server's, for a reply).
 *
 * @module components/chat/message-list
 */

import { Bot } from 'lucide-react';
import { useEffect, useRef, type ReactElement } from 'react';

import { ErrorCard } from './error-card';
import { ProgressStages } from './progress-stages';
import { RefusalCard } from './refusal-card';
import { ResultCard } from './result-card';
import type { ChatItem, ChatState } from './chat-state';
import type { AskInput, TradeSetupAction } from './types';
import { useChatWords } from './use-chat-words';

/** What the trader's own bubble says: the question as typed, or the label of the button pressed. */
export function UserBubble({ input }: { input: AskInput }): ReactElement {
  const { tr } = useChatWords();
  return (
    <div
      data-testid="user-bubble"
      data-source={input.kind === 'TYPED' ? 'TYPED' : input.intent}
      className="ms-auto max-w-[88%] rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs"
    >
      <p className="sr-only">{tr('chat.you')}</p>
      {input.kind === 'TYPED' ? (
        <p dir="auto" className="whitespace-pre-wrap break-words">
          {input.question}
        </p>
      ) : (
        <p className="font-medium">{tr(`chat.instant.${input.intent}`)}</p>
      )}
    </div>
  );
}

export interface MessageListProps {
  state: ChatState;
  onRetry: (item: Extract<ChatItem, { kind: 'ERROR' }>) => void;
  onStop?: () => void;
  onUpgrade?: () => void;
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}

export function MessageList({
  state,
  onRetry,
  onStop,
  onUpgrade,
  onOpenTradeSetup,
}: MessageListProps): ReactElement {
  const { tr } = useChatWords();
  const box = useRef<HTMLDivElement | null>(null);
  const busy = state.flight !== null;

  // where the reader's eyes should be: the bottom while a question or the stages are the newest thing,
  // the TOP of a reply when it has just arrived (a report is long: its headline and its direction come first)
  const stageKey =
    state.flight === null ? '' : Object.values(state.flight.stages).join();
  const newest = state.items[state.items.length - 1];
  useEffect(() => {
    const element = box.current;
    if (element === null) return;
    const last = element.lastElementChild;
    const reply = !busy && newest !== undefined && newest.kind !== 'USER';
    element.scrollTop =
      reply && last instanceof HTMLElement
        ? Math.max(0, last.offsetTop - 12)
        : element.scrollHeight;
  }, [state.items.length, busy, stageKey, newest]);

  const empty = state.items.length === 0 && !busy;

  return (
    <div
      ref={box}
      role="log"
      aria-label={tr('chat.messages.label')}
      data-testid="message-list"
      className="relative min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
    >
      {empty ? (
        <div
          data-testid="empty-state"
          className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-bold text-foreground">
            {tr('chat.empty.title')}
          </p>
          <p className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
            {tr('chat.empty.body')}
          </p>
        </div>
      ) : null}

      {state.items.map((item) => {
        switch (item.kind) {
          case 'USER':
            return <UserBubble key={item.id} input={item.input} />;
          case 'RESULT':
            return (
              <ResultCard
                key={item.id}
                result={item.result}
                {...(onOpenTradeSetup === undefined
                  ? {}
                  : { onOpenTradeSetup })}
              />
            );
          case 'REFUSAL':
            return (
              <RefusalCard
                key={item.id}
                refusal={item.refusal}
                quota={item.quota}
                {...(onUpgrade === undefined ? {} : { onUpgrade })}
              />
            );
          case 'ERROR':
            return (
              <ErrorCard
                key={item.id}
                code={item.code}
                requestId={item.requestId}
                retryable={item.retryable}
                retryDisabled={busy}
                onRetry={() => onRetry(item)}
              />
            );
          case 'CANCELLED':
            return (
              <p
                key={item.id}
                role="status"
                data-testid="cancelled-note"
                className="bg-muted/30 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground"
              >
                {tr('chat.cancelled')}
              </p>
            );
        }
      })}

      {state.flight === null ? null : (
        <ProgressStages
          stages={state.flight.stages}
          {...(onStop === undefined ? {} : { onStop })}
        />
      )}
    </div>
  );
}
