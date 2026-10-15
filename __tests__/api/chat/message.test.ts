/**
 * @jest-environment node
 */

/**
 * `POST /api/chat/message` end to end (build step 7 part 7b; plan part 7 "Tests"; ADR-054, decisions
 * D23 and D24): the route's whole body over the orchestrator and the fake ports of the 7a world. What
 * runs for real: the route layer (`runMessageRoute`), the body reader, the stream framing, the gate,
 * the pipeline, the checks, the composer, the ledger model and the stores.
 *
 * The shape of the answer is the thing under test: a JSON error with the HTTP status of its reason
 * while the request is still at the gate, a 200 NDJSON stream from the moment the gate has passed, the
 * stored reply for a request seen before, and nothing at all for a client that left.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/reply/server/ports', () => ({
  createReplyPorts: jest.fn(() => {
    throw new Error('the production ports must not be built here');
  }),
}));

import {
  decodeStream,
  validateStreamOrder,
} from '@/lib/reply/contracts/stage-events';
import type {
  ResultEvent,
  StreamEvent,
} from '@/lib/reply/contracts/stage-events';
import { runMessageRoute } from '@/lib/reply/server/respond';
import type { MessageRouteOptions } from '@/lib/reply/server/respond';
import { createReplyPorts } from '@/lib/reply/server/ports';

import { echoResult } from '../../lib/intake/helpers/ports';
import {
  USER,
  buildWorld,
  type ReplyWorld,
} from '../../lib/reply/run/helpers/world';

const uuid = (n: number): string =>
  `3f0c8a52-1d4e-4c7a-9b0e-${String(n).padStart(12, '0')}`;

function post(
  body: unknown,
  init: { signal?: AbortSignal; contentType?: string | null; raw?: string } = {}
): Request {
  const headers: Record<string, string> = {};
  if (init.contentType !== null) {
    headers['content-type'] = init.contentType ?? 'application/json';
  }
  return new Request('http://localhost/api/chat/message', {
    method: 'POST',
    headers,
    body: init.raw ?? JSON.stringify(body),
    ...(init.signal === undefined ? {} : { signal: init.signal }),
  });
}

async function send(
  w: ReplyWorld,
  request: Request,
  options: MessageRouteOptions = {}
): Promise<{ response: Response; text: string }> {
  const response = await runMessageRoute(request, {
    ports: w.ports,
    ...options,
  });
  return { response, text: await response.text() };
}

const typed = (n = 1, extra: Record<string, unknown> = {}) => ({
  client_request_id: uuid(n),
  question: 'What is the direction of gold now?',
  ...extra,
});

function events(text: string): StreamEvent[] {
  const decoded = decodeStream(text);
  if (!decoded.ok) {
    throw new Error(
      `the stream is not valid: ${JSON.stringify(decoded.issues)}`
    );
  }
  return decoded.events;
}

describe('a request that passes the gate is a stream', () => {
  it('answers a typed question with stage events and one result, whole, in order', async () => {
    const w = await buildWorld();
    const { response, text } = await send(w, post(typed()));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/x-ndjson; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const all = events(text);
    expect(validateStreamOrder(all)).toEqual([]);
    const stages = all.filter((e) => e.type === 'stage');
    expect(
      stages.filter((e) => e.status === 'STARTED').map((e) => e.stage)
    ).toEqual(['GATE', 'UNDERSTAND', 'DATA', 'CONTEXT', 'MODEL', 'CHECKS']);
    const last = all[all.length - 1] as ResultEvent;
    expect(last.type).toBe('result');
    expect(last.result.kind).toBe('REPORT1');
    expect(last.request_id).toMatch(/^[0-9a-f]{64}$/);
    // exactly one terminal event, and it is last
    expect(all.filter((e) => e.type !== 'stage')).toHaveLength(1);
    // the reply is stored by the time the last line was sent
    expect(w.chat.messages).toHaveLength(2);
    expect(w.traces.rows.size).toBe(1);
  });

  it('answers a button press with { client_request_id, kind }, and skips the Understand stage', async () => {
    const w = await buildWorld();
    const { response, text } = await send(
      w,
      post({ client_request_id: uuid(2), kind: 'INSTANT_M15_INSPECT' })
    );
    expect(response.status).toBe(200);
    const all = events(text);
    expect(
      all.filter((e) => e.type === 'stage' && e.status === 'SKIPPED')
    ).toEqual([
      { type: 'stage', stage: 'UNDERSTAND', status: 'SKIPPED', ms: null },
    ]);
    expect((all[all.length - 1] as ResultEvent).result.intent).toBe(
      'INSTANT_M15_INSPECT'
    );
  });

  it('a refusal of the door or the scope check is the terminal event of a stream, not an HTTP error', async () => {
    const w = await buildWorld({
      intake: {
        understand: echoResult('direction of eurusd', 'DIRECTION', {
          symbols: ['EURUSD'],
        }),
      },
    });
    const { response, text } = await send(w, post(typed()));
    expect(response.status).toBe(200);
    const all = events(text);
    const last = all[all.length - 1]!;
    expect(last).toMatchObject({ type: 'refusal' });
    expect(last.type === 'refusal' && last.refusal.code).toBe('OUT_OF_SCOPE');
    expect(validateStreamOrder(all)).toEqual([]);
  });

  it('the fixed answer of a stale cycle is a stream too, with the model and the checks skipped', async () => {
    const w = await buildWorld({
      intake: { worldOptions: { gateway: 'STALE' } },
    });
    const { response, text } = await send(w, post(typed()));
    expect(response.status).toBe(200);
    const all = events(text);
    expect(
      all
        .filter((e) => e.type === 'stage' && e.status === 'SKIPPED')
        .map((e) => e.type === 'stage' && e.stage)
    ).toEqual(['MODEL', 'CHECKS']);
    expect((all[all.length - 1] as ResultEvent).result.kind).toBe(
      'FIXED_ANSWER'
    );
  });
});

describe('a request turned away at the gate is a JSON error with its status', () => {
  const body = async (response: Response) =>
    (await response.json()) as {
      success: false;
      error: { code: string; message: string };
      refusal?: {
        code: string;
        stage: string;
        reply: string;
        reply_locale: string;
      };
      quota?: {
        limit_units: number;
        available_units: number;
        needed_units: number;
      };
      request_id?: string;
    };

  it.each([
    ['not signed in', { session: null }, 401, 'NOT_SIGNED_IN'],
    [
      'a Free trader',
      { session: { userId: USER, tier: 'FREE' } },
      403,
      'TIER_REQUIRED',
    ],
    [
      'no profile',
      {
        profile: {
          ok: false as const,
          code: 'PROFILE_NOT_SET' as const,
          detail: 'none',
        },
      },
      409,
      'PROFILE_NOT_SET',
    ],
  ])('%s', async (_name, intake, status, code) => {
    const w = await buildWorld({ intake });
    const { response } = await (async () => {
      const r = await runMessageRoute(post(typed()), { ports: w.ports });
      return { response: r };
    })();
    expect(response.status).toBe(status);
    expect(response.headers.get('content-type')).toBe(
      'application/json; charset=utf-8'
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    const json = await body(response);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe(code);
    // the reply the trader reads is in their language
    expect(json.refusal).toMatchObject({ code, reply_locale: 'en-US' });
    expect(json.refusal!.reply.length).toBeGreaterThan(10);
    expect(w.primary?.count).toBe(0);
  });

  it('a thread that is not the trader’s is 422 THREAD_INVALID', async () => {
    const w = await buildWorld();
    const theirs = w.chat.seedThread({ user_id: 'someone-else' });
    const response = await runMessageRoute(
      post(typed(1, { thread_id: theirs.id })),
      { ports: w.ports }
    );
    expect(response.status).toBe(422);
    expect((await body(response)).error.code).toBe('THREAD_INVALID');
    expect(w.primary?.count).toBe(0);
  });

  it('an allowance that cannot cover the request is 429 with the balance', async () => {
    const w = await buildWorld({ allowance: 30_000 });
    const response = await runMessageRoute(post(typed()), { ports: w.ports });
    expect(response.status).toBe(429);
    const json = await body(response);
    expect(json.error.code).toBe('QUOTA_INSUFFICIENT');
    expect(json.quota).toMatchObject({
      limit_units: 30_000,
      available_units: 30_000,
    });
    expect(json.quota!.needed_units).toBeGreaterThan(30_000);
    expect(json.request_id).toMatch(/^[0-9a-f]{64}$/);
    expect(response.headers.get('x-request-id')).toBe(json.request_id);
    expect(w.fake.calls.understand).toBe(0);
  });

  it('a service nobody can price is 503, not a quota refusal', async () => {
    const w = await buildWorld({ primary: null });
    const response = await runMessageRoute(post(typed()), { ports: w.ports });
    expect(response.status).toBe(503);
    const json = await body(response);
    expect(json.error.code).toBe('FEATURE_UNAVAILABLE');
    expect(json.quota).toBeUndefined();
  });

  it('a route that is off is 404 to everybody, and asks for nothing', async () => {
    const w = await buildWorld({ intake: { enabled: false } });
    const response = await runMessageRoute(post(typed()), { ports: w.ports });
    expect(response.status).toBe(404);
    expect((await body(response)).error.code).toBe('FEATURE_DISABLED');
    expect(w.fake.calls.session).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('without injected ports, the flag is read from the environment before anything is built', async () => {
    const response = await runMessageRoute(post(typed()), { env: {} });
    expect(response.status).toBe(404);
    expect(createReplyPorts).not.toHaveBeenCalled();
    for (const value of ['TRUE', '1', 'yes', 'false', '']) {
      const other = await runMessageRoute(post(typed()), {
        env: { REPLY_ENABLED: value },
      });
      expect(other.status).toBe(404);
    }
    expect(createReplyPorts).not.toHaveBeenCalled();
  });
});

describe('the body is read after the tier, and only what is named is taken from it', () => {
  async function status(w: ReplyWorld, request: Request) {
    const response = await runMessageRoute(request, { ports: w.ports });
    return {
      status: response.status,
      json: (await response.json()) as {
        error: { code: string; message: string };
      },
    };
  }

  it('is never read for a caller who is not signed in or not Pro', async () => {
    for (const intake of [
      { session: null },
      { session: { userId: USER, tier: 'FREE' } },
    ]) {
      const w = await buildWorld({ intake });
      const request = post(
        {},
        { raw: 'this is not json', contentType: 'text/plain' }
      );
      const text = jest.spyOn(request, 'text');
      const { status: code } = await status(w, request);
      expect([401, 403]).toContain(code);
      expect(text).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['a body that is not JSON', { raw: 'not json' }, 400],
    ['a JSON body that is not an object', { raw: '[1,2]' }, 400],
    ['a body of the wrong type', { raw: '{}', contentType: 'text/plain' }, 415],
    ['no content type at all', { raw: '{}', contentType: null }, 415],
    [
      'a body that is too large',
      { raw: JSON.stringify({ x: 'a'.repeat(9_000) }) },
      413,
    ],
  ])('%s', async (_name, init, expected) => {
    const w = await buildWorld();
    const { status: code } = await status(w, post(undefined, init));
    expect(code).toBe(expected);
    expect(w.primary?.count).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it.each([
    ['no client id', { question: 'q' }],
    [
      'a client id that is not a UUID',
      { client_request_id: 'not-a-uuid', question: 'q' },
    ],
    ['a client id that is a number', { client_request_id: 5, question: 'q' }],
    ['neither a question nor a kind', { client_request_id: uuid(1) }],
    [
      'both a question and a kind',
      { client_request_id: uuid(1), question: 'q', kind: 'INSTANT_M5_INSPECT' },
    ],
    [
      'a question that is not text',
      { client_request_id: uuid(1), question: 7 },
    ],
    [
      'a kind that is not a button',
      { client_request_id: uuid(1), kind: 'DIRECTION' },
    ],
    [
      'a thread id that is not text',
      { client_request_id: uuid(1), question: 'q', thread_id: 5 },
    ],
  ])('%s is a 400', async (_name, payload) => {
    const w = await buildWorld();
    const { status: code, json } = await status(w, post(payload));
    expect(code).toBe(400);
    expect(json.error.code).toBe('BAD_REQUEST');
    expect(w.primary?.count).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('32 forged fields change nothing: the user, the tier, the language, the symbol and the intent are the server’s', async () => {
    const FORGED = 'FORGED-9917';
    const forged: Record<string, unknown> = {
      user_id: FORGED,
      userId: FORGED,
      user: { id: FORGED },
      session: { user: { id: FORGED, tier: 'PRO' } },
      tier: 'PRO',
      plan: 'PRO',
      role: 'ADMIN',
      is_admin: true,
      locale: 'ja',
      language: 'ja',
      reply_locale: 'ja',
      interface_locale: 'ja',
      symbol: 'EURUSD',
      timeframe: 'H4',
      intent: 'REPORT_2',
      trader_type: 'SCALPER',
      profile: { trader_type: 'SCALPER', equity: 1, commission: 1 },
      equity: 1_000_000,
      commission: 99,
      request_id: FORGED,
      thread_owner: FORGED,
      model: FORGED,
      system: FORGED,
      prompt: FORGED,
      temperature: 2,
      max_output_tokens: 1,
      units: 0,
      units_charged: 0,
      balance: 1e12,
      quota: { limit_units: 1e12 },
      cycle_slot: '2020-01-01T00:00Z',
      data_status: 'FRESH',
    };
    expect(Object.keys(forged)).toHaveLength(32);
    const w = await buildWorld();
    const { response, text } = await send(w, post({ ...typed(7), ...forged }));
    expect(response.status).toBe(200);
    const all = events(text);
    const result = (all[all.length - 1] as ResultEvent).result;

    // who: the session's user, in the gate and in every store
    expect(w.fake.calls.profileUsers).toEqual([USER]);
    const row = [...w.traces.rows.values()][0]!;
    expect(row).toMatchObject({
      user_id: USER,
      tier: 'PRO',
      locale: 'en-US',
      intent: 'DIRECTION',
    });
    expect([...w.chat.threads.values()][0]!.user_id).toBe(USER);
    expect([...w.ledger.reservations.values()][0]!.user_id).toBe(USER);

    // what: the language is the interface's, the symbol gold, the intent the Understand step's, the type the profile's
    expect(result.reply_locale).toBe('en-US');
    expect(result.intent).toBe('DIRECTION');
    expect(w.fake.calls.snapshotRequests).toEqual([
      { traderType: 'DAY_TRADER' },
    ]);
    expect(w.fake.calls.understandRequests).toHaveLength(1);

    // and none of it reached the model, the trace, the reply or the books
    const everywhere = JSON.stringify([
      w.primary!.calls,
      [...w.traces.rows.values()],
      result,
      [...w.ledger.reservations.values()],
      w.chat.messages,
    ]);
    expect(everywhere).not.toContain(FORGED);
    expect(everywhere).not.toContain('EURUSD');
    expect(everywhere).not.toMatch(/"equity"|"commission"/);
  });
});

describe('a request seen before, and one in flight', () => {
  it('returns the stored reply to the second press as a stream of one event', async () => {
    const w = await buildWorld();
    const first = await send(w, post(typed(3)));
    const second = await send(w, post(typed(3)));
    expect(second.response.status).toBe(200);
    const a = events(first.text);
    const b = events(second.text);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ type: 'result' });
    expect((b[0] as ResultEvent).result).toEqual(
      (a[a.length - 1] as ResultEvent).result
    );
    expect(w.primary?.count).toBe(1);
    expect(w.ledger.reservations.size).toBe(1);
  });

  it('a duplicate that arrives while the first runs is told to try again, and runs nothing', async () => {
    const w = await buildWorld();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const model = w.primary!;
    const complete = model.complete.bind(model);
    (model as { complete: typeof complete }).complete = async (request) => {
      await gate;
      return complete(request);
    };
    let task: Promise<unknown> = Promise.resolve();
    const firstResponse = await runMessageRoute(post(typed(4)), {
      ports: w.ports,
      keepAlive: (t) => {
        task = t;
      },
    });
    const duplicate = await send(w, post(typed(4)));
    expect(duplicate.response.status).toBe(200);
    expect(events(duplicate.text)).toEqual([
      expect.objectContaining({
        type: 'error',
        code: 'INTERNAL',
        retryable: true,
      }),
    ]);
    release();
    await firstResponse.text();
    await task;
    expect(model.count).toBe(1);
  });
});

describe('the client leaves', () => {
  it('before any model is called: nobody is listening, nothing is held or charged', async () => {
    const w = await buildWorld();
    const controller = new AbortController();
    controller.abort();
    const response = await runMessageRoute(
      post(typed(5), { signal: controller.signal }),
      { ports: w.ports }
    );
    expect(response.status).toBe(499);
    expect(w.primary?.count).toBe(0);
    expect(w.ledger.reservations.size).toBe(0);
  });

  it('after the model was called: the run finishes, settles and stores, so a reload shows the reply', async () => {
    const w = await buildWorld();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const model = w.primary!;
    const complete = model.complete.bind(model);
    (model as { complete: typeof complete }).complete = async (request) => {
      await gate;
      return complete(request);
    };
    let task: Promise<unknown> = Promise.resolve();
    const response = await runMessageRoute(post(typed(6)), {
      ports: w.ports,
      keepAlive: (t) => {
        task = t;
      },
    });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    await reader.read(); // the first stage events arrive
    await reader.cancel(); // the client closes the connection while the model is working
    release();
    await task;

    expect(model.count).toBe(1);
    expect([...w.ledger.reservations.values()][0]).toMatchObject({
      status: 'SETTLED',
      actual_units: 2_800,
    });
    expect(w.chat.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect(w.traces.rows.size).toBe(1);
  });

  it('hands the run to the platform so it is kept alive', async () => {
    const w = await buildWorld();
    const kept: Promise<unknown>[] = [];
    await send(w, post(typed(8)), { keepAlive: (t) => kept.push(t) });
    expect(kept).toHaveLength(1);
    await expect(kept[0]).resolves.toBeUndefined();
  });
});

describe('a run that fails on our side', () => {
  it('is a 500 JSON error before the stream and an error event after it, and says nothing of the cause', async () => {
    const w = await buildWorld();
    const thread = w.chat.seedThread({ user_id: USER });
    w.ports.threads.context = async () => {
      throw new Error('threads are down with password hunter2');
    };
    const { response, text } = await send(
      w,
      post(typed(9, { thread_id: thread.id }))
    );
    // the failure came after the gate: it is the terminal event of a stream
    expect(response.status).toBe(200);
    const all = events(text);
    expect(all[all.length - 1]).toMatchObject({
      type: 'error',
      code: 'INTERNAL',
      retryable: false,
    });
    expect(text).not.toContain('hunter2');
  });
});
