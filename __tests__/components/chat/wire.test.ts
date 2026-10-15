/**
 * @jest-environment node
 */

/**
 * The browser's side of the chat routes (build step 7 part 8): the NDJSON reader and the two requests,
 * run over the REAL recorded answers of the message route (`app/dev/chat/recorded.json`), cut into
 * reads of every awkward size, and over every way a request can fail.
 */

import {
  failureFromBody,
  loadInfo,
  parseEventLine,
  readEvents,
  readInfo,
  sendMessage,
} from '@/components/chat/wire';
import type { StageEvent } from '@/components/chat/types';

import {
  RECORDED,
  eventsOf,
  fakeFetch,
  jsonResponse,
  ndjson,
  refusalOf,
  responseOf,
  resultOf,
  stateBody,
  streamResponse,
} from './helpers/fake-fetch';

const BODY = {
  client_request_id: '3f0c8a52-1d4e-4c7a-9b0e-000000000001',
  question: 'Direction?',
};

const STREAMS = Object.keys(RECORDED).filter(
  (n) => RECORDED[n]?.kind === 'STREAM'
);

async function send(
  response: Response | (() => Response | Promise<Response>),
  signal?: AbortSignal
) {
  const stages: StageEvent[] = [];
  const f = fakeFetch({
    message: async () =>
      typeof response === 'function' ? response() : response,
  });
  const outcome = await sendMessage({
    fetchImpl: f.fetch,
    body: BODY,
    ...(signal === undefined ? {} : { signal }),
    onStage: (event) => stages.push(event),
  });
  return { outcome, stages, calls: f.calls };
}

describe('parseEventLine', () => {
  const stage = { type: 'stage', stage: 'MODEL', status: 'STARTED', ms: null };

  it('reads a stage event', () => {
    expect(parseEventLine(JSON.stringify(stage))).toEqual(stage);
  });

  it.each([
    ['not JSON', 'not json'],
    ['an array', '[]'],
    ['a string', '"stage"'],
    ['no type', '{}'],
    ['an unknown type', JSON.stringify({ type: 'progress' })],
    ['an unknown stage', JSON.stringify({ ...stage, stage: 'DISPATCH' })],
    ['an unknown status', JSON.stringify({ ...stage, status: 'RUNNING' })],
    [
      'a result with no reply',
      JSON.stringify({ type: 'result', request_id: 'x' }),
    ],
    [
      'a result of an unknown kind',
      JSON.stringify({
        type: 'result',
        request_id: 'x',
        result: { kind: 'POEM' },
      }),
    ],
    [
      'a refusal without a reply text',
      JSON.stringify({
        type: 'refusal',
        request_id: 'x',
        refusal: { code: 'OUT_OF_SCOPE' },
      }),
    ],
    [
      'an error without the retry flag',
      JSON.stringify({ type: 'error', request_id: 'x', code: 'INTERNAL' }),
    ],
    [
      'an error without a request id',
      JSON.stringify({ type: 'error', code: 'INTERNAL', retryable: true }),
    ],
  ])('refuses %s', (_name, line) => {
    expect(parseEventLine(line)).toBeNull();
  });

  it.each(STREAMS)('reads every line of the recorded stream %s', (name) => {
    for (const event of eventsOf(name)) {
      expect(parseEventLine(JSON.stringify(event))).toEqual(event);
    }
  });

  it('accepts an error event whose code it does not know (the words fall back to the general one)', () => {
    const event = {
      type: 'error',
      request_id: 'x',
      code: 'NEW_CODE',
      retryable: false,
    };
    expect(parseEventLine(JSON.stringify(event))).toEqual(event);
  });
});

describe('readEvents', () => {
  const text = ndjson(eventsOf('report1-long'));

  it.each([0, 1, 2, 3, 7, 64, 1000])(
    'reads the same events whatever the size of a read (%i bytes)',
    async (chunk) => {
      const seen: unknown[] = [];
      const { events, clean } = await readEvents(
        streamResponse(text, { chunk }).body as ReadableStream<Uint8Array>,
        (event) => seen.push(event)
      );
      expect(clean).toBe(true);
      expect(events).toEqual(eventsOf('report1-long'));
      expect(seen).toEqual(events);
    }
  );

  it('puts back a multi-byte character that two reads split', async () => {
    const event = {
      type: 'error',
      request_id: 'x',
      code: 'INTERNAL — ü 日本 ⁦4,367.25⁩',
      retryable: true,
    };
    for (let chunk = 1; chunk <= 5; chunk += 1) {
      const { events, clean } = await readEvents(
        streamResponse(ndjson([event]), { chunk })
          .body as ReadableStream<Uint8Array>,
        () => undefined
      );
      expect(clean).toBe(true);
      expect(events).toEqual([event]);
    }
  });

  it('calls back as each line completes, before the stream has ended', async () => {
    const order: string[] = [];
    const lines = ndjson(eventsOf('report1-long'));
    const body = streamResponse(lines, { chunk: 1000 })
      .body as ReadableStream<Uint8Array>;
    await readEvents(body, (e) => order.push(e.type));
    expect(order.at(-1)).toBe('result');
    expect(order.filter((t) => t === 'stage').length).toBe(12);
  });

  it('is not clean when the last line has no newline (a cut stream)', async () => {
    const cut = ndjson(eventsOf('report1-long')).slice(0, -1);
    const { clean } = await readEvents(
      streamResponse(cut).body as ReadableStream<Uint8Array>,
      () => undefined
    );
    expect(clean).toBe(false);
  });

  it('is not clean when a line is not an event', async () => {
    const { clean, events } = await readEvents(
      streamResponse(
        `${JSON.stringify(eventsOf('report1-long')[0])}\nnot json\n`
      ).body as ReadableStream<Uint8Array>,
      () => undefined
    );
    expect(clean).toBe(false);
    expect(events).toHaveLength(1);
  });

  it('ignores a blank line', async () => {
    const { clean, events } = await readEvents(
      streamResponse(`\n${ndjson(eventsOf('report1-long'))}\n`)
        .body as ReadableStream<Uint8Array>,
      () => undefined
    );
    expect(clean).toBe(true);
    expect(events).toHaveLength(eventsOf('report1-long').length);
  });
});

describe('sendMessage: a stream', () => {
  it.each(STREAMS)(
    'returns the one terminal event of %s, and every stage as it arrives',
    async (name) => {
      const { outcome, stages } = await send(responseOf(name, { chunk: 97 }));
      const events = eventsOf(name);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.terminal).toEqual(events.at(-1));
      expect(stages).toEqual(events.filter((e) => e.type === 'stage'));
    }
  );

  it('posts JSON to the message route with the body it was given, and nothing else', async () => {
    const { calls } = await send(responseOf('report1-long'));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      url: '/api/chat/message',
      method: 'POST',
      body: BODY,
    });
  });

  it('a refusal in the stream is a terminal event, not a failure', async () => {
    const { outcome } = await send(responseOf('refusal-out-of-scope'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.terminal.type).toBe('refusal');
    expect(outcome.terminal).toMatchObject({
      refusal: refusalOf('refusal-out-of-scope'),
    });
  });

  it('an error event is a terminal event too', async () => {
    const { outcome } = await send(responseOf('error-persistence'));
    expect(outcome).toMatchObject({
      ok: true,
      terminal: { type: 'error', code: 'PERSISTENCE_FAILED', retryable: false },
    });
  });

  it('a stream with no terminal event is a bad stream', async () => {
    const events = eventsOf('report1-long').filter((e) => e.type === 'stage');
    const { outcome } = await send(streamResponse(ndjson(events)));
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });

  it('a stream with two terminal events is a bad stream', async () => {
    const events = eventsOf('report1-long');
    const { outcome } = await send(
      streamResponse(ndjson([...events, events.at(-1)]))
    );
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });

  it('a stream that ends with a stage after its terminal event is a bad stream', async () => {
    const events = eventsOf('report1-long');
    const { outcome } = await send(
      streamResponse(ndjson([...events, events[0]]))
    );
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });

  it('a stream cut in the middle of a line is a bad stream', async () => {
    const cut = ndjson(eventsOf('report1-long')).slice(0, -20);
    const { outcome } = await send(streamResponse(cut));
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });

  it('a 200 that is not an NDJSON stream is a bad stream', async () => {
    const { outcome } = await send(jsonResponse({ success: true }));
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });

  it('a 200 with no body is a bad stream', async () => {
    const empty = new Response(null, {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
    });
    const { outcome } = await send(empty);
    expect(outcome).toEqual({ ok: false, failure: { kind: 'BAD_STREAM' } });
  });
});

describe('sendMessage: what is answered before a stream begins', () => {
  it('a refusal with the balance is a refusal the trader reads, with the numbers', async () => {
    const { outcome } = await send(responseOf('refusal-quota'));
    expect(outcome).toMatchObject({
      ok: false,
      failure: {
        kind: 'REFUSED',
        status: 429,
        refusal: { code: 'QUOTA_INSUFFICIENT' },
        quota: {
          limit_units: 20_000_000,
          available_units: 30_000,
          needed_units: 44_302,
        },
      },
    });
    if (outcome.ok || outcome.failure.kind !== 'REFUSED') return;
    expect(outcome.failure.requestId).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([
    ['refusal-tier', 403, 'TIER_REQUIRED'],
    ['refusal-profile', 409, 'PROFILE_NOT_SET'],
  ])('%s is a refusal with no balance', async (name, status, code) => {
    const { outcome } = await send(responseOf(name));
    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: 'REFUSED', status, refusal: { code }, quota: null },
    });
  });

  it('a route that is not switched on (404 FEATURE_DISABLED) is "disabled"', async () => {
    const { outcome } = await send(
      jsonResponse(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      )
    );
    expect(outcome).toEqual({ ok: false, failure: { kind: 'DISABLED' } });
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [500, 'INTERNAL'],
    [503, 'INTERNAL'],
  ])('a %i is a failure with its own code (%s)', async (status, code) => {
    const { outcome } = await send(
      jsonResponse(
        { success: false, error: { code, message: 'x' }, request_id: 'abc' },
        status
      )
    );
    expect(outcome).toEqual({
      ok: false,
      failure: { kind: 'FAILED', status, code, requestId: 'abc' },
    });
  });

  it('an error body that is not JSON is INTERNAL, with no request id', async () => {
    const { outcome } = await send(
      new Response('<html>oops</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      })
    );
    expect(outcome).toEqual({
      ok: false,
      failure: {
        kind: 'FAILED',
        status: 502,
        code: 'INTERNAL',
        requestId: null,
      },
    });
  });

  it('a 404 that is not the flag (a missing thread) is a failure, not "disabled"', async () => {
    const { outcome } = await send(
      jsonResponse(
        { success: false, error: { code: 'THREAD_INVALID', message: 'x' } },
        404
      )
    );
    expect(outcome).toMatchObject({
      ok: false,
      failure: { kind: 'FAILED', status: 404, code: 'THREAD_INVALID' },
    });
  });
});

describe('failureFromBody', () => {
  it('reads a refusal body whatever the status', () => {
    expect(
      failureFromBody(429, {
        success: false,
        error: { code: 'QUOTA_INSUFFICIENT' },
        refusal: refusalOf('refusal-quota'),
      })
    ).toMatchObject({
      kind: 'REFUSED',
      status: 429,
      quota: null,
    });
  });

  it.each([null, undefined, 3, 'text', [], {}, { error: 'x' }])(
    'makes a general failure of %j',
    (body) => {
      expect(failureFromBody(500, body)).toEqual({
        kind: 'FAILED',
        status: 500,
        code: 'INTERNAL',
        requestId: null,
      });
    }
  );

  it('ignores a quota that is not three numbers', () => {
    const failure = failureFromBody(429, {
      error: { code: 'QUOTA_INSUFFICIENT' },
      refusal: refusalOf('refusal-quota'),
      quota: { limit_units: 1, available_units: '2', needed_units: 3 },
    });
    expect(failure).toMatchObject({ kind: 'REFUSED', quota: null });
  });
});

describe('sendMessage: the connection', () => {
  it('a request that cannot be made is a network failure', async () => {
    const f = fakeFetch({
      message: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const outcome = await sendMessage({
      fetchImpl: f.fetch,
      body: BODY,
      onStage: () => undefined,
    });
    expect(outcome).toEqual({ ok: false, failure: { kind: 'NETWORK' } });
  });

  it('a body that fails while it is read is a network failure', async () => {
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(
            new TextEncoder().encode(
              ndjson(eventsOf('report1-long').slice(0, 2))
            )
          );
        } else {
          controller.error(new TypeError('network error'));
        }
      },
    });
    const { outcome, stages } = await send(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      })
    );
    expect(outcome).toEqual({ ok: false, failure: { kind: 'NETWORK' } });
    // what had arrived was still shown
    expect(stages.length).toBeGreaterThan(0);
  });

  it('an abort before the answer is "aborted", not a network failure', async () => {
    const controller = new AbortController();
    const f = fakeFetch({
      message: (_body, call) =>
        new Promise<Response>((_resolve, reject) => {
          call.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        }),
    });
    const pending = sendMessage({
      fetchImpl: f.fetch,
      body: BODY,
      signal: controller.signal,
      onStage: () => undefined,
    });
    controller.abort();
    expect(await pending).toEqual({ ok: false, failure: { kind: 'ABORTED' } });
  });

  it('an abort while the stream is being read is "aborted"', async () => {
    const controller = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull() {
        // what a browser does: an aborted fetch errors the body it was streaming
        return new Promise((_resolve, reject) => {
          const fail = () => reject(new DOMException('Aborted', 'AbortError'));
          if (controller.signal.aborted) fail();
          else controller.signal.addEventListener('abort', fail);
        });
      },
    });
    const pending = send(
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/x-ndjson' },
      }),
      controller.signal
    );
    controller.abort();
    expect((await pending).outcome).toEqual({
      ok: false,
      failure: { kind: 'ABORTED' },
    });
  });

  it('passes the abort signal to the request', async () => {
    const controller = new AbortController();
    const { calls } = await send(responseOf('report1-long'), controller.signal);
    expect(calls[0]?.signal).toBe(controller.signal);
  });
});

describe('GET /api/chat/state', () => {
  it('reads the models that passed, the balance, the profile and the cycle', async () => {
    const f = fakeFetch({ state: jsonResponse(stateBody()) });
    const outcome = await loadInfo(f.fetch);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(
      outcome.info.models.map((m) => [m.slug, m.units_per_msg, m.default])
    ).toEqual([
      ['vendor-a/model-a', 18_000, true],
      ['vendor-b/model-b', null, false],
    ]);
    expect(outcome.info.quota).toEqual({
      configured: true,
      month: '2026-10',
      limit_units: 20_000_000,
      used_units: 10_000_000,
      reserved_units: 0,
      available_units: 10_000_000,
    });
    expect(outcome.info.profile).toEqual({ trader_type: 'DAY_TRADER' });
    expect(outcome.info.cycle).toEqual({
      slot: '2026-09-18T20:55Z',
      data_status: 'FRESH',
    });
    expect(f.calls[0]).toMatchObject({ url: '/api/chat/state', method: 'GET' });
  });

  it('no model has passed: an empty list, not an error', async () => {
    const f = fakeFetch({ state: jsonResponse(stateBody({ models: [] })) });
    const outcome = await loadInfo(f.fetch);
    expect(outcome).toMatchObject({ ok: true, info: { models: [] } });
  });

  it('a part the server could not read is null and the rest is still used', async () => {
    const f = fakeFetch({
      state: jsonResponse(
        stateBody({
          profile: null,
          cycle: null,
          quota: {
            configured: false,
            limit_units: null,
            used_units: null,
            reserved_units: null,
            available_units: null,
          },
        })
      ),
    });
    const outcome = await loadInfo(f.fetch);
    expect(outcome).toMatchObject({
      ok: true,
      info: {
        profile: null,
        cycle: null,
        quota: { configured: false, available_units: null },
      },
    });
  });

  it('leaves out a model it cannot read, and reads the measured cost only when it is a number', () => {
    const info = readInfo(
      stateBody({
        models: [
          { slug: 'a/b', name: 'B', units_per_msg: '18000' },
          { name: 'no slug' },
          null,
          'text',
          {
            slug: 'c/d',
            name: 'D',
            units_per_msg: 25_000,
            default: true,
            vision: true,
            multiplier: 2,
          },
        ],
      })
    );
    expect(
      info?.models.map((m) => [m.slug, m.units_per_msg, m.multiplier])
    ).toEqual([
      ['a/b', null, 1],
      ['c/d', 25_000, 2],
    ]);
  });

  it('refuses a cycle with a status it does not know, and a trader type it does not know', () => {
    const info = readInfo(
      stateBody({
        cycle: { slot: 'x', data_status: 'WEIRD' },
        profile: { trader_type: 'WHALE' },
      })
    );
    expect(info).toMatchObject({ cycle: null, profile: null });
  });

  it.each([null, undefined, [], 'x', { success: false }, { success: 'true' }])(
    'is not a state answer: %j',
    (body) => {
      expect(readInfo(body)).toBeNull();
    }
  );

  it('a route that is not switched on is "disabled"', async () => {
    const f = fakeFetch({
      state: jsonResponse(
        {
          success: false,
          error: { code: 'FEATURE_DISABLED', message: 'Not found' },
        },
        404
      ),
    });
    expect(await loadInfo(f.fetch)).toEqual({ ok: false, reason: 'DISABLED' });
  });

  it.each([
    [500, { success: false }],
    [401, { success: false, error: { code: 'NOT_SIGNED_IN' } }],
    [200, { nothing: true }],
  ])('a %i with %j is a failure', async (status, body) => {
    const f = fakeFetch({ state: jsonResponse(body, status) });
    expect(await loadInfo(f.fetch)).toEqual({ ok: false, reason: 'FAILED' });
  });

  it('a body that is not JSON is a failure', async () => {
    const f = fakeFetch({ state: new Response('nope', { status: 502 }) });
    expect(await loadInfo(f.fetch)).toEqual({ ok: false, reason: 'FAILED' });
  });

  it('a connection that cannot be made is a network failure; an abort is an abort', async () => {
    const down = fakeFetch({
      state: () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(await loadInfo(down.fetch)).toEqual({
      ok: false,
      reason: 'NETWORK',
    });
    const controller = new AbortController();
    controller.abort();
    expect(await loadInfo(down.fetch, controller.signal)).toEqual({
      ok: false,
      reason: 'ABORTED',
    });
  });
});

describe('the recorded replies, as the panel reads them', () => {
  it('the recorded results are the four kinds', () => {
    const kinds = new Set(
      STREAMS.flatMap((n) => {
        const last = eventsOf(n).at(-1);
        return last?.type === 'result' ? [resultOf(n).kind] : [];
      })
    );
    expect(kinds).toEqual(
      new Set(['REPORT1', 'ANSWER', 'FIXED_ANSWER', 'ACTION'])
    );
  });
});
