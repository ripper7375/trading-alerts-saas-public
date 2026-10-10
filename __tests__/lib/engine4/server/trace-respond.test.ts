/**
 * @jest-environment node
 */

/**
 * The trace builder and the front door of every route (build step 5, part 6): time
 * measured in whole milliseconds without floating-point arithmetic, JSON that carries
 * `bigint` as exact text, and one place where every failure becomes the one error
 * format, with nothing of the cause in it.
 */

import { ENGINE4_VERSION } from '@/lib/engine4';
import {
  ERROR_STATUS,
  Engine4HttpError,
  errorBody,
} from '@/lib/engine4/server/errors';
import type { Engine4ErrorCode } from '@/lib/engine4/server/errors';
import {
  respondError,
  respondOk,
  runRoute,
  toJsonText,
} from '@/lib/engine4/server/respond';
import type { RouteInput } from '@/lib/engine4/server/respond';
import type { AccessResult } from '@/lib/engine4/server/session';
import { TraceBuilder } from '@/lib/engine4/server/trace';
import { AuditKeyError } from '@/lib/engine4/store/user-hash';
import { StoredProfileError } from '@/lib/engine4/store/profile-store';

// The front door imports the stores, which import the user database client.
jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));

/** A clock that moves only when told to. */
function clock(start: number) {
  let now = start;
  return {
    read: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

afterEach(() => jest.restoreAllMocks());

describe('TraceBuilder', () => {
  test('names the request, the route, the method and the engine version', () => {
    const c = clock(1_789_764_930_000);
    const trace = new TraceBuilder('size', 'POST', c.read, 'req-1').snapshot();
    expect(trace).toEqual({
      requestId: 'req-1',
      route: 'size',
      method: 'POST',
      engine4Version: ENGINE4_VERSION,
      startedAt: '2026-09-18T20:55:30.000Z',
      tier: null,
      language: null,
      submissionId: null,
      data: null,
      risk: null,
      timings: { totalMs: 0, stages: [] },
    });
  });

  test('makes a fresh UUID for each request unless it is given one', () => {
    const a = new TraceBuilder('offer', 'POST').requestId;
    const b = new TraceBuilder('offer', 'POST').requestId;
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(a).not.toBe(b);
  });

  test('times each stage and the total in whole milliseconds', async () => {
    const c = clock(1000);
    const trace = new TraceBuilder('size', 'POST', c.read, 'r');
    c.advance(5);
    await trace.stage('profile', async () => {
      c.advance(12);
    });
    await trace.stage('cycle', async () => {
      c.advance(30);
    });
    c.advance(3);
    expect(trace.snapshot().timings).toEqual({
      totalMs: 50,
      stages: [
        { name: 'profile', ms: 12 },
        { name: 'cycle', ms: 30 },
      ],
    });
  });

  test('a stage that throws is still timed, and the error goes on', async () => {
    const c = clock(1000);
    const trace = new TraceBuilder('size', 'POST', c.read, 'r');
    await expect(
      trace.stage('save', async () => {
        c.advance(7);
        throw new Error('nope');
      })
    ).rejects.toThrow('nope');
    expect(trace.snapshot().timings.stages).toEqual([{ name: 'save', ms: 7 }]);
  });

  test('stages that overlap each measure their own wall time', async () => {
    const c = clock(0);
    const trace = new TraceBuilder('offer', 'POST', c.read, 'r');
    await Promise.all([
      trace.stage('a', async () => {
        c.advance(10);
      }),
      trace.stage('b', async () => {
        c.advance(20);
      }),
    ]);
    const stages = trace.snapshot().timings.stages;
    expect(stages.map((s) => s.name).sort()).toEqual(['a', 'b']);
  });

  test('set merges the groups it is given and replaces a group as a whole', () => {
    const trace = new TraceBuilder('consent', 'POST', clock(0).read, 'r');
    trace.set({ tier: 'PRO', language: 'ja' });
    trace.set({ submissionId: 'press-1' });
    trace.set({ tier: 'FREE' });
    expect(trace.snapshot()).toMatchObject({
      tier: 'FREE',
      language: 'ja',
      submissionId: 'press-1',
    });
  });

  test('a snapshot is a copy: later stages do not change one already taken', async () => {
    const trace = new TraceBuilder('size', 'POST', clock(0).read, 'r');
    const early = trace.snapshot();
    await trace.stage('x', async () => undefined);
    expect(early.timings.stages).toEqual([]);
    const withX = trace.snapshot();
    withX.timings.stages[0]!.name = 'changed';
    expect(trace.snapshot().timings.stages[0]!.name).toBe('x');
  });
});

describe('toJsonText', () => {
  test('writes a bigint as exact decimal text, nested anywhere', () => {
    const big = 123_456_789_012_345_678_901_234_567_890n;
    expect(JSON.parse(toJsonText({ a: big, b: [big], c: { d: big } }))).toEqual(
      {
        a: '123456789012345678901234567890',
        b: ['123456789012345678901234567890'],
        c: { d: '123456789012345678901234567890' },
      }
    );
  });

  test('leaves everything else as JSON.stringify does, and uses toJSON', () => {
    expect(
      toJsonText({
        a: 1,
        b: 'x',
        c: null,
        d: undefined,
        e: { toJSON: () => '1.5' },
      })
    ).toBe('{"a":1,"b":"x","c":null,"e":"1.5"}');
  });
});

describe('errors', () => {
  test('every code has an HTTP status, and the table is the one in the docs', () => {
    expect(ERROR_STATUS).toEqual({
      FEATURE_DISABLED: 404,
      UNAUTHENTICATED: 401,
      TIER_REQUIRED: 403,
      BAD_REQUEST: 400,
      UNSUPPORTED_MEDIA_TYPE: 415,
      PAYLOAD_TOO_LARGE: 413,
      INVALID_PROFILE: 422,
      PROFILE_NOT_SET: 409,
      CONSENT_REFUSED: 422,
      SETUP_CHANGED: 409,
      SUBMISSION_IN_FLIGHT: 409,
      SUBMISSION_ID_REUSED: 422,
      DATA_UNAVAILABLE: 503,
      AUDIT_NOT_CONFIGURED: 503,
      INTERNAL: 500,
    });
  });

  test('the error body is the code, the message and the details only when there are some', () => {
    const trace = new TraceBuilder(
      'size',
      'POST',
      clock(0).read,
      'r'
    ).snapshot();
    expect(errorBody('BAD_REQUEST', 'm', trace)).toEqual({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'm' },
      trace,
    });
    expect(errorBody('BAD_REQUEST', 'm', trace, { a: 1 }).error).toEqual({
      code: 'BAD_REQUEST',
      message: 'm',
      details: { a: 1 },
    });
  });
});

describe('respondOk and respondError', () => {
  const trace = new TraceBuilder('size', 'POST', clock(0).read, 'r').snapshot();

  test('send JSON that is never cached, with the status the code maps to', async () => {
    const ok = respondOk({ a: 1 }, trace, 201);
    expect(ok.status).toBe(201);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(ok.headers.get('content-type')).toBe(
      'application/json; charset=utf-8'
    );
    expect(await ok.json()).toEqual({ success: true, a: 1, trace });
    for (const code of Object.keys(ERROR_STATUS) as Engine4ErrorCode[]) {
      expect(respondError(code, 'm', trace).status).toBe(ERROR_STATUS[code]);
    }
  });

  test('a success is 200 unless told otherwise', () => {
    expect(respondOk({}, trace).status).toBe(200);
  });
});

describe('runRoute', () => {
  const PRO: AccessResult = { ok: true, caller: { userId: 'u1', tier: 'PRO' } };
  const input = (over: Partial<RouteInput> = {}): RouteInput => ({
    route: 'size',
    request: new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"a":1}',
    }),
    takesBody: true,
    ...over,
  });
  const run = (
    handler: Parameters<typeof runRoute>[1],
    over: Partial<RouteInput> = {},
    access: AccessResult = PRO
  ): Promise<Response> =>
    runRoute(input(over), handler, {
      clock: clock(0).read,
      authorizeCaller: async () => access,
    });

  test('hands the handler the caller, the trace and the parsed body, and sends its fields', async () => {
    const seen: unknown[] = [];
    const response = await run(async (context) => {
      seen.push(context.caller, context.body);
      context.trace.set({ language: 'de' });
      return { fields: { hello: 'world' }, status: 201 };
    });
    expect(seen).toEqual([{ userId: 'u1', tier: 'PRO' }, { a: 1 }]);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, hello: 'world' });
    expect(body.trace).toMatchObject({
      tier: 'PRO',
      language: 'de',
      route: 'size',
    });
  });

  test('the clock given to the front door is the clock of the trace', async () => {
    const response = await run(async () => ({ fields: {} }));
    const { trace } = await response.json();
    expect(trace.startedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  test('a field of a handler cannot take the place of success or of the trace', async () => {
    const response = await run(async () => ({
      fields: { success: false, trace: 'forged', ok: 1 },
    }));
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.trace.route).toBe('size');
    expect(body.ok).toBe(1);
  });

  test('a route without a body is not asked for one', async () => {
    const response = await run(
      async (context) => ({ fields: { body: context.body } }),
      { takesBody: false, request: new Request('http://localhost/x') }
    );
    expect((await response.json()).body).toBeNull();
  });

  test.each([
    ['FEATURE_DISABLED', 404],
    ['UNAUTHENTICATED', 401],
    ['TIER_REQUIRED', 403],
  ] as const)(
    'a refused caller (%s) is %i and the handler never runs',
    async (code, status) => {
      const handler = jest.fn();
      const response = await run(
        handler,
        {},
        { ok: false, code, message: 'm', tier: 'FREE' }
      );
      expect(response.status).toBe(status);
      expect((await response.json()).trace.tier).toBe('FREE');
      expect(handler).not.toHaveBeenCalled();
    }
  );

  test('a bad body is refused before the handler runs', async () => {
    const handler = jest.fn();
    const response = await run(handler, {
      request: new Request('http://localhost/x', {
        method: 'POST',
        body: '{}',
      }),
    });
    expect(response.status).toBe(415);
    expect(handler).not.toHaveBeenCalled();
  });

  test('an Engine4HttpError becomes its code, message and details', async () => {
    const response = await run(async () => {
      throw new Engine4HttpError('SETUP_CHANGED', 'moved', {
        currentSetupSha256: 'x',
      });
    });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toEqual({
      code: 'SETUP_CHANGED',
      message: 'moved',
      details: { currentSetupSha256: 'x' },
    });
  });

  test('a missing audit key is a 503 that names no variable, and is logged with the request id', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const response = await run(async () => {
      throw new AuditKeyError('MISSING', 'ENGINE4_AUDIT_HMAC_KEY is not set');
    });
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain('ENGINE4_AUDIT_HMAC_KEY');
    expect(quiet.mock.calls[0]!.join(' ')).toContain(
      JSON.parse(text).trace.requestId
    );
  });

  test('a stored profile that is not valid is a plain 500', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const response = await run(async () => {
      throw new StoredProfileError('u1', [
        { field: 'equity', code: 'REQUIRED', message: 'secret' },
      ]);
    });
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.message).toBe(
      'The stored profile could not be read.'
    );
    expect(text).not.toContain('secret');
    expect(quiet).toHaveBeenCalled();
  });

  test.each([
    [new Error('postgres://admin:hunter2@db refused')],
    ['a thrown string'],
    [{ code: 'P2002' }],
    [null],
  ])(
    'anything else (%p) is a plain 500 with a fixed message',
    async (thrown) => {
      const quiet = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const response = await run(async () => {
        throw thrown;
      });
      const text = await response.text();
      expect(response.status).toBe(500);
      expect(JSON.parse(text).error).toEqual({
        code: 'INTERNAL',
        message: 'Something went wrong on our side.',
      });
      expect(text).not.toContain('hunter2');
      expect(quiet).toHaveBeenCalled();
    }
  );

  test('the request id in the log is the one in the answer', async () => {
    const quiet = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const response = await run(async () => {
      throw new Error('x');
    });
    const { trace } = await response.json();
    expect(String(quiet.mock.calls[0]![0])).toContain(trace.requestId);
  });
});
