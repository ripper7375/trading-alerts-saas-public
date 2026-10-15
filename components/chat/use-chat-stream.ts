'use client';

/**
 * Sending one request and feeding what comes back into the chat state (build step 7 part 8).
 *
 * `useChatStream` is the thin React layer over `wire.ts`: it keeps the AbortController of the request
 * in flight, refuses a second request while one is running (a guard on a REF, not on state, so two
 * clicks or two key presses that land in the same tick still send ONE request), turns every outcome
 * into reducer actions, and aborts the request when the component goes away.
 *
 * A request is `{ client_request_id, thread_id?, question }` or `{ client_request_id, thread_id?, kind }`
 * and nothing else: the user, the tier, the language and the model are the server's to decide, and a
 * body that named them would only be ignored (`lib/reply/server/request.ts`). The same
 * `client_request_id` sent again is the same request: the server charges it once and answers from what
 * it stored, which is what "Try again" relies on.
 *
 * @module components/chat/use-chat-stream
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';

import type { ChatAction } from './chat-state';
import type { AskInput } from './types';
import { sendMessage, type SendOutcome } from './wire';

type Fetch = typeof fetch;

/** A UUID v4 for `client_request_id`. `crypto.randomUUID` exists only in a secure context; the fallback does not. */
export function newRequestId(): string {
  const c: Crypto | undefined =
    typeof crypto === 'undefined' ? undefined : crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (c !== undefined) c.getRandomValues(bytes);
  else
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/** The JSON body of one request: only the fields the route reads. */
export function bodyOf(
  clientRequestId: string,
  threadId: string | null,
  input: AskInput
): Record<string, unknown> {
  return {
    client_request_id: clientRequestId,
    ...(threadId === null ? {} : { thread_id: threadId }),
    ...(input.kind === 'TYPED'
      ? { question: input.question }
      : { kind: input.intent }),
  };
}

export interface RunArgs {
  clientRequestId: string;
  threadId: string | null;
  input: AskInput;
  /** the same request again */
  retry: boolean;
}

export type Started =
  /** one was already in flight: nothing was sent */
  | { accepted: false }
  /** the request is on its way; `done` settles when its outcome has been fed to the state */
  | { accepted: true; done: Promise<SendOutcome> };

export interface ChatStream {
  /** Send a request, or refuse at once (and send nothing) when one is already in flight. */
  run: (args: RunArgs) => Started;
  /** Stop the request in flight, if any. */
  cancel: () => void;
}

export function useChatStream(
  fetchImpl: Fetch,
  dispatch: Dispatch<ChatAction>
): ChatStream {
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const run = useCallback(
    (args: RunArgs): Started => {
      // the guard is a ref, set before anything is awaited: a second call in the same tick is refused
      if (busy.current) return { accepted: false };
      busy.current = true;
      const own = new AbortController();
      controller.current = own;
      const send = (action: ChatAction): void => {
        if (alive.current) dispatch(action);
      };
      send({
        type: 'SEND_STARTED',
        clientRequestId: args.clientRequestId,
        input: args.input,
        retry: args.retry,
      });
      const done = (async (): Promise<SendOutcome> => {
        try {
          const outcome = await sendMessage({
            fetchImpl,
            body: bodyOf(args.clientRequestId, args.threadId, args.input),
            signal: own.signal,
            onStage: (event) => send({ type: 'STAGE', event }),
          });
          if (outcome.ok) {
            send({ type: 'TERMINAL', event: outcome.terminal });
          } else {
            send({
              type: 'SEND_FAILED',
              failure: outcome.failure,
              clientRequestId: args.clientRequestId,
              input: args.input,
            });
          }
          return outcome;
        } finally {
          busy.current = false;
          if (controller.current === own) controller.current = null;
        }
      })();
      return { accepted: true, done };
    },
    [fetchImpl, dispatch]
  );

  const cancel = useCallback((): void => {
    controller.current?.abort();
  }, []);

  return { run, cancel };
}
