/**
 * The chat of the whole workspace (build step 7 part 9): `ChatWorkspace`, the one provider above the
 * three panels. Off, it reads nothing and says the chat is not switched on; on, a Pro trader's chat reads
 * its state; a Free trader's never reads a route. The panels under it are the real ones.
 *
 * `LocaleProvider` wraps every render and nothing here uses fake timers (LESSONS-LEARNED L40).
 */

import { act, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import ChatPanel from '@/components/chat-panel';
import { useOptionalChat } from '@/components/chat/chat-provider';
import { initialChatState } from '@/components/chat/chat-state';
import {
  ChatWorkspace,
  switchedOffState,
  useWorkspaceOverlay,
} from '@/components/chat/chat-workspace';

import { renderIn } from '../report2/helpers/render';
import {
  fakeFetch,
  jsonResponse,
  stateBody,
  type FakeFetch,
} from './helpers/fake-fetch';

jest.mock('next/navigation', () => ({ usePathname: () => '/terminal' }));

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
});

function install(): FakeFetch {
  const f = fakeFetch({ state: jsonResponse(stateBody()) });
  global.fetch = f.fetch;
  return f;
}

function Seen(): ReactElement {
  const chat = useOptionalChat();
  const overlay = useWorkspaceOverlay();
  return (
    <p data-testid="seen">
      {chat === null ? 'no chat' : `${chat.state.infoStatus} live=${chat.live}`}
      {overlay === null ? ' no overlay' : ' overlay'}
    </p>
  );
}

describe('switchedOffState', () => {
  it('is the start of a chat that has been told the routes are off', () => {
    expect(switchedOffState()).toEqual({
      ...initialChatState(),
      infoStatus: 'unavailable',
    });
  });
});

describe('ChatWorkspace', () => {
  it('is off by default: nothing is read, and the panel says so', async () => {
    const f = install();
    renderIn(
      <ChatWorkspace tier="PRO">
        <Seen />
        <ChatPanel tier="PRO" />
      </ChatWorkspace>
    );
    expect(screen.getByTestId('seen')).toHaveTextContent(
      'unavailable live=false no overlay'
    );
    expect(await screen.findByTestId('unavailable')).toHaveTextContent(
      'The AI Analyst is not switched on yet'
    );
    await act(async () => undefined);
    expect(f.calls).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('on, for a Pro trader: reads the state once and the panel is live', async () => {
    const f = install();
    renderIn(
      <ChatWorkspace tier="PRO" replyEnabled>
        <Seen />
        <ChatPanel tier="PRO" />
      </ChatWorkspace>
    );
    await screen.findByTestId('quota-meter');
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET /api/chat/state',
    ]);
    expect(screen.getByTestId('seen')).toHaveTextContent('ready live=true');
    expect(
      screen.getByRole('textbox', { name: 'Your question' })
    ).toBeEnabled();
  });

  it('on, for a Free trader: reads nothing, whatever the flag says', async () => {
    const f = install();
    renderIn(
      <ChatWorkspace tier="FREE" replyEnabled>
        <Seen />
        <ChatPanel tier="FREE" />
      </ChatWorkspace>
    );
    expect(await screen.findByTestId('demo-replay')).toBeInTheDocument();
    expect(screen.getByTestId('seen')).toHaveTextContent('live=false');
    await act(async () => undefined);
    expect(f.calls).toHaveLength(0);
  });

  it('takes a state to start from, and that wins over the default', async () => {
    const f = install();
    renderIn(
      <ChatWorkspace
        tier="PRO"
        initialState={{ ...initialChatState(), threadId: 'th-7' }}
      >
        <Seen />
      </ChatWorkspace>
    );
    await act(async () => undefined);
    expect(screen.getByTestId('seen')).toHaveTextContent('idle live=false');
    expect(f.calls).toHaveLength(0);
  });

  it('does not read again when the page rerenders', async () => {
    const f = install();
    const view = renderIn(
      <ChatWorkspace tier="PRO" replyEnabled>
        <Seen />
      </ChatWorkspace>
    );
    await waitFor(() =>
      expect(screen.getByTestId('seen')).toHaveTextContent('ready')
    );
    view.rerender(
      <ChatWorkspace tier="PRO" replyEnabled>
        <Seen />
      </ChatWorkspace>
    );
    await act(async () => undefined);
    expect(f.gets()).toHaveLength(1);
  });

  it('without it a panel runs alone, with its own chat and no workspace overlay', () => {
    install();
    renderIn(<Seen />);
    expect(screen.getByTestId('seen')).toHaveTextContent('no chat no overlay');
  });
});
