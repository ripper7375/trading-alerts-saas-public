/**
 * The gate's thread check, over the database (build step 7 part 7a; architecture 5.13 and 7.5,
 * plan decision D6 of step 6 superseded by the chat store of part 1).
 *
 * The gate asks one question of a request that names a thread: is it a thread of THIS trader,
 * for this symbol? The answer is yes or no and nothing else. A thread that does not exist, a
 * thread of another trader, a thread of another symbol and an id that is not even an id are the
 * same `{ ok: false }`, which the gate turns into `THREAD_INVALID`: existence is never leaked
 * (`getThread` puts the user id in the `where`, so another trader's thread is simply not found).
 * A request that names no thread passes: the first message of a conversation makes one.
 *
 * A database that cannot be read throws, and the gate turns that into `FEATURE_UNAVAILABLE`: a
 * failing store never lets a request through.
 *
 * @module lib/platform/chat/thread-port
 */

import 'server-only';

import { THREAD_ID } from '@/lib/reply/contracts/intake';
import type { ThreadPort } from '@/lib/reply/contracts/intake';

import { getThread } from './threads-store';
import type { ThreadStoreOptions } from './threads-store';

export function createThreadPort(options: ThreadStoreOptions = {}): ThreadPort {
  return {
    async check({ userId, threadId, symbol }) {
      if (threadId === null) return { ok: true, threadId: null };
      if (!THREAD_ID.test(threadId)) return { ok: false };
      const thread = await getThread(userId, threadId, options);
      return thread !== null && thread.symbol === symbol
        ? { ok: true, threadId }
        : { ok: false };
    },
  };
}
