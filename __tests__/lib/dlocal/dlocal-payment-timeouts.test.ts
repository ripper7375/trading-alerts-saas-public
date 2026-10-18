/**
 * @jest-environment node
 *
 * dLocal outbound timeouts (Next.js remediation T1-a / T1-a-writes):
 * getPaymentStatus 5 s, createPayment 15 s with no retry.
 *
 * A node environment because jsdom's AbortSignal has no `timeout()`; the
 * service only ever runs on the server. `AbortSignal.timeout` is replaced by a
 * controllable signal so the duration it was asked for is asserted exactly and
 * no real timer is waited for.
 */

const ORIGINAL_ENV = process.env;
const realFetch = global.fetch;

jest.mock('@/lib/idempotency/idempotency-guard', () => ({
  acquireIdempotencyLock: jest.fn(),
}));

function liveEnv(): void {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'production',
    DLOCAL_API_KEY: 'test-api-key',
    DLOCAL_LOGIN: 'test-login',
    DLOCAL_SECRET_KEY: 'test-secret',
  };
}

/** A fetch that never answers on its own and rejects with the signal's reason when aborted, as undici does. */
function stalledFetch() {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason)
        );
      })
  );
}

function load() {
  jest.resetModules();
  return require('@/lib/dlocal/dlocal-payment.service');
}

const PAYMENT = {
  userId: 'user-1',
  amount: 29.0,
  currency: 'THB',
  country: 'TH',
  paymentMethod: 'TrueMoney',
  planType: 'MONTHLY',
};

beforeEach(() => {
  liveEnv();
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = ORIGINAL_ENV;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('getPaymentStatus (read): 5 s', () => {
  it('bounds the GET with a 5 second AbortSignal', async () => {
    const signal = new AbortController().signal;
    const spy = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pay-1', status: 'PAID' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getPaymentStatus } = load();
    const status = await getPaymentStatus('pay-1');

    expect(status.status).toBe('PAID');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(5_000);
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });

  it('rejects when the timeout fires, instead of hanging', async () => {
    const controller = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    global.fetch = stalledFetch() as unknown as typeof fetch;

    const { getPaymentStatus } = load();
    const pending = getPaymentStatus('pay-2');
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('createPayment (write): 15 s, never retried', () => {
  it('bounds the POST with a 15 second AbortSignal', async () => {
    const signal = new AbortController().signal;
    const spy = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dl-1', redirect_url: 'https://pay.example/1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createPayment } = load();
    await createPayment(PAYMENT);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(15_000);
    expect(fetchMock.mock.calls[0][1].signal).toBe(signal);
  });

  it('rejects with the timeout when dLocal stalls, after one fetch only', async () => {
    const controller = new AbortController();
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetchMock = stalledFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createPayment } = load();
    const pending = createPayment(PAYMENT);
    // createPayment reaches fetch after its own awaits; let it get there.
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort(new DOMException('timed out', 'TimeoutError'));

    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not use the 5 s read budget for the write', async () => {
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(new AbortController().signal);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dl-2' }),
    }) as unknown as typeof fetch;

    const { createPayment } = load();
    await createPayment(PAYMENT);

    expect(spy).not.toHaveBeenCalledWith(5_000);
  });
});
