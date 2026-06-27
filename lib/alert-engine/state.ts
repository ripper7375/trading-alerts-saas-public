/**
 * Alert engine state — previous price, cooldown and one-shot guards.
 *
 * Backed by Redis in production (survives restarts → no double-fires); an
 * in-memory implementation is provided for tests. The store is abstracted so
 * the evaluator never touches Redis directly.
 *
 * @module lib/alert-engine/state
 */

export interface AlertStateStore {
  getPrev(key: string): Promise<number | null>;
  setPrev(key: string, value: number): Promise<void>;
  isOnCooldown(key: string): Promise<boolean>;
  setCooldown(key: string, ttlSec: number): Promise<void>;
  isFired(key: string): Promise<boolean>;
  setFired(key: string): Promise<void>;
}

/** Minimal subset of the ioredis client the store needs. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, ttlSec: number, value: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  exists(key: string): Promise<number>;
}

const PREV_TTL_SEC = 7 * 24 * 60 * 60; // rolling 7 days

export function createRedisStateStore(redis: RedisLike): AlertStateStore {
  return {
    async getPrev(key) {
      const v = await redis.get(key);
      if (v === null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    },
    async setPrev(key, value) {
      await redis.setex(key, PREV_TTL_SEC, String(value));
    },
    async isOnCooldown(key) {
      return (await redis.exists(key)) > 0;
    },
    async setCooldown(key, ttlSec) {
      await redis.setex(key, Math.max(1, Math.floor(ttlSec)), '1');
    },
    async isFired(key) {
      return (await redis.exists(key)) > 0;
    },
    async setFired(key) {
      await redis.set(key, '1');
    },
  };
}

/** In-memory store for tests (no TTL expiry simulation). */
export function createMemoryStateStore(): AlertStateStore {
  const prev = new Map<string, number>();
  const cooldown = new Set<string>();
  const fired = new Set<string>();
  return {
    async getPrev(key) {
      return prev.has(key) ? (prev.get(key) as number) : null;
    },
    async setPrev(key, value) {
      prev.set(key, value);
    },
    async isOnCooldown(key) {
      return cooldown.has(key);
    },
    async setCooldown(key) {
      cooldown.add(key);
    },
    async isFired(key) {
      return fired.has(key);
    },
    async setFired(key) {
      fired.add(key);
    },
  };
}
