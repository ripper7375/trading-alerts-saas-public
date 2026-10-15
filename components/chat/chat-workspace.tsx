'use client';

/**
 * The chat of the whole workspace (build step 7 part 9): ONE `ChatProvider` above Panel A (the thread
 * list), Panel B (the conversation) and Panel C (the two Market Context badges), so they share one
 * thread, one conversation and one request in flight.
 *
 * Because the provider sits above the panels, a panel that unmounts takes nothing with it. Collapsing
 * Panel B to its rail used to discard the conversation (part 8, deviation 3); now the conversation, the
 * active thread and a request that is still being answered are all here when it opens again.
 *
 * This is also where "Open trade setup" lives for the workspace. The launcher (the Engine 4 offer check
 * and the Trade Setup modal) is mounted once here and handed to the provider, and the element it draws
 * (the modal, or the notice that it could not be opened) is given to whichever Panel B is on screen
 * through `useWorkspaceOverlay()`: a card's button works the same whether Panel B was collapsed and
 * opened again or not.
 *
 * `replyEnabled` is the server's decision (`isReplyEnabled`: `REPLY_ENABLED` is exactly `true`, read by
 * the page at request time). Off, the chat makes no request at all and says it is not switched on, which
 * is what it said before when the routes answered 404: the panel, the thread list and the badges stay
 * quiet, and the Panel C badges behave exactly as they did (ADR-098 D10). A Free trader's chat never
 * reads a route either way (ADR-072).
 *
 * @module components/chat/chat-workspace
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react';

import { ChatProvider } from './chat-provider';
import { initialChatState, type ChatState } from './chat-state';
import { useTradeSetupLauncher } from './trade-setup-launcher';

type Fetch = typeof fetch;

const OverlayContext = createContext<ReactElement | null>(null);

/** What Panel B draws above its meter for the workspace's trade setup launcher (the modal or its notice). */
export function useWorkspaceOverlay(): ReactElement | null {
  return useContext(OverlayContext);
}

/** The state of a workspace whose chat is not switched on: it says so and reads nothing. */
export function switchedOffState(): ChatState {
  return { ...initialChatState(), infoStatus: 'unavailable' };
}

export interface ChatWorkspaceProps {
  tier: 'FREE' | 'PRO';
  /** the chat routes are on (the page reads `REPLY_ENABLED` on the server); off when omitted */
  replyEnabled?: boolean;
  children: ReactNode;
  /** replaces the network (tests, the development preview) */
  fetchImpl?: Fetch;
  makeId?: () => string;
  /** a state to start from, in place of the default one (tests and the preview) */
  initialState?: ChatState;
}

export function ChatWorkspace({
  tier,
  replyEnabled = false,
  children,
  fetchImpl,
  makeId,
  initialState,
}: ChatWorkspaceProps): ReactElement {
  const launcher = useTradeSetupLauncher(fetchImpl);
  // one object for the provider's whole life: a new initial state every render would be ignored anyway
  const start = useMemo<ChatState | undefined>(
    () => initialState ?? (replyEnabled ? undefined : switchedOffState()),
    [initialState, replyEnabled]
  );

  return (
    <OverlayContext.Provider value={launcher.element}>
      <ChatProvider
        tier={tier}
        loadOnMount={replyEnabled && tier === 'PRO'}
        onOpenTradeSetup={launcher.open}
        {...(fetchImpl === undefined ? {} : { fetchImpl })}
        {...(makeId === undefined ? {} : { makeId })}
        {...(start === undefined ? {} : { initialState: start })}
      >
        {children}
      </ChatProvider>
    </OverlayContext.Provider>
  );
}
