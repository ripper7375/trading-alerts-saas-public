import {
  ConflictException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyStore } from './idempotency.store';

interface FakeResponse {
  statusCode: number;
  status: jest.Mock;
}

function buildContext(
  headers: Record<string, string>,
  statusCode = 200
): { context: ExecutionContext; response: FakeResponse } {
  const response: FakeResponse = {
    statusCode,
    status: jest.fn().mockReturnThis(),
  };
  const request = { method: 'POST', originalUrl: '/v1/test', headers };
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

  it('executes and caches the response on a first-time key', async () => {
    store.get.mockResolvedValue(null);
    store.claim.mockResolvedValue(true);
    store.save.mockResolvedValue(undefined);
    const { context } = buildContext({ 'idempotency-key': 'key-1' }, 201);
    const handler = buildCallHandler(of({ id: 'abc' }));

    const result = await interceptor.intercept(context, handler);
    await new Promise((resolve) => result.subscribe(resolve));

    expect(store.claim).toHaveBeenCalledWith(
      'POST:/v1/test:key-1',
      expect.any(Number)
    );
    expect(store.save).toHaveBeenCalledWith(
      'POST:/v1/test:key-1',
      { statusCode: 201, body: { id: 'abc' } },
      expect.any(Number)
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
    expect(store.release).toHaveBeenCalledWith('POST:/v1/test:key-1');
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
});
