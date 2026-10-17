/**
 * @jest-environment node
 *
 * operation-service transport timeouts (Next.js remediation T1-a / T1-a-writes).
 *
 * Reads (GET/HEAD) are bounded to 5 s, writes to 15 s and never retried. A timeout is reported as
 * OperationServiceError(504, GATEWAY_TIMEOUT) so every route handler's existing
 * `.status` / `.body` mapping answers `{ error: 'Gateway timeout' }`.
 *
 * The 5 s timer is not waited for: `AbortSignal.timeout` is replaced by a
 * controllable signal, which also shows the exact duration it was asked for.
 */

jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(),
}));

import {
  callOperationService,
  callOperationServiceWithOptionalTokenStatus,
  callOperationServiceWithToken,
  callOperationServiceWithTokenStatus,
  OperationServiceError,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
} from '@/lib/operation-service/client';

const mockFetch = jest.fn();
const realFetch = global.fetch;

/** A fetch that never answers on its own and rejects with the signal's reason when aborted, as undici does. */
function stalledFetch(): void {
  mockFetch.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        );
      })
  );
}

/** Replaces the timer with a signal the test fires itself; returns the controller and the spy. */
function controllableTimeout() {
  const controller = new AbortController();
  const spy = jest
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValue(controller.signal);
  return { controller, spy };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('read timeout (GET / HEAD)', () => {
  it('is 5 seconds', () => {
    expect(READ_TIMEOUT_MS).toBe(5_000);
  });

  it.each(['GET', 'HEAD', 'get'])(
    'bounds a %s call with a 5 s signal',
    async (method) => {
      const { controller, spy } = controllableTimeout();
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      await callOperationService('/alerts', { method });

      expect(spy).toHaveBeenCalledWith(5_000);
      const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBe(controller.signal);
    }
  );

  it('treats a call with no method as a GET', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await callOperationService('/alerts');

    expect(spy).toHaveBeenCalledWith(5_000);
  });

  it('bounds the three token-carrying variants too', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockImplementation(async () => jsonResponse({ ok: true }));

    await callOperationServiceWithToken('/a', 't');
    await callOperationServiceWithTokenStatus('/b', 't');
    await callOperationServiceWithOptionalTokenStatus('/c', null);

    expect(spy).toHaveBeenCalledTimes(3);
    for (const call of spy.mock.calls) expect(call).toEqual([5_000]);
  });

  it('answers 504 GATEWAY_TIMEOUT when the upstream stalls', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callOperationService('/alerts', { method: 'GET' });
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({
      name: 'OperationServiceError',
      status: 504,
      body: { error: 'Gateway timeout', code: 'GATEWAY_TIMEOUT' },
    });
    await expect(pending).rejects.toBeInstanceOf(OperationServiceError);
  });

  it('answers 504 when the timeout fires while the body is still streaming', async () => {
    const { controller } = controllableTimeout();
    const response = {
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(controller.signal.reason)
          );
        }),
    };
    mockFetch.mockResolvedValue(response);

    const pending = callOperationService('/alerts', { method: 'GET' });
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    // Not an empty `{}` returned as a success.
    await expect(pending).rejects.toMatchObject({
      status: 504,
      body: { code: 'GATEWAY_TIMEOUT' },
    });
  });

  it('keeps an upstream error status as it is (no timeout involved)', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Not Found' }, 404));

    await expect(
      callOperationService('/alerts/1', { method: 'GET' })
    ).rejects.toMatchObject({ status: 404, body: { error: 'Not Found' } });
  });

  it('keeps a non-JSON success body as {} (unchanged behaviour)', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(new Response('<html>', { status: 200 }));

    await expect(
      callOperationService('/x', { method: 'GET' })
    ).resolves.toEqual({});
  });

  it('rethrows a network failure that is not a timeout', async () => {
    controllableTimeout();
    const boom = new TypeError('fetch failed');
    mockFetch.mockRejectedValue(boom);

    await expect(callOperationService('/x', { method: 'GET' })).rejects.toBe(
      boom
    );
  });

  it('lets a caller-supplied signal abort the call, and rethrows its abort untouched', async () => {
    controllableTimeout();
    stalledFetch();
    const caller = new AbortController();

    const pending = callOperationService('/x', {
      method: 'GET',
      signal: caller.signal,
    });
    const reason = new Error('caller gave up');
    caller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  it('still sends the same URL, headers and no-store cache', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({}));

    await callOperationServiceWithTokenStatus('/alerts', 'tok', {
      method: 'GET',
      headers: { 'x-correlation-id': 'c1' },
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/alerts');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-correlation-id': 'c1',
      Authorization: 'Bearer tok',
    });
  });
});

describe('write timeout (POST / PUT / PATCH / DELETE)', () => {
  it('is 15 seconds', () => {
    expect(WRITE_TIMEOUT_MS).toBe(15_000);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])(
    'bounds a %s call with a 15 s signal, not the 5 s read one',
    async (method) => {
      const { controller, spy } = controllableTimeout();
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      await callOperationService('/alerts', { method, body: '{}' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(15_000);
      const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBe(controller.signal);
    }
  );

  it('bounds the status-returning and optional-token writes too', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockImplementation(async () => jsonResponse({ ok: true }, 201));

    await callOperationServiceWithTokenStatus('/alerts', 't', {
      method: 'POST',
    });
    await callOperationServiceWithOptionalTokenStatus(
      '/user/2fa/verify',
      null,
      { method: 'POST' }
    );

    expect(spy.mock.calls).toEqual([[15_000], [15_000]]);
  });

  it('answers 504 GATEWAY_TIMEOUT when a write stalls', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callOperationService('/alerts', {
      method: 'POST',
      body: '{}',
    });
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({
      name: 'OperationServiceError',
      status: 504,
      body: { error: 'Gateway timeout', code: 'GATEWAY_TIMEOUT' },
    });
  });

  it('never retries a write that timed out: fetch is called exactly once', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callOperationService('/alerts', {
      method: 'POST',
      body: '{}',
    });
    controller.abort(new DOMException('timed out', 'TimeoutError'));
    await expect(pending).rejects.toMatchObject({ status: 504 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('never retries a write that failed upstream either', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Bad Gateway' }, 502));

    await expect(
      callOperationService('/alerts', { method: 'POST', body: '{}' })
    ).rejects.toMatchObject({ status: 502 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps an upstream 201 status on a write (no timeout involved)', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'a1' }, 201));

    await expect(
      callOperationServiceWithTokenStatus('/alerts', 't', { method: 'POST' })
    ).resolves.toEqual({ status: 201, body: { id: 'a1' } });
  });
});
