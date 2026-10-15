/**
 * Panel B, whole (build step 7 part 8): the shell the workspace mounts (`components/chat-panel.tsx`)
 * with the REAL provider, stream reader, reducer and cards, over a fetch that answers with the real
 * recorded replies of the message route. A request is held open on purpose to look at the stages in
 * flight, and released to look at the card.
 *
 * `LocaleProvider` wraps every render and nothing here uses fake timers (LESSONS-LEARNED L40: the two
 * together run Node out of memory).
 */

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as ts from 'typescript';

import ChatPanel, { type ChatPanelProps } from '@/components/chat-panel';
import { ChatPanelView } from '@/components/chat/chat-panel-view';
import { ChatProvider } from '@/components/chat/chat-provider';
import { loadDemo } from '@/components/chat/demo-source';
import { CHAT_TEXT } from '@/components/chat/text';
import type { DemoRecording } from '@/components/chat/types';
import { notVerifiedMark } from '@/lib/reply/checks/wording-lists';

import { offerAnswer, scene } from '../report2/helpers/engine-api';
import { renderIn } from '../report2/helpers/render';
import {
  fakeFetch,
  jsonResponse,
  resultOf,
  resultOfKind,
  responseOf,
  stateBody,
  type FakeFetch,
  type FakeRoutes,
} from './helpers/fake-fetch';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
}));

const ROOT = join(__dirname, '..', '..', '..');
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const original = global.fetch;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function install(routes: FakeRoutes): FakeFetch {
  const f = fakeFetch({ state: jsonResponse(stateBody()), ...routes });
  global.fetch = f.fetch;
  return f;
}

afterEach(() => {
  global.fetch = original;
});

const box = () => screen.getByRole('textbox', { name: 'Your question' });
const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

async function ready() {
  await screen.findByRole('textbox', { name: 'Your question' });
  await waitFor(() =>
    expect(screen.getByTestId('quota-meter')).toBeInTheDocument()
  );
}

async function ask(text: string) {
  await userEvent.type(box(), `${text}{Enter}`);
}

describe('a PRO panel', () => {
  it('reads the state once, and draws the picker, the badges, the meter and the composer', async () => {
    const f = install({});
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    expect(f.gets()).toHaveLength(1);
    expect(f.gets()[0]).toMatchObject({
      url: '/api/chat/state',
      method: 'GET',
    });
    expect(screen.getByText('AI Analyst')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'AI Analyst chat' })
    ).toHaveAttribute('data-tier', 'PRO');
    expect(screen.getByRole('combobox', { name: 'AI model' })).toHaveValue(
      'vendor-a/model-a'
    );
    expect(screen.getByTestId('profile-badge')).toHaveTextContent('Day trader');
    expect(screen.getByTestId('quota-percent')).toHaveTextContent('50% left');
    expect(screen.getByTestId('quota-analyses')).toHaveTextContent(
      'About 555 analyses left'
    );
    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      'Ask about gold'
    );
    expect(f.posts()).toHaveLength(0);
  });

  it('while the state loads it says so; the composer is there once it has', async () => {
    const hold = deferred<Response>();
    install({
      state: () => {
        throw new Error('unused');
      },
    });
    global.fetch = jest.fn(() => hold.promise) as unknown as typeof fetch;
    renderIn(<ChatPanel tier="PRO" />);
    expect(screen.getByTestId('loading')).toHaveTextContent(
      'Loading the analyst…'
    );
    await act(async () => hold.resolve(jsonResponse(stateBody())));
    expect(
      await screen.findByRole('textbox', { name: 'Your question' })
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('no model has passed: the picker says so', async () => {
    install({ state: jsonResponse(stateBody({ models: [] })) });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    expect(screen.getByTestId('model-picker')).toHaveTextContent(
      'No model available yet'
    );
  });

  it('the server is not switched on (404): says so, no composer, no meter, and nothing of the old placeholder', async () => {
    install({
      state: jsonResponse(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      ),
    });
    renderIn(<ChatPanel tier="PRO" />);
    expect(await screen.findByTestId('unavailable')).toHaveTextContent(
      'The AI Analyst is not switched on yet'
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quota-meter')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /Coming Soon|Token Quota|42,500|500,000/
    );
  });

  it('the state failed (500): a notice with Try again, the composer stays, and Try again reads it again', async () => {
    let answer: Response = jsonResponse({ success: false }, 500);
    const f = install({ state: () => answer.clone() });
    renderIn(<ChatPanel tier="PRO" />);
    const notice = await screen.findByTestId('state-failed');
    expect(notice).toHaveTextContent(
      'The analyst could not be reached just now.'
    );
    expect(box()).toBeEnabled();
    answer = jsonResponse(stateBody());
    await userEvent.click(
      within(notice).getByRole('button', { name: 'Try again' })
    );
    await waitFor(() =>
      expect(screen.getByTestId('quota-meter')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('state-failed')).not.toBeInTheDocument();
    expect(f.gets()).toHaveLength(2);
  });

  it('picking another model changes what "analyses left" is worked out from', async () => {
    install({});
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'AI model' }),
      'vendor-b/model-b'
    );
    expect(screen.getByTestId('quota-analyses')).toHaveTextContent(
      'Analyses left: not measured yet'
    );
  });
});

describe('asking a question', () => {
  it('posts exactly { client_request_id, question }, shows the stages while it runs and the card when it is done', async () => {
    const hold = deferred<Response>();
    const f = install({ message: () => hold.promise });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('What is the direction of gold now?');

    expect(f.posts()).toHaveLength(1);
    const post = f.posts()[0]!;
    expect(post.url).toBe('/api/chat/message');
    expect(Object.keys(post.body as object).sort()).toEqual([
      'client_request_id',
      'question',
    ]);
    expect(post.body).toEqual({
      client_request_id: expect.stringMatching(UUID),
      question: 'What is the direction of gold now?',
    });
    expect(screen.getByTestId('user-bubble')).toHaveTextContent(
      'What is the direction of gold now?'
    );
    expect(screen.getByTestId('progress-stages')).toBeInTheDocument();
    expect(box()).toBeDisabled();
    expect(box()).toHaveValue('');
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();

    await act(async () =>
      hold.resolve(responseOf('report1-long', { chunk: 200 }))
    );
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-stages')).not.toBeInTheDocument();
    expect(box()).toBeEnabled();
    expect(screen.getByTestId('headline')).toHaveTextContent(
      resultOfKind('report1-long', 'REPORT1').report.headline.slice(0, 20)
    );
  });

  it('the stages follow the stream: each one shows its state as the events arrive', async () => {
    const encoder = new TextEncoder();
    const lines = responseOf('report1-long');
    const text = await lines.text();
    const rows = text.split('\n').filter(Boolean);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });
    install({
      message: () =>
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        }),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const stateOf = (stage: string) =>
      screen
        .getByRole('list', { name: 'Progress' })
        .querySelector(`[data-stage="${stage}"]`)
        ?.getAttribute('data-state');

    await waitFor(() => expect(stateOf('GATE')).toBe('PENDING'));
    // GATE started, GATE done, UNDERSTAND started
    for (const row of rows.slice(0, 3))
      await act(async () => controller.enqueue(encoder.encode(`${row}\n`)));
    await waitFor(() => expect(stateOf('UNDERSTAND')).toBe('STARTED'));
    expect(stateOf('GATE')).toBe('DONE');
    expect(stateOf('MODEL')).toBe('PENDING');
    // the rest, to the end
    for (const row of rows.slice(3))
      await act(async () => controller.enqueue(encoder.encode(`${row}\n`)));
    await act(async () => controller.close());
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
  });

  it('a double press is ONE request: two Enters in the same tick, and two clicks, send one', async () => {
    const hold = deferred<Response>();
    const f = install({ message: () => hold.promise });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    fireEvent.change(box(), { target: { value: 'Direction?' } });
    act(() => {
      fireEvent.keyDown(box(), { key: 'Enter' });
      fireEvent.keyDown(box(), { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    });
    expect(f.posts()).toHaveLength(1);
    expect(screen.getAllByTestId('user-bubble')).toHaveLength(1);
    await act(async () => hold.resolve(responseOf('report1-long')));
    await screen.findByTestId('report1-card');
    expect(f.posts()).toHaveLength(1);
  });

  it('cannot send a second question while one runs, and the text typed meanwhile stays', async () => {
    const hold = deferred<Response>();
    const f = install({ message: () => hold.promise });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('First');
    expect(box()).toBeDisabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(f.posts()).toHaveLength(1);
    await act(async () => hold.resolve(responseOf('answer')));
    await screen.findByTestId('answer-card');
  });

  it('ignores a question that is empty or longer than the door takes', async () => {
    const f = install({});
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await userEvent.type(box(), '   {Enter}');
    fireEvent.change(box(), { target: { value: 'x'.repeat(501) } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(f.posts()).toHaveLength(0);
  });

  it('trims the question it sends', async () => {
    const f = install({ message: () => responseOf('answer') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('  Where is the exit?  ');
    await screen.findByTestId('answer-card');
    expect(f.posts()[0]?.body).toMatchObject({
      question: 'Where is the exit?',
    });
  });

  it('after a reply the next question goes into the same thread, and the balance is read again', async () => {
    const f = install({ message: (_b, _c) => responseOf('report1-long') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('First question');
    await screen.findByTestId('report1-card');
    await waitFor(() => expect(f.gets()).toHaveLength(2));
    await ask('Second question');
    await waitFor(() => expect(f.posts()).toHaveLength(2));
    expect(f.posts()[0]?.body).not.toHaveProperty('thread_id');
    expect(f.posts()[1]?.body).toEqual({
      client_request_id: expect.stringMatching(UUID),
      thread_id: resultOf('report1-long').thread_id,
      question: 'Second question',
    });
    expect(
      (f.posts()[1]?.body as { client_request_id: string }).client_request_id
    ).not.toBe(
      (f.posts()[0]?.body as { client_request_id: string }).client_request_id
    );
  });

  it('every kind of reply is drawn by its own card', async () => {
    for (const [name, testId] of [
      ['report1-long', 'report1-card'],
      ['answer', 'answer-card'],
      ['fixed-stale', 'fixed-answer-card'],
      ['fixed-model-down', 'fixed-answer-card'],
      ['action', 'action-card'],
    ] as const) {
      install({ message: () => responseOf(name) });
      const { unmount } = renderIn(<ChatPanel tier="PRO" />);
      await ready();
      await ask('Question');
      expect(await screen.findByTestId(testId)).toBeInTheDocument();
      unmount();
    }
  });

  it('a number that could not be verified is the mark of the language, never the model’s digits', async () => {
    install({ message: () => responseOf('report1-flagged') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    await screen.findByTestId('report1-card');
    expect(screen.getByTestId('headline')).toHaveTextContent(
      notVerifiedMark('en-US')
    );
    expect(document.body.textContent).not.toContain('4999.99');
  });
});

describe('a request that does not become a reply', () => {
  it('a refusal in the stream is a card with the server’s words', async () => {
    install({ message: () => responseOf('refusal-out-of-scope') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('EURUSD?');
    const card = await screen.findByTestId('refusal-card');
    expect(card).toHaveAttribute('data-code', 'OUT_OF_SCOPE');
    expect(box()).toBeEnabled();
  });

  it('the allowance cannot cover it (429): the refusal and the share left, and no retry', async () => {
    const f = install({ message: () => responseOf('refusal-quota') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const card = await screen.findByTestId('refusal-card');
    expect(card).toHaveAttribute('data-code', 'QUOTA_INSUFFICIENT');
    expect(screen.getByTestId('refusal-allowance')).toHaveTextContent(
      'Allowance left this month: 0%'
    );
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('44302');
    expect(document.body.textContent).not.toContain('44,302');
    await waitFor(() => expect(f.gets()).toHaveLength(2));
  });

  it('the route is not switched on: the question goes away and the panel says "not switched on"', async () => {
    install({
      message: () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'FEATURE_DISABLED', message: 'Not found' },
          },
          404
        ),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    expect(await screen.findByTestId('unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('user-bubble')).not.toBeInTheDocument();
  });

  it('an error event: a card that is not retryable, with the request id support opens', async () => {
    install({ message: () => responseOf('error-persistence') });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const card = await screen.findByTestId('error-card');
    expect(card).toHaveAttribute('data-code', 'PERSISTENCE_FAILED');
    expect(screen.getByTestId('error-request-id')).toHaveTextContent(
      /Request ID [0-9a-f]{64}/
    );
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
    expect(box()).toBeEnabled();
  });

  it('a connection that drops: an error with Try again, and Try again is the SAME request', async () => {
    let calls = 0;
    const f = install({
      message: () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return responseOf('report1-long');
      },
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const card = await screen.findByTestId('error-card');
    expect(card).toHaveAttribute('data-code', 'NETWORK');
    await userEvent.click(
      within(card).getByRole('button', { name: 'Try again' })
    );
    await screen.findByTestId('report1-card');
    expect(f.posts()).toHaveLength(2);
    expect(f.posts()[1]?.body).toEqual(f.posts()[0]?.body);
    // one question on screen, the error gone
    expect(screen.getAllByTestId('user-bubble')).toHaveLength(1);
    expect(screen.queryByTestId('error-card')).not.toBeInTheDocument();
  });

  it('a stream that is cut: an error, and nothing of the half reply is drawn', async () => {
    const text = (await responseOf('report1-long').text()).slice(0, -40);
    install({
      message: () =>
        new Response(text, {
          status: 200,
          headers: { 'content-type': 'application/x-ndjson' },
        }),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    expect(await screen.findByTestId('error-card')).toHaveAttribute(
      'data-code',
      'BAD_STREAM'
    );
    expect(screen.queryByTestId('report1-card')).not.toBeInTheDocument();
  });

  it('a 500: an error with Try again; a 400: an error without it', async () => {
    install({
      message: () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'INTERNAL', message: 'x' },
            request_id: 'r-1',
          },
          503
        ),
    });
    const { unmount } = renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const card = await screen.findByTestId('error-card');
    expect(
      within(card).getByRole('button', { name: 'Try again' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('error-request-id')).toHaveTextContent(
      'Request ID r-1'
    );
    unmount();
    install({
      message: () =>
        jsonResponse(
          { success: false, error: { code: 'BAD_REQUEST', message: 'x' } },
          400
        ),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    const bad = await screen.findByTestId('error-card');
    expect(within(bad).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('stopping, and leaving', () => {
  it('Stop aborts the request, leaves a note, and the composer is back', async () => {
    const f = install({
      message: (_b, call) =>
        new Promise<Response>((_resolve, reject) => {
          call.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        }),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    expect(f.posts()[0]?.signal?.aborted).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(f.posts()[0]?.signal?.aborted).toBe(true);
    expect(await screen.findByTestId('cancelled-note')).toHaveTextContent(
      'Stopped.'
    );
    expect(screen.queryByTestId('progress-stages')).not.toBeInTheDocument();
    expect(box()).toBeEnabled();
  });

  it('closing the panel aborts the request and updates nothing after it is gone', async () => {
    const errors = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const hold = deferred<Response>();
    const f = install({ message: () => hold.promise });
    const view = renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    view.unmount();
    expect(f.posts()[0]?.signal?.aborted).toBe(true);
    await act(async () => hold.resolve(responseOf('report1-long')));
    await flush();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('what Panel C leaves for the composer', () => {
  it('a pending prompt goes into the composer of a PRO trader, once, and is cleared', async () => {
    install({});
    const onClear = jest.fn();
    renderIn(
      <ChatPanel
        tier="PRO"
        pendingPrompt="Inspect the M15 chart"
        onClearPendingPrompt={onClear}
      />
    );
    await ready();
    expect(box()).toHaveValue('Inspect the M15 chart');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('a Free trader’s panel takes nothing and sends nothing', () => {
    const f = install({});
    const onClear = jest.fn();
    renderIn(
      <ChatPanel
        tier="FREE"
        pendingPrompt="Inspect"
        onClearPendingPrompt={onClear}
      />
    );
    expect(onClear).not.toHaveBeenCalled();
    expect(f.calls).toHaveLength(0);
  });
});

describe('the collapse control and the shell’s props', () => {
  it('the collapse button calls back, and is not drawn without a handler', async () => {
    install({});
    const onCollapse = jest.fn();
    renderIn(<ChatPanel tier="PRO" onCollapsePanel={onCollapse} />);
    await ready();
    await userEvent.click(
      screen.getByRole('button', { name: 'Collapse panel' })
    );
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('draws no collapse button without a handler', async () => {
    install({});
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    expect(
      screen.queryByRole('button', { name: 'Collapse panel' })
    ).not.toBeInTheDocument();
  });

  it('keeps the props the workspace passes: the same seven, with the same names', () => {
    const source = ts.createSourceFile(
      'chat-panel.tsx',
      readFileSync(join(ROOT, 'components/chat-panel.tsx'), 'utf8'),
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TSX
    );
    const props = source.statements.find(
      (s): s is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(s) && s.name.text === 'ChatPanelProps'
    );
    expect(props).toBeDefined();
    expect(
      (props?.members ?? []).map(
        (m) =>
          `${(m.name as ts.Identifier).text}${(m as ts.PropertySignature).questionToken ? '?' : ''}`
      )
    ).toEqual([
      'tier',
      'onCollapsePanel?',
      'onOpenUpgradeModal?',
      'symbol?',
      'timeframe?',
      'pendingPrompt?',
      'onClearPendingPrompt?',
    ]);
    const props2: ChatPanelProps = {
      tier: 'PRO',
      symbol: 'XAUUSD',
      timeframe: 'M5',
    };
    expect(props2.tier).toBe('PRO');
  });

  it('has no hard-coded model, no counter, no allowance and no "coming soon" left in it', () => {
    const shell = readFileSync(join(ROOT, 'components/chat-panel.tsx'), 'utf8');
    for (const old of [
      'ANALYST_MODELS',
      'Gemini',
      'Claude Sonnet',
      'GPT',
      'Kimi',
      'GLM',
      'DeepSeek',
      '42500',
      '42,500',
      'aiMonthlyTokenQuota',
      'Coming Soon',
      'Monthly Token Quota',
      'PRO_TIER_CONFIG',
    ]) {
      expect({ old, found: shell.includes(old) }).toEqual({
        old,
        found: false,
      });
    }
  });
});

describe('the Free tier', () => {
  it('has no chat: the locked picker that leads to pricing, the read-only footer with the upgrade button', async () => {
    const f = install({});
    const onUpgrade = jest.fn();
    renderIn(<ChatPanel tier="FREE" onOpenUpgradeModal={onUpgrade} />);
    expect(
      screen.getByRole('region', { name: 'AI Analyst chat' })
    ).toHaveAttribute('data-tier', 'FREE');
    expect(
      screen.getByRole('link', { name: 'Model choice is part of PRO' })
    ).toHaveAttribute('href', '/pricing');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quota-meter')).not.toBeInTheDocument();
    expect(screen.getByTestId('free-footer')).toHaveTextContent(
      'Read-only (Free tier)'
    );
    await userEvent.click(
      within(screen.getByTestId('free-footer')).getByRole('button', {
        name: 'Upgrade to PRO',
      })
    );
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(f.calls).toHaveLength(0);
  });

  it('while no recording exists says the example is not available yet (the recording is part 10’s)', () => {
    expect(loadDemo('en-US')).toBeNull();
    renderIn(<ChatPanel tier="FREE" />);
    expect(screen.getByTestId('demo-empty')).toHaveTextContent(
      'The recorded example is not available yet.'
    );
  });

  const demo = (): DemoRecording => ({
    as_of: '2026-09-18T20:55Z',
    locale: 'en-US',
    turns: [
      {
        question: 'What is the direction of gold now?',
        instant: null,
        result: resultOf('report1-long'),
      },
      {
        question: null,
        instant: 'INSTANT_M5_INSPECT',
        result: resultOf('report1-short-instant'),
      },
      {
        question: 'Where would you exit this?',
        instant: null,
        result: resultOf('answer'),
      },
    ],
  });

  it('replays a recorded conversation under a banner that says it is recorded and when the data is from', () => {
    const f = install({});
    renderIn(
      <ChatProvider tier="FREE">
        <ChatPanelView tier="FREE" demo={demo()} />
      </ChatProvider>
    );
    const banner = screen.getByTestId('demo-banner');
    expect(banner).toHaveAttribute('role', 'note');
    expect(screen.getByTestId('demo-label')).toHaveTextContent(
      /^Recorded example, data as of /
    );
    expect(banner).toHaveTextContent(
      'This is a recorded conversation, not live data.'
    );
    const turns = screen.getAllByTestId('demo-turn');
    expect(turns).toHaveLength(3);
    expect(
      within(turns[0] as HTMLElement).getByTestId('user-bubble')
    ).toHaveTextContent('What is the direction of gold now?');
    expect(
      within(turns[0] as HTMLElement).getByTestId('report1-card')
    ).toBeInTheDocument();
    expect(
      within(turns[1] as HTMLElement).getByTestId('user-bubble')
    ).toHaveTextContent('Inspect the M5 chart');
    expect(
      within(turns[2] as HTMLElement).getByTestId('answer-card')
    ).toBeInTheDocument();
    // the same real cards, with no Trade Setup button: there is no live cycle to size on
    expect(
      screen.queryByRole('button', { name: 'Open trade setup' })
    ).not.toBeInTheDocument();
    expect(f.calls).toHaveLength(0);
  });

  it('is labelled in every language the same way: the banner is a note, never live data', () => {
    install({});
    renderIn(
      <ChatProvider tier="FREE">
        <ChatPanelView tier="FREE" demo={demo()} />
      </ChatProvider>
    );
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      CHAT_TEXT['chat.demo.body']
    );
  });
});

describe('Open trade setup', () => {
  const sceneOffer = () => offerAnswer(scene());

  it('asks Engine 4 whether it is offered for the cycle of the reply, then opens the Trade Setup modal', async () => {
    const f = install({
      message: () => responseOf('report1-long'),
      offer: jsonResponse(sceneOffer()),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    await screen.findByTestId('report1-card');
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Trade setup')).toBeInTheDocument();
    const offerCall = f.calls.find((c) => c.url === '/api/engine4/offer');
    expect(offerCall).toMatchObject({ method: 'POST' });
    const slot = resultOf('report1-long').stamp.as_of as string;
    expect(offerCall?.body).toEqual({
      cycleSlot: String(Math.floor(Date.parse(slot) / 1000)),
    });
  });

  it('a route that is off (404), or any failure: one sentence, and no modal', async () => {
    install({
      message: () => responseOf('report1-long'),
      offer: jsonResponse(
        { success: false, error: { code: 'FEATURE_DISABLED' } },
        404
      ),
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    await screen.findByTestId('report1-card');
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    expect(
      await screen.findByText('The trade setup could not be opened just now.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(
      within(screen.getByTestId('trade-setup-notice')).getByRole('button', {
        name: 'Close',
      })
    );
    expect(screen.queryByTestId('trade-setup-notice')).not.toBeInTheDocument();
  });

  it('pressing it twice asks once', async () => {
    const hold = deferred<Response>();
    const f = install({
      message: () => responseOf('report1-long'),
      offer: () => hold.promise as unknown as Response,
    });
    renderIn(<ChatPanel tier="PRO" />);
    await ready();
    await ask('Direction?');
    await screen.findByTestId('report1-card');
    const button = screen.getByRole('button', { name: 'Open trade setup' });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(f.calls.filter((c) => c.url === '/api/engine4/offer')).toHaveLength(
      1
    );
    await act(async () => hold.resolve(jsonResponse({ success: false }, 500)));
    await screen.findByTestId('trade-setup-notice');
  });
});

describe('a provider above the panel', () => {
  it('is used instead of a second one: the panel does not read the state twice', async () => {
    const f = install({});
    renderIn(
      <ChatProvider tier="PRO">
        <ChatPanel tier="PRO" />
      </ChatProvider>
    );
    await ready();
    expect(f.gets()).toHaveLength(1);
  });
});
