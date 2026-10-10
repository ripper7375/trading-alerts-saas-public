/**
 * An in-memory stand-in for the three Redis commands the submission guard uses
 * (`SET key value EX seconds [NX]`, `GET`, `DEL`). It models what the guard relies
 * on: `NX` sets only an absent key, and a key can be made to expire. It also has
 * one switch, `down`, that makes every call fail like an unreachable Redis.
 */

import type { RedisLike } from '@/lib/engine4/server/idempotency';

export interface FakeRedis extends RedisLike {
  store: Map<string, { value: string; ttl: number }>;
  /** every call, in order: `set NX key`, `set key`, `get key`, `del key` */
  calls: string[];
  /** every call fails */
  down: boolean;
  /** delete a key as if it had expired */
  expire(key: string): void;
}

export function newFakeRedis(): FakeRedis {
  const store = new Map<string, { value: string; ttl: number }>();
  const redis: FakeRedis = {
    store,
    calls: [],
    down: false,
    expire: (key) => {
      store.delete(key);
    },
    set: (async (
      key: string,
      value: string,
      mode: 'EX',
      seconds: number,
      condition?: 'NX'
    ) => {
      redis.calls.push(condition === 'NX' ? `set NX ${key}` : `set ${key}`);
      if (redis.down) throw new Error('Redis is down');
      // what the real server refuses: an unknown option, a time that is not a whole number above zero
      if (mode !== 'EX') throw new Error('ERR syntax error');
      if (!Number.isInteger(seconds) || seconds <= 0) {
        throw new Error('ERR invalid expire time in set');
      }
      if (condition !== undefined && condition !== 'NX') {
        throw new Error('ERR syntax error');
      }
      if (condition === 'NX' && store.has(key)) return null;
      store.set(key, { value, ttl: seconds });
      return 'OK';
    }) as RedisLike['set'],
    get: async (key) => {
      redis.calls.push(`get ${key}`);
      if (redis.down) throw new Error('Redis is down');
      const held = store.get(key);
      return held === undefined ? null : held.value;
    },
    del: async (key) => {
      redis.calls.push(`del ${key}`);
      if (redis.down) throw new Error('Redis is down');
      return store.delete(key) ? 1 : 0;
    },
  };
  return redis;
}
