/**
 * The development preview of the three connected panels (build step 7 part 9): `/dev/workspace`.
 *
 * It must be an honest window on the real thing, and must not exist in a production build. So: the page
 * refuses under NODE_ENV=production; the threads stand-in answers the way the REAL threads routes do
 * (the shapes of `threadView` and `messageView`, an opaque cursor, 404 `THREAD_INVALID`, 404
 * `FEATURE_DISABLED`); what it holds are RECORDED replies of the real message route; a message the
 * preview answers is filed into the list the way the real route files it; and the preview hands the real
 * workspace exactly the flags its controls say.
 */

import {
  act,
  render as rtlRender,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import WorkspacePreviewPage from '@/app/dev/workspace/page';
import { WorkspacePreview } from '@/app/dev/workspace/workspace-preview';
import {
  THREAD_WORLDS,
  threadsStandIn,
  type ThreadWorld,
} from '@/app/dev/workspace/threads-stand-in';
import { RECORDED } from '@/app/dev/chat/scenarios';
import { standInFetch } from '@/app/dev/chat/stand-in';
import { previewInfo } from '@/app/dev/chat/scenarios';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { itemsFromMessages, readThread } from '@/components/chat/threads-wire';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

import { resultOf } from '../components/chat/helpers/fake-fetch';

const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/workspace',
  notFound: () => notFound(),
}));

let lastProps: Record<string, unknown> = {};
jest.mock('@/components/workspace/trading-workspace', () => ({
  TradingWorkspace: (props: Record<string, unknown>) => {
    lastProps = props;
    return <div data-testid="workspace-stub" />;
  },
}));
jest.mock('@/components/ui/pro-upgrade-modal', () => ({
  ProUpgradeModal: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="upgrade-modal" data-open={String(isOpen)} />
  ),
}));

const env = process.env as Record<string, string | undefined>;
const NODE_ENV = env['NODE_ENV'];
afterEach(() => {
  env['NODE_ENV'] = NODE_ENV;
  notFound.mockClear();
  lastProps = {};
  localStorage.clear();
});

function renderPreview(language = 'en-US') {
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language,
      timezone: 'UTC',
      dateFormat: 'MDY',
      timeFormat: '24h',
      currency: 'USD',
    })
  );
  return rtlRender(<WorkspacePreview />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    ),
  });
}

function standIn(world: ThreadWorld = 'five', language = 'en-US', slowMs = 5) {
  return threadsStandIn({
    world: () => world,
    language: () => language,
    t: (_key, fallback) => fallback ?? '',
    slowMs,
  });
}

const call = async (
  stand: ReturnType<typeof standIn>,
  url: string,
  init?: RequestInit
) => {
  const response = stand.handle(url, init);
  if (response === null) throw new Error(`not a threads URL: ${url}`);
  const resolved = await response;
  return { status: resolved.status, body: (await resolved.json()) as any };
};

describe('the page', () => {
  it('does not exist in a production build', () => {
    env['NODE_ENV'] = 'production';
    expect(() => WorkspacePreviewPage()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('shows the preview everywhere else', () => {
    env['NODE_ENV'] = 'development';
    const element = WorkspacePreviewPage() as ReactElement;
    expect(element.type).toBe(WorkspacePreview);
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('the threads stand-in answers like the real routes', () => {
  it('lists the threads newest first, in the shape the browser reads, every row readable', async () => {
    const { status, body } = await call(
      standIn(),
      '/api/chat/threads?limit=30'
    );
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.next).toBeNull();
    const read = body.threads.map(readThread);
    expect(read.every((t: unknown) => t !== null)).toBe(true);
    expect(read.map((t: { id: string }) => t.id)).toEqual([
      'th-fixture-0002',
      'th-fixture-0001',
      'th-fixture-0007',
      'th-fixture-0008',
      'th-fixture-0003',
    ]);
    // the four directions, and one with none, and one the trader named
    expect(read.map((t: { lastBias: unknown }) => t.lastBias)).toEqual([
      'SHORT',
      'LONG',
      'NEUTRAL',
      'STAND_ASIDE',
      null,
    ]);
    expect(read[4].titleSource).toBe('USER');
  });

  it('pages with an opaque cursor, and the second page repeats nothing', async () => {
    const stand = standIn('many');
    const first = await call(stand, '/api/chat/threads?limit=30');
    expect(first.body.threads).toHaveLength(30);
    expect(typeof first.body.next).toBe('string');
    const second = await call(
      stand,
      `/api/chat/threads?limit=30&after=${encodeURIComponent(first.body.next)}`
    );
    expect(second.body.threads).toHaveLength(15);
    expect(second.body.next).toBeNull();
    const ids = [...first.body.threads, ...second.body.threads].map(
      (t: { id: string }) => t.id
    );
    expect(new Set(ids).size).toBe(45);
    const bad = await call(stand, '/api/chat/threads?after=%25%25');
    expect(bad.status).toBe(400);
  });

  it('reads a thread and its messages back as the items Panel B draws', async () => {
    const { status, body } = await call(
      standIn(),
      '/api/chat/threads/th-fixture-0001'
    );
    expect(status).toBe(200);
    expect(body.thread.id).toBe('th-fixture-0001');
    const items = itemsFromMessages(body.messages);
    expect(items.map((i) => i.kind)).toEqual(['USER', 'RESULT']);
    expect(items[0]).toMatchObject({
      input: { kind: 'TYPED', question: 'What is the direction of gold now?' },
    });
    expect((items[1] as { result: unknown }).result).toEqual(
      resultOf('report1-long')
    );
  });

  it('keeps ids and prices of a thread read in another language, and changes the words', async () => {
    const english = await call(standIn(), '/api/chat/threads/th-fixture-0001');
    const german = await call(
      standIn('five', 'de'),
      '/api/chat/threads/th-fixture-0001'
    );
    const [en, de] = [english, german].map(
      (r) =>
        (
          itemsFromMessages(r.body.messages)[1] as {
            result: { reply_locale: string; thread_id: string };
          }
        ).result
    );
    expect(en?.reply_locale).not.toBe(de?.reply_locale);
    expect(de?.thread_id).toBe(en?.thread_id);
  });

  it('says 404 THREAD_INVALID for a thread that is not there, whatever the verb', async () => {
    const stand = standIn();
    for (const method of ['GET', 'PATCH', 'DELETE']) {
      const { status, body } = await call(stand, '/api/chat/threads/nope', {
        method,
        body: '{"title":"x"}',
      });
      expect(status).toBe(404);
      expect(body.error.code).toBe('THREAD_INVALID');
    }
  });

  it('renames (trimmed, at most 80 characters, marked as the trader’s) and refuses an empty name', async () => {
    const stand = standIn();
    const ok = await call(stand, '/api/chat/threads/th-fixture-0001', {
      method: 'PATCH',
      body: JSON.stringify({ title: `  ${'x'.repeat(100)}  ` }),
    });
    expect(ok.body.title).toBe('x'.repeat(80));
    const list = await call(stand, '/api/chat/threads');
    const row = list.body.threads.find(
      (t: { id: string }) => t.id === 'th-fixture-0001'
    );
    expect(row.title_source).toBe('USER');
    const empty = await call(stand, '/api/chat/threads/th-fixture-0001', {
      method: 'PATCH',
      body: JSON.stringify({ title: '   ' }),
    });
    expect(empty.status).toBe(400);
  });

  it('deletes a thread and its messages', async () => {
    const stand = standIn();
    expect(
      (
        await call(stand, '/api/chat/threads/th-fixture-0001', {
          method: 'DELETE',
        })
      ).body.success
    ).toBe(true);
    const list = await call(stand, '/api/chat/threads');
    expect(list.body.threads).toHaveLength(4);
    const gone = await call(stand, '/api/chat/threads/th-fixture-0001');
    expect(gone.status).toBe(404);
  });

  it('has a world with no threads, one that cannot be read, one that is off, and one that is slow', async () => {
    expect(
      (await call(standIn('none'), '/api/chat/threads')).body.threads
    ).toEqual([]);
    expect((await call(standIn('error'), '/api/chat/threads')).status).toBe(
      503
    );
    const off = await call(standIn('off'), '/api/chat/threads');
    expect(off.status).toBe(404);
    expect(off.body.error.code).toBe('FEATURE_DISABLED');
    const started = Date.now();
    const slow = await call(standIn('slow', 'en-US', 60), '/api/chat/threads');
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect(slow.body.threads).toHaveLength(5);
  });

  it('has the same worlds as it names', () => {
    expect([...THREAD_WORLDS]).toEqual([
      'five',
      'many',
      'none',
      'slow',
      'error',
      'off',
    ]);
  });

  it('does not answer a URL that is not a threads route', () => {
    expect(standIn().handle('/api/chat/state', undefined)).toBeNull();
    expect(standIn().handle('/api/chat/message', undefined)).toBeNull();
  });
});

describe('a message the preview answers is filed like the real route files it', () => {
  it('makes a thread with a title in the server’s form, at the top of the list, with the reply’s direction', async () => {
    const stand = standIn('none');
    const id = stand.accept({
      answer: 'report1-short-instant',
      body: { client_request_id: 'c-1', kind: 'INSTANT_M5_INSPECT' },
    });
    expect(id).toMatch(/^th-preview-\d+$/);
    const list = await call(stand, '/api/chat/threads');
    expect(list.body.threads).toHaveLength(1);
    expect(list.body.threads[0]).toMatchObject({
      id,
      title: 'XAUUSD · M5 · SHORT · 28 SEP 23:15',
      title_source: 'AUTO',
      last_bias: 'SHORT',
      message_count: 2,
      report_count: 1,
    });
    const thread = await call(stand, `/api/chat/threads/${id}`);
    const items = itemsFromMessages(thread.body.messages);
    expect(items[0]).toMatchObject({
      input: { kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' },
    });
    // the reply is filed under the thread it belongs to
    expect(
      (items[1] as { result: { thread_id: string } }).result.thread_id
    ).toBe(id);
  });

  it('extends the thread a message was sent into, and the next new message makes another', async () => {
    const stand = standIn('five');
    const same = stand.accept({
      answer: 'answer',
      body: {
        client_request_id: 'c-2',
        thread_id: 'th-fixture-0003',
        question: 'More?',
      },
    });
    expect(same).toBe('th-fixture-0003');
    const list = await call(stand, '/api/chat/threads');
    expect(list.body.threads[0]).toMatchObject({
      id: 'th-fixture-0003',
      message_count: 4,
      last_preview: 'More?',
    });
    const other = stand.accept({
      answer: 'answer',
      body: { client_request_id: 'c-3', question: 'Another?' },
    });
    expect(other).not.toBe(same);
    expect((await call(stand, '/api/chat/threads')).body.threads).toHaveLength(
      6
    );
  });

  it('files a refusal as a refusal, and an error as nothing', async () => {
    const stand = standIn('none');
    stand.accept({
      answer: 'refusal-out-of-scope',
      body: { client_request_id: 'c-4', question: 'Weather?' },
    });
    stand.accept({
      answer: 'error-persistence',
      body: { client_request_id: 'c-5', question: 'Anything?' },
    });
    const list = await call(stand, '/api/chat/threads');
    expect(list.body.threads).toHaveLength(1);
    const thread = await call(
      stand,
      `/api/chat/threads/${list.body.threads[0].id}`
    );
    expect(itemsFromMessages(thread.body.messages).map((i) => i.kind)).toEqual([
      'USER',
      'REFUSAL',
    ]);
  });

  it('gives the reply of a message stand-in the thread it was filed under', async () => {
    const stand = standIn('none');
    const fetcher = standInFetch({
      answer: () => 'report1-long',
      info: () => previewInfo('50', 'two'),
      language: () => 'en-US',
      t: (_k, fallback) => fallback ?? '',
      stepMs: 0,
      threadId: (body) => stand.accept({ answer: 'report1-long', body }),
    });
    const response = await fetcher('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        client_request_id: 'c-6',
        question: 'Direction?',
      }),
    });
    const lines = (await response.text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const result = lines.at(-1);
    expect(result.type).toBe('result');
    const list = await call(stand, '/api/chat/threads');
    expect(result.result.thread_id).toBe(list.body.threads[0].id);
    expect(result.result.thread_id).not.toBe(
      resultOf('report1-long').thread_id
    );
  });

  it('keeps the recorded thread when no workspace asks for another (/dev/chat is unchanged)', async () => {
    const fetcher = standInFetch({
      answer: () => 'report1-long',
      info: () => previewInfo('50', 'two'),
      language: () => 'en-US',
      t: (_k, fallback) => fallback ?? '',
      stepMs: 0,
    });
    const response = await fetcher('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        client_request_id: 'c-7',
        question: 'Direction?',
      }),
    });
    const last = (await response.text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
      .at(-1);
    expect(last.result.thread_id).toBe(resultOf('report1-long').thread_id);
    expect(RECORDED['report1-long']).toBeDefined();
  });
});

describe('the preview', () => {
  it('hands the real workspace the flags its controls say, and a stand-in for the chat', () => {
    renderPreview();
    expect(lastProps).toMatchObject({
      tier: 'PRO',
      replyEnabled: true,
      instantPromptsEnabled: true,
    });
    expect(typeof lastProps['chatFetchImpl']).toBe('function');
    expect(lastProps['onOpenUpgradeModal']).toBeUndefined();
  });

  it('turns the chat off, the instant prompts off, and Free on', async () => {
    renderPreview();
    await userEvent.click(screen.getByTestId('preview-reply'));
    expect(lastProps['replyEnabled']).toBe(false);
    await userEvent.click(screen.getByTestId('preview-instant'));
    expect(lastProps['instantPromptsEnabled']).toBe(false);
    await userEvent.click(screen.getByTestId('preview-tier-FREE'));
    expect(lastProps['tier']).toBe('FREE');
    expect(typeof lastProps['onOpenUpgradeModal']).toBe('function');
    expect(screen.getByTestId('upgrade-modal')).toHaveAttribute(
      'data-open',
      'false'
    );
    act(() => (lastProps['onOpenUpgradeModal'] as () => void)());
    expect(screen.getByTestId('upgrade-modal')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('its stand-in answers the state, the threads and a message, and files the message into the list', async () => {
    renderPreview();
    const fetcher = lastProps['chatFetchImpl'] as typeof fetch;
    const state = await (await fetcher('/api/chat/state')).json();
    expect(state.success).toBe(true);
    expect(state.models).toHaveLength(2);
    const before = await (await fetcher('/api/chat/threads?limit=30')).json();
    expect(before.threads).toHaveLength(5);
    const response = await fetcher('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        client_request_id: 'c-8',
        kind: 'INSTANT_M5_INSPECT',
      }),
    });
    expect(response.headers.get('content-type')).toContain('ndjson');
    await response.text();
    const after = await (await fetcher('/api/chat/threads?limit=30')).json();
    expect(after.threads).toHaveLength(6);
    expect(after.threads[0].id).toMatch(/^th-preview-/);
  });

  it('starts the workspace again when the tier, a flag or the list changes (a different server-side render)', async () => {
    renderPreview();
    const first = lastProps;
    await userEvent.click(screen.getByTestId('preview-reply'));
    expect(lastProps).not.toBe(first);
    await waitFor(() => expect(lastProps['replyEnabled']).toBe(false));
  });

  it('can be folded away, and says what it is', async () => {
    renderPreview();
    const controls = screen.getByTestId('preview-controls');
    expect(controls).toHaveTextContent('RECORDED answers');
    expect(controls).toHaveTextContent('Nothing is sent anywhere');
    await userEvent.click(
      screen.getByRole('button', { name: /Development preview/ })
    );
    expect(screen.queryByTestId('preview-tier-PRO')).toBeNull();
  });
});
