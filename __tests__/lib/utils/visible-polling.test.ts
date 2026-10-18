/**
 * startVisiblePolling — the shared loop of the client polling hooks.
 *
 * Fake timers drive the interval; `document.visibilityState` is replaced by a
 * getter the test flips (jsdom's is always 'visible').
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import {
  POLL_REQUEST_TIMEOUT_MS,
  startVisiblePolling,
  type PollRequest,
} from '@/lib/utils/visible-polling';

const INTERVAL_MS = 30_000;

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** A poll function whose requests stay open until the test settles them. */
function openPoll() {
  const requests: PollRequest[] = [];
  const settlers: Array<() => void> = [];
  const poll = jest.fn((request: PollRequest): Promise<void> => {
    requests.push(request);
    return new Promise<void>((resolve) => settlers.push(resolve));
  });
  const settle = async (index: number): Promise<void> => {
    settlers[index]?.();
    await jest.advanceTimersByTimeAsync(0);
  };
  return { poll, requests, settle };
}

/** A poll function that answers at once. */
function instantPoll() {
  return jest.fn(async (_request: PollRequest): Promise<void> => undefined);
}

describe('startVisiblePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (document as unknown as Record<string, unknown>)['visibilityState'];
  });

  describe('while the tab is visible', () => {
    it('polls once at once and then once per interval', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(3);
      stop();
    });

    it('does not poll again before the interval has passed', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      await jest.advanceTimersByTimeAsync(INTERVAL_MS - 1);
      expect(poll).toHaveBeenCalledTimes(1);
      stop();
    });
  });

  describe('while the tab is hidden', () => {
    it('sends nothing on a tick', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(1);

      visibility = 'hidden';
      await jest.advanceTimersByTimeAsync(INTERVAL_MS * 5);
      expect(poll).toHaveBeenCalledTimes(1);
      stop();
    });

    it('polls once, at once, when the tab becomes visible after a skipped tick', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);

      visibility = 'hidden';
      await jest.advanceTimersByTimeAsync(INTERVAL_MS * 5);
      expect(poll).toHaveBeenCalledTimes(1);

      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(2);

      // The catch-up is one request, not one per skipped tick, and it is not
      // repeated by a second visibility event.
      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(2);
      stop();
    });

    it('does not refresh on return when no tick was skipped', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);

      setVisibility('hidden');
      await jest.advanceTimersByTimeAsync(INTERVAL_MS - 1000);
      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);

      expect(poll).toHaveBeenCalledTimes(1);
      stop();
    });

    it('sends nothing when it starts hidden, and polls when the tab shows', async () => {
      visibility = 'hidden';
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      await jest.advanceTimersByTimeAsync(INTERVAL_MS * 2);
      expect(poll).not.toHaveBeenCalled();

      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(1);
      stop();
    });
  });

  describe('overlap', () => {
    it('drops a tick while a request is still in flight', async () => {
      const { poll, settle } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS, INTERVAL_MS * 10);

      await jest.advanceTimersByTimeAsync(INTERVAL_MS * 3);
      expect(poll).toHaveBeenCalledTimes(1);

      await settle(0);
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(2);
      stop();
    });

    it('does not start a second request when the tab returns during one', async () => {
      const { poll, settle } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS, INTERVAL_MS * 10);

      visibility = 'hidden';
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(1);

      await settle(0);
      stop();
    });
  });

  describe('a request that never answers', () => {
    it('is aborted after the request timeout, as a failure and not as a stop', async () => {
      const { poll, requests } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS, 5_000);

      expect(requests[0]?.signal.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(5_000);
      expect(requests[0]?.signal.aborted).toBe(true);
      expect(requests[0]?.isStopped()).toBe(false);

      // The fake call never returns, so the overlap guard still holds the
      // next tick back; the next test shows the loop freed once it does.
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(1);
      stop();
    });

    it('uses a 10 second timeout by default', async () => {
      expect(POLL_REQUEST_TIMEOUT_MS).toBe(10_000);
      const { poll, requests } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);

      await jest.advanceTimersByTimeAsync(POLL_REQUEST_TIMEOUT_MS - 1);
      expect(requests[0]?.signal.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(requests[0]?.signal.aborted).toBe(true);
      stop();
    });

    it('frees the loop once an aborted request settles', async () => {
      const { poll, requests, settle } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS, 5_000);

      await jest.advanceTimersByTimeAsync(5_000);
      expect(requests[0]?.signal.aborted).toBe(true);
      // A real fetch rejects on abort; the poll function returns.
      await settle(0);

      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      expect(poll).toHaveBeenCalledTimes(2);
      stop();
    });
  });

  describe('stopping', () => {
    it('aborts the request in flight and marks the poller stopped', async () => {
      const { poll, requests } = openPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);

      expect(requests[0]?.signal.aborted).toBe(false);
      expect(requests[0]?.isStopped()).toBe(false);
      stop();
      expect(requests[0]?.signal.aborted).toBe(true);
      expect(requests[0]?.isStopped()).toBe(true);
    });

    it('sends nothing after it', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      stop();

      await jest.advanceTimersByTimeAsync(INTERVAL_MS * 5);
      setVisibility('hidden');
      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);

      expect(poll).toHaveBeenCalledTimes(1);
    });

    it('removes its visibility listener', () => {
      const added = jest.spyOn(document, 'addEventListener');
      const removed = jest.spyOn(document, 'removeEventListener');
      const stop = startVisiblePolling(instantPoll(), INTERVAL_MS);
      const listener = added.mock.calls.find(
        ([type]) => type === 'visibilitychange'
      )?.[1];
      expect(listener).toBeDefined();

      stop();
      expect(removed).toHaveBeenCalledWith('visibilitychange', listener);
      added.mockRestore();
      removed.mockRestore();
    });

    it('does not start a new request when stopped while hidden and then shown', async () => {
      const poll = instantPoll();
      const stop = startVisiblePolling(poll, INTERVAL_MS);
      visibility = 'hidden';
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);
      stop();

      setVisibility('visible');
      await jest.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(1);
    });
  });

  describe('a poll function that throws', () => {
    it('does not end the loop and leaves no unhandled rejection', async () => {
      const poll = jest
        .fn<(request: PollRequest) => Promise<void>>()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(undefined);
      const unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      const stop = startVisiblePolling(poll, INTERVAL_MS);
      await jest.advanceTimersByTimeAsync(INTERVAL_MS);

      expect(poll).toHaveBeenCalledTimes(2);
      expect(unhandled).not.toHaveBeenCalled();
      process.off('unhandledRejection', unhandled);
      stop();
    });
  });
});
