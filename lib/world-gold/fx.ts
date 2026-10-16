/** Dedicated fiat-only contract. Never alters payment/subscription FX or stores raw data beyond eight hours. */
import { logger } from '@/lib/logger';
import {
  parseFxTimestamp,
  CURRENCYBEACON_RATES_URL,
} from '@/lib/fx/rate-providers';
import { getRedisClient } from '@/lib/redis/client';
import { WORLD_GOLD_CURRENCIES, type WorldGoldCurrency } from './catalog';
import type { WorldGoldFx } from './types';

export const RAW_RETENTION_MS = 8 * 60 * 60 * 1000;
export const FX_REFRESH_MS = 60 * 60 * 1000;
export const FX_STALE_MS = 65 * 60 * 1000;
const PREFIX = 'world-gold:fx:v1';
const LATEST_KEY = `${PREFIX}:latest`;
const HISTORY_KEY = `${PREFIX}:observations`;
const LOCK_KEY = `${PREFIX}:refresh`;
export interface WorldGoldRedis {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: 'EXAT',
    seconds: number
  ): Promise<unknown>;
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
    condition: 'NX'
  ): Promise<unknown>;
  zadd(key: string, score: number, value: string): Promise<unknown>;
  zrevrangebyscore(
    key: string,
    max: number,
    min: string,
    limit: 'LIMIT',
    offset: number,
    count: number
  ): Promise<string[]>;
  zremrangebyscore(key: string, min: string, max: number): Promise<unknown>;
  expireat(key: string, seconds: number): Promise<unknown>;
}
let cache: WorldGoldFx | null = null;
let inflight: Promise<WorldGoldFx | null> | null = null;
let retryAfter = 0;
let cacheTimer: ReturnType<typeof setTimeout> | undefined;
let cacheRevision = 0;
let cacheGeneration = 0;
let retentionClockMs = 0;
let retentionClockTick = performance.now();

// Wall-clock rollback cannot give an already retained observation a new lifetime.
function retentionNow(now: Date): Date {
  const tick = performance.now();
  retentionClockMs = Math.max(
    now.getTime(),
    retentionClockMs + Math.max(0, tick - retentionClockTick)
  );
  retentionClockTick = tick;
  return new Date(retentionClockMs);
}
function eraseCache(): void {
  cache = null;
  clearTimeout(cacheTimer);
  cacheTimer = undefined;
  cacheRevision++;
}
function retainedCache(now: Date): WorldGoldFx | null {
  const retentionTime = retentionNow(now);
  if (cache && (!validFx(cache, now) || !validFx(cache, retentionTime)))
    eraseCache();
  return cache;
}
function retainCache(
  snapshot: WorldGoldFx,
  now: Date,
  generation: number
): boolean {
  const retentionTime = retentionNow(now);
  if (
    generation !== cacheGeneration ||
    !validFx(snapshot, now) ||
    !validFx(snapshot, retentionTime)
  )
    return false;
  eraseCache();
  cache = snapshot;
  const deadline =
    Math.min(Date.parse(snapshot.updatedAt), Date.parse(snapshot.observedAt)) +
    RAW_RETENTION_MS;
  const revision = cacheRevision;
  // Capture only the deadline and revision, never the raw observation, in the timer.
  cacheTimer = setTimeout(
    () => {
      if (revision !== cacheRevision) return;
      retentionClockMs = Math.max(retentionClockMs, deadline);
      retentionClockTick = performance.now();
      eraseCache();
    },
    Math.max(0, deadline - retentionTime.getTime())
  );
  cacheTimer.unref?.();
  return true;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function ratesFrom(value: unknown): Record<WorldGoldCurrency, number> | null {
  const input = object(value);
  if (!input) return null;
  const result = {} as Record<WorldGoldCurrency, number>;
  for (const code of WORLD_GOLD_CURRENCIES) {
    const rate = input[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0)
      return null;
    result[code] = rate;
  }
  return result;
}
export function validFx(snapshot: WorldGoldFx, now: Date): boolean {
  const published = parseFxTimestamp(snapshot.updatedAt);
  const observed = parseFxTimestamp(snapshot.observedAt);
  const expires = parseFxTimestamp(snapshot.expiresAt);
  return (
    snapshot.provider === 'currencybeacon' &&
    ratesFrom(snapshot.rates) !== null &&
    published !== null &&
    observed !== null &&
    expires !== null &&
    published <= observed &&
    observed <= now.getTime() &&
    now.getTime() - published < RAW_RETENTION_MS &&
    now.getTime() - observed < RAW_RETENTION_MS &&
    expires > observed &&
    expires <= Math.min(observed + FX_REFRESH_MS, published + RAW_RETENTION_MS)
  );
}
export function parseStoredFx(
  raw: string | null,
  now: Date
): WorldGoldFx | null {
  if (!raw) return null;
  try {
    const parsed = object(JSON.parse(raw));
    if (!parsed) return null;
    const result: WorldGoldFx = {
      provider: parsed['provider'] as 'currencybeacon',
      rates: ratesFrom(parsed['rates']) as Record<WorldGoldCurrency, number>,
      updatedAt: parsed['updatedAt'] as string,
      observedAt: parsed['observedAt'] as string,
      expiresAt: parsed['expiresAt'] as string,
    };
    return validFx(result, now) ? result : null;
  } catch {
    return null;
  }
}
export function parseWorldGoldProvider(
  data: unknown,
  observedAt: Date
): WorldGoldFx | null {
  const envelope = object(data);
  const meta = object(envelope?.['meta']);
  const response = object(envelope?.['response']);
  if ((meta && meta['code'] !== 200) || response?.['base'] !== 'USD')
    return null;
  const inputRates = object(response['rates']);
  if (
    !inputRates ||
    (inputRates['USD'] !== undefined && inputRates['USD'] !== 1)
  )
    return null;
  const rates = ratesFrom(inputRates);
  const timestamp = response['timestamp'];
  const epochMs = typeof timestamp === 'number' ? timestamp * 1000 : NaN;
  const value =
    response['date'] !== undefined
      ? response['date']
      : Number.isFinite(epochMs) && epochMs > 0 && epochMs <= 8.64e15
        ? new Date(epochMs).toISOString()
        : null;
  const published = parseFxTimestamp(value);
  if (!rates || published === null) return null;
  const result: WorldGoldFx = {
    provider: 'currencybeacon',
    rates,
    updatedAt: new Date(published).toISOString(),
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(
      Math.min(
        observedAt.getTime() + FX_REFRESH_MS,
        published + RAW_RETENTION_MS
      )
    ).toISOString(),
  };
  return validFx(result, observedAt) ? result : null;
}
async function bounded<T>(promise: Promise<T>, milliseconds = 600): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('World gold store timeout')),
          milliseconds
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function redisClient(): WorldGoldRedis | null {
  return process.env['REDIS_URL'] ? getRedisClient() : null;
}
export async function publishFx(
  snapshot: WorldGoldFx,
  client: WorldGoldRedis,
  now: Date
): Promise<void> {
  if (!validFx(snapshot, now)) return;
  const retainUntil = Math.floor(
    Math.min(Date.parse(snapshot.updatedAt), Date.parse(snapshot.observedAt)) /
      1000 +
      RAW_RETENTION_MS / 1000
  );
  const key = `${PREFIX}:observation:${Date.parse(snapshot.observedAt)}`;
  // EXAT is absolute: retries and reads never extend the raw-data retention deadline.
  await bounded(
    Promise.all([
      client.set(LATEST_KEY, JSON.stringify(snapshot), 'EXAT', retainUntil),
      client.set(key, JSON.stringify(snapshot), 'EXAT', retainUntil),
      client.zadd(HISTORY_KEY, Date.parse(snapshot.observedAt), key),
      client.zremrangebyscore(
        HISTORY_KEY,
        '-inf',
        now.getTime() - RAW_RETENTION_MS
      ),
      client.expireat(HISTORY_KEY, retainUntil),
    ])
  );
}
async function fetchProvider(key: string): Promise<WorldGoldFx | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const url = new URL(CURRENCYBEACON_RATES_URL);
  url.searchParams.set('base', 'USD');
  url.searchParams.set('symbols', WORLD_GOLD_CURRENCIES.join(','));
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${key}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const body: unknown = await response.json();
        return parseWorldGoldProvider(body, new Date());
      })(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, 3000);
      }),
    ]);
  } catch {
    logger.warn('[world-gold] CurrencyBeacon unavailable');
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function refreshFx(
  now: Date,
  generation: number
): Promise<WorldGoldFx | null> {
  const client = redisClient();
  if (client) {
    try {
      const stored = parseStoredFx(await bounded(client.get(LATEST_KEY)), now);
      if (generation !== cacheGeneration) return null;
      if (stored) retainCache(stored, now, generation);
    } catch {
      logger.warn('[world-gold] FX store read unavailable');
    }
  }
  if (generation !== cacheGeneration) return null;
  {
    const current = retainedCache(now);
    if (current && Date.parse(current.expiresAt) > now.getTime())
      return current;
  }
  // Resolve fallback lazily: provider/store waits must not retain an expired cache object.
  const fallback = (): WorldGoldFx | null =>
    generation === cacheGeneration
      ? retainedCache(new Date(Math.max(now.getTime(), Date.now())))
      : null;
  if (now.getTime() < retryAfter) return fallback();
  const apiKey = process.env['CURRENCYBEACON_API_KEY']?.trim();
  if (!apiKey) return fallback();
  if (client) {
    try {
      const claimed = await bounded(
        client.set(LOCK_KEY, 'refresh', 'EX', 15, 'NX')
      );
      if (!claimed) return fallback();
    } catch {
      logger.warn('[world-gold] FX refresh lock unavailable');
    }
  }
  if (generation !== cacheGeneration) return null;
  const next = await fetchProvider(apiKey);
  if (generation !== cacheGeneration) return null;
  if (!next) {
    retryAfter = retentionNow(now).getTime() + 5 * 60 * 1000;
    return fallback();
  }
  if (!retainCache(next, new Date(), generation)) return fallback();
  retryAfter = 0;
  if (client) {
    try {
      await publishFx(next, client, new Date());
    } catch {
      logger.warn('[world-gold] FX observation store unavailable');
    }
  }
  return fallback();
}
export async function getWorldGoldFx(
  now = new Date()
): Promise<WorldGoldFx | null> {
  const current = retainedCache(now);
  if (current && Date.parse(current.expiresAt) > now.getTime()) return current;
  if (!inflight) {
    const request = refreshFx(now, cacheGeneration).finally(() => {
      if (inflight === request) inflight = null;
    });
    inflight = request;
  }
  return inflight;
}
export function fxQualifiesForClose(
  snapshot: WorldGoldFx,
  cutoff: Date,
  now: Date
): boolean {
  return (
    validFx(snapshot, now) &&
    Date.parse(snapshot.updatedAt) <= cutoff.getTime() &&
    Date.parse(snapshot.observedAt) <= cutoff.getTime() &&
    cutoff.getTime() - Date.parse(snapshot.updatedAt) <= FX_STALE_MS
  );
}
export async function getFxAtClose(
  cutoff: Date,
  now = new Date(),
  client: WorldGoldRedis | null = redisClient()
): Promise<WorldGoldFx | null> {
  const candidates: WorldGoldFx[] = [];
  const current = retainedCache(now);
  if (current && fxQualifiesForClose(current, cutoff, now))
    candidates.push(current);
  if (client) {
    try {
      const keys = await bounded(
        client.zrevrangebyscore(
          HISTORY_KEY,
          cutoff.getTime(),
          '-inf',
          'LIMIT',
          0,
          32
        )
      );
      const records = await bounded(
        Promise.all(keys.map((key) => client.get(key)))
      );
      for (const raw of records) {
        const snapshot = parseStoredFx(raw, now);
        if (snapshot && fxQualifiesForClose(snapshot, cutoff, now))
          candidates.push(snapshot);
      }
    } catch {
      logger.warn('[world-gold] Historical FX observations unavailable');
    }
  }
  candidates.sort(
    (a, b) =>
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      Date.parse(b.observedAt) - Date.parse(a.observedAt)
  );
  return (
    candidates.find((candidate) =>
      fxQualifiesForClose(candidate, cutoff, retentionNow(now))
    ) ?? null
  );
}
export function clearWorldGoldFxCache(): void {
  cacheGeneration++;
  eraseCache();
  inflight = null;
  retryAfter = 0;
  retentionClockMs = 0;
  retentionClockTick = performance.now();
}
