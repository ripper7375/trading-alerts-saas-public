/**
 * The three panels on one chat (build step 7 part 9): the REAL `TradingWorkspace`, with the REAL Panel A
 * (`ChatSidebar` and its thread list), Panel B (`ChatPanel`) and Panel C (`MtfStackedCharts` and its two
 * Market Context badges), over a fetch that answers the chat routes with the real recorded answers of the
 * message route and an in-memory stand-in with the real threads routes' shapes. Only the chart canvas
 * (`lightweight-charts`), the price socket and the Market Comments panel are stubbed.
 *
 * What is held here:
 *  - ONE chat above the panels: collapsing Panel B to its rail and opening it again keeps the
 *    conversation, the active thread and a request that is still being answered;
 *  - a press on a Market Context badge sends ONE `POST /api/chat/message` with exactly
 *    `{ client_request_id, kind }`; the stages, then the card, are in Panel B; the thread it made is in
 *    Panel A and active; Panel B opens if it was collapsed;
 *  - ONE request in flight for the whole workspace: while Panel B is answering (a typed question or a
 *    badge), both badges are disabled and `aria-busy`, the pressed badge spins, a second press does nothing;
 *  - a refusal is below the badge AND a card in Panel B;
 *  - with the reply flag off, nothing about the chat is read or sent and the badges behave as they did
 *    (ADR-098 D10); a Free trader's press still opens the upgrade modal.
 *
 * `LocaleProvider` wraps every render and nothing here uses fake timers (LESSONS-LEARNED L40).
 */

import React from 'react';
import {
  act,
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { INSTANT_ENDPOINT } from '@/components/charts/use-instant-prompt';
import { TradingWorkspace } from '@/components/workspace/trading-workspace';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

import {
  fakeFetch,
  jsonResponse,
  refusalOf,
  resultOf,
  responseOf,
  stateBody,
  type FakeFetch,
  type FakeRoutes,
} from '../chat/helpers/fake-fetch';
import {
  exchangeJson,
  threadJson,
  threadsServer,
  type ThreadsServer,
} from '../chat/helpers/threads-server';

let mockPathname = '/terminal';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/dynamic', () => () => {
  // the real stacked charts, loaded at once instead of lazily
  const { MtfStackedCharts } = jest.requireActual(
    '@/components/charts/mtf-stacked-charts'
  ) as typeof import('@/components/charts/mtf-stacked-charts');
  return MtfStackedCharts;
});

jest.mock('@/hooks/use-ohlcv-socket', () => ({
  useOhlcvSocket: () => ({
    data: null,
    isConnected: true,
    isLoading: false,
    error: null,
  }),
}));

jest.mock('lightweight-charts', () => {
  // every height pushed to a live chart (see mtf-stacked-charts.test.tsx): how "the canvases are the same" is told
  const appliedHeights: number[] = [];
  const mockTimeScale = {
    fitContent: jest.fn(),
    getVisibleRange: jest.fn(() => ({ from: 1000, to: 2000 })),
    setVisibleRange: jest.fn(),
    subscribeVisibleTimeRangeChange: jest.fn(),
    unsubscribeVisibleTimeRangeChange: jest.fn(),
  };
  return {
    __appliedHeights: appliedHeights,
    createChart: jest.fn(() => ({
      addSeries: () => ({
        setData: jest.fn(),
        setMarkers: jest.fn(),
        applyOptions: jest.fn(),
      }),
      remove: jest.fn(),
      timeScale: () => mockTimeScale,
      applyOptions: (options: { height?: number }) => {
        if (typeof options?.height === 'number') {
          appliedHeights.push(options.height);
        }
      },
    })),
    ColorType: { Solid: 'Solid' },
    CandlestickSeries: 'Candlestick',
  };
});

jest.mock('@/components/charts/drawing/DrawingLayer', () => ({
  DrawingLayer: () => null,
}));
jest.mock('@/components/charts/drawing/useFiredAlertMarkers', () => ({
  useFiredAlertMarkers: jest.fn(),
}));
jest.mock('@/components/charts/mtf/MtfToggle', () => ({
  MtfToggle: () => null,
}));

let mockTier: 'PRO' | 'FREE' = 'PRO';
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { tier: mockTier, name: 'Test Trader' } },
  }),
  getSession: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/components/market-comments-panel', () => ({
  __esModule: true,
  default: () => <div data-testid="market-comments" />,
}));

function render(ui: React.ReactElement) {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    ),
  });
}

// ---------------------------------------------------------------------------------------
// the server stand-in: the chat routes, the threads routes and the old instant route
// ---------------------------------------------------------------------------------------

interface World {
  f: FakeFetch;
  server: ThreadsServer;
  /** the calls the old instant route got */
  instant: { url: string; body: unknown }[];
  /** the calls that went to the chat's own routes, other than the thread list */
  chatCalls: () => string[];
}

const ORIGINAL_FETCH = global.fetch;
const appliedHeights = (
  jest.requireMock('lightweight-charts') as { __appliedHeights: number[] }
).__appliedHeights;

function world(
  options: {
    threads?: ThreadsServer;
    message?: FakeRoutes['message'];
    instant?: () => Response;
    offer?: FakeRoutes['offer'];
  } = {}
): World {
  const server = options.threads ?? threadsServer([], {});
  const f = fakeFetch({
    state: () => jsonResponse(stateBody()),
    threads: (call) => server.handle(call),
    ...(options.offer === undefined ? {} : { offer: options.offer }),
    message:
      options.message ??
      ((body) => {
        const reply = resultOf('report1-short-instant');
        server.file({
          threadId: reply.thread_id,
          title: 'XAUUSD · M5 · SHORT · 28 SEP 23:15',
          user:
            typeof body['kind'] === 'string'
              ? { instant: body['kind'] }
              : { text: String(body['question']) },
          reply,
        });
        return responseOf('report1-short-instant');
      }),
  });
  const instant: World['instant'] = [];
  global.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === INSTANT_ENDPOINT) {
      instant.push({
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      });
      return Promise.resolve(
        options.instant?.() ?? jsonResponse({ success: true }, 200)
      );
    }
    if (url.startsWith('/api/chat/') || url.startsWith('/api/engine4/')) {
      return f.fetch(input, init);
    }
    // every other provider of the workspace gets an empty answer of its own
    return Promise.resolve(new Response('{}', { status: 200 }));
  }) as typeof fetch;
  return {
    f,
    server,
    instant,
    chatCalls: () =>
      f.calls
        .filter((c) => !/\/api\/chat\/threads(\?|$)/.test(c.url))
        .map((c) => `${c.method} ${c.url}`),
  };
}

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  mockTier = 'PRO';
  mockPathname = '/terminal';
  localStorage.clear();
});

const M5 = 'XAUUSD · M5 Market Context';
const M15 = 'XAUUSD · M15 Market Context';
const badge = (name: string): HTMLElement =>
  screen.getByRole('button', { name });
const box = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Your question' });
const messagePosts = (w: World) =>
  w.f.calls.filter((c) => c.method === 'POST' && c.url === '/api/chat/message');

/** The panel has read its state (the meter is drawn), and the thread list has read its first page. */
async function ready(): Promise<void> {
  await screen.findByTestId('quota-meter');
  await screen.findByRole('textbox', { name: 'Your question' });
  await waitFor(() => expect(screen.getByTestId('new-thread')).toBeEnabled());
}

/**
 * Type a question into the composer with the keyboard and send it with Enter. A pointer press is not
 * used to focus it: jsdom has no layout, every rectangle is empty, so react-resizable-panels takes a
 * press anywhere for a press on a resize handle and swallows it. The keyboard is what the composer
 * answers to, and is what is under test.
 */
async function typeQuestion(text: string): Promise<void> {
  act(() => box().focus());
  await userEvent.keyboard(`${text}{Enter}`);
}

const panelB = (): HTMLElement => screen.getByTestId('chat-panel');
const rail = (): HTMLElement =>
  screen.getByRole('button', { name: 'Show AI Analyst' });
const collapseB = () =>
  userEvent.click(screen.getByRole('button', { name: 'Collapse panel' }));
const rows = (): HTMLElement[] => screen.queryAllByTestId('thread-item');

// ---------------------------------------------------------------------------------------

describe('the chat is switched off (replyEnabled is false or missing)', () => {
  it('reads and sends nothing: Panel B and Panel A say it is not switched on', async () => {
    const w = world();
    render(<TradingWorkspace tier="PRO" />);
    expect(await screen.findByTestId('unavailable')).toHaveTextContent(
      'The AI Analyst is not switched on yet'
    );
    expect(screen.getByTestId('threads-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('new-thread')).toBeDisabled();
    await act(async () => undefined);
    expect(w.f.calls).toHaveLength(0);
  });

  it('is the same with the flag given as false', async () => {
    const w = world();
    render(
      <TradingWorkspace tier="PRO" replyEnabled={false} instantPromptsEnabled />
    );
    await screen.findByTestId('unavailable');
    await act(async () => undefined);
    expect(w.f.calls).toHaveLength(0);
  });

  it('the badges are the instant prompts of step 6: a press posts { kind } to the intake route, once, and nothing to the chat', async () => {
    const w = world();
    render(<TradingWorkspace tier="PRO" instantPromptsEnabled />);
    await screen.findByTestId('unavailable');
    await userEvent.click(badge(M5));
    await waitFor(() => expect(w.instant).toHaveLength(1));
    expect(w.instant[0]).toEqual({
      url: '/api/intake/instant',
      body: { kind: 'INSTANT_M5_INSPECT' },
    });
    await userEvent.click(badge(M15));
    await waitFor(() => expect(w.instant).toHaveLength(2));
    expect(w.instant[1]?.body).toEqual({ kind: 'INSTANT_M15_INSPECT' });
    expect(w.f.calls).toHaveLength(0);
  });

  it('without the instant prompts the badges are the older ones: a press hands a prompt to the chat panel', async () => {
    const w = world();
    // the chat is on here, the instant prompts are not: the older badge fills the composer
    render(<TradingWorkspace tier="PRO" replyEnabled />);
    await ready();
    await userEvent.click(badge(M5));
    await waitFor(() =>
      expect(box()).toHaveValue(
        'Analyse XAUUSD M5 market context and structure.'
      )
    );
    expect(messagePosts(w)).toHaveLength(0);
    expect(w.instant).toHaveLength(0);
  });
});

describe('the chat is on', () => {
  it('reads the state and the first page of threads once each, and nothing else', async () => {
    const w = world({
      threads: threadsServer([threadJson({ id: 'old', title: 'Old thread' })]),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(w.f.calls.map((c) => `${c.method} ${c.url}`).sort()).toEqual([
      'GET /api/chat/state',
      'GET /api/chat/threads?limit=30',
    ]);
    expect(w.instant).toHaveLength(0);
  });

  it('three panels, one state: Panel A, Panel B and the two badges are all there', async () => {
    world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    expect(panelB()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: M5 })).toBeEnabled();
    expect(screen.getByRole('button', { name: M15 })).toBeEnabled();
    expect(screen.getByTestId('threads-empty')).toBeInTheDocument();
  });
});

describe('a press on a Market Context badge', () => {
  it('sends exactly { client_request_id, kind } to the chat route, once, and the answer is a card in Panel B', async () => {
    const w = world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await userEvent.click(badge(M5));
    await waitFor(() => expect(messagePosts(w)).toHaveLength(1));
    const body = messagePosts(w)[0]?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['client_request_id', 'kind']);
    expect(body['kind']).toBe('INSTANT_M5_INSPECT');
    expect(typeof body['client_request_id']).toBe('string');
    expect(body['client_request_id']).toMatch(/^[0-9a-f-]{36}$/);
    // the answer is Panel B's
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    expect(within(panelB()).getByTestId('user-bubble')).toHaveAttribute(
      'data-source',
      'INSTANT_M5_INSPECT'
    );
    // and the old route was not used
    expect(w.instant).toHaveLength(0);
  });

  it('the M15 badge sends its own label', async () => {
    const w = world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await userEvent.click(badge(M15));
    await waitFor(() => expect(messagePosts(w)).toHaveLength(1));
    expect(messagePosts(w)[0]?.body).toMatchObject({
      kind: 'INSTANT_M15_INSPECT',
    });
    await screen.findByTestId('report1-card');
  });

  it('shows the stages in Panel B while it runs, and the thread it made in Panel A, active', async () => {
    let release!: (r: Response) => void;
    const w = world({
      message: (_body) =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await userEvent.click(badge(M5));
    expect(
      await within(panelB()).findByTestId('progress-stages')
    ).toBeInTheDocument();
    expect(rows()).toHaveLength(0);

    const reply = resultOf('report1-short-instant');
    w.server.file({
      threadId: reply.thread_id,
      title: 'XAUUSD · M5 · SHORT · 28 SEP 23:15',
      user: { instant: 'INSTANT_M5_INSPECT' },
      reply,
    });
    await act(async () => release(responseOf('report1-short-instant')));

    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]?.dataset['threadId']).toBe(reply.thread_id);
    expect(rows()[0]?.dataset['active']).toBe('true');
    expect(
      within(rows()[0] as HTMLElement).getByTestId('thread-bias')
    ).toHaveTextContent('Short');
    expect(within(panelB()).queryByTestId('progress-stages')).toBeNull();
  });

  it('scrolls Panel B to the TOP of the new card', async () => {
    world();
    const offset = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetTop'
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
      configurable: true,
      get: () => 300,
    });
    const seen: number[] = [];
    try {
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      const list = within(panelB()).getByTestId('message-list');
      Object.defineProperty(list, 'scrollTop', {
        configurable: true,
        get: () => seen.at(-1) ?? 0,
        set: (value: number) => {
          seen.push(value);
        },
      });
      await userEvent.click(badge(M5));
      await screen.findByTestId('report1-card');
      await waitFor(() => expect(seen.at(-1)).toBe(288));
    } finally {
      if (offset !== undefined) {
        Object.defineProperty(HTMLElement.prototype, 'offsetTop', offset);
      }
    }
  });

  describe('one request in flight for the whole workspace', () => {
    async function held(): Promise<{ w: World; release: () => void }> {
      let release!: (r: Response) => void;
      const w = world({
        message: () =>
          new Promise<Response>((r) => {
            release = r;
          }),
      });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      return { w, release: () => release(responseOf('answer')) };
    }

    it('a badge in flight: both badges are disabled and aria-busy, only the pressed one spins, the composer waits', async () => {
      const { release } = await held();
      await userEvent.click(badge(M5));
      await waitFor(() => expect(badge(M5)).toBeDisabled());
      for (const name of [M5, M15]) {
        expect(badge(name)).toBeDisabled();
        expect(badge(name)).toHaveAttribute('aria-busy', 'true');
      }
      expect(
        screen.getByTestId('market-context-spinner-m5')
      ).toBeInTheDocument();
      expect(screen.queryByTestId('market-context-spinner-m15')).toBeNull();
      expect(box()).toBeDisabled();
      expect(screen.getByTestId('new-thread')).toBeDisabled();
      await act(async () => release());
      await waitFor(() => expect(badge(M5)).toBeEnabled());
      expect(badge(M15)).toBeEnabled();
      expect(badge(M5)).not.toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByTestId('market-context-spinner-m5')).toBeNull();
      expect(box()).toBeEnabled();
    });

    it('a second press, on either badge, is ignored: one request', async () => {
      const { w, release } = await held();
      await userEvent.click(badge(M5));
      await waitFor(() => expect(badge(M15)).toBeDisabled());
      // a disabled button gets no click from a person; a script's click must still do nothing
      fireEvent.click(badge(M15));
      fireEvent.click(badge(M5));
      fireEvent.click(badge(M5));
      expect(messagePosts(w)).toHaveLength(1);
      await act(async () => release());
      await waitFor(() => expect(badge(M5)).toBeEnabled());
      expect(messagePosts(w)).toHaveLength(1);
    });

    it('two presses in the same tick send one request', async () => {
      const { w, release } = await held();
      act(() => {
        fireEvent.click(badge(M5));
        fireEvent.click(badge(M15));
      });
      expect(messagePosts(w)).toHaveLength(1);
      expect(messagePosts(w)[0]?.body).toMatchObject({
        kind: 'INSTANT_M5_INSPECT',
      });
      await act(async () => release());
      await waitFor(() => expect(badge(M5)).toBeEnabled());
    });

    it('a typed question in flight: both badges wait, neither spins, a press does nothing', async () => {
      const { w, release } = await held();
      await typeQuestion('Where is gold going?');
      await waitFor(() => expect(badge(M5)).toBeDisabled());
      expect(badge(M15)).toBeDisabled();
      expect(badge(M5)).toHaveAttribute('aria-busy', 'true');
      expect(badge(M15)).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByTestId('market-context-spinner-m5')).toBeNull();
      expect(screen.queryByTestId('market-context-spinner-m15')).toBeNull();
      fireEvent.click(badge(M15));
      expect(messagePosts(w)).toHaveLength(1);
      expect(messagePosts(w)[0]?.body).toMatchObject({
        question: 'Where is gold going?',
      });
      await act(async () => release());
      await waitFor(() => expect(badge(M5)).toBeEnabled());
      expect(badge(M15)).toBeEnabled();
    });

    it('a typed question cannot be sent while a badge is answering', async () => {
      const { w, release } = await held();
      await userEvent.click(badge(M15));
      await waitFor(() => expect(box()).toBeDisabled());
      fireEvent.keyDown(box(), { key: 'Enter' });
      expect(messagePosts(w)).toHaveLength(1);
      await act(async () => release());
      await waitFor(() => expect(box()).toBeEnabled());
    });
  });

  describe('a refusal', () => {
    it('is shown below the badge AND as a card in Panel B (a refusal before the stream)', async () => {
      const w = world({ message: () => responseOf('refusal-quota') });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      await userEvent.click(badge(M5));
      const card = await within(panelB()).findByTestId('refusal-card');
      const notice = await screen.findByTestId('market-context-notice-m5');
      expect(notice).toHaveAttribute('role', 'status');
      expect(notice.textContent).toBe(refusalOf('refusal-quota').reply);
      expect(within(card).getByTestId('refusal-reply').textContent).toBe(
        refusalOf('refusal-quota').reply
      );
      // the other badge shows nothing, and both work again
      expect(screen.queryByTestId('market-context-notice-m15')).toBeNull();
      expect(badge(M5)).toBeEnabled();
      expect(badge(M15)).toBeEnabled();
      expect(messagePosts(w)).toHaveLength(1);
    });

    it('is shown the same way for a refusal inside the stream', async () => {
      world({ message: () => responseOf('refusal-out-of-scope') });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      await userEvent.click(badge(M15));
      const notice = await screen.findByTestId('market-context-notice-m15');
      expect(notice.textContent).toBe(refusalOf('refusal-out-of-scope').reply);
      expect(
        await within(panelB()).findByTestId('refusal-card')
      ).toBeInTheDocument();
    });

    it('says "not available" below the badge, and shows the error card, when the request fails', async () => {
      world({ message: () => responseOf('error-persistence') });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      await userEvent.click(badge(M5));
      const notice = await screen.findByTestId('market-context-notice-m5');
      expect(notice).toHaveTextContent(/not available/i);
      expect(
        await within(panelB()).findByTestId('error-card')
      ).toBeInTheDocument();
      await waitFor(() => expect(badge(M5)).toBeEnabled());
    });

    it('a route that is not on: the badge says "not available" and the chat goes quiet', async () => {
      world({
        message: () =>
          jsonResponse(
            { success: false, error: { code: 'FEATURE_DISABLED' } },
            404
          ),
      });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      await userEvent.click(badge(M5));
      expect(
        await screen.findByTestId('market-context-notice-m5')
      ).toHaveTextContent(/not available/i);
      await waitFor(() => expect(badge(M5)).toBeEnabled());
      expect(await screen.findByTestId('unavailable')).toBeInTheDocument();
    });

    it('goes away by itself, as it always did', async () => {
      // (the 12-second timer itself is held by ask-ai-button.test.tsx; here it only has to be there)
      world({ message: () => responseOf('refusal-quota') });
      render(
        <TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />
      );
      await ready();
      await userEvent.click(badge(M5));
      expect(
        await screen.findByTestId('market-context-notice-m5')
      ).toBeInTheDocument();
    });
  });
});

describe('Panel B collapsed and opened again', () => {
  it('keeps the conversation (the question and its answer)', async () => {
    world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await typeQuestion('Where is gold going?');
    await screen.findByTestId('report1-card');
    await waitFor(() => expect(box()).toBeEnabled());

    await collapseB();
    expect(screen.queryByTestId('chat-panel')).toBeNull();
    expect(rail()).toBeInTheDocument();

    await userEvent.click(rail());
    expect(panelB()).toBeInTheDocument();
    expect(screen.getByTestId('report1-card')).toBeInTheDocument();
    expect(within(panelB()).getByTestId('user-bubble')).toHaveTextContent(
      'Where is gold going?'
    );
  });

  it('keeps the active thread in Panel A and asks the server for nothing more', async () => {
    const w = world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await typeQuestion('Where is gold going?');
    await screen.findByTestId('report1-card');
    await waitFor(() => expect(rows()).toHaveLength(1));
    const active = rows()[0]?.dataset['threadId'];
    expect(rows()[0]?.dataset['active']).toBe('true');
    const settled = w.f.calls.length;

    await collapseB();
    expect(rows()[0]?.dataset['active']).toBe('true');
    await userEvent.click(rail());
    expect(rows()[0]?.dataset['threadId']).toBe(active);
    expect(rows()[0]?.dataset['active']).toBe('true');
    // the next question joins the same thread
    await typeQuestion('And now?');
    await waitFor(() => expect(messagePosts(w)).toHaveLength(2));
    expect(messagePosts(w)[1]?.body).toMatchObject({ thread_id: active });
    // nothing was read again because the panel was collapsed
    expect(
      w.f.calls.slice(0, settled).filter((c) => c.method === 'POST')
    ).toHaveLength(1);
  });

  it('keeps a request that is still being answered: its stages are there when the panel is open again, and so is the card', async () => {
    let release!: (r: Response) => void;
    const w = world({
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await typeQuestion('Where is gold going?');
    await within(panelB()).findByTestId('progress-stages');

    await collapseB();
    // collapsing did not stop it: still one request, the badges still wait
    expect(messagePosts(w)).toHaveLength(1);
    expect(badge(M5)).toBeDisabled();
    await userEvent.click(rail());
    expect(within(panelB()).getByTestId('progress-stages')).toBeInTheDocument();
    expect(within(panelB()).getByTestId('user-bubble')).toBeInTheDocument();

    const reply = resultOf('report1-short-instant');
    w.server.file({
      threadId: reply.thread_id,
      title: 'XAUUSD · M5 · SHORT · 28 SEP 23:15',
      user: { text: 'Where is gold going?' },
      reply,
    });
    await act(async () => release(responseOf('report1-short-instant')));
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    expect(messagePosts(w)).toHaveLength(1);
  });

  it('the answer that arrives while it is collapsed is there when it is opened', async () => {
    let release!: (r: Response) => void;
    world({
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await typeQuestion('Where is gold going?');
    await within(panelB()).findByTestId('progress-stages');
    await collapseB();
    await act(async () => release(responseOf('answer')));
    await waitFor(() => expect(badge(M5)).toBeEnabled());
    await userEvent.click(rail());
    expect(await screen.findByTestId('answer-card')).toBeInTheDocument();
  });

  it('a Panel C press opens Panel B when its answer arrives, and shows the card', async () => {
    let release!: (r: Response) => void;
    const w = world({
      message: () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await collapseB();
    expect(screen.queryByTestId('chat-panel')).toBeNull();

    await userEvent.click(badge(M15));
    await waitFor(() => expect(messagePosts(w)).toHaveLength(1));
    // still collapsed while it runs; the badge spins
    expect(screen.queryByTestId('chat-panel')).toBeNull();
    expect(
      screen.getByTestId('market-context-spinner-m15')
    ).toBeInTheDocument();

    const reply = resultOf('report1-short-instant');
    w.server.file({
      threadId: reply.thread_id,
      title: 'XAUUSD · M15 · SHORT · 28 SEP 23:15',
      user: { instant: 'INSTANT_M15_INSPECT' },
      reply,
    });
    await act(async () => release(responseOf('report1-short-instant')));

    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show AI Analyst' })
    ).toBeNull();
    await waitFor(() => expect(rows()[0]?.dataset['active']).toBe('true'));
  });

  it('a Panel C press does not close Panel B when it is already open', async () => {
    world();
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await userEvent.click(badge(M5));
    await screen.findByTestId('report1-card');
    expect(panelB()).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show AI Analyst' })
    ).toBeNull();
  });

  it('a refusal leaves Panel B collapsed: the notice is below the badge', async () => {
    world({ message: () => responseOf('refusal-quota') });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await collapseB();
    await userEvent.click(badge(M5));
    expect(
      await screen.findByTestId('market-context-notice-m5')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('chat-panel')).toBeNull();
    // and the refusal card is waiting in Panel B
    await userEvent.click(rail());
    expect(within(panelB()).getByTestId('refusal-card')).toBeInTheDocument();
  });
});

describe('"Open trade setup" belongs to the workspace', () => {
  it('works from a card in Panel B, and its notice is still there when Panel B is opened again', async () => {
    world({
      message: () => responseOf('report1-long'),
      offer: () =>
        jsonResponse(
          { success: false, error: { code: 'FEATURE_DISABLED' } },
          404
        ),
    });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await typeQuestion('Direction?');
    await screen.findByTestId('report1-card');
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    const notice = await within(panelB()).findByTestId('trade-setup-notice');
    expect(notice).toHaveTextContent(
      'The trade setup could not be opened just now.'
    );
    // Panel B goes to its rail and comes back: the launcher is the workspace's, so its notice stays
    await collapseB();
    expect(screen.queryByTestId('trade-setup-notice')).toBeNull();
    await userEvent.click(rail());
    expect(
      await within(panelB()).findByTestId('trade-setup-notice')
    ).toBeInTheDocument();
    // and closing it closes it
    await userEvent.click(
      within(panelB()).getByRole('button', { name: 'Close' })
    );
    expect(screen.queryByTestId('trade-setup-notice')).toBeNull();
  });
});

describe('Panel A opens a thread into Panel B', () => {
  it('shows the stored conversation, and a question there joins the thread', async () => {
    const stored = threadsServer(
      [threadJson({ id: 'th-old', title: 'Old gold thread' })],
      {
        'th-old': exchangeJson(
          1,
          { text: 'Earlier question' },
          resultOf('answer')
        ),
      }
    );
    const w = world({ threads: stored, message: () => responseOf('answer') });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await waitFor(() => expect(rows()).toHaveLength(1));
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    expect(
      await within(panelB()).findByTestId('answer-card')
    ).toBeInTheDocument();
    expect(within(panelB()).getByTestId('user-bubble')).toHaveTextContent(
      'Earlier question'
    );
    await typeQuestion('And now?');
    await waitFor(() => expect(messagePosts(w)).toHaveLength(1));
    expect(messagePosts(w)[0]?.body).toMatchObject({
      thread_id: 'th-old',
      question: 'And now?',
    });
  });

  it('says so, with a way to try again, when the thread cannot be opened', async () => {
    const stored = threadsServer([threadJson({ id: 'th-old' })], {
      'th-old': exchangeJson(1, { text: 'Earlier' }, resultOf('answer')),
    });
    world({ threads: stored });
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    await waitFor(() => expect(rows()).toHaveLength(1));
    stored.failNext('GET', 500);
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    const failed = await within(panelB()).findByTestId('thread-open-failed');
    expect(failed).toHaveTextContent('This conversation could not be opened.');
    await userEvent.click(
      within(failed).getByRole('button', { name: 'Try again' })
    );
    expect(
      await within(panelB()).findByTestId('answer-card')
    ).toBeInTheDocument();
    expect(within(panelB()).queryByTestId('thread-open-failed')).toBeNull();
  });
});

describe('the Free tier', () => {
  it('never reads or sends anything: the example is its one thread, a press opens the upgrade modal', async () => {
    mockTier = 'FREE';
    mockPathname = '/free';
    const w = world();
    const upgrade = jest.fn();
    render(
      <TradingWorkspace
        tier="FREE"
        replyEnabled
        instantPromptsEnabled
        onOpenUpgradeModal={upgrade}
      />
    );
    expect(await screen.findByTestId('demo-replay')).toBeInTheDocument();
    expect(screen.getByTestId('threads-demo-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('new-thread')).toBeNull();
    await userEvent.click(badge(M5));
    await userEvent.click(badge(M15));
    expect(upgrade).toHaveBeenCalledTimes(2);
    await act(async () => undefined);
    expect(w.f.calls).toHaveLength(0);
    expect(w.instant).toHaveLength(0);
  });
});

describe('the canvases', () => {
  it('are given the same heights, and the panes the same boxes, whether the chat is on or off', async () => {
    world();
    appliedHeights.length = 0;
    const first = render(<TradingWorkspace tier="PRO" instantPromptsEnabled />);
    await screen.findByTestId('unavailable');
    const offHeights = [...appliedHeights];
    const offBoxes = ['mtf-upper-container', 'mtf-lower-container'].map(
      (id) => screen.getByTestId(id).className
    );
    first.unmount();

    appliedHeights.length = 0;
    render(<TradingWorkspace tier="PRO" replyEnabled instantPromptsEnabled />);
    await ready();
    const onBoxes = ['mtf-upper-container', 'mtf-lower-container'].map(
      (id) => screen.getByTestId(id).className
    );
    expect(offHeights.length).toBeGreaterThan(0);
    expect([...new Set(appliedHeights)]).toEqual([...new Set(offHeights)]);
    expect(onBoxes).toEqual(offBoxes);
  });
});
