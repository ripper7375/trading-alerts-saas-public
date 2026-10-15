'use client';

/**
 * The chat state and what can be done to it (build step 7 part 8).
 *
 * `ChatProvider` holds the conversation of Panel B: the thread, the items on screen, the request in
 * flight and its stages, the state of `GET /api/chat/state` (the passed models, the balance, the
 * profile and the cycle). `useChat()` hands the panel's components the state and five things to do:
 * `ask`, `retry`, `stop`, `selectModel` and `reloadInfo`.
 *
 * It is built to be hoisted: `ChatPanel` mounts its own provider when none is above it and uses the
 * one that is when there is (`useOptionalChat`), so build step 7 part 9 can lift it into the workspace
 * to share one state between the three panels without touching the panel.
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
  type ChatItem,
  type ChatState,
} from './chat-state';
import { COMPOSER_MAX_CHARS } from './limits';
import type { AskInput, TradeSetupAction } from './types';
import { newRequestId, useChatStream } from './use-chat-stream';
import { loadInfo } from './wire';

type Fetch = typeof fetch;

export interface ChatContextValue {
  state: ChatState;
  /** a request is in flight, for the whole workspace */
  busy: boolean;
  /** Send a typed question or a Panel C label. False when it was not sent (empty, too long, or busy). */
  ask: (input: AskInput) => boolean;
  /** Send an error's request again, with the same `client_request_id`. */
  retry: (item: Extract<ChatItem, { kind: 'ERROR' }>) => boolean;
  /** Stop the request in flight. */
  stop: () => void;
  selectModel: (slug: string) => void;
  reloadInfo: () => void;
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
    };
  }, [shouldLoad, reloadInfo]);

  const send = useCallback(
    (input: AskInput, clientRequestId: string, retry: boolean): boolean => {
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
        if (outcome.ok === false && outcome.failure.kind === 'DISABLED') return;
        if (alive.current && tier === 'PRO') reloadInfo();
      });
      return true;
    },
    [stream, reloadInfo, tier]
  );

  const ask = useCallback(
    (input: AskInput): boolean => {
      if (input.kind === 'TYPED') {
        const text = input.question.trim();
        if (text === '' || lengthOf(text) > COMPOSER_MAX_CHARS) return false;
        return send({ kind: 'TYPED', question: text }, makeId(), false);
      }
      return send(input, makeId(), false);
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

  const value = useMemo<ChatContextValue>(
    () => ({
      state,
      busy: isBusy(state),
      ask,
      retry,
      stop,
      selectModel,
      reloadInfo,
      openTradeSetup,
    }),
    [state, ask, retry, stop, selectModel, reloadInfo, openTradeSetup]
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
