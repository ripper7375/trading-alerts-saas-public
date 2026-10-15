/**
 * The workspace's one chat (build step 7 part 9), without any panel: how an `ask` ends, and what
 * Panel A can do through the provider (open a thread, start a new one, tell it one was deleted).
 * Real reducer, real wire code, the server's recorded answers and an in-memory stand-in with the
 * real threads routes' shapes. No fake timers, no mocks of the chat.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import {
  ChatProvider,
  useChat,
  type AskOutcome,
  type ChatContextValue,
} from '@/components/chat/chat-provider';
import type { AskInput } from '@/components/chat/types';

import {
  fakeFetch,
  jsonResponse,
  type Call,
  responseOf,
  resultOf,
  stateBody,
  type FakeFetch,
  type FakeRoutes,
} from './helpers/fake-fetch';
import {
  exchangeJson,
  threadJson,
  threadsServer,
  type ThreadsServer,
} from './helpers/threads-server';

let chat!: ChatContextValue;
function Probe(): ReactElement {
  chat = useChat();
  return (
    <div>
      <p data-testid="items">{chat.state.items.map((i) => i.kind).join(',')}</p>
      <p data-testid="busy">{String(chat.busy)}</p>
      <p data-testid="info">{chat.state.infoStatus}</p>
      <p data-testid="thread">{chat.state.threadId ?? ''}</p>
      <p data-testid="thread-status">{chat.state.threadStatus}</p>
    </div>
  );
}

function mount(
  routes: FakeRoutes,
  props: Partial<React.ComponentProps<typeof ChatProvider>> = {}
): FakeFetch {
  const f = fakeFetch({ state: jsonResponse(stateBody()), ...routes });
  render(
    <ChatProvider tier="PRO" fetchImpl={f.fetch} {...props}>
      <Probe />
    </ChatProvider>
  );
  return f;
}

const typed = (question: string): AskInput => ({ kind: 'TYPED', question });
const GET_OLD = {
  url: '/api/chat/threads/th-old',
  method: 'GET',
  body: null,
  signal: undefined,
};

const settledOf = (): {
  outcomes: AskOutcome[];
  onSettled: (outcome: AskOutcome) => void;
} => {
  const outcomes: AskOutcome[] = [];
  return { outcomes, onSettled: (outcome) => outcomes.push(outcome) };
};

// the balance is read again after every request: let that last read land inside act
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

const idle = (): void =>
  expect(screen.getByTestId('busy')).toHaveTextContent('false');

describe('ask: how a request ended', () => {
  async function ready(routes: FakeRoutes): Promise<FakeFetch> {
    const f = mount(routes);
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    return f;
  }

  it('tells a result with the thread and the request, and the answer is in the state', async () => {
    await ready({ message: () => responseOf('report1-long') });
    const seen = settledOf();
    act(() => {
      chat.ask({ kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' }, seen);
    });
    await waitFor(() => expect(seen.outcomes).toHaveLength(1));
    expect(seen.outcomes[0]).toEqual({
      kind: 'RESULT',
      threadId: resultOf('report1-long').thread_id,
      requestId: resultOf('report1-long').provenance.request_id,
    });
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT')
    );
    await waitFor(idle);
  });

  it.each([
    ['a refusal event', 'refusal-out-of-scope', 'REFUSAL'],
    ['a refusal before the stream (allowance)', 'refusal-quota', 'REFUSAL'],
    ['a refusal before the stream (tier)', 'refusal-tier', 'REFUSAL'],
    ['an error event', 'error-persistence', 'FAILED'],
  ])('%s is a %s', async (_label, exchange, kind) => {
    await ready({ message: () => responseOf(exchange) });
    const seen = settledOf();
    act(() => {
      chat.ask(typed('Direction?'), seen);
    });
    await waitFor(() => expect(seen.outcomes).toHaveLength(1));
    expect(seen.outcomes[0]?.kind).toBe(kind);
    await waitFor(idle);
  });

  it('carries the server’s own words for a refusal', async () => {
    await ready({ message: () => responseOf('refusal-quota') });
    const seen = settledOf();
    act(() => {
      chat.ask(typed('Direction?'), seen);
    });
    await waitFor(() => expect(seen.outcomes).toHaveLength(1));
    const outcome = seen.outcomes[0] as Extract<
      AskOutcome,
      { kind: 'REFUSAL' }
    >;
    expect(outcome.reply.length).toBeGreaterThan(5);
    await waitFor(idle);
  });

  it('says UNAVAILABLE when the routes are not on, FAILED for a 5xx and a dropped connection, CANCELLED for a stop', async () => {
    // the last one never answers by itself: it ends when the request is aborted, as a real fetch does
    const answers: ((call: Call) => Response | Promise<Response>)[] = [
      () =>
        jsonResponse(
          { success: false, error: { code: 'FEATURE_DISABLED' } },
          404
        ),
      () => jsonResponse({ success: false, error: { code: 'INTERNAL' } }, 503),
      () => {
        throw new TypeError('Failed to fetch');
      },
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        }),
    ];
    let n = 0;
    await ready({
      message: (_body, call) =>
        (answers[n++] as (c: Call) => Response | Promise<Response>)(call),
    });
    const kinds: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const seen = settledOf();
      act(() => {
        chat.ask(typed(`q${i}`), seen);
      });
      if (i === 3) {
        await waitFor(() =>
          expect(screen.getByTestId('busy')).toHaveTextContent('true')
        );
        act(() => chat.stop());
      }
      await waitFor(() => expect(seen.outcomes).toHaveLength(1));
      kinds.push((seen.outcomes[0] as AskOutcome).kind);
      await waitFor(idle);
    }
    expect(kinds).toEqual(['UNAVAILABLE', 'FAILED', 'FAILED', 'CANCELLED']);
  });

  it('never calls back for a request that was not sent', async () => {
    const f = await ready({ message: () => responseOf('answer') });
    const seen = settledOf();
    act(() => {
      expect(chat.ask(typed('   '), seen)).toBe(false);
      expect(chat.ask(typed('x'.repeat(501)), seen)).toBe(false);
    });
    await act(async () => undefined);
    expect(seen.outcomes).toEqual([]);
    expect(f.posts()).toHaveLength(0);
  });

  it('never calls back after the provider went away', async () => {
    let release!: (r: Response) => void;
    const f = fakeFetch({
      state: jsonResponse(stateBody()),
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    const view = render(
      <ChatProvider tier="PRO" fetchImpl={f.fetch}>
        <Probe />
      </ChatProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    const seen = settledOf();
    act(() => {
      chat.ask(typed('Direction?'), seen);
    });
    view.unmount();
    release(responseOf('answer'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(seen.outcomes).toEqual([]);
  });
});

describe('threads: new, open, deleted', () => {
  const stored = (): ThreadsServer =>
    threadsServer(
      [threadJson({ id: 'th-old' }), threadJson({ id: 'th-new' })],
      {
        'th-old': exchangeJson(
          1,
          { text: 'Earlier question' },
          resultOf('answer')
        ),
        'th-new': exchangeJson(
          1,
          { instant: 'INSTANT_M5_INSPECT' },
          resultOf('report1-short-instant')
        ),
      }
    );

  async function ready(
    server: ThreadsServer,
    extra: FakeRoutes = {}
  ): Promise<FakeFetch> {
    const f = mount({ threads: (call) => server.handle(call), ...extra });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    return f;
  }

  it('opens a thread: it is active at once, Panel B shows its messages, and a question asked there joins it', async () => {
    const server = stored();
    const f = await ready(server, { message: () => responseOf('answer') });
    let taken = false;
    act(() => {
      taken = chat.selectThread('th-old');
    });
    expect(taken).toBe(true);
    // the thread is active before its messages arrive
    expect(screen.getByTestId('thread')).toHaveTextContent('th-old');
    expect(screen.getByTestId('thread-status')).toHaveTextContent('loading');
    expect(screen.getByTestId('busy')).toHaveTextContent('true');
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT')
    );
    expect(screen.getByTestId('thread-status')).toHaveTextContent('idle');
    idle();
    expect(server.calls.filter((c) => c.method === 'GET')).toHaveLength(1);

    act(() => {
      chat.ask(typed('And now?'));
    });
    expect(f.posts()[0]?.body).toMatchObject({
      thread_id: 'th-old',
      question: 'And now?',
    });
    await waitFor(idle);
  });

  it('does not let a question, a press or a new thread go while a thread is being opened', async () => {
    const server = stored();
    let release!: (r: Response) => void;
    const f = await ready(server, {
      threads: (call) =>
        call.method === 'GET' && call.url.endsWith('/th-old')
          ? new Promise<Response>((r) => {
              release = r;
            })
          : server.handle(call),
      message: () => responseOf('answer'),
    });
    act(() => {
      chat.selectThread('th-old');
    });
    let results: boolean[] = [];
    act(() => {
      results = [
        chat.ask(typed('too early')),
        chat.ask({ kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' }),
        chat.newThread(),
        chat.selectThread('th-new'),
      ];
    });
    expect(results).toEqual([false, false, false, false]);
    expect(f.posts()).toHaveLength(0);
    expect(screen.getByTestId('thread')).toHaveTextContent('th-old');
    await act(async () => release(server.handle(GET_OLD)));
    await waitFor(idle);
    expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT');
  });

  it('says so when the thread could not be opened, and opening it again can work', async () => {
    const server = stored();
    await ready(server);
    server.failNext('GET', 500);
    act(() => {
      chat.selectThread('th-old');
    });
    await waitFor(() =>
      expect(screen.getByTestId('thread-status')).toHaveTextContent('error')
    );
    expect(screen.getByTestId('thread')).toHaveTextContent('th-old');
    idle();
    act(() => {
      chat.selectThread('th-old');
    });
    await waitFor(() =>
      expect(screen.getByTestId('thread-status')).toHaveTextContent('idle')
    );
    expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT');
  });

  it('a Free trader opens nothing and reads nothing', () => {
    const server = stored();
    const f = fakeFetch({ threads: (call) => server.handle(call) });
    render(
      <ChatProvider tier="FREE" fetchImpl={f.fetch}>
        <Probe />
      </ChatProvider>
    );
    let taken = true;
    act(() => {
      taken = chat.selectThread('th-old');
    });
    expect(taken).toBe(false);
    expect(f.calls).toHaveLength(0);
  });

  it('starts a new thread: nothing on screen, no thread, and the next question has no thread_id', async () => {
    const server = stored();
    const f = await ready(server, { message: () => responseOf('answer') });
    act(() => {
      chat.selectThread('th-old');
    });
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT')
    );
    act(() => {
      expect(chat.newThread()).toBe(true);
    });
    expect(screen.getByTestId('items')).toHaveTextContent('');
    expect(screen.getByTestId('thread')).toHaveTextContent('');
    act(() => {
      chat.ask(typed('Fresh start'));
    });
    expect(f.posts()[0]?.body).not.toHaveProperty('thread_id');
    await waitFor(idle);
  });

  it('refuses a new thread and an opening while a request is in flight', async () => {
    const server = stored();
    let release!: (r: Response) => void;
    await ready(server, {
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    act(() => {
      chat.ask(typed('Direction?'));
    });
    let results: boolean[] = [];
    act(() => {
      results = [chat.newThread(), chat.selectThread('th-old')];
    });
    expect(results).toEqual([false, false]);
    expect(chat.state.items.map((i) => i.kind)).toEqual(['USER']);
    await act(async () => release(responseOf('answer')));
    await waitFor(idle);
  });

  it('threadDeleted empties Panel B for the thread on screen only', async () => {
    const server = stored();
    await ready(server);
    act(() => {
      chat.selectThread('th-old');
    });
    await waitFor(() =>
      expect(screen.getByTestId('thread-status')).toHaveTextContent('idle')
    );
    act(() => chat.threadDeleted('th-new'));
    expect(screen.getByTestId('thread')).toHaveTextContent('th-old');
    act(() => chat.threadDeleted('th-old'));
    expect(screen.getByTestId('thread')).toHaveTextContent('');
    expect(screen.getByTestId('items')).toHaveTextContent('');
  });

  it('exposes whether the chat is live and the fetch it uses', async () => {
    const server = stored();
    const f = await ready(server);
    expect(chat.live).toBe(true);
    await chat.fetcher('/api/chat/threads');
    expect(f.calls.at(-1)?.url).toBe('/api/chat/threads');
    cleanup();

    const off = mount({}, { loadOnMount: false });
    expect(chat.live).toBe(false);
    expect(off.calls).toHaveLength(0);
    cleanup();

    const free = fakeFetch({});
    render(
      <ChatProvider tier="FREE" fetchImpl={free.fetch} loadOnMount>
        <Probe />
      </ChatProvider>
    );
    expect(chat.live).toBe(false);
  });
});
