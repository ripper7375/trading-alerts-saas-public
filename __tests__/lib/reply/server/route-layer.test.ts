/**
 * @jest-environment node
 */

/**
 * The small parts of the chat route layer (build step 7 part 7b): the body reader, the error format,
 * the NDJSON stream and the terminal event of each outcome.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import {
  decodeStream,
  encodeEvent,
  validateStreamOrder,
} from '@/lib/reply/contracts/stage-events';
import type { StreamEvent } from '@/lib/reply/contracts/stage-events';
import {
  chatErrorBody,
  chatErrorResponse,
  jsonHeaders,
  jsonResponse,
  quotaBody,
} from '@/lib/reply/server/errors';
import {
  CLIENT_REQUEST_UUID,
  readReplyRequest,
} from '@/lib/reply/server/request';
import {
  NDJSON_CONTENT_TYPE,
  createEventStream,
  streamHeaders,
  terminalOf,
} from '@/lib/reply/server/stream';
import type { ReplyRun } from '@/lib/reply/run/types';

const ID = '3f0c8a52-1d4e-4c7a-9b0e-000000000001';

describe('readReplyRequest', () => {
  it('reads a typed question and a button press, taking only the named fields', () => {
    expect(
      readReplyRequest({
        client_request_id: ID,
        question: 'gold now?',
        thread_id: 'th-1',
      })
    ).toEqual({
      ok: true,
      request: {
        kind: 'TYPED',
        question: 'gold now?',
        threadId: 'th-1',
        clientRequestId: ID,
      },
    });
    expect(
      readReplyRequest({ client_request_id: ID, kind: 'INSTANT_M5_INSPECT' })
    ).toEqual({
      ok: true,
      request: {
        kind: 'INSTANT',
        intent: 'INSTANT_M5_INSPECT',
        threadId: null,
        clientRequestId: ID,
      },
    });
    const forged = readReplyRequest({
      client_request_id: ID,
      question: 'q',
      user_id: 'x',
      tier: 'PRO',
      constructor: { prototype: 1 },
    });
    expect(forged).toEqual({
      ok: true,
      request: {
        kind: 'TYPED',
        question: 'q',
        threadId: null,
        clientRequestId: ID,
      },
    });
    expect(Object.keys((forged as { request: object }).request).sort()).toEqual(
      ['clientRequestId', 'kind', 'question', 'threadId']
    );
  });

  it('a thread id is optional and may be null', () => {
    for (const thread_id of [undefined, null]) {
      expect(
        readReplyRequest({ client_request_id: ID, question: 'q', thread_id })
      ).toMatchObject({
        ok: true,
        request: { threadId: null },
      });
    }
    expect(
      readReplyRequest({ client_request_id: ID, question: 'q', thread_id: '' })
    ).toMatchObject({
      ok: true,
      request: { threadId: '' },
    });
  });

  it('a question may be anything the door will judge, even an empty text', () => {
    expect(
      readReplyRequest({ client_request_id: ID, question: '' })
    ).toMatchObject({ ok: true });
  });

  it('knows a UUID', () => {
    for (const good of [
      ID,
      ID.toUpperCase(),
      '00000000-0000-0000-0000-000000000000',
    ]) {
      expect(CLIENT_REQUEST_UUID.test(good)).toBe(true);
    }
    for (const bad of [
      '',
      ID + '0',
      ID.slice(1),
      ID.replace(/-/g, ''),
      `${ID} `,
      ' ' + ID,
      ID.replace('3f', 'zz'),
    ]) {
      expect(CLIENT_REQUEST_UUID.test(bad)).toBe(false);
    }
  });

  it('says what is wrong, in English, for a developer', () => {
    const failure = (body: Record<string, unknown>) => {
      const read = readReplyRequest(body);
      return read.ok ? null : read.failure;
    };
    expect(failure({ question: 'q' })).toEqual({
      code: 'BAD_REQUEST',
      message: 'client_request_id must be a UUID.',
    });
    expect(
      failure({ client_request_id: ID, question: 'q', thread_id: 3 })
    ).toEqual({ code: 'BAD_REQUEST', message: 'thread_id must be text.' });
    expect(
      failure({
        client_request_id: ID,
        question: 'q',
        kind: 'INSTANT_M5_INSPECT',
      })
    ).toEqual({
      code: 'BAD_REQUEST',
      message: 'Send a question or a kind, not both.',
    });
    expect(failure({ client_request_id: ID, question: 3 })).toEqual({
      code: 'BAD_REQUEST',
      message: 'question must be text.',
    });
    expect(failure({ client_request_id: ID, kind: 'X' })).toEqual({
      code: 'BAD_REQUEST',
      message: 'kind must be INSTANT_M5_INSPECT or INSTANT_M15_INSPECT.',
    });
    expect(failure({ client_request_id: ID })).toEqual({
      code: 'BAD_REQUEST',
      message: 'Send a question or a kind.',
    });
  });

  it('does not see a field that is only inherited', () => {
    const body = Object.create({
      client_request_id: ID,
      question: 'q',
    }) as Record<string, unknown>;
    expect(readReplyRequest(body)).toMatchObject({ ok: false });
  });
});

describe('the error format', () => {
  it('has a code and a message, and the request id and the refusal only when there are some', () => {
    expect(chatErrorBody('FEATURE_DISABLED')).toEqual({
      success: false,
      error: { code: 'FEATURE_DISABLED', message: 'Not found' },
    });
    const refusal = {
      schema: 'intake-refusal/1',
      code: 'TIER_REQUIRED',
      stage: 'GATE',
      reply_locale: 'en-US',
      reply: 'Pro only.',
    } as never;
    expect(
      chatErrorBody('TIER_REQUIRED', {
        requestId: 'r1',
        refusal,
        message: 'custom',
      })
    ).toEqual({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'custom' },
      request_id: 'r1',
      refusal,
    });
  });

  it('has no request id and no refusal key when there are none (not a key set to nothing)', () => {
    const body = chatErrorBody('INTERNAL');
    expect(Object.keys(body).sort()).toEqual(['error', 'success']);
    expect(
      Object.keys(chatErrorBody('INTERNAL', { requestId: 'r' })).sort()
    ).toEqual(['error', 'request_id', 'success']);
    const refusal = { schema: 'intake-refusal/1' } as never;
    expect(Object.keys(chatErrorBody('INTERNAL', { refusal })).sort()).toEqual([
      'error',
      'refusal',
      'success',
    ]);
  });

  it('carries the balance as the wire names it, and nothing for no balance', () => {
    const quota = { limitUnits: 100, availableUnits: 40, neededUnits: 90 };
    expect(quotaBody(quota)).toEqual({
      limit_units: 100,
      available_units: 40,
      needed_units: 90,
    });
    expect(chatErrorBody('QUOTA_INSUFFICIENT', { quota }).quota).toEqual({
      limit_units: 100,
      available_units: 40,
      needed_units: 90,
    });
    expect(
      'quota' in chatErrorBody('QUOTA_INSUFFICIENT', { quota: null })
    ).toBe(false);
    expect('quota' in chatErrorBody('QUOTA_INSUFFICIENT')).toBe(false);
  });

  it('maps each code to the status of the intake routes, unless told another', async () => {
    const statuses: [Parameters<typeof chatErrorResponse>[0], number][] = [
      ['FEATURE_DISABLED', 404],
      ['NOT_SIGNED_IN', 401],
      ['TIER_REQUIRED', 403],
      ['THREAD_INVALID', 422],
      ['PROFILE_NOT_SET', 409],
      ['QUOTA_INSUFFICIENT', 429],
      ['FEATURE_UNAVAILABLE', 503],
      ['BAD_REQUEST', 400],
      ['UNSUPPORTED_MEDIA_TYPE', 415],
      ['PAYLOAD_TOO_LARGE', 413],
      ['INTERNAL', 500],
    ];
    for (const [code, status] of statuses) {
      expect(chatErrorResponse(code).status).toBe(status);
    }
    expect(chatErrorResponse('THREAD_INVALID', { status: 404 }).status).toBe(
      404
    );
  });

  it('sets no request header when it has no request, and never the text "undefined"', () => {
    expect(Object.keys(jsonHeaders()).sort()).toEqual([
      'Cache-Control',
      'Content-Type',
    ]);
    const bare = chatErrorResponse('INTERNAL');
    expect(bare.headers.get('x-request-id')).toBeNull();
    expect(jsonResponse({}).headers.get('x-request-id')).toBeNull();
    expect(
      chatErrorResponse('INTERNAL', { requestId: 'r9' }).headers.get(
        'x-request-id'
      )
    ).toBe('r9');
  });

  it('is never cached, and names the request when it knows it', () => {
    expect(jsonHeaders()).toEqual({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    expect(jsonHeaders('r1')['X-Request-Id']).toBe('r1');
    const response = jsonResponse({ a: 1 }, 201, 'r2');
    expect(response.status).toBe(201);
    expect(response.headers.get('x-request-id')).toBe('r2');
    expect(jsonResponse({ a: 1 }).status).toBe(200);
  });
});

describe('the stream', () => {
  const stage = (
    s: 'GATE' | 'DATA',
    status: 'STARTED' | 'DONE'
  ): StreamEvent => ({
    type: 'stage',
    stage: s,
    status,
    ms: status === 'DONE' ? 3 : null,
  });
  const error: StreamEvent = {
    type: 'error',
    request_id: 'r',
    code: 'INTERNAL',
    retryable: false,
  };

  async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
    return new Response(stream).text();
  }

  it('is NDJSON, never cached, and not buffered by a proxy', () => {
    expect(NDJSON_CONTENT_TYPE).toBe('application/x-ndjson; charset=utf-8');
    expect(streamHeaders()).toEqual({
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
  });

  it('writes the initial events, then the ones written, then ends: every line a valid event, in order', async () => {
    const { stream, write, end } = createEventStream([
      stage('GATE', 'STARTED'),
    ]);
    write(stage('GATE', 'DONE'));
    write(error);
    end();
    const text = await drain(stream);
    expect(text).toBe(
      [stage('GATE', 'STARTED'), stage('GATE', 'DONE'), error]
        .map(encodeEvent)
        .join('')
    );
    const decoded = decodeStream(text);
    expect(decoded.ok).toBe(true);
    expect(validateStreamOrder(decoded.events)).toEqual([]);
  });

  it('writes nothing after it ended, and ends only once', async () => {
    const { stream, write, end } = createEventStream([]);
    write(error);
    end();
    write(stage('DATA', 'STARTED'));
    end();
    expect(await drain(stream)).toBe(encodeEvent(error));
  });

  it('a client that cancels is not an error: what is written afterwards goes nowhere', async () => {
    const { stream, write, end } = createEventStream([
      stage('GATE', 'STARTED'),
    ]);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(() => write(error)).not.toThrow();
    expect(() => end()).not.toThrow();
  });

  it('a stream that is already closed under it is not an error either', () => {
    const { stream, write } = createEventStream([]);
    void stream.cancel();
    expect(() => write(error)).not.toThrow();
  });

  describe('the terminal event of each outcome', () => {
    const run = (r: unknown) => r as ReplyRun<never>;

    it('a reply is a result, a refusal a refusal, a failure of ours an error', () => {
      const result = { schema: 'reply-result/1' } as never;
      const refusal = { schema: 'intake-refusal/1' } as never;
      expect(
        terminalOf(
          run({ kind: 'REPLY', requestId: 'r', result, replayed: false })
        )
      ).toEqual({
        type: 'result',
        request_id: 'r',
        result,
      });
      expect(
        terminalOf(
          run({
            kind: 'REFUSED',
            requestId: 'r',
            refusal,
            quota: null,
            traced: false,
          })
        )
      ).toEqual({
        type: 'refusal',
        request_id: 'r',
        refusal,
      });
      expect(
        terminalOf(
          run({
            kind: 'ERROR',
            requestId: 'r',
            code: 'PERSISTENCE_FAILED',
            retryable: false,
          })
        )
      ).toEqual({
        type: 'error',
        request_id: 'r',
        code: 'PERSISTENCE_FAILED',
        retryable: false,
      });
    });

    it('a client that left is told it may ask again; a request that never reached the gate has none', () => {
      expect(terminalOf(run({ kind: 'ABORTED', requestId: 'r' }))).toEqual({
        type: 'error',
        request_id: 'r',
        code: 'INTERNAL',
        retryable: true,
      });
      expect(terminalOf(run({ kind: 'DISABLED' }))).toBeNull();
      expect(
        terminalOf(run({ kind: 'REQUEST_FAILED', failure: 'x' }))
      ).toBeNull();
    });
  });
});
