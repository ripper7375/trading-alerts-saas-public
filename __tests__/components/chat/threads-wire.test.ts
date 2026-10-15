/**
 * The browser's side of the threads routes (build step 7 part 9): what it asks, what it reads back
 * from the shapes the REAL routes answer, and how it turns a stored thread into the items Panel B draws.
 * Real wire code over an in-memory stand-in with the real routes' shapes (`helpers/threads-server.ts`).
 */

import {
  deleteThread,
  getThread,
  itemsFromMessages,
  listThreads,
  readThread,
  renameThread,
} from '@/components/chat/threads-wire';

import {
  fakeFetch,
  jsonResponse,
  refusalOf,
  resultOf,
} from './helpers/fake-fetch';
import {
  exchangeJson,
  threadJson,
  threadsServer,
  type ThreadsServer,
} from './helpers/threads-server';

function client(server: ThreadsServer) {
  return fakeFetch({ threads: (call) => server.handle(call) });
}

describe('readThread', () => {
  it('reads a row of the list as the panel keeps it', () => {
    expect(readThread(threadJson())).toEqual({
      id: 'th-1',
      title: 'XAUUSD · M15 · LONG · 18 SEP 20:55',
      titleSource: 'AUTO',
      lastBias: 'LONG',
      lastPreview: 'Gold is holding above the channel.',
      messageCount: 2,
      lastMessageAt: '2026-09-18T21:02:00.000Z',
      lastCycleSlot: '2026-09-18T20:55Z',
    });
  });

  it.each(['LONG', 'SHORT', 'NEUTRAL', 'STAND_ASIDE'] as const)(
    'keeps the bias %s',
    (bias) => {
      expect(readThread(threadJson({ last_bias: bias }))?.lastBias).toBe(bias);
    }
  );

  it('has no bias for a thread whose answers had none, or one it does not know', () => {
    expect(readThread(threadJson({ last_bias: null }))?.lastBias).toBeNull();
    expect(
      readThread({ ...threadJson(), last_bias: 'MAYBE' })?.lastBias
    ).toBeNull();
  });

  it("marks a trader's own title", () => {
    expect(readThread(threadJson({ title_source: 'USER' }))?.titleSource).toBe(
      'USER'
    );
  });

  it('leaves out a row it cannot draw, and does not guess the missing parts of one it can', () => {
    expect(readThread(null)).toBeNull();
    expect(readThread([])).toBeNull();
    expect(readThread({ ...threadJson(), id: '' })).toBeNull();
    expect(readThread({ ...threadJson(), title: 7 })).toBeNull();
    expect(readThread({ ...threadJson(), last_message_at: null })).toBeNull();
    const sparse = readThread({
      id: 'x',
      title: 'T',
      last_message_at: '2026-09-18T21:02:00.000Z',
    });
    expect(sparse).toMatchObject({
      lastBias: null,
      lastPreview: '',
      messageCount: 0,
      lastCycleSlot: null,
      titleSource: 'AUTO',
    });
  });
});

describe('listThreads', () => {
  it('asks for a page and reads the threads and the cursor', async () => {
    const server = threadsServer([
      threadJson({ id: 'a', last_message_at: '2026-09-18T21:03:00.000Z' }),
      threadJson({ id: 'b', last_message_at: '2026-09-18T21:02:00.000Z' }),
      threadJson({ id: 'c', last_message_at: '2026-09-18T21:01:00.000Z' }),
    ]);
    const f = client(server);
    const first = await listThreads(f.fetch, { limit: 2 });
    expect(first).toMatchObject({ ok: true, next: expect.any(String) });
    if (!first.ok) throw new Error('unreachable');
    expect(first.threads.map((t) => t.id)).toEqual(['a', 'b']);
    expect(f.calls[0]?.url).toBe('/api/chat/threads?limit=2');
    expect(f.calls[0]?.method).toBe('GET');

    const second = await listThreads(f.fetch, {
      limit: 2,
      after: first.next as string,
    });
    if (!second.ok) throw new Error('unreachable');
    expect(second.threads.map((t) => t.id)).toEqual(['c']);
    expect(second.next).toBeNull();
    expect(f.calls[1]?.url).toBe(
      `/api/chat/threads?limit=2&after=${encodeURIComponent(first.next as string)}`
    );
  });

  it('asks for the default page with no query at all', async () => {
    const f = client(threadsServer([threadJson()]));
    await listThreads(f.fetch);
    expect(f.calls[0]?.url).toBe('/api/chat/threads');
  });

  it('drops the rows it cannot draw and keeps the rest', async () => {
    const f = fakeFetch({
      threads: () =>
        jsonResponse({
          success: true,
          threads: [threadJson({ id: 'ok' }), { id: 5 }, null],
          next: null,
        }),
    });
    const out = await listThreads(f.fetch);
    expect(out.ok && out.threads.map((t) => t.id)).toEqual(['ok']);
  });

  it('says DISABLED when the route is not on (a 404 for everybody)', async () => {
    const server = threadsServer();
    server.disable();
    expect(await listThreads(client(server).fetch)).toEqual({
      ok: false,
      reason: 'DISABLED',
    });
  });

  it('says FAILED for any other status, or a body that is not a list', async () => {
    const server = threadsServer();
    server.failNext('GET', 503);
    expect(await listThreads(client(server).fetch)).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const odd = fakeFetch({
      threads: () => jsonResponse({ success: true, threads: 'no' }),
    });
    expect(await listThreads(odd.fetch)).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const text = fakeFetch({
      threads: () => new Response('<html>', { status: 200 }),
    });
    expect(await listThreads(text.fetch)).toEqual({
      ok: false,
      reason: 'FAILED',
    });
  });

  it('says NETWORK when the connection fails and ABORTED when it was stopped', async () => {
    const broken = (() => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await listThreads(broken)).toEqual({
      ok: false,
      reason: 'NETWORK',
    });
    const controller = new AbortController();
    const stopped = (async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }) as unknown as typeof fetch;
    expect(await listThreads(stopped, { signal: controller.signal })).toEqual({
      ok: false,
      reason: 'ABORTED',
    });
  });
});

describe('itemsFromMessages: a stored thread as the items Panel B draws', () => {
  const report = resultOf('report1-long');
  const answer = resultOf('answer');

  it("turns the trader's typed question and the stored reply into a bubble and a card", () => {
    const items = itemsFromMessages([
      ...exchangeJson(1, { text: 'Where is gold going?' }, report),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 'm1',
      kind: 'USER',
      input: { kind: 'TYPED', question: 'Where is gold going?' },
    });
    expect(items[1]).toMatchObject({
      id: 'm2',
      kind: 'RESULT',
      requestId: report.provenance.request_id,
    });
    expect((items[1] as { result: unknown }).result).toBe(report);
  });

  it('turns a Panel C press into the label of the button it was', () => {
    const items = itemsFromMessages(
      exchangeJson(1, { instant: 'INSTANT_M5_INSPECT' }, answer)
    );
    expect(items[0]).toMatchObject({
      kind: 'USER',
      input: { kind: 'INSTANT', intent: 'INSTANT_M5_INSPECT' },
    });
  });

  it('turns a stored refusal into a refusal card', () => {
    const refusal = refusalOf('refusal-out-of-scope');
    const items = itemsFromMessages(
      exchangeJson(1, { instant: 'INSTANT_M15_INSPECT' }, refusal)
    );
    expect(items[1]).toMatchObject({
      kind: 'REFUSAL',
      requestId: null,
      quota: null,
    });
    expect((items[1] as { refusal: { code: string } }).refusal.code).toBe(
      refusal.code
    );
  });

  it('keeps the order of several exchanges and numbers the items from 1', () => {
    const items = itemsFromMessages([
      ...exchangeJson(1, { text: 'First' }, report),
      ...exchangeJson(3, { text: 'Second' }, answer),
    ]);
    expect(items.map((i) => i.kind)).toEqual([
      'USER',
      'RESULT',
      'USER',
      'RESULT',
    ]);
    expect(items.map((i) => i.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('leaves out what it cannot draw instead of guessing', () => {
    const items = itemsFromMessages([
      null,
      'text',
      { role: 'USER', kind: 'TYPED', text: '' },
      { role: 'USER', kind: 'INSTANT', intent: 'INSTANT_M99_INSPECT' },
      { role: 'USER', kind: 'WEIRD', text: 'x' },
      { role: 'ASSISTANT', reply: { kind: 'REPORT1' } },
      { role: 'ASSISTANT', reply: null },
      { role: 'SYSTEM' },
      ...exchangeJson(9, { text: 'Kept' }, answer),
    ]);
    expect(items.map((i) => i.kind)).toEqual(['USER', 'RESULT']);
  });
});

describe('getThread', () => {
  it('reads the thread and its messages as items', async () => {
    const server = threadsServer([threadJson({ id: 'th-9' })], {
      'th-9': exchangeJson(1, { text: 'Hi' }, resultOf('answer')),
    });
    const f = client(server);
    const out = await getThread(f.fetch, 'th-9');
    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('unreachable');
    expect(out.thread.id).toBe('th-9');
    expect(out.items.map((i) => i.kind)).toEqual(['USER', 'RESULT']);
    expect(f.calls[0]).toMatchObject({
      url: '/api/chat/threads/th-9',
      method: 'GET',
    });
  });

  it('puts an id into the path as text, never as a path', async () => {
    const f = client(threadsServer());
    await getThread(f.fetch, '../other thread');
    expect(f.calls[0]?.url).toBe('/api/chat/threads/..%2Fother%20thread');
  });

  it('says NOT_FOUND for a thread that is not there or not the trader’s (one answer)', async () => {
    expect(await getThread(client(threadsServer()).fetch, 'nope')).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });

  it('says DISABLED, FAILED, NETWORK and ABORTED as they happen', async () => {
    const off = threadsServer([threadJson()]);
    off.disable();
    expect(await getThread(client(off).fetch, 'th-1')).toEqual({
      ok: false,
      reason: 'DISABLED',
    });
    const bad = threadsServer([threadJson()]);
    bad.failNext('GET', 500);
    expect(await getThread(client(bad).fetch, 'th-1')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const notAThread = fakeFetch({
      threads: () => jsonResponse({ success: true, thread: 1, messages: [] }),
    });
    expect(await getThread(notAThread.fetch, 'th-1')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const gone = (() => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await getThread(gone, 'th-1')).toEqual({
      ok: false,
      reason: 'NETWORK',
    });
    const controller = new AbortController();
    controller.abort();
    const stopped = (async () => {
      throw new DOMException('Aborted', 'AbortError');
    }) as unknown as typeof fetch;
    expect(await getThread(stopped, 'th-1', controller.signal)).toEqual({
      ok: false,
      reason: 'ABORTED',
    });
  });
});

describe('renameThread', () => {
  it('sends the title as typed and reads the one the server kept', async () => {
    const server = threadsServer([threadJson()]);
    const f = client(server);
    const out = await renameThread(f.fetch, 'th-1', '  My gold plan  ');
    expect(out).toEqual({ ok: true, title: 'My gold plan' });
    expect(f.calls[0]).toMatchObject({
      url: '/api/chat/threads/th-1',
      method: 'PATCH',
      body: { title: '  My gold plan  ' },
    });
  });

  it('says INVALID when the server will not take the title (a 400)', async () => {
    const f = client(threadsServer([threadJson()]));
    expect(await renameThread(f.fetch, 'th-1', '   ')).toEqual({
      ok: false,
      reason: 'INVALID',
    });
  });

  it('says NOT_FOUND, DISABLED, FAILED and NETWORK', async () => {
    expect(
      await renameThread(client(threadsServer()).fetch, 'nope', 'T')
    ).toEqual({ ok: false, reason: 'NOT_FOUND' });
    const off = threadsServer([threadJson()]);
    off.disable();
    expect(await renameThread(client(off).fetch, 'th-1', 'T')).toEqual({
      ok: false,
      reason: 'DISABLED',
    });
    const bad = threadsServer([threadJson()]);
    bad.failNext('PATCH', 502);
    expect(await renameThread(client(bad).fetch, 'th-1', 'T')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const noTitle = fakeFetch({
      threads: () => jsonResponse({ success: true }),
    });
    expect(await renameThread(noTitle.fetch, 'th-1', 'T')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const gone = (() => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await renameThread(gone, 'th-1', 'T')).toEqual({
      ok: false,
      reason: 'NETWORK',
    });
  });
});

describe('deleteThread', () => {
  it('deletes once and the thread is gone from the store', async () => {
    const server = threadsServer([threadJson(), threadJson({ id: 'th-2' })]);
    const f = client(server);
    expect(await deleteThread(f.fetch, 'th-1')).toEqual({ ok: true });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({
      url: '/api/chat/threads/th-1',
      method: 'DELETE',
    });
    expect(server.threads.map((t) => t.id)).toEqual(['th-2']);
  });

  it('says NOT_FOUND, DISABLED, FAILED and NETWORK', async () => {
    expect(await deleteThread(client(threadsServer()).fetch, 'nope')).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
    const off = threadsServer([threadJson()]);
    off.disable();
    expect(await deleteThread(client(off).fetch, 'th-1')).toEqual({
      ok: false,
      reason: 'DISABLED',
    });
    const bad = threadsServer([threadJson()]);
    bad.failNext('DELETE', 500);
    expect(await deleteThread(client(bad).fetch, 'th-1')).toEqual({
      ok: false,
      reason: 'FAILED',
    });
    const gone = (() => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await deleteThread(gone, 'th-1')).toEqual({
      ok: false,
      reason: 'NETWORK',
    });
  });
});
