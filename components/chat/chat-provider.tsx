'use client';

/**
 * The chat state and what can be done to it (build step 7 part 8).
 *
 * `ChatProvider` holds the conversation of Panel B: the thread, the items on screen, the request in
 * flight and its stages, the state of `GET /api/chat/state` (the passed models, the balance, the
 * profile and the cycle). `useChat()` hands the panel's components the state and five things to do:
 * `ask`, `retry`, `stop`, `selectModel` and `reloadInfo`.
 *
 * It is hoisted (build step 7 part 9): the workspace mounts ONE provider above the three panels, so the
 * thread list of Panel A, the conversation of Panel B and the two Market Context badges of Panel C share
 * one state, one active thread and one request in flight. `ChatPanel` still mounts its own provider when
 * none is above it (`useOptionalChat`), which is how it runs on its own in the preview and the tests.
 * Because the provider sits above the panels, collapsing Panel B to its rail unmounts only the panel: the
 * conversation, the thread and a request in flight are all still here when it opens again.
 *
 * Who the trader is, what tier they have and which model answers are never sent from here: the server
 * reads them. A Free trader's provider never calls the routes at all (the panel shows the recorded
 * demo, ADR-072), so `loadOnMount` defaults to PRO only.
 *
 * @module components/chat/chat-provider
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

import {
  chatReducer,
  initialChatState,
  isBusy,
  isOpeningThread,
  type ChatItem,
  type ChatState,
} from './chat-state';
import { COMPOSER_MAX_CHARS } from './limits';
import { getThread } from './threads-wire';
import type { AskInput, TradeSetupAction } from './types';
import { newRequestId, useChatStream } from './use-chat-stream';
import { loadInfo, type SendOutcome } from './wire';

type Fetch = typeof fetch;

/**
 * How one `ask` ended, for a caller that must react to it (the Panel C badges: a refusal is shown
 * below the badge as well as in Panel B, a result expands Panel B). The chat state has already been told
 * (the update is dispatched; React draws it on its next render), so a caller never has to put the
 * answer on screen itself.
 */
export type AskOutcome =
  /** an answer was delivered into this thread */
  | { kind: 'RESULT'; threadId: string; requestId: string }
  /** the server (or its gate) said no; `reply` is its fixed words, in the reader's language */
  | { kind: 'REFUSAL'; reply: string }
  /** the chat routes are not switched on */
  | { kind: 'UNAVAILABLE' }
  /** an error card is on screen: the request failed on the way or on our side */
  | { kind: 'FAILED' }
  /** the trader stopped it */
  | { kind: 'CANCELLED' };

export interface AskOptions {
  /** called once, when an accepted request has ended; never for one that was not sent */
  onSettled?: (outcome: AskOutcome) => void;
}

/** What a request's end means to a caller that does not read the chat state. */
export function outcomeOf(outcome: SendOutcome): AskOutcome {
  if (outcome.ok) {
    const event = outcome.terminal;
    if (event.type === 'result') {
      return {
        kind: 'RESULT',
        threadId: event.result.thread_id,
        requestId: event.request_id,
      };
    }
    if (event.type === 'refusal') {
      return { kind: 'REFUSAL', reply: event.refusal.reply };
    }
    return { kind: 'FAILED' };
  }
  const failure = outcome.failure;
  switch (failure.kind) {
    case 'ABORTED':
      return { kind: 'CANCELLED' };
    case 'DISABLED':
      return { kind: 'UNAVAILABLE' };
    case 'REFUSED':
      return { kind: 'REFUSAL', reply: failure.refusal.reply };
    default:
      return { kind: 'FAILED' };
  }
}

export interface ChatContextValue {
  state: ChatState;
  /**
   * A request is in flight, or a thread is being opened: for the whole workspace. Every control that
   * would start another (the composer, the two Panel C badges, "new thread", a thread row) waits on it.
   */
  busy: boolean;
  /** the chat routes are being read (a Pro trader, and the workspace says the chat is on) */
  live: boolean;
  /** the `fetch` the chat uses, so Panel A's thread list talks to the same server (or stand-in) */
  fetcher: Fetch;
  /** Send a typed question or a Panel C label. False when it was not sent (empty, too long, or busy). */
  ask: (input: AskInput, options?: AskOptions) => boolean;
  /** Send an error's request again, with the same `client_request_id`. */
  retry: (item: Extract<ChatItem, { kind: 'ERROR' }>) => boolean;
  /** Stop the request in flight. */
  stop: () => void;
  selectModel: (slug: string) => void;
  reloadInfo: () => void;
  /** Panel A: start a new, empty thread. False while a request is in flight. */
  newThread: () => boolean;
  /** Panel A: open a thread of the trader's. False when it was not opened (busy, or not a Pro trader). */
  selectThread: (threadId: string) => boolean;
  /** Panel A: a thread was deleted; Panel B empties if it was the one on screen. */
  threadDeleted: (threadId: string) => void;
  /** a card's "Open trade setup" button */
  openTradeSetup: (action: TradeSetupAction) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  /** `FREE` never reads the routes */
  tier: 'FREE' | 'PRO';
  fetchImpl?: Fetch;
  /** a new `client_request_id` for each press (a test passes its own) */
  makeId?: () => string;
  /** a state to start from (the development preview and the tests play states into it) */
  initialState?: ChatState;
  /** read `GET /api/chat/state` when mounted; defaults to true for PRO */
  loadOnMount?: boolean;
  /** called by a card's "Open trade setup" button */
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}

/** The characters the door counts: code points, as the trader sees them. */
export const lengthOf = (text: string): number => Array.from(text).length;

export function ChatProvider({
  children,
  tier,
  fetchImpl,
  makeId = newRequestId,
  initialState,
  loadOnMount,
  onOpenTradeSetup,
}: ChatProviderProps): ReactElement {
  const [state, dispatch] = useReducer(
    chatReducer,
    initialState,
    (start) => start ?? initialChatState()
  );
  const fetcher: Fetch =
    fetchImpl ?? ((...args: Parameters<Fetch>) => fetch(...args));
  const stream = useChatStream(fetcher, dispatch);

  // the latest values, for callbacks that must not change identity on every render
  const threadRef = useRef(state.threadId);
  threadRef.current = state.threadId;
  // the latest answer to "may another request start", for callbacks that must not change identity
  const busyRef = useRef(false);
  busyRef.current = isBusy(state) || isOpeningThread(state);
  const isOpeningThreadRef = useRef(false);
  isOpeningThreadRef.current = isOpeningThread(state);
  const threadFlight = useRef<AbortController | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const openRef = useRef(onOpenTradeSetup);
  openRef.current = onOpenTradeSetup;
  const alive = useRef(true);
  const infoFlight = useRef<AbortController | null>(null);

  const reloadInfo = useCallback((): void => {
    if (tier !== 'PRO') return;
    infoFlight.current?.abort();
    const own = new AbortController();
    infoFlight.current = own;
    dispatch({ type: 'INFO_LOADING' });
    void loadInfo(fetcherRef.current, own.signal).then((outcome) => {
      if (!alive.current || own.signal.aborted) return;
      if (outcome.ok) dispatch({ type: 'INFO_LOADED', info: outcome.info });
      else if (outcome.reason !== 'ABORTED') {
        dispatch({ type: 'INFO_FAILED', reason: outcome.reason });
      }
    });
  }, [tier]);

  const shouldLoad = loadOnMount ?? tier === 'PRO';
  useEffect(() => {
    alive.current = true;
    if (shouldLoad) reloadInfo();
    return () => {
      alive.current = false;
      infoFlight.current?.abort();
      threadFlight.current?.abort();
    };
  }, [shouldLoad, reloadInfo]);

  const send = useCallback(
    (
      input: AskInput,
      clientRequestId: string,
      retry: boolean,
      options?: AskOptions
    ): boolean => {
      // a thread is being opened: a question sent now would join it and then be wiped by its messages
      if (isOpeningThreadRef.current) return false;
      const started = stream.run({
        clientRequestId,
        threadId: threadRef.current,
        input,
        retry,
      });
      if (!started.accepted) return false;
      // the balance moved (a settled request, or a refusal about it): read it again, unless the
      // route is not on at all (then there is nothing to read)
      void started.done.then((outcome) => {
        if (alive.current) options?.onSettled?.(outcomeOf(outcome));
        if (outcome.ok === false && outcome.failure.kind === 'DISABLED') return;
        if (alive.current && tier === 'PRO') reloadInfo();
      });
      return true;
    },
    [stream, reloadInfo, tier]
  );

  const ask = useCallback(
    (input: AskInput, options?: AskOptions): boolean => {
      if (input.kind === 'TYPED') {
        const text = input.question.trim();
        if (text === '' || lengthOf(text) > COMPOSER_MAX_CHARS) return false;
        return send(
          { kind: 'TYPED', question: text },
          makeId(),
          false,
          options
        );
      }
      return send(input, makeId(), false, options);
    },
    [send, makeId]
  );

  const retry = useCallback(
    (item: Extract<ChatItem, { kind: 'ERROR' }>): boolean =>
      item.retryable ? send(item.input, item.clientRequestId, true) : false,
    [send]
  );

  const stop = useCallback((): void => stream.cancel(), [stream]);
  const selectModel = useCallback(
    (slug: string): void => dispatch({ type: 'SELECT_MODEL', slug }),
    []
  );
  const openTradeSetup = useCallback((action: TradeSetupAction): void => {
    openRef.current?.(action);
  }, []);

  const newThread = useCallback((): boolean => {
    if (busyRef.current) return false;
    threadFlight.current?.abort();
    dispatch({ type: 'NEW_THREAD' });
    return true;
  }, []);

  const selectThread = useCallback(
    (threadId: string): boolean => {
      if (tier !== 'PRO' || busyRef.current) return false;
      threadFlight.current?.abort();
      const own = new AbortController();
      threadFlight.current = own;
      dispatch({ type: 'THREAD_LOADING', threadId });
      void getThread(fetcherRef.current, threadId, own.signal).then(
        (outcome) => {
          if (!alive.current || own.signal.aborted) return;
          if (outcome.ok) {
            dispatch({ type: 'THREAD_LOADED', threadId, items: outcome.items });
          } else if (outcome.reason !== 'ABORTED') {
            dispatch({ type: 'THREAD_FAILED', threadId });
          }
        }
      );
      return true;
    },
    [tier]
  );

  const threadDeleted = useCallback((threadId: string): void => {
    dispatch({ type: 'THREAD_DELETED', threadId });
  }, []);

  const fetchStable = useCallback<Fetch>(
    (...args) => fetcherRef.current(...args),
    []
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      state,
      busy: isBusy(state) || isOpeningThread(state),
      live: tier === 'PRO' && shouldLoad,
      fetcher: fetchStable,
      ask,
      retry,
      stop,
      selectModel,
      reloadInfo,
      openTradeSetup,
      newThread,
      selectThread,
      threadDeleted,
    }),
    [
      state,
      tier,
      shouldLoad,
      fetchStable,
      ask,
      retry,
      stop,
      selectModel,
      reloadInfo,
      openTradeSetup,
      newThread,
      selectThread,
      threadDeleted,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/** The chat, or null when there is no provider above (the panel then mounts its own). */
export function useOptionalChat(): ChatContextValue | null {
  return useContext(ChatContext);
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (context === null) {
    throw new Error('useChat must be used inside a ChatProvider');
  }
  return context;
}
