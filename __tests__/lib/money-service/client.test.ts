/**
 * @jest-environment node
 *
 * money-service transport timeouts (Next.js remediation T1-a / T1-a-writes).
 *
 * Reads (GET/HEAD) are bounded to 5 s, writes to 15 s and never retried. A timeout is reported as
 * MoneyServiceError(504, GATEWAY_TIMEOUT). `AbortSignal.timeout` is replaced
 * by a controllable signal so the 5 s is neither waited for nor assumed.
 */

import {
  callMoneyService,
  callMoneyServiceWithToken,
  MoneyServiceError,
  READ_TIMEOUT_MS,
  WRITE_TIMEOUT_MS,
} from '@/lib/money-service/client';

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

      await callMoneyService('/v1/admin/analytics', { method });

      expect(spy).toHaveBeenCalledWith(5_000);
      const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBe(controller.signal);
    }
  );

  it('treats a call with no method as a GET', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await callMoneyService('/v1/admin/analytics');

    expect(spy).toHaveBeenCalledWith(5_000);
  });

  it('bounds the token-carrying variant too', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await callMoneyServiceWithToken('/v1/wise/recipients/me', 'tok');

    expect(spy).toHaveBeenCalledWith(5_000);
  });

  it('answers 504 GATEWAY_TIMEOUT when the upstream stalls', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callMoneyService('/v1/admin/analytics', { method: 'GET' });
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({
      name: 'MoneyServiceError',
      status: 504,
      body: { error: 'Gateway timeout', code: 'GATEWAY_TIMEOUT' },
    });
    await expect(pending).rejects.toBeInstanceOf(MoneyServiceError);
  });

  it('answers 504 when the timeout fires while the body is still streaming', async () => {
    const { controller } = controllableTimeout();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(controller.signal.reason)
          );
        }),
    });

    const pending = callMoneyService('/v1/admin/analytics', { method: 'GET' });
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
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));

    await expect(
      callMoneyService('/v1/admin/analytics', { method: 'GET' })
    ).rejects.toMatchObject({ status: 403, body: { error: 'Forbidden' } });
  });

  it('rethrows a network failure that is not a timeout', async () => {
    controllableTimeout();
    const boom = new TypeError('fetch failed');
    mockFetch.mockRejectedValue(boom);

    await expect(
      callMoneyService('/v1/admin/analytics', { method: 'GET' })
    ).rejects.toBe(boom);
  });

  it('lets a caller-supplied signal abort the call, and rethrows its abort untouched', async () => {
    controllableTimeout();
    stalledFetch();
    const caller = new AbortController();

    const pending = callMoneyService('/v1/admin/analytics', {
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

    await callMoneyServiceWithToken('/v1/admin/analytics', 'tok', {
      method: 'GET',
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3002/v1/admin/analytics');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
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

      await callMoneyService('/v1/disbursement/pay', { method, body: '{}' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(15_000);
      const init = mockFetch.mock.calls[0]?.[1] as RequestInit;
      expect(init.signal).toBe(controller.signal);
    }
  );

  it('bounds the token-carrying write too', async () => {
    const { spy } = controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await callMoneyServiceWithToken('/v1/disbursement/pay', 't', {
      method: 'POST',
    });

    expect(spy.mock.calls).toEqual([[15_000]]);
  });

  it('answers 504 GATEWAY_TIMEOUT when a write stalls', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callMoneyService('/v1/disbursement/pay', {
      method: 'POST',
      body: '{}',
    });
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({
      name: 'MoneyServiceError',
      status: 504,
      body: { error: 'Gateway timeout', code: 'GATEWAY_TIMEOUT' },
    });
  });

  it('never retries a write that timed out: fetch is called exactly once', async () => {
    const { controller } = controllableTimeout();
    stalledFetch();

    const pending = callMoneyService('/v1/disbursement/pay', {
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
      callMoneyService('/v1/disbursement/pay', { method: 'POST', body: '{}' })
    ).rejects.toMatchObject({ status: 502 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns the body of a successful write (no timeout involved)', async () => {
    controllableTimeout();
    mockFetch.mockResolvedValue(jsonResponse({ id: 'b1' }));

    await expect(
      callMoneyServiceWithToken('/v1/subscription/cancel', 't', {
        method: 'POST',
      })
    ).resolves.toEqual({ id: 'b1' });
  });
});
