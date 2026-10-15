'use client';

/**
 * Panel A's thread list (build step 7 part 9): the trader's conversations from
 * `GET /api/chat/threads`, newest message first, a page at a time (the cursor is the server's, opaque
 * here), and what can be done to them: open one, start a new one, rename one, delete one.
 *
 * It reads the workspace's one chat (`useOptionalChat`) and shares its state: the active thread IS the
 * thread Panel B shows, so an answer that creates or extends a thread moves the highlight with no
 * message between the panels, and opening a thread here fills Panel B. The list is read again, quietly,
 * each time a request ends (a new thread has appeared, or an old one has moved to the top).
 *
 * The list is read only when the chat is live: a Pro trader, and the workspace says the chat routes are
 * on. With them off it says so (`unavailable`) and makes no request. A Free trader's Panel A never gets
 * here: it shows the recorded example only (ADR-072, ADR-098 D19).
 *
 * Everything that needs the network goes through the chat's own `fetch`, so a test or the development
 * preview swaps one function and the whole workspace follows.
 *
 * @module components/chat/use-chat-threads
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useOptionalChat } from './chat-provider';
import { THREAD_PAGE_SIZE } from './limits';
import {
  deleteThread,
  listThreads,
  renameThread,
  type DeleteOutcome,
  type RenameOutcome,
} from './threads-wire';
import type { ThreadSummary } from './types';

export type ThreadsStatus = 'loading' | 'ready' | 'error' | 'unavailable';

interface View {
  status: ThreadsStatus;
  threads: ThreadSummary[];
  /** the cursor of the next page, or null when there is no more */
  next: string | null;
  loadingMore: boolean;
  moreFailed: boolean;
}

const LOADING: View = {
  status: 'loading',
  threads: [],
  next: null,
  loadingMore: false,
  moreFailed: false,
};

const UNAVAILABLE: View = { ...LOADING, status: 'unavailable' };

export interface ChatThreads {
  status: ThreadsStatus;
  threads: readonly ThreadSummary[];
  hasMore: boolean;
  loadingMore: boolean;
  moreFailed: boolean;
  /** the thread Panel B shows, or null for a new one */
  activeId: string | null;
  /** a request is in flight or a thread is being opened: opening, starting and deleting wait */
  busy: boolean;
  reload: () => void;
  loadMore: () => void;
  select: (threadId: string) => void;
  startNew: () => void;
  rename: (threadId: string, title: string) => Promise<RenameOutcome>;
  remove: (threadId: string) => Promise<DeleteOutcome>;
}

export function useChatThreads(): ChatThreads {
  const chat = useOptionalChat();
  const fetcher = chat?.fetcher;
  // not "live" while the state route has said the chat is off: there is nothing to list
  const live =
    chat !== null && chat.live && chat.state.infoStatus !== 'unavailable';
  const inFlight = chat !== null && chat.state.flight !== null;

  const [view, setView] = useState<View>(live ? LOADING : UNAVAILABLE);
  const flight = useRef<AbortController | null>(null);
  const moreFlight = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const nextRef = useRef<string | null>(null);
  nextRef.current = view.next;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      flight.current?.abort();
      moreFlight.current?.abort();
    };
  }, []);

  /**
   * Read the first page. A quiet read (after a request ended) keeps the list on screen and leaves it
   * as it was if the read fails; it also brings the list back to its first page, because a thread that
   * moved to the top shifts every page behind it and a cursor of the old order would skip one.
   */
  const load = useCallback(
    (quiet: boolean): void => {
      if (fetcher === undefined) return;
      flight.current?.abort();
      moreFlight.current?.abort();
      const own = new AbortController();
      flight.current = own;
      if (!quiet) setView((prev) => ({ ...prev, status: 'loading' }));
      void listThreads(fetcher, {
        limit: THREAD_PAGE_SIZE,
        signal: own.signal,
      }).then((outcome) => {
        if (!alive.current || own.signal.aborted) return;
        if (outcome.ok) {
          setView({
            status: 'ready',
            threads: outcome.threads,
            next: outcome.next,
            loadingMore: false,
            moreFailed: false,
          });
        } else if (outcome.reason === 'DISABLED') {
          setView(UNAVAILABLE);
        } else if (outcome.reason !== 'ABORTED') {
          setView((prev) =>
            quiet && prev.status === 'ready'
              ? prev
              : { ...prev, status: 'error', loadingMore: false }
          );
        }
      });
    },
    [fetcher]
  );

  // the first read, and a second one if the chat becomes live later
  useEffect(() => {
    if (!live) {
      flight.current?.abort();
      setView(UNAVAILABLE);
      return;
    }
    load(false);
  }, [live, load]);

  // a request ended: a thread may be new, or newly at the top
  const wasInFlight = useRef(false);
  useEffect(() => {
    if (wasInFlight.current && !inFlight && live) load(true);
    wasInFlight.current = inFlight;
  }, [inFlight, live, load]);

  const reload = useCallback((): void => load(false), [load]);

  const loadMore = useCallback((): void => {
    const cursor = nextRef.current;
    if (fetcher === undefined || cursor === null) return;
    moreFlight.current?.abort();
    const own = new AbortController();
    moreFlight.current = own;
    setView((prev) => ({ ...prev, loadingMore: true, moreFailed: false }));
    void listThreads(fetcher, {
      limit: THREAD_PAGE_SIZE,
      after: cursor,
      signal: own.signal,
    }).then((outcome) => {
      if (!alive.current || own.signal.aborted) return;
      if (outcome.ok) {
        setView((prev) => {
          const seen = new Set(prev.threads.map((thread) => thread.id));
          return {
            ...prev,
            threads: [
              ...prev.threads,
              ...outcome.threads.filter((thread) => !seen.has(thread.id)),
            ],
            next: outcome.next,
            loadingMore: false,
            moreFailed: false,
          };
        });
      } else if (outcome.reason !== 'ABORTED') {
        setView((prev) => ({ ...prev, loadingMore: false, moreFailed: true }));
      }
    });
  }, [fetcher]);

  const select = useCallback(
    (threadId: string): void => {
      chat?.selectThread(threadId);
    },
    [chat]
  );

  const startNew = useCallback((): void => {
    chat?.newThread();
  }, [chat]);

  const rename = useCallback(
    async (threadId: string, title: string): Promise<RenameOutcome> => {
      if (fetcher === undefined) return { ok: false, reason: 'FAILED' };
      const outcome = await renameThread(fetcher, threadId, title);
      if (outcome.ok && alive.current) {
        setView((prev) => ({
          ...prev,
          threads: prev.threads.map((thread) =>
            thread.id === threadId
              ? { ...thread, title: outcome.title, titleSource: 'USER' }
              : thread
          ),
        }));
      }
      return outcome;
    },
    [fetcher]
  );

  const remove = useCallback(
    async (threadId: string): Promise<DeleteOutcome> => {
      if (fetcher === undefined) return { ok: false, reason: 'FAILED' };
      const outcome = await deleteThread(fetcher, threadId);
      // a thread that is already gone is gone: the list and Panel B should agree with the server
      if (outcome.ok || outcome.reason === 'NOT_FOUND') {
        if (alive.current) {
          setView((prev) => ({
            ...prev,
            threads: prev.threads.filter((thread) => thread.id !== threadId),
          }));
        }
        chat?.threadDeleted(threadId);
      }
      return outcome;
    },
    [fetcher, chat]
  );

  return useMemo<ChatThreads>(
    () => ({
      status: view.status,
      threads: view.threads,
      hasMore: view.next !== null,
      loadingMore: view.loadingMore,
      moreFailed: view.moreFailed,
      activeId: chat?.state.threadId ?? null,
      busy: chat?.busy ?? false,
      reload,
      loadMore,
      select,
      startNew,
      rename,
      remove,
    }),
    [
      view,
      chat?.state.threadId,
      chat?.busy,
      reload,
      loadMore,
      select,
      startNew,
      rename,
      remove,
    ]
  );
}
