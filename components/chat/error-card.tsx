'use client';

/**
 * A request that failed on the way (build step 7 part 8; ADR-054): an error event after the stream
 * began (`INTERNAL`, `LEDGER_UNAVAILABLE`, `PERSISTENCE_FAILED`), a connection that dropped, a stream
 * that was cut or could not be read, or a status the server answered with.
 *
 * The words say what is true for each: a request nobody could price was never run; an analysis that
 * was made and could not be filed is NOT shown and the request id is what support opens. "Try again"
 * sends the same request with the same `client_request_id`, so a reply the server already stored comes
 * back and is charged once. It is offered only when the server (or the kind of failure) says the same
 * request may be sent again.
 *
 * @module components/chat/error-card
 */

import { AlertTriangle } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

import type { ChatKey } from './text';
import { useChatWords } from './use-chat-words';

const MESSAGE_KEY: Record<string, ChatKey> = {
  INTERNAL: 'chat.error.INTERNAL',
  LEDGER_UNAVAILABLE: 'chat.error.LEDGER_UNAVAILABLE',
  PERSISTENCE_FAILED: 'chat.error.PERSISTENCE_FAILED',
  NETWORK: 'chat.error.NETWORK',
  BAD_STREAM: 'chat.error.BAD_STREAM',
};

/** The words for a code: its own, or the general failure for a status code we have no words for. */
export function errorKeyOf(code: string): ChatKey {
  return Object.prototype.hasOwnProperty.call(MESSAGE_KEY, code)
    ? (MESSAGE_KEY[code] as ChatKey)
    : 'chat.error.HTTP';
}

export interface ErrorCardProps {
  code: string;
  requestId: string | null;
  retryable: boolean;
  onRetry?: () => void;
  /** the retry is not possible just now (another request is running) */
  retryDisabled?: boolean;
}

export function ErrorCard({
  code,
  requestId,
  retryable,
  onRetry,
  retryDisabled = false,
}: ErrorCardProps): ReactElement {
  const { tr, inline } = useChatWords();
  return (
    <div
      role="alert"
      data-testid="error-card"
      data-code={code}
      className="space-y-2 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {tr('chat.error.title')}
      </p>
      <p className="break-words text-sm leading-relaxed">
        {tr(errorKeyOf(code))}
      </p>
      {requestId === null ? null : (
        <p
          data-testid="error-request-id"
          className="break-all text-[11px] text-muted-foreground"
        >
          {tr('chat.error.request_id', { id: inline(requestId) })}
        </p>
      )}
      {retryable && onRetry !== undefined ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retryDisabled}
          onClick={onRetry}
          className="h-7 text-xs font-semibold"
        >
          {tr('chat.retry')}
        </Button>
      ) : null}
    </div>
  );
}
