/**
 * The chat provider and the stream hook (build step 7 part 8), without the panel: what `ask`, `retry`,
 * `stop` and `reloadInfo` do, what a request carries, and the guards. A small consumer shows the state.
 * Real reducer, real wire code, the server's recorded answers; no fake timers, `LocaleProvider` is
 * not needed here because nothing in the provider draws a word.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

import {
  ChatProvider,
  lengthOf,
  useChat,
  useOptionalChat,
  type ChatContextValue,
} from '@/components/chat/chat-provider';
import { initialChatState } from '@/components/chat/chat-state';
import { bodyOf, newRequestId } from '@/components/chat/use-chat-stream';
import type { AskInput, TradeSetupAction } from '@/components/chat/types';

import {
  fakeFetch,
  jsonResponse,
  resultOf,
  responseOf,
  stateBody,
  type FakeFetch,
  type FakeRoutes,
} from './helpers/fake-fetch';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let chat!: ChatContextValue;
function Probe(): ReactElement {
  chat = useChat();
  return (
    <div>
      <p data-testid="items">{chat.state.items.map((i) => i.kind).join(',')}</p>
      <p data-testid="busy">{String(chat.busy)}</p>
      <p data-testid="info">{chat.state.infoStatus}</p>
      <p data-testid="thread">{chat.state.threadId ?? ''}</p>
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

// the balance is read again after every request: let that last read land inside act before the next test
afterEach(async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('newRequestId and bodyOf', () => {
  it('makes a version 4 UUID, and a different one each time', () => {
    const ids = Array.from({ length: 50 }, () => newRequestId());
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(50);
  });

  it('uses randomUUID where the platform has it, and builds one where it does not', () => {
    const real = globalThis.crypto;
    const fixed = '11111111-2222-4333-8444-555555555555';
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: () => fixed,
        getRandomValues: real.getRandomValues.bind(real),
      },
      configurable: true,
    });
    expect(newRequestId()).toBe(fixed);
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: real.getRandomValues.bind(real) },
      configurable: true,
    });
    expect(newRequestId()).toMatch(UUID);
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });
    expect(newRequestId()).toMatch(UUID);
    Object.defineProperty(globalThis, 'crypto', {
      value: real,
      configurable: true,
    });
  });

  it('a request carries the id, the thread when there is one, and the question or the label: nothing else', () => {
    expect(bodyOf('c-1', null, typed('Q'))).toEqual({
      client_request_id: 'c-1',
      question: 'Q',
    });
    expect(bodyOf('c-1', 'th-1', typed('Q'))).toEqual({
      client_request_id: 'c-1',
      thread_id: 'th-1',
      question: 'Q',
    });
    expect(
      bodyOf('c-2', null, { kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' })
    ).toEqual({
      client_request_id: 'c-2',
      kind: 'INSTANT_M5_INSPECT',
    });
  });

  it('never names the user, the tier, the language, the model or the symbol', () => {
    const text = JSON.stringify([
      bodyOf('c', 't', typed('x')),
      bodyOf('c', null, { kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' }),
    ]);
    for (const forbidden of [
      'user',
      'tier',
      'locale',
      'language',
      'model',
      'symbol',
      'equity',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('counts characters as the door does', () => {
    expect(lengthOf('abc')).toBe(3);
    expect(lengthOf('😀😀')).toBe(2);
    expect(lengthOf('')).toBe(0);
  });
});

describe('the provider', () => {
  it('reads the state when mounted for a PRO trader, never for a Free one', async () => {
    const pro = mount({});
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    expect(pro.gets()).toHaveLength(1);
  });

  it('a Free trader’s provider never calls a route, whatever it is asked', async () => {
    const f = fakeFetch({
      state: jsonResponse(stateBody()),
      message: () => responseOf('report1-long'),
    });
    render(
      <ChatProvider tier="FREE" fetchImpl={f.fetch}>
        <Probe />
      </ChatProvider>
    );
    act(() => chat.reloadInfo());
    expect(f.calls).toHaveLength(0);
    expect(screen.getByTestId('info')).toHaveTextContent('idle');
  });

  it('loadOnMount={false} leaves the state alone, and the initial state is the start', async () => {
    const f = mount(
      {},
      {
        loadOnMount: false,
        initialState: { ...initialChatState(), infoStatus: 'unavailable' },
      }
    );
    await act(async () => undefined);
    expect(f.calls).toHaveLength(0);
    expect(screen.getByTestId('info')).toHaveTextContent('unavailable');
  });

  it('useChat outside a provider says so; useOptionalChat is null there', () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(
      'useChat must be used inside a ChatProvider'
    );
    spy.mockRestore();
    let seen: ChatContextValue | null | undefined;
    function Optional(): ReactElement {
      seen = useOptionalChat();
      return <span />;
    }
    render(<Optional />);
    expect(seen).toBeNull();
  });
});

describe('ask', () => {
  it('takes a question, uses the id the provider makes, and puts the question and the reply on screen', async () => {
    const f = mount(
      { message: () => responseOf('report1-long') },
      { makeId: () => 'id-1' }
    );
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    let taken = false;
    act(() => {
      taken = chat.ask(typed('  Direction?  '));
    });
    expect(taken).toBe(true);
    expect(f.posts()[0]?.body).toEqual({
      client_request_id: 'id-1',
      question: 'Direction?',
    });
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,RESULT')
    );
    expect(screen.getByTestId('busy')).toHaveTextContent('false');
    expect(screen.getByTestId('thread')).toHaveTextContent(
      resultOf('report1-long').thread_id
    );
  });

  it('refuses an empty, a blank and a too-long question without a request', async () => {
    const f = mount({});
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    let results: boolean[] = [];
    act(() => {
      results = [
        chat.ask(typed('')),
        chat.ask(typed('   \n ')),
        chat.ask(typed('x'.repeat(501))),
      ];
    });
    expect(results).toEqual([false, false, false]);
    expect(f.posts()).toHaveLength(0);
  });

  it('takes 500 characters exactly', async () => {
    const f = mount({ message: () => responseOf('answer') });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask(typed('x'.repeat(500)));
    });
    expect(f.posts()).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByTestId('busy')).toHaveTextContent('false')
    );
  });

  it('a button press sends its label', async () => {
    const f = mount({ message: () => responseOf('report1-short-instant') });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask({ kind: 'INSTANT', intent: 'INSTANT_M15_INSPECT' });
    });
    expect(f.posts()[0]?.body).toMatchObject({ kind: 'INSTANT_M15_INSPECT' });
    expect(f.posts()[0]?.body).not.toHaveProperty('question');
    await waitFor(() =>
      expect(screen.getByTestId('busy')).toHaveTextContent('false')
    );
  });

  it('a second request in the SAME tick is refused: one request, not two', async () => {
    let release!: (r: Response) => void;
    let calls = 0;
    const f = mount({
      message: () => {
        calls += 1;
        // the first request is held open; the ones after it are answered at once
        return calls === 1
          ? new Promise<Response>((r) => {
              release = r;
            })
          : responseOf('answer');
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    let results: boolean[] = [];
    act(() => {
      results = [
        chat.ask(typed('one')),
        chat.ask(typed('two')),
        chat.ask({ kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' }),
      ];
    });
    expect(results).toEqual([true, false, false]);
    expect(f.posts()).toHaveLength(1);
    expect(screen.getByTestId('items')).toHaveTextContent('USER');
    await act(async () => release(responseOf('answer')));
    await waitFor(() =>
      expect(screen.getByTestId('busy')).toHaveTextContent('false')
    );
    // and once it has ended, the next one goes
    act(() => {
      expect(chat.ask(typed('three'))).toBe(true);
    });
    expect(f.posts()).toHaveLength(2);
    await waitFor(() =>
      expect(screen.getByTestId('busy')).toHaveTextContent('false')
    );
  });

  it('every way out of "in flight" lets the next request go: reply, refusal, error event, failure, 5xx, stop', async () => {
    const answers = [
      () => responseOf('report1-long'),
      () => responseOf('refusal-out-of-scope'),
      () => responseOf('error-persistence'),
      () => responseOf('refusal-quota'),
      () => jsonResponse({ success: false, error: { code: 'INTERNAL' } }, 503),
      () => {
        throw new TypeError('Failed to fetch');
      },
    ];
    let n = 0;
    const f = mount({ message: () => answers[n++ % answers.length]!() });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    for (let i = 0; i < answers.length; i += 1) {
      act(() => {
        expect(chat.ask(typed(`q${i}`))).toBe(true);
      });
      await waitFor(() =>
        expect(screen.getByTestId('busy')).toHaveTextContent('false')
      );
    }
    expect(f.posts()).toHaveLength(answers.length);
  });
});

describe('retry', () => {
  it('sends the same request with the same id, and not at all for an error that may not be retried', async () => {
    let calls = 0;
    const f = mount({
      message: () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        if (calls === 2) return responseOf('error-persistence');
        return responseOf('answer');
      },
    });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask(typed('Direction?'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,ERROR')
    );
    const failed = chat.state.items[1] as Extract<
      ChatContextValue['state']['items'][number],
      { kind: 'ERROR' }
    >;
    expect(failed.retryable).toBe(true);
    act(() => {
      expect(chat.retry(failed)).toBe(true);
    });
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,ERROR')
    );
    expect(f.posts()[1]?.body).toEqual(f.posts()[0]?.body);
    // the second error is the server's "not retryable": retry says no and sends nothing
    const final = chat.state.items[1] as typeof failed;
    expect(final.retryable).toBe(false);
    let again = true;
    act(() => {
      again = chat.retry(final);
    });
    expect(again).toBe(false);
    expect(f.posts()).toHaveLength(2);
  });
});

describe('the balance', () => {
  it('is read again after every request that ended, and not after a route that is not on', async () => {
    const f = mount({ message: () => responseOf('answer') });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask(typed('one'));
    });
    await waitFor(() => expect(f.gets()).toHaveLength(2));
    const off = mount({
      message: () =>
        jsonResponse(
          { success: false, error: { code: 'FEATURE_DISABLED', message: 'x' } },
          404
        ),
    });
    await waitFor(() => expect(off.gets()).toHaveLength(1));
    act(() => {
      chat.ask(typed('two'));
    });
    await waitFor(() =>
      expect(screen.getAllByTestId('info').at(-1)).toHaveTextContent(
        'unavailable'
      )
    );
    await act(async () => undefined);
    expect(off.gets()).toHaveLength(1);
  });

  it('a state read that is overtaken by a newer one is dropped, whatever order the answers arrive in', async () => {
    const pending: ((r: Response) => void)[] = [];
    const f = fakeFetch({
      state: (() =>
        new Promise<Response>((resolve) => pending.push(resolve))) as never,
    });
    render(
      <ChatProvider tier="PRO" fetchImpl={f.fetch}>
        <Probe />
      </ChatProvider>
    );
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => chat.reloadInfo());
    await waitFor(() => expect(pending).toHaveLength(2));
    const only = (slug: string) =>
      jsonResponse(
        stateBody({
          models: [{ slug, name: slug, units_per_msg: 1, default: true }],
        })
      );
    // the newer read answers first, the older one afterwards
    await act(async () => pending[1]!(only('newer/model')));
    await act(async () => pending[0]!(only('older/model')));
    expect(chat.state.info?.models.map((m) => m.slug)).toEqual(['newer/model']);
  });
});

describe('leaving', () => {
  it('stop aborts the request in flight', async () => {
    const f = mount({
      message: (_b, call) =>
        new Promise<Response>((_resolve, reject) => {
          call.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        }),
    });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask(typed('x'));
    });
    act(() => chat.stop());
    expect(f.posts()[0]?.signal?.aborted).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId('items')).toHaveTextContent('USER,CANCELLED')
    );
  });

  it('stop with nothing in flight does nothing', async () => {
    mount({});
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => chat.stop());
    expect(screen.getByTestId('items')).toHaveTextContent('');
  });

  it('unmounting aborts what is in flight, and the late answer is not drawn', async () => {
    let release!: (r: Response) => void;
    const f = fakeFetch({
      state: jsonResponse(stateBody()),
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const view = render(
      <ChatProvider tier="PRO" fetchImpl={f.fetch}>
        <Probe />
      </ChatProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => {
      chat.ask(typed('x'));
    });
    view.unmount();
    expect(f.posts()[0]?.signal?.aborted).toBe(true);
    await act(async () => release(responseOf('report1-long')));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('openTradeSetup calls the handler it was given, and is quiet without one', async () => {
    const onOpen = jest.fn();
    mount({}, { onOpenTradeSetup: onOpen });
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    const action: TradeSetupAction = {
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: '2026-09-18T20:55Z',
      trader_type: 'DAY_TRADER',
      zone_ids: ['Z1'],
    };
    act(() => chat.openTradeSetup(action));
    expect(onOpen).toHaveBeenCalledWith(action);
  });

  it('selectModel remembers the pick', async () => {
    mount({});
    await waitFor(() =>
      expect(screen.getByTestId('info')).toHaveTextContent('ready')
    );
    act(() => chat.selectModel('vendor-b/model-b'));
    expect(chat.state.modelSlug).toBe('vendor-b/model-b');
  });
});
