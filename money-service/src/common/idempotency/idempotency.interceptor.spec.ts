import {
  ConflictException,
  CallHandler,
  ExecutionContext,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor';
import {
  IDEMPOTENCY_CLAIM_LEASE_SECONDS,
  IDEMPOTENCY_TTL_SECONDS,
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency.store';

interface FakeResponse {
  statusCode: number;
  status: jest.Mock;
}

interface ContextOptions {
  /** `null` = an unauthenticated request (no `request.user`). */
  userId?: string | null;
  body?: unknown;
}

function buildContext(
  headers: Record<string, string>,
  statusCode = 200,
  { userId = 'user-1', body = { plan: 'monthly' } }: ContextOptions = {}
): { context: ExecutionContext; response: FakeResponse } {
  const response: FakeResponse = {
    statusCode,
    status: jest.fn().mockReturnThis(),
  };
  const request = {
    method: 'POST',
    originalUrl: '/v1/test',
    headers,
    body,
    ...(userId === null ? {} : { user: { id: userId } }),
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response };
}

function buildCallHandler<T>(observable: Observable<T>): CallHandler {
  return { handle: () => observable };
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

describe('IdempotencyInterceptor', () => {
  let store: jest.Mocked<IdempotencyStore>;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    store = {
      get: jest.fn(),
      claim: jest.fn(),
      save: jest.fn(),
      release: jest.fn(),
    } as unknown as jest.Mocked<IdempotencyStore>;
    interceptor = new IdempotencyInterceptor(store);
  });

  it('passes through untouched when no Idempotency-Key header is present', async () => {
    const { context } = buildContext({});
    const handler = buildCallHandler(of({ ok: true }));
    const handleSpy = jest.spyOn(handler, 'handle');

    const result = await interceptor.intercept(context, handler);
    const emitted = await new Promise((resolve) => result.subscribe(resolve));

    expect(emitted).toEqual({ ok: true });
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(store.get).not.toHaveBeenCalled();
  });

  it('executes and caches the response, with the body hash, on a first-time key', async () => {
    store.get.mockResolvedValue(null);
    store.claim.mockResolvedValue(true);
    store.save.mockResolvedValue(undefined);
    const { context } = buildContext({ 'idempotency-key': 'key-1' }, 201);
    const handler = buildCallHandler(of({ id: 'abc' }));

    const result = await interceptor.intercept(context, handler);
    await new Promise((resolve) => result.subscribe(resolve));

    expect(store.claim).toHaveBeenCalledWith(
      'user-1:POST:/v1/test:key-1',
      expect.any(Number)
    );
    expect(store.save).toHaveBeenCalledWith(
      'user-1:POST:/v1/test:key-1',
      {
        statusCode: 201,
        body: { id: 'abc' },
        bodyHash: expect.stringMatching(SHA256_HEX),
      },
      IDEMPOTENCY_TTL_SECONDS
    );
  });

  it('returns the cached response without invoking the handler on a duplicate key', async () => {
    store.get.mockResolvedValue({ statusCode: 201, body: { id: 'abc' } });
    const { context, response } = buildContext({
      'idempotency-key': 'key-1',
    });
    const handler = buildCallHandler(of({ id: 'should-not-run' }));
    const handleSpy = jest.spyOn(handler, 'handle');

    const result = await interceptor.intercept(context, handler);
    const emitted = await new Promise((resolve) => result.subscribe(resolve));

    expect(emitted).toEqual({ id: 'abc' });
    expect(handleSpy).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('throws ConflictException when a duplicate request is still in flight', async () => {
    store.get.mockResolvedValue('IN_PROGRESS');
    const { context } = buildContext({ 'idempotency-key': 'key-1' });
    const handler = buildCallHandler(of({}));

    await expect(interceptor.intercept(context, handler)).rejects.toThrow(
      ConflictException
    );
  });

  it('throws ConflictException when claim() loses the race', async () => {
    store.get.mockResolvedValue(null);
    store.claim.mockResolvedValue(false);
    const { context } = buildContext({ 'idempotency-key': 'key-1' });
    const handler = buildCallHandler(of({}));

    await expect(interceptor.intercept(context, handler)).rejects.toThrow(
      ConflictException
    );
  });

  it('releases the claim without caching when the handler errors', async () => {
    store.get.mockResolvedValue(null);
    store.claim.mockResolvedValue(true);
    store.release.mockResolvedValue(undefined);
    const { context } = buildContext({ 'idempotency-key': 'key-1' });
    const handler = buildCallHandler(throwError(() => new Error('boom')));

    const result = await interceptor.intercept(context, handler);
    await expect(
      new Promise((_resolve, reject) => result.subscribe({ error: reject }))
    ).rejects.toThrow('boom');

    expect(store.save).not.toHaveBeenCalled();
    expect(store.release).toHaveBeenCalledWith('user-1:POST:/v1/test:key-1');
  });

  it('fails open (proceeds uncached) when the store errors on read', async () => {
    store.get.mockRejectedValue(new Error('redis down'));
    const { context } = buildContext({ 'idempotency-key': 'key-1' });
    const handler = buildCallHandler(of({ ok: true }));

    const result = await interceptor.intercept(context, handler);
    const emitted = await new Promise((resolve) => result.subscribe(resolve));

    expect(emitted).toEqual({ ok: true });
  });

  it('fails open (proceeds uncached) when claim() errors', async () => {
    store.get.mockResolvedValue(null);
    store.claim.mockRejectedValue(new Error('redis down'));
    const { context } = buildContext({ 'idempotency-key': 'key-1' });
    const handler = buildCallHandler(of({ ok: true }));

    const result = await interceptor.intercept(context, handler);
    const emitted = await new Promise((resolve) => result.subscribe(resolve));

    expect(emitted).toEqual({ ok: true });
  });

  describe('scoped by user (Remediation Tier 2 §6.8)', () => {
    it("puts the user's id in the cache key", async () => {
      store.get.mockResolvedValue(null);
      store.claim.mockResolvedValue(true);
      store.save.mockResolvedValue(undefined);

      for (const userId of ['user-A', 'user-B']) {
        const { context } = buildContext(
          { 'idempotency-key': 'same-key' },
          200,
          { userId }
        );
        await interceptor.intercept(context, buildCallHandler(of({})));
      }

      expect(store.claim.mock.calls.map((c) => c[0])).toEqual([
        'user-A:POST:/v1/test:same-key',
        'user-B:POST:/v1/test:same-key',
      ]);
    });

    it('falls back to "anonymous" for a request without a user, rather than failing', async () => {
      store.get.mockResolvedValue(null);
      store.claim.mockResolvedValue(true);
      const { context } = buildContext({ 'idempotency-key': 'k' }, 200, {
        userId: null,
      });

      await interceptor.intercept(context, buildCallHandler(of({})));

      expect(store.claim).toHaveBeenCalledWith(
        'anonymous:POST:/v1/test:k',
        expect.any(Number)
      );
    });

    it("never hands user A's cached response to user B who sends the same key to the same route", async () => {
      // A store that behaves like Redis: one map, claim = SET NX.
      const records = new Map<string, IdempotencyRecord | 'IN_PROGRESS'>();
      const memory = {
        get: jest.fn(async (key: string) => records.get(key) ?? null),
        claim: jest.fn(async (key: string) => {
          if (records.has(key)) return false;
          records.set(key, 'IN_PROGRESS');
          return true;
        }),
        save: jest.fn(async (key: string, record: IdempotencyRecord) => {
          records.set(key, record);
        }),
        release: jest.fn(async (key: string) => {
          records.delete(key);
        }),
      } as unknown as IdempotencyStore;
      const shared = new IdempotencyInterceptor(memory);
      const headers = { 'idempotency-key': 'guessed-or-shared-key' };

      const a = buildContext(headers, 200, { userId: 'user-A' });
      const aOut = await shared.intercept(
        a.context,
        buildCallHandler(of({ checkoutUrl: 'https://pay.example/A' }))
      );
      await new Promise((resolve) => aOut.subscribe(resolve));
      await new Promise((resolve) => setImmediate(resolve)); // let save() land

      const bHandler = buildCallHandler(
        of({ checkoutUrl: 'https://pay.example/B' })
      );
      const bSpy = jest.spyOn(bHandler, 'handle');
      const b = buildContext(headers, 200, { userId: 'user-B' });
      const bOut = await shared.intercept(b.context, bHandler);
      const bBody = await new Promise((resolve) => bOut.subscribe(resolve));

      expect(bSpy).toHaveBeenCalledTimes(1); // B's own request ran
      expect(bBody).toEqual({ checkoutUrl: 'https://pay.example/B' });
      expect(JSON.stringify(bBody)).not.toContain('/A');
    });
  });

  describe('the body must match on a replay (Remediation Tier 2 §6.8)', () => {
    async function hashStoredFor(body: unknown): Promise<string> {
      const fresh = {
        get: jest.fn().mockResolvedValue(null),
        claim: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
      } as unknown as jest.Mocked<IdempotencyStore>;
      const { context } = buildContext({ 'idempotency-key': 'k' }, 200, {
        body,
      });
      const out = await new IdempotencyInterceptor(fresh).intercept(
        context,
        buildCallHandler(of({}))
      );
      await new Promise((resolve) => out.subscribe(resolve));
      return (fresh.save.mock.calls[0]?.[1] as IdempotencyRecord)
        .bodyHash as string;
    }

    it('refuses with 422, and does not run the handler, when the key is reused with a different body', async () => {
      const original = await hashStoredFor({ plan: 'monthly' });
      store.get.mockResolvedValue({
        statusCode: 200,
        body: { sessionId: 'cs_1' },
        bodyHash: original,
      });
      const { context } = buildContext({ 'idempotency-key': 'k' }, 200, {
        body: { plan: 'yearly' },
      });
      const handler = buildCallHandler(of({ sessionId: 'cs_2' }));
      const handleSpy = jest.spyOn(handler, 'handle');

      await expect(interceptor.intercept(context, handler)).rejects.toThrow(
        UnprocessableEntityException
      );
      expect(handleSpy).not.toHaveBeenCalled();
      expect(store.claim).not.toHaveBeenCalled();
    });

    it('replays the cached response for the same body', async () => {
      const original = await hashStoredFor({ plan: 'monthly' });
      store.get.mockResolvedValue({
        statusCode: 200,
        body: { sessionId: 'cs_1' },
        bodyHash: original,
      });
      const { context } = buildContext({ 'idempotency-key': 'k' }, 200, {
        body: { plan: 'monthly' },
      });

      const out = await interceptor.intercept(
        context,
        buildCallHandler(of({ sessionId: 'never' }))
      );
      const emitted = await new Promise((resolve) => out.subscribe(resolve));

      expect(emitted).toEqual({ sessionId: 'cs_1' });
    });

    it('hashes the same whatever order the body keys arrive in', async () => {
      const one = await hashStoredFor({
        a: 1,
        b: { c: 2, d: [3, { e: 4, f: 5 }] },
      });
      const two = await hashStoredFor({
        b: { d: [3, { f: 5, e: 4 }], c: 2 },
        a: 1,
      });

      expect(one).toMatch(SHA256_HEX);
      expect(two).toBe(one);
    });

    it('hashes different bodies differently, including an absent body', async () => {
      const hashes = await Promise.all([
        hashStoredFor({ plan: 'monthly' }),
        hashStoredFor({ plan: 'yearly' }),
        hashStoredFor({ plan: 'monthly', affiliateCode: 'AFF10' }),
        hashStoredFor(null), // no body at all
        hashStoredFor({}),
      ]);

      // all five are different requests; a null body is not an empty object
      expect(new Set(hashes).size).toBe(hashes.length);
    });

    it('still replays a record written before bodyHash existed (no hash = no check)', async () => {
      store.get.mockResolvedValue({ statusCode: 200, body: { old: true } });
      const { context } = buildContext({ 'idempotency-key': 'k' }, 200, {
        body: { anything: 'goes' },
      });

      const out = await interceptor.intercept(
        context,
        buildCallHandler(of({ old: false }))
      );
      const emitted = await new Promise((resolve) => out.subscribe(resolve));

      expect(emitted).toEqual({ old: true });
    });
  });

  describe('a short claim lease (Remediation Tier 2 §6.8)', () => {
    it('holds the in-flight claim for 60 seconds, not 24 hours', async () => {
      store.get.mockResolvedValue(null);
      store.claim.mockResolvedValue(true);
      const { context } = buildContext({ 'idempotency-key': 'k' });

      await interceptor.intercept(context, buildCallHandler(of({})));

      expect(IDEMPOTENCY_CLAIM_LEASE_SECONDS).toBe(60);
      expect(store.claim).toHaveBeenCalledWith(
        expect.any(String),
        IDEMPOTENCY_CLAIM_LEASE_SECONDS
      );
      expect(IDEMPOTENCY_CLAIM_LEASE_SECONDS).toBeLessThan(
        IDEMPOTENCY_TTL_SECONDS
      );
    });

    it('still keeps a FINISHED response for 24 hours', async () => {
      store.get.mockResolvedValue(null);
      store.claim.mockResolvedValue(true);
      store.save.mockResolvedValue(undefined);
      const { context } = buildContext({ 'idempotency-key': 'k' });

      const out = await interceptor.intercept(
        context,
        buildCallHandler(of({ ok: true }))
      );
      await new Promise((resolve) => out.subscribe(resolve));

      expect(store.save).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        24 * 60 * 60
      );
    });
  });
});
