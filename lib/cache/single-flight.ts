/**
 * Keyed single-flight: callers that ask for the same key while a run of `load`
 * for that key is still pending share that one run instead of starting their own.
 *
 * Built for the market cache-aside routes (get cache -> on a miss read Postgres
 * -> set cache). Without it, K requests that all miss the same key before any
 * of them has written it each run the same query. With it, one request per key
 * per warm process does the work and the others await its result.
 *
 * What this is NOT:
 * - Not a cache: the entry exists only while the run is pending and is removed
 *   the moment it settles, so it adds no freshness delay and no lifetime.
 * - Not a lock across processes: two server instances still each run `load`.
 * - Not negative caching: a rejection reaches every caller that joined that
 *   run, the key is freed, and the next call starts a fresh run.
 *
 * The result is shared by reference, so callers must treat it as read-only.
 * `load` must not close over a request, a session or an abort signal: the run
 * is shared, so one caller going away must not cancel work another caller needs.
 *
 * @module lib/cache/single-flight
 */

const inFlight = new Map<string, Promise<unknown>>();

export function singleFlight<T>(
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  // `async () => load()` turns a synchronous throw from `load` into a rejection.
  const request: Promise<T> = (async () => load())().finally(() => {
    // Remove only our own entry (the guard lib/world-gold/fx.ts uses too). While
    // an entry exists no other run can replace it, so this is defensive.
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
}
