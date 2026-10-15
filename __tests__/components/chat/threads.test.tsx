/**
 * Panel A's conversations (build step 7 part 9): the thread list, whole, with the REAL provider,
 * reducer, hook and components over an in-memory stand-in with the real threads routes' shapes
 * (`helpers/threads-server.ts`) and the real recorded answers of the message route.
 *
 * What is held: the loading, empty, error and switched-off states; every bias badge; the active thread
 * following Panel B in both directions; opening, a new thread, "Show more" with the server's cursor;
 * rename and delete calling the API once each, with the plain statement of what a delete removes and
 * what it keeps; the collapsed rail; the Free tier's recorded example only; Arabic.
 *
 * `LocaleProvider` wraps every render and nothing here uses fake timers (LESSONS-LEARNED L40).
 */

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import { ChatProvider, useChat } from '@/components/chat/chat-provider';
import { ThreadList } from '@/components/chat/thread-list';
import { CHAT_TEXT } from '@/components/chat/text';
import type { DemoRecording } from '@/components/chat/types';
import ar from '@/lib/i18n/dictionaries/ar.json';

import { renderIn } from '../report2/helpers/render';
import {
  fakeFetch,
  jsonResponse,
  resultOf,
  responseOf,
  stateBody,
  type FakeFetch,
  type FakeRoutes,
} from './helpers/fake-fetch';
import {
  exchangeJson,
  threadJson,
  threadsServer,
  type ThreadJson,
  type ThreadsServer,
} from './helpers/threads-server';

jest.mock('next/navigation', () => ({ usePathname: () => '/terminal' }));

function Probe(): ReactElement {
  const chat = useChat();
  return (
    <div>
      <p data-testid="p-thread">{chat.state.threadId ?? ''}</p>
      <p data-testid="p-items">
        {chat.state.items.map((i) => i.kind).join(',')}
      </p>
      <p data-testid="p-busy">{String(chat.busy)}</p>
      <button
        type="button"
        data-testid="p-ask"
        onClick={() => chat.ask({ kind: 'TYPED', question: 'Direction?' })}
      />
    </div>
  );
}

function threads(count: number): ThreadJson[] {
  return Array.from({ length: count }, (_, i) =>
    threadJson({
      id: `t${String(i + 1).padStart(2, '0')}`,
      title: `Thread ${i + 1}`,
      last_message_at: new Date(
        Date.UTC(2026, 8, 18, 21, 59 - i, 0)
      ).toISOString(),
    })
  );
}

interface Mounted {
  f: FakeFetch;
  server: ThreadsServer;
}

function mount(
  server: ThreadsServer,
  options: {
    routes?: FakeRoutes;
    collapsed?: boolean;
    language?: string;
    loadOnMount?: boolean;
  } = {}
): Mounted {
  const f = fakeFetch({
    state: jsonResponse(stateBody()),
    threads: (call) => server.handle(call),
    message: () => responseOf('answer'),
    ...options.routes,
  });
  renderIn(
    <ChatProvider
      tier="PRO"
      fetchImpl={f.fetch}
      {...(options.loadOnMount === undefined
        ? {}
        : { loadOnMount: options.loadOnMount })}
    >
      <ThreadList collapsed={options.collapsed ?? false} tier="PRO" />
      <Probe />
    </ChatProvider>,
    options.language
  );
  return { f, server };
}

const rows = (): HTMLElement[] => screen.queryAllByTestId('thread-item');
const titles = (): string[] =>
  screen.queryAllByTestId('thread-title').map((el) => el.textContent ?? '');
const threadGets = (f: FakeFetch) =>
  f.calls.filter((c) => c.method === 'GET' && /threads(\?|$)/.test(c.url));

async function listed(): Promise<void> {
  await screen.findByTestId('threads');
}

describe('the states of the list', () => {
  it('shows skeleton rows while the first page is read, and the rows when it has arrived', async () => {
    const server = threadsServer(threads(2));
    let release!: (r: Response) => void;
    mount(server, {
      routes: {
        threads: (call) =>
          new Promise<Response>((r) => {
            release = () => r(server.handle(call));
          }),
      },
    });
    const loading = await screen.findByTestId('threads-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading).toHaveAccessibleName('Loading your conversations…');
    // a new thread cannot be started before the list is known
    expect(screen.getByTestId('new-thread')).toBeDisabled();
    await act(async () => release(new Response()));
    await listed();
    expect(screen.queryByTestId('threads-loading')).toBeNull();
    expect(titles()).toEqual(['Thread 1', 'Thread 2']);
    expect(screen.getByTestId('new-thread')).toBeEnabled();
  });

  it('says there is nothing yet when the trader has no conversation', async () => {
    mount(threadsServer([]));
    const empty = await screen.findByTestId('threads-empty');
    expect(empty).toHaveTextContent('No conversations yet');
    expect(empty).toHaveTextContent(
      'Your questions to the AI Analyst are saved here.'
    );
    expect(rows()).toHaveLength(0);
    // a new thread is still a thing to start
    expect(screen.getByTestId('new-thread')).toBeEnabled();
  });

  it('says the list could not be read, and reads it again when asked', async () => {
    const server = threadsServer(threads(2));
    server.failNext('GET', 503);
    const { f } = mount(server);
    const alert = await screen.findByTestId('threads-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Your conversations could not be loaded.');
    await userEvent.click(
      within(alert).getByRole('button', { name: 'Try again' })
    );
    await listed();
    expect(titles()).toEqual(['Thread 1', 'Thread 2']);
    expect(screen.queryByTestId('threads-error')).toBeNull();
    expect(threadGets(f)).toHaveLength(2);
  });

  it('says so, quietly, when the chat is not switched on: the route answers 404 for everybody', async () => {
    const server = threadsServer(threads(2));
    server.disable();
    const { f } = mount(server);
    const note = await screen.findByTestId('threads-unavailable');
    expect(note).toHaveTextContent(
      'Conversations appear here once the AI Analyst is switched on.'
    );
    expect(rows()).toHaveLength(0);
    expect(screen.getByTestId('new-thread')).toBeDisabled();
    expect(threadGets(f)).toHaveLength(1);
  });

  it('makes no request at all when the workspace says the chat is off', async () => {
    const server = threadsServer(threads(2));
    const { f } = mount(server, { loadOnMount: false });
    expect(
      await screen.findByTestId('threads-unavailable')
    ).toBeInTheDocument();
    await act(async () => undefined);
    expect(f.calls).toHaveLength(0);
  });

  it('runs with no provider above it, and asks for nothing', () => {
    renderIn(<ThreadList collapsed={false} tier="PRO" />);
    expect(screen.getByTestId('threads-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('new-thread')).toBeDisabled();
  });
});

describe('a row', () => {
  const MATRIX: [ThreadJson['last_bias'], string, string][] = [
    ['LONG', 'Long', 'good'],
    ['SHORT', 'Short', 'bad'],
    ['NEUTRAL', 'Neutral', 'neutral'],
    ['STAND_ASIDE', 'Stand aside', 'warn'],
  ];

  it.each(MATRIX)(
    'shows the last direction %s as a badge in the reader’s words',
    async (bias, word, tone) => {
      mount(threadsServer([threadJson({ last_bias: bias })]));
      await listed();
      const badge = screen.getByTestId('thread-bias');
      expect(badge).toHaveTextContent(word);
      expect(badge).toHaveAttribute('data-tone', tone);
      // it is drawn in capitals: LONG, SHORT, NEUTRAL, STAND ASIDE
      expect(badge.className).toContain('uppercase');
    }
  );

  it('has no badge for a thread whose answers had no direction', async () => {
    mount(threadsServer([threadJson({ last_bias: null })]));
    await listed();
    expect(screen.queryByTestId('thread-bias')).toBeNull();
  });

  it('shows the server’s title as it came, a one-line preview and the time in the viewer’s format', async () => {
    mount(
      threadsServer([
        threadJson({
          title: 'XAUUSD · M15 · LONG · 18 SEP 20:55',
          last_preview: 'Gold is holding above the channel.',
          last_message_at: '2026-09-18T21:02:00.000Z',
        }),
      ])
    );
    await listed();
    expect(screen.getByTestId('thread-title')).toHaveTextContent(
      'XAUUSD · M15 · LONG · 18 SEP 20:55'
    );
    expect(screen.getByTestId('thread-preview')).toHaveTextContent(
      'Gold is holding above the channel.'
    );
    expect(screen.getByTestId('thread-time')).toHaveTextContent(
      '09/18/2026 21:02'
    );
    expect(screen.getByTestId('thread-time')).toHaveAttribute(
      'datetime',
      '2026-09-18T21:02:00.000Z'
    );
    // one line: the text is cut, not wrapped
    expect(screen.getByTestId('thread-title').className).toContain('truncate');
    expect(screen.getByTestId('thread-preview').className).toContain(
      'truncate'
    );
  });

  it('draws no preview line for a thread with no preview', async () => {
    mount(threadsServer([threadJson({ last_preview: '' })]));
    await listed();
    expect(screen.queryByTestId('thread-preview')).toBeNull();
  });

  it('has the whole title and the last message time as its name on hover', async () => {
    mount(threadsServer([threadJson({ title: 'A very long title indeed' })]));
    await listed();
    expect(rows()[0]?.querySelector('button')).toHaveAttribute(
      'title',
      expect.stringContaining('A very long title indeed')
    );
    expect(rows()[0]?.querySelector('button')).toHaveAttribute(
      'title',
      expect.stringContaining('Last message: 09/18/2026 21:02')
    );
  });
});

describe('the active thread', () => {
  const server = (): ThreadsServer =>
    threadsServer(threads(3), {
      t01: exchangeJson(1, { text: 'First' }, resultOf('answer')),
      t02: exchangeJson(
        1,
        { instant: 'INSTANT_M5_INSPECT' },
        resultOf('report1-short-instant')
      ),
    });

  it('is none for a new thread', async () => {
    mount(server());
    await listed();
    expect(screen.getByTestId('p-thread')).toHaveTextContent('');
    expect(rows().filter((r) => r.dataset['active'] === 'true')).toHaveLength(
      0
    );
    expect(document.querySelector('[aria-current]')).toBeNull();
  });

  it('is the thread picked, and Panel B gets its messages', async () => {
    const { f } = mount(server());
    await listed();
    await userEvent.click(
      within(rows()[1] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    expect(screen.getByTestId('p-thread')).toHaveTextContent('t02');
    const active = rows().filter((r) => r.dataset['active'] === 'true');
    expect(active).toHaveLength(1);
    expect(active[0]?.dataset['threadId']).toBe('t02');
    expect(
      within(active[0] as HTMLElement).getAllByRole('button')[0]
    ).toHaveAttribute('aria-current', 'true');
    expect(f.calls.filter((c) => c.url.endsWith('/t02'))).toHaveLength(1);
  });

  it('moves to another thread when another is picked', async () => {
    mount(server());
    await listed();
    for (const index of [0, 2]) {
      await userEvent.click(
        within(rows()[index] as HTMLElement).getAllByRole(
          'button'
        )[0] as HTMLElement
      );
      await waitFor(() =>
        expect(screen.getByTestId('p-thread')).toHaveTextContent(
          `t0${index + 1}`
        )
      );
      await waitFor(() =>
        expect(screen.getByTestId('p-busy')).toHaveTextContent('false')
      );
    }
    expect(rows().filter((r) => r.dataset['active'] === 'true')).toHaveLength(
      1
    );
    expect(
      rows().find((r) => r.dataset['active'] === 'true')?.dataset['threadId']
    ).toBe('t03');
  });

  it('clears when a new thread is started', async () => {
    mount(server());
    await listed();
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    await userEvent.click(screen.getByTestId('new-thread'));
    expect(screen.getByTestId('p-thread')).toHaveTextContent('');
    expect(screen.getByTestId('p-items')).toHaveTextContent('');
    expect(rows().filter((r) => r.dataset['active'] === 'true')).toHaveLength(
      0
    );
  });

  it('follows a new answer: the thread it made appears at the top of the list and is the active one', async () => {
    const s = server();
    const answer = resultOf('report1-long');
    const { f } = mount(s, {
      routes: {
        message: () => {
          s.file({
            threadId: answer.thread_id,
            title: 'XAUUSD · M15 · LONG · 18 SEP 20:55',
            user: { text: 'Direction?' },
            reply: answer,
          });
          return responseOf('report1-long');
        },
      },
    });
    await listed();
    expect(rows()).toHaveLength(3);
    await userEvent.click(screen.getByTestId('p-ask'));
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(rows()[0]?.dataset['threadId']).toBe(answer.thread_id);
    expect(rows()[0]?.dataset['active']).toBe('true');
    expect(
      within(rows()[0] as HTMLElement).getByTestId('thread-bias')
    ).toHaveTextContent('Long');
    // the list was read again quietly, once, when the request ended
    expect(threadGets(f)).toHaveLength(2);
    expect(screen.queryByTestId('threads-loading')).toBeNull();
  });

  it('a quiet read that fails leaves the list as it was', async () => {
    const s = server();
    const { f } = mount(s);
    await listed();
    s.failNext('GET', 500);
    await userEvent.click(screen.getByTestId('p-ask'));
    await waitFor(() =>
      expect(screen.getByTestId('p-busy')).toHaveTextContent('false')
    );
    await waitFor(() => expect(threadGets(f)).toHaveLength(2));
    expect(titles()).toEqual(['Thread 1', 'Thread 2', 'Thread 3']);
    expect(screen.queryByTestId('threads-error')).toBeNull();
  });
});

describe('while a request is in flight', () => {
  it('waits: the other rows and a new thread cannot be used, the active row can still be read', async () => {
    const s = threadsServer(threads(3), {
      t01: exchangeJson(1, { text: 'First' }, resultOf('answer')),
    });
    let release!: (r: Response) => void;
    mount(s, {
      routes: {
        message: () =>
          new Promise<Response>((r) => {
            release = r;
          }),
      },
    });
    await listed();
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    await userEvent.click(screen.getByTestId('p-ask'));
    await waitFor(() =>
      expect(screen.getByTestId('p-busy')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('new-thread')).toBeDisabled();
    const [first, second] = [
      within(rows()[0] as HTMLElement).getAllByRole('button')[0],
      within(rows()[1] as HTMLElement).getAllByRole('button')[0],
    ];
    expect(first).toBeEnabled();
    expect(second).toBeDisabled();
    // the thread that is being answered cannot be deleted under the request
    expect(
      within(rows()[0] as HTMLElement).getByRole('button', {
        name: 'Delete Thread 1',
      })
    ).toBeDisabled();
    await act(async () => release(responseOf('answer')));
    await waitFor(() =>
      expect(screen.getByTestId('p-busy')).toHaveTextContent('false')
    );
    expect(screen.getByTestId('new-thread')).toBeEnabled();
  });
});

describe('more threads', () => {
  it('shows a page, and the next one when asked, with the cursor the server gave', async () => {
    const s = threadsServer(threads(35));
    const { f } = mount(s);
    await listed();
    expect(rows()).toHaveLength(30);
    expect(f.calls[0]?.url).toBe('/api/chat/threads?limit=30');
    const more = screen.getByTestId('threads-more');
    expect(more).toHaveTextContent('Show more');
    await userEvent.click(more);
    await waitFor(() => expect(rows()).toHaveLength(35));
    const second = f.calls.find((c) => c.url.includes('after='));
    expect(second?.url).toMatch(
      /^\/api\/chat\/threads\?limit=30&after=[\w-]+$/
    );
    expect(screen.queryByTestId('threads-more')).toBeNull();
    expect(titles()[34]).toBe('Thread 35');
  });

  it('does not offer more when the list fits in a page', async () => {
    mount(threadsServer(threads(30)));
    await listed();
    expect(screen.queryByTestId('threads-more')).toBeNull();
  });

  it('says the next page failed, keeps what is shown, and tries again', async () => {
    const s = threadsServer(threads(35));
    mount(s);
    await listed();
    s.failNext('GET', 500);
    await userEvent.click(screen.getByTestId('threads-more'));
    const failed = await screen.findByTestId('threads-more-failed');
    expect(failed).toHaveTextContent('More conversations could not be loaded.');
    expect(rows()).toHaveLength(30);
    const again = screen.getByTestId('threads-more');
    expect(again).toHaveTextContent('Try again');
    await userEvent.click(again);
    await waitFor(() => expect(rows()).toHaveLength(35));
    expect(screen.queryByTestId('threads-more-failed')).toBeNull();
  });

  it('never shows a thread twice when a page overlaps the last', async () => {
    const all = threads(35);
    const s = threadsServer(all);
    mount(s, {
      routes: {
        threads: (call) => {
          const response = s.handle(call);
          if (!call.url.includes('after=')) return response;
          // the second page repeats the last thread of the first
          return response.json().then((body) =>
            jsonResponse({
              ...body,
              threads: [all[29], ...body.threads],
            })
          );
        },
      },
    });
    await listed();
    await userEvent.click(screen.getByTestId('threads-more'));
    await waitFor(() => expect(rows()).toHaveLength(35));
    expect(new Set(titles()).size).toBe(35);
  });
});

describe('rename', () => {
  async function open(s: ThreadsServer): Promise<Mounted> {
    const m = mount(s);
    await listed();
    return m;
  }
  const pencil = (title: string): HTMLElement =>
    screen.getByRole('button', { name: `Rename ${title}` });

  it('sends the new title once and shows the one the server kept', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    await userEvent.click(pencil('Thread 1'));
    const field = screen.getByRole('textbox', { name: 'Conversation name' });
    expect(field).toHaveValue('Thread 1');
    expect(field).toHaveFocus();
    await userEvent.clear(field);
    await userEvent.type(field, '  My gold plan {Enter}');
    await waitFor(() => expect(titles()[0]).toBe('My gold plan'));
    const patches = f.calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      url: '/api/chat/threads/t01',
      body: { title: 'My gold plan' },
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(s.threads.find((t) => t.id === 't01')?.title_source).toBe('USER');
  });

  it('saves with the check mark too', async () => {
    const s = threadsServer(threads(2));
    await open(s);
    await userEvent.click(pencil('Thread 2'));
    const field = screen.getByRole('textbox', { name: 'Conversation name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(titles()[1]).toBe('Renamed'));
  });

  it('Escape and the cross cancel without a request', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    await userEvent.click(pencil('Thread 1'));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Conversation name' }),
      'abc{Escape}'
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(titles()[0]).toBe('Thread 1');
    await userEvent.click(pencil('Thread 1'));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(f.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
  });

  it('does not send an empty name, a blank one or the name it already has', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    await userEvent.click(pencil('Thread 1'));
    const field = screen.getByRole('textbox', { name: 'Conversation name' });
    await userEvent.clear(field);
    expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    await userEvent.type(field, '   {Enter}');
    expect(f.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, 'Thread 1{Enter}');
    expect(f.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('takes at most 80 characters', async () => {
    const s = threadsServer(threads(1));
    await open(s);
    await userEvent.click(pencil('Thread 1'));
    expect(
      screen.getByRole('textbox', { name: 'Conversation name' })
    ).toHaveAttribute('maxlength', '80');
  });

  it('says it could not be saved, and keeps the field open for another try', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    s.failNext('PATCH', 500);
    await userEvent.click(pencil('Thread 1'));
    const field = screen.getByRole('textbox', { name: 'Conversation name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Plan B{Enter}');
    const alert = await screen.findByTestId('rename-failed');
    expect(alert).toHaveTextContent('The name could not be saved.');
    // the row is still being edited (its title is the field), and nothing was renamed
    expect(titles()).toEqual(['Thread 2']);
    expect(s.threads.find((t) => t.id === 't01')?.title).toBe('Thread 1');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(field, '{Enter}');
    await waitFor(() => expect(titles()[0]).toBe('Plan B'));
    expect(f.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
  });
});

describe('delete', () => {
  async function open(
    s: ThreadsServer,
    routes: FakeRoutes = {}
  ): Promise<Mounted> {
    const m = mount(s, { routes });
    await listed();
    return m;
  }
  const bin = (title: string): HTMLElement =>
    screen.getByRole('button', { name: `Delete ${title}` });

  it('asks first, and says plainly what is removed and what is kept', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    await userEvent.click(bin('Thread 1'));
    const dialog = await screen
      .findByRole('alertdialog')
      .catch(() => screen.findByRole('dialog'));
    expect(
      within(dialog).getByText('Delete this conversation?')
    ).toBeInTheDocument();
    const body = within(dialog).getByTestId('delete-body');
    expect(body).toHaveTextContent(CHAT_TEXT['chat.threads.delete_body']);
    // the transcript goes; the audit record stays on the server and holds none of the questions
    expect(body.textContent).toMatch(/removed for good/);
    expect(body.textContent).toMatch(/audit record/);
    expect(body.textContent).toMatch(/cannot be changed or deleted/);
    expect(body.textContent).toMatch(/no part of your questions/);
    expect(within(dialog).getByText('Thread 1')).toBeInTheDocument();
    // nothing was sent yet
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    expect(rows()).toHaveLength(2);
  });

  it('keeps the thread when the trader keeps it', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    await userEvent.click(bin('Thread 1'));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Keep it' })
    );
    await waitFor(() =>
      expect(screen.queryByTestId('delete-dialog')).toBeNull()
    );
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    expect(rows()).toHaveLength(2);
  });

  it('deletes once, takes the thread out of the list and closes', async () => {
    const s = threadsServer(threads(3));
    const { f } = await open(s);
    await userEvent.click(bin('Thread 2'));
    await userEvent.click(await screen.findByTestId('delete-confirm'));
    await waitFor(() => expect(titles()).toEqual(['Thread 1', 'Thread 3']));
    const deletes = f.calls.filter((c) => c.method === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe('/api/chat/threads/t02');
    await waitFor(() =>
      expect(screen.queryByTestId('delete-dialog')).toBeNull()
    );
    expect(s.threads.map((t) => t.id)).toEqual(['t01', 't03']);
  });

  it('empties Panel B and the active thread when the thread on screen is deleted', async () => {
    const s = threadsServer(threads(2), {
      t01: exchangeJson(1, { text: 'First' }, resultOf('answer')),
    });
    await open(s);
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    await userEvent.click(bin('Thread 1'));
    await userEvent.click(await screen.findByTestId('delete-confirm'));
    await waitFor(() => expect(titles()).toEqual(['Thread 2']));
    expect(screen.getByTestId('p-thread')).toHaveTextContent('');
    expect(screen.getByTestId('p-items')).toHaveTextContent('');
  });

  it('leaves Panel B alone when another thread is deleted', async () => {
    const s = threadsServer(threads(2), {
      t01: exchangeJson(1, { text: 'First' }, resultOf('answer')),
    });
    await open(s);
    await userEvent.click(
      within(rows()[0] as HTMLElement).getAllByRole('button')[0] as HTMLElement
    );
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    await userEvent.click(bin('Thread 2'));
    await userEvent.click(await screen.findByTestId('delete-confirm'));
    await waitFor(() => expect(titles()).toEqual(['Thread 1']));
    expect(screen.getByTestId('p-thread')).toHaveTextContent('t01');
    expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT');
  });

  it('says it could not be deleted, keeps the dialog and the thread, and can try again', async () => {
    const s = threadsServer(threads(2));
    const { f } = await open(s);
    s.failNext('DELETE', 500);
    await userEvent.click(bin('Thread 1'));
    await userEvent.click(await screen.findByTestId('delete-confirm'));
    const failed = await screen.findByTestId('delete-failed');
    expect(failed).toHaveTextContent('The conversation could not be deleted.');
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(titles()).toEqual(['Thread 1', 'Thread 2']);
    await userEvent.click(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(titles()).toEqual(['Thread 2']));
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(2);
  });

  it('a thread that is already gone is gone: the row goes too', async () => {
    const s = threadsServer(threads(2));
    await open(s);
    s.threads = s.threads.filter((t) => t.id !== 't01');
    await userEvent.click(bin('Thread 1'));
    await userEvent.click(await screen.findByTestId('delete-confirm'));
    await waitFor(() => expect(titles()).toEqual(['Thread 2']));
  });

  it('a double click on "Delete conversation" sends one request', async () => {
    const s = threadsServer(threads(2));
    let release!: () => void;
    const { f } = await open(s, {
      threads: (call) =>
        call.method === 'DELETE'
          ? new Promise<Response>((r) => {
              release = () => r(s.handle(call));
            })
          : s.handle(call),
    });
    await userEvent.click(bin('Thread 1'));
    const confirm = await screen.findByTestId('delete-confirm');
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(f.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
    expect(confirm).toBeDisabled();
    await act(async () => release());
    await waitFor(() => expect(titles()).toEqual(['Thread 2']));
  });
});

describe('the collapsed rail', () => {
  it('is an icon for every thread, named by its title, and a plus for a new one', async () => {
    mount(threadsServer(threads(2)), { collapsed: true });
    await listed();
    expect(titles()).toEqual([]);
    const buttons = rows().map((row) => row.querySelector('button'));
    expect(buttons[0]).toHaveAccessibleName('Thread 1');
    expect(buttons[1]).toHaveAccessibleName('Thread 2');
    expect(screen.queryByTestId('thread-bias')).toBeNull();
    const plus = screen.getByTestId('new-thread');
    expect(plus).toHaveAccessibleName('New thread');
    expect(plus).not.toHaveTextContent('New thread');
  });

  it('still opens a thread and starts a new one', async () => {
    const s = threadsServer(threads(2), {
      t02: exchangeJson(1, { text: 'Second' }, resultOf('answer')),
    });
    mount(s, { collapsed: true });
    await listed();
    await userEvent.click(rows()[1]?.querySelector('button') as HTMLElement);
    await waitFor(() =>
      expect(screen.getByTestId('p-items')).toHaveTextContent('USER,RESULT')
    );
    expect(rows()[1]?.dataset['active']).toBe('true');
    expect(rows()[1]?.querySelector('button')).toHaveAttribute(
      'aria-current',
      'true'
    );
    await userEvent.click(screen.getByTestId('new-thread'));
    expect(screen.getByTestId('p-thread')).toHaveTextContent('');
  });

  it('draws no skeleton text, empty text or note on the rail', async () => {
    mount(threadsServer([]), { collapsed: true });
    await act(async () => undefined);
    await waitFor(() =>
      expect(screen.queryByTestId('threads-loading')).toBeNull()
    );
    expect(screen.queryByTestId('threads-empty')).toBeNull();
  });
});

describe('the Free tier', () => {
  const demo: DemoRecording = {
    as_of: '2026-09-18T20:55Z',
    locale: 'en-US',
    turns: [],
  };

  it('has the recorded example as its one thread, and reads no route', async () => {
    const f = fakeFetch({});
    renderIn(
      <ChatProvider tier="FREE" fetchImpl={f.fetch}>
        <ThreadList collapsed={false} tier="FREE" demo={demo} />
      </ChatProvider>
    );
    expect(screen.getByTestId('threads-demo')).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent('Recorded example');
    expect(rows()[0]).toHaveTextContent('09/18/2026 20:55');
    expect(rows()[0]?.querySelector('[aria-current="true"]')).not.toBeNull();
    // nothing to create, rename or delete
    expect(screen.queryByTestId('new-thread')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    await act(async () => undefined);
    expect(f.calls).toHaveLength(0);
  });

  it('says the example is not available yet when there is none', () => {
    renderIn(<ThreadList collapsed={false} tier="FREE" demo={null} />);
    expect(screen.getByTestId('threads-demo-empty')).toHaveTextContent(
      'The recorded example is not available yet.'
    );
    expect(rows()).toHaveLength(0);
  });

  it('is one icon on the rail', () => {
    renderIn(<ThreadList collapsed tier="FREE" demo={demo} />);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.querySelector('[aria-label]')).toHaveAttribute(
      'aria-label',
      'Recorded example'
    );
  });
});

describe('Arabic', () => {
  it('uses the reader’s words, keeps the market title and the time left to right', async () => {
    const s = threadsServer([threadJson({ last_bias: 'LONG' })]);
    mount(s, { language: 'ar' });
    await waitFor(() =>
      expect(screen.getByTestId('new-thread')).toHaveTextContent(
        (ar as Record<string, string>)['chat.threads.new'] as string
      )
    );
    await listed();
    expect(screen.getByTestId('thread-bias')).toHaveTextContent(
      (ar as Record<string, string>)['chat.threads.bias.LONG'] as string
    );
    // the title is market data: its own direction decides
    const title = screen.getByTestId('thread-title');
    expect(title.tagName).toBe('BDI');
    expect(title).toHaveAttribute('dir', 'auto');
    expect(title).toHaveTextContent('XAUUSD · M15 · LONG · 18 SEP 20:55');
    // the time is a figure: left to right
    expect(
      screen.getByTestId('thread-time').querySelector('bdi')
    ).toHaveAttribute('dir', 'ltr');
  });
});
