/**
 * @jest-environment node
 */

/**
 * The threads API and the state route (build step 7 part 7b; plan part 7 (6); decisions D15, D16,
 * D18): who may ask, what a trader sees, and above all that a thread of another trader is not there.
 * The stores are the real ones over in-memory clients, so the ownership in every `where` is what is
 * under test, not a mock's say-so.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/intake/server/access', () => ({
  sessionPort: jest.fn(),
  profilePort: { read: jest.fn() },
}));
jest.mock('@/lib/intake/read/snapshot', () => ({ readSnapshot: jest.fn() }));

import type { AiModel } from '@/config/ai-models';
import { canUseAiChat } from '@/lib/platform/entitlements';
import type { Balance, LedgerPort } from '@/lib/reply/meter/quota-port';
import {
  authorize,
  decodeCursor,
  encodeCursor,
  handleThreadDelete,
  handleThreadGet,
  handleThreadRename,
  handleThreadsList,
  messageView,
  threadView,
} from '@/lib/reply/server/threads-api';
import type { ChatAuth, ThreadsApiDeps } from '@/lib/reply/server/threads-api';
import {
  AI_MODEL_REGISTRY,
  pickerModels,
  planLaunch,
} from '@/lib/reply/gateway/registry';
import { createStateApiDeps, handleState } from '@/lib/reply/server/state-api';
import type { StateApiDeps } from '@/lib/reply/server/state-api';

import { FakeChatClient } from '../../lib/platform/helpers/fakes';
import type { GateSession } from '@/lib/reply/contracts/intake';

const ME = 'user-pro-1';
const OTHER = 'user-pro-2';

function authFor(
  session: GateSession | null | 'THROWS' = { userId: ME, tier: 'PRO' },
  over: Partial<ChatAuth> = {}
): ChatAuth {
  return {
    enabled: () => true,
    session: {
      current: async () => {
        if (session === 'THROWS') throw new Error('session store down');
        return session;
      },
    },
    allows: (tier) => canUseAiChat(tier),
    ...over,
  };
}

function world(session?: GateSession | null | 'THROWS') {
  const chat = new FakeChatClient();
  const deps: ThreadsApiDeps = { auth: authFor(session), chat: chat.client() };
  return { chat, deps };
}

const get = (path = '/api/chat/threads') =>
  new Request(`http://localhost${path}`);
const withBody = (method: string, body: unknown, type = 'application/json') =>
  new Request('http://localhost/api/chat/threads/x', {
    method,
    headers: { 'content-type': type },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
// a response body is read by name in these tests; the shapes are asserted, not typed
const json = async (response: Response): Promise<any> => response.json();

const SLOT = Date.UTC(2026, 8, 18, 20, 55) / 1000;

function message(
  chat: FakeChatClient,
  threadId: string,
  seq: number,
  over: Record<string, unknown> = {}
) {
  chat.messages.push({
    id: `m-${threadId}-${seq}`,
    thread_id: threadId,
    seq,
    request_id: `r-${threadId}-${Math.ceil(seq / 2)}`,
    role: seq % 2 === 1 ? 'USER' : 'ASSISTANT',
    kind: seq % 2 === 1 ? 'TYPED' : 'REPORT1',
    intent: 'DIRECTION',
    body_text: seq % 2 === 1 ? 'direction?' : null,
    body_json: seq % 2 === 1 ? null : { kind: 'REPORT1', n: seq },
    cycle_slot: SLOT,
    created_at: chat.now,
    expires_at: chat.now,
    ...over,
  } as never);
}

describe('who may ask', () => {
  const ASKS: [string, (deps: ThreadsApiDeps) => Promise<Response>][] = [
    ['list', (deps) => handleThreadsList(get(), deps)],
    ['get', (deps) => handleThreadGet(get(), 'th-1', deps)],
    [
      'rename',
      (deps) =>
        handleThreadRename(withBody('PATCH', { title: 'x' }), 'th-1', deps),
    ],
    ['delete', (deps) => handleThreadDelete(get(), 'th-1', deps)],
  ];

  describe.each(ASKS)('%s', (_name, ask) => {
    it('is 404 to everybody when the route is off, and asks nobody who they are', async () => {
      const { chat } = world();
      const session = jest.fn();
      const response = await ask({
        auth: authFor(undefined, {
          enabled: () => false,
          session: { current: session },
        }),
        chat: chat.client(),
      });
      expect(response.status).toBe(404);
      expect((await json(response)).error.code).toBe('FEATURE_DISABLED');
      expect(session).not.toHaveBeenCalled();
      expect(chat.log).toEqual([]);
    });

    it('is 401 for a caller who is not signed in, whether the session is empty or breaks', async () => {
      for (const session of [
        null,
        'THROWS' as const,
        { userId: '', tier: 'PRO' },
      ]) {
        const { chat, deps } = world(session);
        const response = await ask(deps);
        expect(response.status).toBe(401);
        expect((await json(response)).error.code).toBe('NOT_SIGNED_IN');
        expect(chat.log).toEqual([]);
      }
    });

    it('is 403 for a tier that has no analyst, and for a tier nobody knows', async () => {
      for (const tier of ['FREE', 'ENTERPRISE', '']) {
        const { chat, deps } = world({ userId: ME, tier });
        const response = await ask(deps);
        expect(response.status).toBe(403);
        expect((await json(response)).error.code).toBe('TIER_REQUIRED');
        expect(chat.log).toEqual([]);
      }
    });

    it('is 503 when the entitlement cannot be read, and not a pass', async () => {
      const { chat } = world();
      const response = await ask({
        auth: authFor(undefined, {
          allows: () => {
            throw new Error('table down');
          },
        }),
        chat: chat.client(),
      });
      expect(response.status).toBe(503);
      expect((await json(response)).error.code).toBe('FEATURE_UNAVAILABLE');
    });
  });
});

describe('the list', () => {
  it('shows the trader’s own threads, newest message first, in the shape the panel needs', async () => {
    const { chat, deps } = world();
    const older = chat.seedThread({
      id: 'th-old',
      user_id: ME,
      title: 'XAUUSD · SHORT · 17 SEP 10:00',
      last_bias: 'SHORT',
      last_cycle_slot: SLOT - 86_400,
      last_message_at: new Date(Date.UTC(2026, 8, 17, 10, 0, 0)),
    });
    const newer = chat.seedThread({
      id: 'th-new',
      user_id: ME,
      last_bias: 'LONG',
      last_cycle_slot: SLOT,
      last_preview: 'Price near 4,378',
      message_count: 4,
      report_count: 2,
      last_message_at: new Date(Date.UTC(2026, 8, 18, 21, 0, 0)),
    });
    chat.seedThread({ id: 'th-theirs', user_id: OTHER });
    const response = await handleThreadsList(get(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await json(response);
    expect(body.success).toBe(true);
    expect(body.threads.map((t: { id: string }) => t.id)).toEqual([
      'th-new',
      'th-old',
    ]);
    expect(body.next).toBeNull();
    expect(body.threads[0]).toEqual({
      id: 'th-new',
      symbol: 'XAUUSD',
      title: newer.title,
      title_source: 'AUTO',
      trader_type: 'DAY_TRADER',
      last_bias: 'LONG',
      last_cycle_slot: '2026-09-18T20:55Z',
      last_preview: 'Price near 4,378',
      message_count: 4,
      report_count: 2,
      last_message_at: '2026-09-18T21:00:00.000Z',
      created_at: newer.created_at.toISOString(),
    });
    expect(threadView(older).last_cycle_slot).toBe('2026-09-17T20:55Z');
    expect(JSON.stringify(body)).not.toContain(ME);
    expect(JSON.stringify(body)).not.toContain('th-theirs');
  });

  it('a thread with no cycle yet has a null slot, and one with a slot that is not a slot too', async () => {
    const { chat } = world();
    const none = chat.seedThread({ user_id: ME, last_cycle_slot: null });
    const odd = chat.seedThread({ user_id: ME, last_cycle_slot: 7 });
    expect(threadView(none).last_cycle_slot).toBeNull();
    expect(threadView(odd).last_cycle_slot).toBeNull();
  });

  it('pages: a page of the size asked for, and the opaque cursor of the next', async () => {
    const { chat, deps } = world();
    for (let i = 0; i < 5; i += 1) {
      chat.seedThread({
        id: `th-${i}`,
        user_id: ME,
        last_message_at: new Date(Date.UTC(2026, 8, 18, 10 + i, 0, 0)),
      });
    }
    const first = await json(
      await handleThreadsList(get('/api/chat/threads?limit=2'), deps)
    );
    expect(first.threads.map((t: { id: string }) => t.id)).toEqual([
      'th-4',
      'th-3',
    ]);
    expect(typeof first.next).toBe('string');
    const second = await json(
      await handleThreadsList(
        get(`/api/chat/threads?limit=2&after=${first.next}`),
        deps
      )
    );
    expect(second.threads.map((t: { id: string }) => t.id)).toEqual([
      'th-2',
      'th-1',
    ]);
    const third = await json(
      await handleThreadsList(
        get(`/api/chat/threads?limit=2&after=${second.next}`),
        deps
      )
    );
    expect(third.threads.map((t: { id: string }) => t.id)).toEqual(['th-0']);
    expect(third.next).toBeNull();
  });

  it('50 by default, and 1 to 100 as asked', async () => {
    const { chat, deps } = world();
    for (let i = 0; i < 60; i += 1) chat.seedThread({ user_id: ME });
    const dflt = await json(await handleThreadsList(get(), deps));
    expect(dflt.threads).toHaveLength(50);
    expect(dflt.next).not.toBeNull();
    const all = await json(
      await handleThreadsList(get('/api/chat/threads?limit=100'), deps)
    );
    expect(all.threads).toHaveLength(60);
    const one = await json(
      await handleThreadsList(get('/api/chat/threads?limit=1'), deps)
    );
    expect(one.threads).toHaveLength(1);
  });

  it.each([
    'limit=0',
    'limit=101',
    'limit=-1',
    'limit=abc',
    'limit=1.5',
    'limit=1000',
    'limit=',
    'after=not a cursor',
    'after=',
    'after=' + 'a'.repeat(201),
    'after=' + Buffer.from('{"t":"x","id":"y"}').toString('base64url'),
    'after=' + Buffer.from('[1]').toString('base64url'),
    'after=' + Buffer.from('null').toString('base64url'),
    'after=' + Buffer.from('{"t":1e30,"id":"y"}').toString('base64url'),
    'after=' + Buffer.from('{"t":1,"id":""}').toString('base64url'),
    'after=' +
      Buffer.from(`{"t":1,"id":"${'x'.repeat(65)}"}`).toString('base64url'),
    'after=' + Buffer.from('{"t":9e15,"id":"y"}').toString('base64url'),
  ])('refuses ?%s with a 400', async (query) => {
    const { chat, deps } = world();
    const response = await handleThreadsList(
      get(`/api/chat/threads?${query}`),
      deps
    );
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe('BAD_REQUEST');
    expect(chat.log).toEqual([]);
  });

  it('a cursor survives the round trip', () => {
    const cursor = {
      lastMessageAt: new Date(Date.UTC(2026, 8, 18, 21, 0, 0)),
      id: 'th-1',
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor('')).toBeNull();
  });

  it('is 503 when the store cannot be read', async () => {
    const { chat, deps } = world();
    chat.chatThread.findMany = async () => {
      throw new Error('down');
    };
    expect((await handleThreadsList(get(), deps)).status).toBe(503);
  });
});

describe('one thread', () => {
  it('shows a thread and its messages in order, the trader’s words and the replies as delivered', async () => {
    const { chat, deps } = world();
    const thread = chat.seedThread({
      id: 'th-1',
      user_id: ME,
      message_count: 2,
    });
    message(chat, 'th-1', 2);
    message(chat, 'th-1', 1);
    const response = await handleThreadGet(get(), thread.id, deps);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.thread.id).toBe('th-1');
    expect(body.messages).toEqual([
      {
        seq: 1,
        role: 'USER',
        kind: 'TYPED',
        intent: 'DIRECTION',
        text: 'direction?',
        reply: null,
        cycle_slot: '2026-09-18T20:55Z',
        created_at: chat.now.toISOString(),
      },
      {
        seq: 2,
        role: 'ASSISTANT',
        kind: 'REPORT1',
        intent: 'DIRECTION',
        text: null,
        reply: { kind: 'REPORT1', n: 2 },
        cycle_slot: '2026-09-18T20:55Z',
        created_at: chat.now.toISOString(),
      },
    ]);
  });

  it('a message with no cycle has a null slot', () => {
    const row = {
      seq: 1,
      role: 'USER',
      kind: 'INSTANT',
      intent: 'INSTANT_M5_INSPECT',
      body_text: null,
      body_json: null,
      cycle_slot: null,
      created_at: new Date(0),
    } as never;
    expect(messageView(row).cycle_slot).toBeNull();
  });

  it('a thread of another trader is not there: the same 404, the same body, as one that never was', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-theirs', user_id: OTHER });
    message(chat, 'th-theirs', 1);
    const theirs = await handleThreadGet(get(), 'th-theirs', deps);
    const nothing = await handleThreadGet(get(), 'th-none', deps);
    expect(theirs.status).toBe(404);
    expect(nothing.status).toBe(404);
    const a = await json(theirs);
    expect(a).toEqual(await json(nothing));
    expect(a.error.code).toBe('THREAD_INVALID');
    expect(JSON.stringify(a)).not.toContain('direction?');
    // their messages were never read
    expect(chat.log).toEqual(['chatThread.findFirst', 'chatThread.findFirst']);
  });

  it('is 503 when the store cannot be read, and 404 if the thread vanished between the two reads', async () => {
    const down = world();
    down.chat.seedThread({ id: 'th-1', user_id: ME });
    down.chat.chatMessage.findMany = async () => {
      throw new Error('down');
    };
    expect((await handleThreadGet(get(), 'th-1', down.deps)).status).toBe(503);

    const gone = world();
    gone.chat.seedThread({ id: 'th-1', user_id: ME });
    let calls = 0;
    const find = gone.chat.chatThread.findFirst;
    gone.chat.chatThread.findFirst = (async (args: never) => {
      calls += 1;
      return calls === 1 ? find(args) : null;
    }) as never;
    expect((await handleThreadGet(get(), 'th-1', gone.deps)).status).toBe(404);
  });
});

describe('renaming', () => {
  it('sets the trader’s own title, which no derived one replaces', async () => {
    const { chat, deps } = world();
    chat.seedThread({
      id: 'th-1',
      user_id: ME,
      title: 'XAUUSD · LONG · 18 SEP 20:55',
    });
    const response = await handleThreadRename(
      withBody('PATCH', { title: '  My gold plan  ' }),
      'th-1',
      deps
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      success: true,
      title: 'My gold plan',
    });
    expect(chat.threads.get('th-1')).toMatchObject({
      title: 'My gold plan',
      title_source: 'USER',
    });
  });

  it('is 404 for a thread that is not the trader’s, and leaves it alone', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-theirs', user_id: OTHER, title: 'theirs' });
    const response = await handleThreadRename(
      withBody('PATCH', { title: 'mine now' }),
      'th-theirs',
      deps
    );
    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe('THREAD_INVALID');
    expect(chat.threads.get('th-theirs')!.title).toBe('theirs');
  });

  it.each([
    ['an empty title', { title: '   ' }, 'The title is empty.'],
    [
      'a title over 80 characters',
      { title: 'x'.repeat(81) },
      'The title is too long (80 characters at most).',
    ],
    ['a title that is not text', { title: 5 }, 'title must be text.'],
    ['no title', {}, 'title must be text.'],
  ])('%s is a 400', async (_name, body, message) => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-1', user_id: ME, title: 'keep' });
    const response = await handleThreadRename(
      withBody('PATCH', body),
      'th-1',
      deps
    );
    expect(response.status).toBe(400);
    const parsed = await json(response);
    expect(parsed.error.code).toBe('BAD_REQUEST');
    expect(parsed.error.message).toBe(message);
    expect(chat.threads.get('th-1')!.title).toBe('keep');
  });

  it('reads a body the way the other routes do: JSON, an object, small', async () => {
    const { deps } = world();
    expect(
      (await handleThreadRename(withBody('PATCH', 'not json'), 'th-1', deps))
        .status
    ).toBe(400);
    expect(
      (
        await handleThreadRename(
          withBody('PATCH', '{}', 'text/plain'),
          'th-1',
          deps
        )
      ).status
    ).toBe(415);
    expect(
      (
        await handleThreadRename(
          withBody('PATCH', { title: 'x'.repeat(9_000) }),
          'th-1',
          deps
        )
      ).status
    ).toBe(413);
  });

  it('a body is not read for a caller who may not ask', async () => {
    const { deps } = world({ userId: ME, tier: 'FREE' });
    const request = withBody('PATCH', { title: 'x' });
    const text = jest.spyOn(request, 'text');
    expect((await handleThreadRename(request, 'th-1', deps)).status).toBe(403);
    expect(text).not.toHaveBeenCalled();
  });

  it('is 503 when the store cannot be written', async () => {
    const { chat, deps } = world();
    chat.chatThread.updateMany = async () => {
      throw new Error('down');
    };
    expect(
      (
        await handleThreadRename(
          withBody('PATCH', { title: 'x' }),
          'th-1',
          deps
        )
      ).status
    ).toBe(503);
  });
});

describe('deleting', () => {
  it('removes the thread and its messages, and nothing else', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-1', user_id: ME });
    chat.seedThread({ id: 'th-2', user_id: ME });
    message(chat, 'th-1', 1);
    message(chat, 'th-1', 2);
    message(chat, 'th-2', 1);
    const response = await handleThreadDelete(get(), 'th-1', deps);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true });
    expect([...chat.threads.keys()]).toEqual(['th-2']);
    expect(chat.messages.map((m) => m.thread_id)).toEqual(['th-2']);
    // the audit rows are in another table and this API has no way to reach them
    expect(chat.log).toEqual(['chatThread.deleteMany']);
  });

  it('is 404 for a thread that is not the trader’s, and leaves it standing with its messages', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-theirs', user_id: OTHER });
    message(chat, 'th-theirs', 1);
    const response = await handleThreadDelete(get(), 'th-theirs', deps);
    expect(response.status).toBe(404);
    expect((await json(response)).error.code).toBe('THREAD_INVALID');
    expect(chat.threads.has('th-theirs')).toBe(true);
    expect(chat.messages).toHaveLength(1);
    // and a second delete of the trader’s own is 404 too: it is gone
    chat.seedThread({ id: 'th-mine', user_id: ME });
    expect((await handleThreadDelete(get(), 'th-mine', deps)).status).toBe(200);
    expect((await handleThreadDelete(get(), 'th-mine', deps)).status).toBe(404);
  });

  it('is 503 when the store cannot be written', async () => {
    const { chat, deps } = world();
    chat.chatThread.deleteMany = async () => {
      throw new Error('down');
    };
    expect((await handleThreadDelete(get(), 'th-1', deps)).status).toBe(503);
  });
});

describe('authorize', () => {
  it('lets a signed-in trader with the analyst through, as the session says they are', async () => {
    await expect(
      authorize(authFor({ userId: ME, tier: 'PRO' }))
    ).resolves.toEqual({
      ok: true,
      caller: { userId: ME, tier: 'PRO' },
    });
  });
});

// ---------------------------------------------------------------------------
// The state route
// ---------------------------------------------------------------------------

describe('the state of the chat panel', () => {
  const model = (slug: string, units: number | null): AiModel =>
    ({
      slug,
      name: `Model ${slug}`,
      multiplier: 1.5,
      vision: true,
      units_per_msg: units,
    }) as AiModel;
  const balance = (over: Partial<Balance> = {}): Balance => ({
    limit: 5_000_000,
    used: 1_000_000,
    reserved: 200_000,
    available: 3_800_000,
    ...over,
  });
  const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

  function deps(
    over: Partial<StateApiDeps> = {},
    session?: GateSession | null
  ) {
    const ledger: LedgerPort = {
      balance: jest.fn(async () => balance()),
      reserve: jest.fn(),
      settle: jest.fn(),
      release: jest.fn(),
    };
    const built: StateApiDeps = {
      auth: authFor(session),
      models: () => [model('vendor-a/one', 4_200), model('vendor-b/two', null)],
      defaultSlug: () => 'vendor-a/one',
      allowanceOf: (tier) => (tier === 'PRO' ? 5_000_000 : 0),
      ledger,
      now: () => NOW,
      profile: async () => ({
        ok: true,
        profile: {
          trader_type: 'SCALPER',
          style: 'BOTH',
          max_risk_pct: '1.5',
          max_leverage: '5',
          target_rrr: '1.75',
          min_sld: '13',
        },
      }),
      cycle: async () => ({ slot: '2026-09-18T20:55Z', data_status: 'FRESH' }),
      ...over,
    };
    return { built, ledger };
  }

  it('is the models, the balance, the type and the cycle, in one call', async () => {
    const { built, ledger } = deps();
    const response = await handleState(get('/api/chat/state'), built);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await json(response)).toEqual({
      success: true,
      models: [
        {
          slug: 'vendor-a/one',
          name: 'Model vendor-a/one',
          multiplier: 1.5,
          vision: true,
          units_per_msg: 4_200,
          default: true,
        },
        {
          slug: 'vendor-b/two',
          name: 'Model vendor-b/two',
          multiplier: 1.5,
          vision: true,
          units_per_msg: null,
          default: false,
        },
      ],
      quota: {
        configured: true,
        month: '2026-10',
        limit_units: 5_000_000,
        used_units: 1_000_000,
        reserved_units: 200_000,
        available_units: 3_800_000,
      },
      profile: { trader_type: 'SCALPER' },
      cycle: { slot: '2026-09-18T20:55Z', data_status: 'FRESH' },
    });
    expect(ledger.balance).toHaveBeenCalledWith({
      userId: ME,
      nowMs: NOW,
      allowanceUnits: 5_000_000,
    });
  });

  it('no model has passed yet: an empty list, and no default', async () => {
    const { built } = deps({ models: () => [], defaultSlug: () => null });
    const body = await json(await handleState(get(), built));
    expect(body.models).toEqual([]);
  });

  it('an allowance that is not set says so, and asks the ledger nothing', async () => {
    const { built, ledger } = deps({ allowanceOf: () => null });
    const body = await json(await handleState(get(), built));
    expect(body.quota).toEqual({
      configured: false,
      month: '2026-10',
      limit_units: null,
      used_units: null,
      reserved_units: null,
      available_units: null,
    });
    expect(ledger.balance).not.toHaveBeenCalled();
    const zero = deps({ allowanceOf: () => 0 });
    expect(
      (await json(await handleState(get(), zero.built))).quota.configured
    ).toBe(false);
  });

  it('a part that cannot be read is null and the rest is still answered', async () => {
    const { built } = deps({
      ledger: {
        balance: async () => {
          throw new Error('ledger down');
        },
        reserve: jest.fn(),
        settle: jest.fn(),
        release: jest.fn(),
      },
      profile: async () => {
        throw new Error('profiles down');
      },
    });
    const body = await json(await handleState(get(), built));
    expect(body.success).toBe(true);
    expect(body.quota).toMatchObject({
      configured: true,
      limit_units: null,
      available_units: null,
    });
    expect(body.profile).toBeNull();
    expect(body.cycle).toBeNull();
    expect(body.models).toHaveLength(2);
  });

  it('no confirmed profile: no badge and no cycle', async () => {
    const { built } = deps({
      profile: async () => ({
        ok: false,
        code: 'PROFILE_NOT_SET',
        detail: 'none',
      }),
      cycle: jest.fn(),
    });
    const body = await json(await handleState(get(), built));
    expect(body.profile).toBeNull();
    expect(body.cycle).toBeNull();
    expect(built.cycle).not.toHaveBeenCalled();
  });

  it('a cycle that cannot be read is null', async () => {
    const { built } = deps({
      cycle: async () => {
        throw new Error('gateway down');
      },
    });
    const body = await json(await handleState(get(), built));
    expect(body.profile).toEqual({ trader_type: 'SCALPER' });
    expect(body.cycle).toBeNull();
  });

  it('asks for the same things the other routes do: off is 404, anonymous 401, Free 403, and nothing is read', async () => {
    const off = deps({}, undefined);
    off.built.auth = authFor(undefined, { enabled: () => false });
    expect((await handleState(get(), off.built)).status).toBe(404);
    const anonymous = deps({}, null);
    expect((await handleState(get(), anonymous.built)).status).toBe(401);
    const free = deps({}, { userId: ME, tier: 'FREE' });
    expect((await handleState(get(), free.built)).status).toBe(403);
    for (const d of [off, anonymous, free]) {
      expect(d.ledger.balance).not.toHaveBeenCalled();
    }
  });
});

// ---------------------------------------------------------------------------
// The edges the first tests leave open
// ---------------------------------------------------------------------------

describe('the cursor, at its edges', () => {
  const make = (value: unknown): string =>
    Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

  it('is refused when it is longer than a cursor ever is, or has a character one never has', () => {
    expect(decodeCursor(make({ t: 1, id: 'a' }))).not.toBeNull();
    const long = make({ t: 1, id: 'a', pad: 'x'.repeat(200) });
    expect(long.length).toBeGreaterThan(200);
    expect(decodeCursor(long)).toBeNull();
    const exactly = make({ t: 1, id: 'a', pad: 'x'.repeat(100) });
    expect(exactly.length).toBeLessThanOrEqual(200);
    expect(decodeCursor(exactly)).not.toBeNull();
    expect(decodeCursor(make({ t: 1, id: 'a' }) + '=')).toBeNull();
    expect(decodeCursor(make({ t: 1, id: 'a' }) + '+')).toBeNull();
  });

  it('is refused when it is not a time and an id', () => {
    expect(decodeCursor(make({ t: 1, id: 'x'.repeat(64) }))).toEqual({
      lastMessageAt: new Date(1),
      id: 'x'.repeat(64),
    });
    for (const bad of [
      { t: 1, id: 'x'.repeat(65) },
      { t: 1, id: '' },
      { t: 1, id: 5 },
      { t: 1 },
      { t: '1', id: 'a' },
      { t: 1.5, id: 'a' },
      { t: 2 ** 53, id: 'a' },
      { t: 9e15, id: 'a' },
      { id: 'a' },
      null,
      5,
      'text',
      [],
    ]) {
      expect(decodeCursor(make(bad))).toBeNull();
    }
    expect(decodeCursor('bm90IGpzb24')).toBeNull();
  });
});

describe('one thread, said once more', () => {
  it('says it worked', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-1', user_id: ME, message_count: 0 });
    const body = await json(await handleThreadGet(get(), 'th-1', deps));
    expect(body.success).toBe(true);
  });
});

describe('renaming, said once more', () => {
  it('reads the title only from the body itself, never from what an object inherits', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-1', user_id: ME });
    const response = await handleThreadRename(
      withBody('PATCH', JSON.parse('{"__proto__":{"title":"smuggled"}}')),
      'th-1',
      deps
    );
    expect(response.status).toBe(400);
    expect((await json(response)).error.message).toBe('title must be text.');
  });

  it('a thread that is not there is the one 404, and a title that cannot be kept is a 400 with its own words', async () => {
    const { chat, deps } = world();
    chat.seedThread({ id: 'th-1', user_id: ME });
    const missing = await handleThreadRename(
      withBody('PATCH', { title: 'ok' }),
      'th-nobody',
      deps
    );
    expect(missing.status).toBe(404);
    expect((await json(missing)).error.code).toBe('THREAD_INVALID');
    const empty = await handleThreadRename(
      withBody('PATCH', { title: '   ' }),
      'th-1',
      deps
    );
    expect(empty.status).toBe(400);
    expect((await json(empty)).error.message).toBe('The title is empty.');
    const long = await handleThreadRename(
      withBody('PATCH', { title: 'x'.repeat(81) }),
      'th-1',
      deps
    );
    expect(long.status).toBe(400);
    expect((await json(long)).error.message).toBe(
      'The title is too long (80 characters at most).'
    );
  });
});

describe('the production dependencies of the state route', () => {
  const answerer = (over: Record<string, unknown>): AiModel =>
    ({
      ...AI_MODEL_REGISTRY[0],
      status: 'passed',
      roles: ['answer'],
      launch_role: null,
      tier_access: ['PRO'],
      ...over,
    }) as unknown as AiModel;
  const registry = [
    answerer({ slug: 't/default', launch_role: 'default' }),
    answerer({ slug: 't/free-only', tier_access: ['FREE'] }),
    answerer({ slug: 't/other' }),
    answerer({ slug: 't/unpassed', status: 'candidate' }),
  ];

  it('give a Pro trader the monthly allowance, a Free trader none, and nobody an allowance that is not set', () => {
    const deps = createStateApiDeps({ PRO_MONTHLY_UNITS: '7777' }, registry);
    expect(deps.allowanceOf('PRO')).toBe(7_777);
    expect(deps.allowanceOf('FREE')).toBe(0);
    expect(deps.allowanceOf('')).toBe(0);
    expect(createStateApiDeps({}, registry).allowanceOf('PRO')).toBeNull();
  });

  it('list the models a Pro trader may choose, and the default of the launch pair', () => {
    const deps = createStateApiDeps({}, registry);
    expect(deps.models().map((m) => m.slug)).toEqual(['t/default', 't/other']);
    expect(deps.defaultSlug()).toBe('t/default');
    const off = createStateApiDeps(
      { REPLY_DISABLED_MODELS: 't/default' },
      registry
    );
    expect(off.models().map((m) => m.slug)).toEqual(['t/other']);
    expect(off.defaultSlug()).toBeNull();
  });

  it('read the real registry when they are given none', () => {
    const deps = createStateApiDeps({});
    expect(deps.models()).toEqual(pickerModels('PRO'));
    expect(deps.defaultSlug()).toBe(planLaunch().primary?.slug ?? null);
  });
});

describe('the state of the chat panel, at the edge of the allowance', () => {
  it('one unit of allowance is a configured allowance, none is not', async () => {
    const mk = (allowance: number) => {
      const ledger: LedgerPort = {
        balance: jest.fn(async () => ({
          limit: allowance,
          used: 0,
          reserved: 0,
          available: allowance,
        })),
        reserve: jest.fn(),
        settle: jest.fn(),
        release: jest.fn(),
      };
      const built: StateApiDeps = {
        auth: authFor(),
        models: () => [],
        defaultSlug: () => null,
        allowanceOf: () => allowance,
        ledger,
        now: () => Date.UTC(2026, 9, 15, 12, 0, 0),
        profile: async () => ({
          ok: false,
          code: 'PROFILE_NOT_SET',
          detail: '',
        }),
        cycle: async () => null,
      };
      return { built, ledger };
    };
    const one = mk(1);
    const body = await json(await handleState(get(), one.built));
    expect(body.quota.configured).toBe(true);
    expect(one.ledger.balance).toHaveBeenCalledTimes(1);
    const none = mk(0);
    const empty = await json(await handleState(get(), none.built));
    expect(empty.quota.configured).toBe(false);
    expect(none.ledger.balance).not.toHaveBeenCalled();
  });
});
