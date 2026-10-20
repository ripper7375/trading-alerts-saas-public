/**
 * @jest-environment node
 */

/**
 * Keyed single-flight (lib/cache/single-flight.ts): what it shares, what it never keeps.
 *
 * Order: docs/migration-orders/adhoc-market-cache-single-flight.migration-order.md
 */
import { describe, it, expect } from '@jest/globals';

import { singleFlight } from '@/lib/cache/single-flight';

import { deferred, flushPromises } from '../../helpers/async-helpers';

describe('singleFlight', () => {
  it('runs the loader once for concurrent calls with the same key and gives every caller the same value', async () => {
    const gate = deferred<{ n: number }>();
    const load = jest.fn(() => gate.promise);

    const calls = [
      singleFlight('k', load),
      singleFlight('k', load),
      singleFlight('k', load),
    ];
    gate.resolve({ n: 1 });
    const results = await Promise.all(calls);

    expect(load).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ n: 1 });
    // shared by reference, as documented
    expect(results[1]).toBe(results[0]);
    expect(results[2]).toBe(results[0]);
  });

  it('runs different keys independently', async () => {
    const a = deferred<string>();
    const b = deferred<string>();
    const loadA = jest.fn(() => a.promise);
    const loadB = jest.fn(() => b.promise);

    const pa = singleFlight('a', loadA);
    const pb = singleFlight('b', loadB);
    b.resolve('B');
    a.resolve('A');

    await expect(pa).resolves.toBe('A');
    await expect(pb).resolves.toBe('B');
    expect(loadA).toHaveBeenCalledTimes(1);
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it('does not let a joiner start a second run while the first is still pending', async () => {
    const gate = deferred<string>();
    const load = jest.fn(() => gate.promise);

    const first = singleFlight('k', load);
    await flushPromises();
    const late = singleFlight('k', load);
    gate.resolve('x');

    await expect(Promise.all([first, late])).resolves.toEqual(['x', 'x']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('starts a new run for a call made after the previous run succeeded (nothing is kept)', async () => {
    const load = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    await expect(singleFlight('k', load)).resolves.toBe('first');
    await expect(singleFlight('k', load)).resolves.toBe('second');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('gives a rejection to every caller that joined the run, then frees the key', async () => {
    const gate = deferred<string>();
    const failing = jest.fn(() => gate.promise);

    const calls = [singleFlight('k', failing), singleFlight('k', failing)];
    const settled = Promise.allSettled(calls);
    gate.reject(new Error('db down'));
    const results = await settled;

    expect(failing).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect((results[0] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect((results[1] as PromiseRejectedResult).reason).toBe(
      (results[0] as PromiseRejectedResult).reason
    );

    // the key is free again: the next call runs its own loader
    const next = jest.fn(async () => 'ok');
    await expect(singleFlight('k', next)).resolves.toBe('ok');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('runs the loader again on a retry after a failure (a failure is never kept)', async () => {
    const load = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    await expect(singleFlight('k', load)).rejects.toThrow('boom');
    await expect(singleFlight('k', load)).resolves.toBe('recovered');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('turns a loader that throws synchronously into a rejection, and frees the key', async () => {
    const throwing = jest.fn((): Promise<string> => {
      throw new Error('sync boom');
    });

    await expect(singleFlight('k', throwing)).rejects.toThrow('sync boom');

    const ok = jest.fn(async () => 'fine');
    await expect(singleFlight('k', ok)).resolves.toBe('fine');
    expect(throwing).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('shares the next run again after a failed one (a failure leaves the key usable, not stuck)', async () => {
    const first = deferred<string>();
    const loadFirst = jest.fn(() => first.promise);
    const p1 = singleFlight('k', loadFirst);
    const p1Settled = p1.catch(() => 'failed');

    first.reject(new Error('first failed'));
    await p1Settled;

    // key is free: a new run starts and stays shared until it settles
    const second = deferred<string>();
    const loadSecond = jest.fn(() => second.promise);
    const p2 = singleFlight('k', loadSecond);
    const p3 = singleFlight('k', loadSecond);
    second.resolve('second');

    await expect(Promise.all([p2, p3])).resolves.toEqual(['second', 'second']);
    expect(loadSecond).toHaveBeenCalledTimes(1);
  });
});
