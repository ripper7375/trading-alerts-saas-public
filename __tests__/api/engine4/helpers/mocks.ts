/**
 * The edges of the route tests, in one place so every test file wires the same
 * ones. A test file declares its `jest.mock(...)` lines (they must sit in the file
 * to be hoisted) and each factory returns one of the module shapes below; the test
 * imports this file for the handles (`db`, `redis`, `world`, `calls`, `signIn`).
 *
 * What runs for real: the route files, the handlers, the engine, the validator, the
 * offer check, the badge, and the profile and consent STORES (against the in-memory
 * stand-in of part 5, which checks nothing the database checks). What is replaced:
 * the session, Redis, the user database, the gateway and the market-database readers.
 */

import type { Session } from 'next-auth';

import type { Tier } from '@/lib/tier-validation';

import { fakeClient, newDb } from '../../../lib/engine4/helpers/store-fake';
import { newFakeRedis } from './redis';
import { world } from './world';

export { world };

export const db = newDb();
export const client = fakeClient(db);
export const redis = newFakeRedis();

export const calls = {
  getSession: jest.fn(),
  gateway: jest.fn(),
  snapshot: jest.fn(),
  specs: jest.fn(),
  tier1: jest.fn(),
  calendar: jest.fn(),
  bars: jest.fn(),
  detail: jest.fn(),
  structure: jest.fn(),
};

export const USER_ID = 'user_pro_1';

export function signIn(tier: Tier | null | undefined, id = USER_ID): void {
  calls.getSession.mockImplementation(async () =>
    tier === undefined
      ? { user: { id } }
      : ({ user: { id, tier } } as unknown as Session)
  );
}

export function signOut(): void {
  calls.getSession.mockImplementation(async () => null);
}

/** Put every handle back to its starting point: nobody signed in, nothing stored, nothing called. */
export function resetAll(): void {
  for (const fn of Object.values(calls)) fn.mockReset();
  db.history.length = 0;
  db.prefs.clear();
  db.consents.length = 0;
  db.calls.length = 0;
  db.failUpsert = false;
  db.failConsentCreate = false;
  db.transactions = 0;
  redis.store.clear();
  redis.calls.length = 0;
  redis.down = false;
  world.reset();
  signOut();
  calls.gateway.mockImplementation(async () => world.gatewayBody());
  calls.snapshot.mockImplementation(
    async (request: { profile: string; pinnedSlot?: number }) =>
      world.snapshot(request)
  );
  calls.specs.mockImplementation(async () => world.specs());
  calls.tier1.mockImplementation(() => world.tier1());
  calls.calendar.mockImplementation(async () => world.calendar());
  calls.bars.mockImplementation(async () => world.bars());
  calls.detail.mockImplementation(async () => world.detail());
  calls.structure.mockImplementation(async () => world.structure());
}

// -- the module shapes the jest.mock factories return --------------------------------------

export const sessionModule = (): object => ({
  __esModule: true,
  getSession: () => calls.getSession(),
});
export const prismaModule = (): object => ({
  __esModule: true,
  prisma: client,
});
export const redisModule = (): object => ({
  __esModule: true,
  getRedisClient: () => redis,
});
export const gatewayModule = (): object => ({
  __esModule: true,
  fetchCurrentCycle: () => calls.gateway(),
});
export const cycleModule = (): object => ({
  __esModule: true,
  readOfferSnapshot: (request: unknown) => calls.snapshot(request),
});
export const specsModule = (): object => ({
  __esModule: true,
  readNewestBrokerFigures: (request: unknown) => calls.specs(request),
});
export const eventsModule = (): object => ({
  __esModule: true,
  loadTier1List: () => calls.tier1(),
  readCalendar: (request: unknown) => calls.calendar(request),
});
export const barsModule = (): object => ({
  __esModule: true,
  readClosedM5Bars: (request: unknown) => calls.bars(request),
});
export const synthesisModule = (): object => ({
  __esModule: true,
  readSynthesisDetail: (request: unknown) => calls.detail(request),
});
export const structureModule = (): object => ({
  __esModule: true,
  readStructureLevels: (request: unknown) => calls.structure(request),
});

/** A request to a route the way a browser sends it. */
export function post(
  url: string,
  body: unknown,
  headers: HeadersInit = {}
): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function get(url: string): Request {
  return new Request(`http://localhost${url}`, { method: 'GET' });
}
