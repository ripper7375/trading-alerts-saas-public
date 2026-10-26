/**
 * @jest-environment node
 */

/**
 * The root Redis client against a REAL redis-server (ad-hoc order
 * docs/migration-orders/adhoc-redis-background-recovery.migration-order.md, Unit R).
 *
 * `lib/redis/client.ts` used to give up reconnecting after ten failed attempts (the retry callback
 * returned `null`), which leaves ioredis in the terminal `end` state: every later command is rejected
 * at once with "Connection is closed" and the process never talks to Redis again. The callback now
 * returns a capped linear delay forever. What a mock cannot show, and this spec does: the SAME client
 * object reconnects by itself after the server comes back, the helpers that sit on it keep their
 * failure policy during the outage, and an outage costs each command at most `commandTimeout` (3 s).
 *
 * Cases
 *   T1 recovery        server down for more than 12 reconnect attempts, back on the same port: the same
 *                      client object answers PING, SET and GET; getRedisStatus() is `ready`
 *   T2 cold start      the first lazy command, issued while the server is still starting, succeeds
 *   T3 no reply        CLIENT PAUSE: the command rejects after about 3 s; the paused write is applied later
 *   T4 intentional     after disconnectRedis() there are no reconnect attempts; the next getter builds a new client
 *   T5 outage latency  every helper (and each route's Redis calls in order) timed in the reconnecting state
 *                      past attempt 11, with the REAL delays and the REAL command timeout
 *   T6 policy kept     during the outage and after recovery (claim and expiry times read back from real keys)
 *
 * Timing. A `jest.mock('ioredis')` shim wraps the REAL `retryStrategy` the module passes in and divides only
 * the delay it returns (by `mockState.divisor`). It never replaces the callback: a reinstated cutoff still
 * returns `null` through the wrapper. T1, T3, T4 and the run-up of T5 use a divisor of 100 so that twelve
 * attempts take a fraction of a second; T2 and the measured part of T5 use 1 (real delays). `connectTimeout`
 * and `commandTimeout` stay real everywhere.
 *
 * SKIPPED unless REDIS_FIXTURE_BIN names a redis-server binary. It never falls back to REDIS_URL (the shared
 * Jest setup sets `redis://localhost:6379`, which this spec overwrites and checks before every module load).
 * The server is started by the spec itself on a random high port bound to 127.0.0.1, persistence off, and is
 * stopped by its own PID. No FLUSHALL, no key outside this run's random prefix except the module-owned keys of
 * the FX store and the world-gold store, which live in this scratch server only.
 *
 *   REDIS_FIXTURE_BIN=C:\ProgramData\chocolatey\lib\redis\tools\redis-server.exe \
 *   REDIS_FIXTURE_REPORT=<optional file for the evidence lines> \
 *     npx jest --coverage=false --testMatch "<root>/__tests__/lib/redis/client-recovery.redis.spec.ts"
 *
 * (point at the real binary, not the Chocolatey shim: a shim is a parent process and killing its PID would
 * leave the server running). The root Jest configuration only collects *.test.ts(x), so `npm run test:ci`
 * never runs this file.
 */

import { spawn, type ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

import type Redis from 'ioredis';

import {
  FX_SUPPORTED_CURRENCIES,
  FX_USD_RATES_SCHEMA_VERSION,
} from '@/lib/fx/rate-contract';

// The shared Jest setup replaces the FX store with a stub; this spec needs the real one.
jest.unmock('@/lib/fx/shared-rate-store');

/** Everything the shim records and the tests steer. Prefixed `mock` so jest.mock may close over it. */
const mockState = {
  /** The delay the module's own callback returns is divided by this. */
  divisor: 100,
  attempts: [] as Array<{
    times: number;
    real: number | null;
    used: number | null;
    at: number;
  }>,
  clients: [] as Array<{ disconnect(): void; status: string }>,
  onAttempt: null as null | ((times: number) => void),
};

jest.mock('ioredis', () => {
  const actual = jest.requireActual('ioredis');
  const RealRedis = actual.default ?? actual;
  class ShimRedis extends RealRedis {
    constructor(url: string, options: Record<string, any>) {
      const real = options['retryStrategy'] as (times: number) => number | null;
      super(url, {
        ...options,
        retryStrategy: (times: number): number | null => {
          const delay = real(times);
          const used =
            delay === null
              ? null
              : Math.max(1, Math.ceil(delay / mockState.divisor));
          mockState.attempts.push({
            times,
            real: delay,
            used,
            at: Date.now(),
          });
          mockState.onAttempt?.(times);
          return used;
        },
      });
      mockState.clients.push(
        this as unknown as { disconnect(): void; status: string }
      );
    }
  }
  return { __esModule: true, default: ShimRedis };
});

// ---------------------------------------------------------------------------------------------------------------
// gate
// ---------------------------------------------------------------------------------------------------------------

const BIN = process.env['REDIS_FIXTURE_BIN'] ?? '';
const REPORT = process.env['REDIS_FIXTURE_REPORT'] ?? '';
const enabled = BIN !== '';
if (enabled && !fs.existsSync(BIN)) {
  throw new Error(`REDIS_FIXTURE_BIN does not exist: ${BIN}`);
}
const suite = enabled ? describe : describe.skip;

const RUN = crypto.randomBytes(4).toString('hex');
const P = `fixture:${RUN}`;
const HOST = '127.0.0.1';

jest.setTimeout(120_000);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  check: () => boolean,
  ms: number,
  step = 10
): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await sleep(step);
  }
  return check();
}

function evidence(label: string, value: unknown): void {
  const line = JSON.stringify({
    label,
    value,
    at: new Date().toISOString(),
  });
  if (REPORT !== '') fs.appendFileSync(REPORT, `${line}\n`);
  process.stderr.write(`[redis-fixture] ${line}\n`);
}

/** NaN and undefined survive the log line as words. */
function show(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value === undefined ? 'undefined' : value, (_key, v) =>
      typeof v === 'number' && Number.isNaN(v) ? 'NaN' : v
    )
  );
}

// ---------------------------------------------------------------------------------------------------------------
// the scratch server
// ---------------------------------------------------------------------------------------------------------------

let port = 0;
let url = '';
let workDir = '';
let child: ChildProcess | null = null;
let childExited: Promise<void> = Promise.resolve();
const spawnedPids: number[] = [];

function assertLocal(candidate: string): void {
  const host = new URL(candidate).hostname;
  if (host !== HOST) {
    throw new Error(`the fixture talks to ${HOST} only, got ${host}`);
  }
}

function tryListen(candidate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(candidate, HOST, () => probe.close(() => resolve(true)));
  });
}

async function pickPort(): Promise<number> {
  for (;;) {
    const candidate = 20_000 + Math.floor(Math.random() * 40_000);
    if (await tryListen(candidate)) return candidate;
  }
}

function canConnect(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(port, HOST);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/** Spawn the server and return at once (it is not accepting connections yet). */
function spawnServer(): void {
  if (child !== null) return;
  const log = fs.openSync(path.join(workDir, 'redis.log'), 'a');
  const proc = spawn(
    BIN,
    [
      '--port',
      String(port),
      '--bind',
      HOST,
      '--save',
      '',
      '--appendonly',
      'no',
      '--dir',
      workDir,
    ],
    { stdio: ['ignore', log, log], windowsHide: true }
  );
  fs.closeSync(log);
  if (proc.pid !== undefined) spawnedPids.push(proc.pid);
  child = proc;
  childExited = new Promise((resolve) => {
    proc.once('exit', () => {
      if (child === proc) child = null;
      resolve();
    });
  });
}

async function pollUntil(
  check: () => Promise<boolean>,
  ms: number,
  step = 25
): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return true;
    await sleep(step);
  }
  return false;
}

async function serverUp(): Promise<void> {
  spawnServer();
  if (!(await pollUntil(canConnect, 15_000))) {
    throw new Error('the scratch redis-server did not start');
  }
}

async function serverDown(): Promise<void> {
  if (child === null) return;
  child.kill('SIGKILL');
  await childExited;
}

process.once('exit', () => {
  child?.kill('SIGKILL');
});

/** A plain connection for the checks, outside the code under test: no retries, long timeout. */
function admin(): Redis {
  const mod = jest.requireActual('ioredis') as {
    default?: typeof Redis;
  } & typeof Redis;
  const RealRedis = mod.default ?? mod;
  return new RealRedis({
    host: HOST,
    port,
    retryStrategy: () => null,
    maxRetriesPerRequest: 1,
    commandTimeout: 20_000,
  });
}

// ---------------------------------------------------------------------------------------------------------------
// the modules under test, loaded fresh
// ---------------------------------------------------------------------------------------------------------------

interface World {
  client: typeof import('@/lib/redis/client');
  cache: typeof import('@/lib/cache/cache-manager');
  idem: typeof import('@/lib/idempotency/idempotency-guard');
  rate: typeof import('@/lib/rate-limit');
  e4: typeof import('@/lib/engine4/server/idempotency');
  invalidate: typeof import('@/lib/drawing/invalidate');
  fx: typeof import('@/lib/fx/shared-rate-store');
  gold: typeof import('@/lib/world-gold/fx');
}

async function loadWorld(divisor = 100): Promise<World> {
  jest.resetModules();
  delete (globalThis as { redisClient?: unknown }).redisClient;
  mockState.divisor = divisor;
  mockState.attempts.length = 0;
  mockState.clients.length = 0;
  mockState.onAttempt = null;
  process.env['REDIS_URL'] = url;
  assertLocal(process.env['REDIS_URL']);
  return {
    client: await import('@/lib/redis/client'),
    cache: await import('@/lib/cache/cache-manager'),
    idem: await import('@/lib/idempotency/idempotency-guard'),
    rate: await import('@/lib/rate-limit'),
    e4: await import('@/lib/engine4/server/idempotency'),
    invalidate: await import('@/lib/drawing/invalidate'),
    fx: await import('@/lib/fx/shared-rate-store'),
    gold: await import('@/lib/world-gold/fx'),
  };
}

function validRates(): import('@/lib/fx/shared-rate-store').SharedUsdRates {
  const now = Date.now();
  return {
    schemaVersion: FX_USD_RATES_SCHEMA_VERSION,
    rates: Object.fromEntries(
      FX_SUPPORTED_CURRENCIES.map((code) => [code, code === 'USD' ? 1 : 1.5])
    ),
    provider: 'frankfurter',
    rateUpdatedAt: new Date(now - 60_000).toISOString(),
    fetchedAt: new Date(now - 30_000).toISOString(),
    expiresAt: new Date(now + 1_800_000).toISOString(),
  };
}

const OUTCOME = {
  id: 'consent-1',
  recordedAt: '2026-10-23T10:00:00.000Z',
  setupSha256: 'a'.repeat(64),
  action: 'ACCEPT',
  cycleSlot: '12345',
};

async function timed<T>(
  run: () => Promise<T>
): Promise<{ ms: number; value?: T; threw?: string }> {
  const start = Date.now();
  try {
    const value = await run();
    return { ms: Date.now() - start, value };
  } catch (error) {
    return {
      ms: Date.now() - start,
      threw: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// the suite
// ---------------------------------------------------------------------------------------------------------------

let errorLog: jest.SpyInstance;
let keepClients = false;
const savedEnv: Record<string, string | undefined> = {};

/** `disconnect()` always runs, even when a graceful quit could not finish. */
async function closeAllClients(): Promise<void> {
  const clients = [...mockState.clients];
  for (const client of clients) {
    try {
      client.disconnect();
    } catch {
      // already closed
    }
  }
  // let the sockets finish closing, so that stopping the server cannot reset one half-closed
  await waitFor(() => clients.every((c) => c.status === 'end'), 2_000);
  mockState.clients.length = 0;
  mockState.onAttempt = null;
}

suite('the root Redis client against a real redis-server', () => {
  beforeAll(async () => {
    for (const name of ['REDIS_URL', 'CURRENCYBEACON_API_KEY']) {
      savedEnv[name] = process.env[name];
    }
    delete process.env['CURRENCYBEACON_API_KEY']; // the world-gold read must not reach the network
    port = await pickPort();
    url = `redis://${HOST}:${port}`;
    assertLocal(url);
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'redis-fixture-'));
    evidence('server', { port, bin: BIN, run: RUN });
  });

  beforeEach(() => {
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (keepClients) return; // the outage suite shares one client across its tests
    await closeAllClients();
  });

  afterAll(async () => {
    try {
      await serverDown();
    } finally {
      evidence('server stopped', { pids: spawnedPids, left: child !== null });
      if (workDir !== '') {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
      for (const [name, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  // -------------------------------------------------------------------------------------------------------------
  it('T1 recovery: the same client answers again after an outage of more than 12 reconnect attempts', async () => {
    await serverUp();
    const world = await loadWorld(100);
    const client = world.client.getRedisClient();
    expect(await client.ping()).toBe('PONG');

    await serverDown();
    await waitFor(
      () => mockState.attempts.length >= 14 || client.status === 'end',
      30_000
    );
    const attemptsDuringOutage = mockState.attempts.length;
    const statusDuringOutage = client.status;
    const reached = {
      attemptsDuringOutage,
      statusDuringOutage,
      realDelays: mockState.attempts.map((a) => [a.times, a.real]),
    };

    await serverUp();
    const probe = await timed(() => client.ping());
    const recovered = await waitFor(
      () => world.client.getRedisStatus().status === 'ready',
      15_000
    );
    evidence('T1', {
      ...reached,
      firstCommandAfterRestart: show(probe),
      statusAfterRestart: world.client.getRedisStatus(),
      attemptsAtEnd: mockState.attempts.length,
    });

    expect(attemptsDuringOutage).toBeGreaterThanOrEqual(13);
    expect(statusDuringOutage).not.toBe('end');
    expect(probe.threw).toBeUndefined();
    expect(probe.value).toBe('PONG');
    expect(recovered).toBe(true);
    expect(world.client.getRedisStatus()).toEqual({
      connected: true,
      status: 'ready',
    });
    expect(world.client.getRedisClient()).toBe(client);
    const key = `${P}:t1`;
    expect(await client.set(key, 'back')).toBe('OK');
    expect(await client.get(key)).toBe('back');
    expect(mockState.clients).toHaveLength(1); // one client for the whole outage
  });

  // -------------------------------------------------------------------------------------------------------------
  it('T2 cold start: the first lazy command, issued while the server is still starting, succeeds within the command budget', async () => {
    await serverDown();
    const world = await loadWorld(1); // real delays
    const client = world.client.getRedisClient();
    expect(client.status).toBe('wait'); // lazyConnect: nothing connected yet

    const start = Date.now();
    const first = client.ping();
    await sleep(250); // the server is NOT listening yet: the first attempt is refused
    spawnServer();
    const reply = await timed(() => first);
    const attemptsSeen = mockState.attempts.map((a) => [a.times, a.real]);
    evidence('T2', {
      reply: show(reply),
      attemptsSeen,
      since: Date.now() - start,
    });

    expect(reply.threw).toBeUndefined();
    expect(reply.value).toBe('PONG');
    expect(reply.ms).toBeLessThan(3_000);
    expect(attemptsSeen.length).toBeGreaterThanOrEqual(1); // it really had to retry
  });

  // -------------------------------------------------------------------------------------------------------------
  it('T3 no reply: a command the server holds back rejects after about 3 s, and the write is applied later (a timeout is not a cancellation)', async () => {
    await serverUp();
    const world = await loadWorld(100);
    const client = world.client.getRedisClient();
    expect(await client.ping()).toBe('PONG');
    const control = admin();
    try {
      const key = `${P}:t3`;
      expect(await control.call('CLIENT', 'PAUSE', '5000', 'WRITE')).toBe('OK');
      const held = await timed(() => client.set(key, 'late'));
      const seenRightAfter = await control.get(key);
      const applied = await pollUntil(
        async () => (await control.get(key)) === 'late',
        8_000,
        100
      );
      evidence('T3', { held: show(held), seenRightAfter, applied });

      expect(held.threw).toBe('Command timed out');
      expect(held.ms).toBeGreaterThanOrEqual(2_800);
      expect(held.ms).toBeLessThan(4_500);
      expect(applied).toBe(true);
      expect(await client.ping()).toBe('PONG'); // the connection was not poisoned
    } finally {
      control.disconnect();
    }
  });

  // -------------------------------------------------------------------------------------------------------------
  it('T4 intentional close: no reconnect attempts after disconnectRedis(), and the next getter builds a new client', async () => {
    await serverUp();
    const world = await loadWorld(100);
    const first = world.client.getRedisClient();
    expect(await first.ping()).toBe('PONG');
    const attemptsBefore = mockState.attempts.length;

    try {
      await world.client.disconnectRedis();
      await sleep(500); // a reconnect would come after 5 ms through the shim
      expect(mockState.attempts).toHaveLength(attemptsBefore);
      expect(first.status).toBe('end');
      expect(world.client.getRedisStatus()).toEqual({
        connected: false,
        status: 'not_initialized',
      });

      const second = world.client.getRedisClient();
      expect(second).not.toBe(first);
      expect(await second.ping()).toBe('PONG');
      expect(mockState.clients).toHaveLength(2);
    } finally {
      // if the graceful quit could not finish, the sockets are still closed
      for (const client of mockState.clients) client.disconnect();
    }
  });

  // -------------------------------------------------------------------------------------------------------------
  describe('an outage past attempt 11, then recovery', () => {
    interface Row {
      name: string;
      rounds: Array<{ ms: number; value?: unknown; threw?: string }>;
    }
    let world: World;
    let probeRows: Row[] = [];
    let routeRows: Row[] = [];
    let statusPastEleven = '';
    let reachedAttempt12 = false;
    let replay: Record<string, unknown> = {};
    let recoveredReady = false;
    let errorsDuringOutage: string[] = [];
    let clientsMade = 0;
    let alertsMessage: string | null = null;

    const out = `${P}:out`;

    afterAll(async () => {
      keepClients = false;
      await closeAllClients();
    });

    beforeAll(async () => {
      keepClients = true;
      const outageErrorLog = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      jest.spyOn(console, 'info').mockImplementation(() => undefined);
      await serverUp();
      world = await loadWorld(100);
      const client = world.client.getRedisClient();
      expect(await client.ping()).toBe('PONG');

      // run up to attempt 11 fast; from attempt 12 on the REAL delays apply (6.0 s, 6.5 s, ...)
      mockState.onAttempt = (times) => {
        if (times >= 11) mockState.divisor = 1;
      };
      await serverDown();
      reachedAttempt12 = await waitFor(
        () =>
          mockState.attempts.some((a) => a.times === 12) ||
          client.status === 'end',
        60_000
      ).then(() => mockState.attempts.some((a) => a.times === 12));
      await sleep(100); // the 4th-attempt flush of the queue happens right after attempt 12
      statusPastEleven = client.status;

      const g = world;
      const probes: Array<[string, () => Promise<unknown>]> = [
        ['getCache', () => g.cache.getCache(`${out}:get`)],
        ['setCache', () => g.cache.setCache(`${out}:set`, { a: 1 }, 60)],
        [
          'checkRateLimit',
          () =>
            g.rate.checkRateLimit(`${out}:user`, {
              limit: 10,
              windowSeconds: 60,
              prefix: `${out}:rl`,
            }),
        ],
        [
          'acquireIdempotencyLock',
          () => g.idem.acquireIdempotencyLock(`${out}:lock`),
        ],
        [
          'claimSubmission',
          () => g.e4.claimSubmission('u1', `${out}-sub1`, 'fp'),
        ],
        [
          'completeSubmission',
          () => g.e4.completeSubmission('u1', `${out}-sub2`, 'fp', OUTCOME),
        ],
        [
          'releaseSubmission',
          () => g.e4.releaseSubmission('u1', `${out}-sub3`),
        ],
        [
          'publishAlertsChanged',
          () =>
            g.invalidate.publishAlertsChanged({
              symbol: 'XAUUSD',
              timeframe: 'H1',
              reason: 'fixture',
            }),
        ],
        ['readSharedUsdRates', () => g.fx.readSharedUsdRates()],
        ['writeSharedUsdRates', () => g.fx.writeSharedUsdRates(validRates())],
        ['getWorldGoldFx', () => g.gold.getWorldGoldFx(new Date())],
        ['getFxAtClose', () => g.gold.getFxAtClose(new Date(), new Date())],
      ];
      const routes: Array<[string, () => Promise<unknown>]> = [
        [
          'market cache route (get, DB, set)',
          async () => {
            await g.cache.getCachedCurrencyGoldIndices();
            await g.cache.cacheCurrencyGoldIndices([{ fixture: true }]);
          },
        ],
        [
          'engine4 submit (claim, work, complete)',
          async () => {
            await g.e4.claimSubmission('u2', `${out}-r1`, 'fp');
            await g.e4.completeSubmission('u2', `${out}-r1`, 'fp', OUTCOME);
          },
        ],
        [
          'engine4 submit failing (claim, work, release)',
          async () => {
            await g.e4.claimSubmission('u3', `${out}-r2`, 'fp');
            await g.e4.releaseSubmission('u3', `${out}-r2`);
          },
        ],
        [
          'validate-discount (rate limit)',
          () =>
            g.rate.checkRateLimit(`${out}:route`, {
              limit: 10,
              windowSeconds: 60,
              prefix: `${out}:rl2`,
            }),
        ],
      ];

      // three rounds of every probe at once (each command has its own 3 s timer), then the route paths
      probeRows = probes.map(([name]) => ({ name, rounds: [] }));
      for (let round = 0; round < 3; round += 1) {
        const results = await Promise.all(probes.map(([, run]) => timed(run)));
        results.forEach((result, i) => probeRows[i]?.rounds.push(result));
      }
      routeRows = routes.map(([name]) => ({ name, rounds: [] }));
      const routeResults = await Promise.all(
        routes.map(([, run]) => timed(run))
      );
      routeResults.forEach((result, i) => routeRows[i]?.rounds.push(result));
      errorsDuringOutage = outageErrorLog.mock.calls.map((call) =>
        call.map((part: unknown) => String(part)).join(' ')
      );

      // bring the server back well inside the window before the next flush (attempt 16)
      await serverUp();
      recoveredReady = await waitFor(
        () => world.client.getRedisStatus().status === 'ready',
        30_000
      );
      await sleep(500); // let the queued commands go out
      clientsMade = mockState.clients.length;
      outageErrorLog.mockRestore();
      jest.restoreAllMocks();

      // what did the timed-out commands do once the client came back?
      const control = admin();
      try {
        replay = {
          setCacheKeyExists: await control.exists(`${out}:set`),
          lockKeyExists: await control.exists(`${out}:lock`),
          lockTtl: await control.ttl(`${out}:lock`),
          completeKeyExists: await control.exists(
            `engine4:consent:v1:u1:${out}-sub2`
          ),
        };
      } finally {
        control.disconnect();
      }
      evidence('outage status and replay', {
        statusPastEleven,
        reachedAttempt12,
        recoveredReady,
        attempts: mockState.attempts.map((a) => [a.times, a.real]),
        replay,
      });
    }, 240_000);

    function median(rounds: Row['rounds']): number {
      const sorted = rounds.map((r) => r.ms).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    }

    it('T5 the outage latency table (reconnecting past attempt 11)', () => {
      const table = [...probeRows, ...routeRows].map((row) => ({
        path: row.name,
        minMs: Math.min(...row.rounds.map((r) => r.ms)),
        medianMs: median(row.rounds),
        maxMs: Math.max(...row.rounds.map((r) => r.ms)),
        result: show(
          row.rounds[0]?.threw !== undefined
            ? { threw: row.rounds[0].threw }
            : row.rounds[0]?.value
        ),
      }));
      evidence('T5 table', table);

      expect(reachedAttempt12).toBe(true);
      expect(['reconnecting', 'connecting']).toContain(statusPastEleven);
      const bounded = new Set([
        'readSharedUsdRates',
        'writeSharedUsdRates',
        'getWorldGoldFx',
        'getFxAtClose',
      ]);
      for (const row of probeRows) {
        for (const round of row.rounds) {
          if (bounded.has(row.name)) {
            // their own Promise.race ends the wait before the command times out
            expect(round.ms).toBeLessThan(1_300);
          } else {
            expect(round.ms).toBeGreaterThanOrEqual(2_700);
            expect(round.ms).toBeLessThan(3_800);
          }
        }
      }
      // a path with two Redis calls in a row costs two timeouts
      for (const row of routeRows) {
        const redisCalls = row.name.startsWith('validate-discount') ? 1 : 2;
        const ms = row.rounds[0]?.ms ?? 0;
        expect(ms).toBeGreaterThanOrEqual(redisCalls * 2_700);
        expect(ms).toBeLessThan(redisCalls * 3_800);
      }
    });

    it('T6 policy during the outage: every helper keeps the failure policy it had', () => {
      const first = (name: string) =>
        probeRows.find((row) => row.name === name)?.rounds[0];

      expect(first('getCache')?.value).toBeNull();
      expect(first('setCache')?.threw).toBeUndefined();
      expect(first('acquireIdempotencyLock')?.value).toBe(true);
      expect(first('claimSubmission')?.value).toEqual({ state: 'UNGUARDED' });
      expect(first('completeSubmission')?.threw).toBeUndefined();
      expect(first('releaseSubmission')?.threw).toBeUndefined();
      expect(first('publishAlertsChanged')?.threw).toBeUndefined();
      expect(first('readSharedUsdRates')?.value).toBeNull();
      expect(first('writeSharedUsdRates')?.threw).toBeUndefined();
      expect(first('getWorldGoldFx')?.value).toBeNull();
      expect(first('getFxAtClose')?.threw).toBeUndefined();

      // checkRateLimit has no handling of its own: record what it really returns
      const rateLimit = first('checkRateLimit');
      evidence('T6 checkRateLimit during the outage', show(rateLimit));
      expect(rateLimit?.threw).toBeUndefined();
      expect(rateLimit?.value).toMatchObject({ success: true, limit: 10 });

      const messages = errorsDuringOutage.join('\n');
      expect(messages).toContain('Cache get error:');
      expect(messages).toContain('Cache set error:');
      expect(messages).toContain('[Idempotency] Redis lock check failed');
      expect(messages).toContain('[engine4] submission guard failed');
      expect(messages).toContain('publishAlertsChanged failed:');
    });

    it('T6 the client came back by itself, and the commands that timed out during the outage were sent after it', () => {
      expect(recoveredReady).toBe(true);
      expect(clientsMade).toBe(1); // one client for the whole outage and the recovery
      // documented ioredis behaviour: a command that timed out in the offline queue still goes out on reconnect
      expect(replay).toMatchObject({
        setCacheKeyExists: 1,
        lockKeyExists: 1,
        completeKeyExists: 1,
      });
      expect(replay['lockTtl']).toBeGreaterThan(0);
      expect(replay['lockTtl']).toBeLessThanOrEqual(30);
    });

    it('T6 policy after recovery: normal results, and the claim and expiry times read back from real keys', async () => {
      const control = admin();
      const subscriber = admin();
      try {
        const keys = `${P}:after`;

        // cache
        await world.cache.setCache(`${keys}:c`, { a: 1 }, 60);
        expect(await world.cache.getCache(`${keys}:c`)).toEqual({ a: 1 });
        expect(await control.ttl(`${keys}:c`)).toBeGreaterThan(55);
        expect(await control.ttl(`${keys}:c`)).toBeLessThanOrEqual(60);
        expect(await world.cache.getCache(`${keys}:missing`)).toBeNull();

        // rate limit: the sorted-set window really counts
        const limit = { limit: 3, windowSeconds: 60, prefix: `${keys}:rl` };
        const results = [];
        for (let i = 0; i < 4; i += 1) {
          results.push(await world.rate.checkRateLimit('u', limit));
          await sleep(5);
        }
        expect(results.map((r) => r.success)).toEqual([
          true,
          true,
          true,
          false,
        ]);
        expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);

        // idempotency lock: first true, repeat false, expiry is the default 30 s
        expect(await world.idem.acquireIdempotencyLock(`${keys}:lock`)).toBe(
          true
        );
        expect(await world.idem.acquireIdempotencyLock(`${keys}:lock`)).toBe(
          false
        );
        expect(await control.ttl(`${keys}:lock`)).toBeGreaterThan(
          world.idem.DEFAULT_IDEMPOTENCY_TTL_SECONDS - 3
        );
        expect(await control.ttl(`${keys}:lock`)).toBeLessThanOrEqual(
          world.idem.DEFAULT_IDEMPOTENCY_TTL_SECONDS
        );

        // engine4: claim 120 s, in flight, done 86,400 s, repeat answers DONE, release frees the key
        const engineKey = `engine4:consent:v1:u9:${keys}-sub`;
        expect(
          await world.e4.claimSubmission('u9', `${keys}-sub`, 'fp')
        ).toEqual({
          state: 'CLAIMED',
        });
        expect(await control.ttl(engineKey)).toBeGreaterThan(
          world.e4.CLAIM_SECONDS - 5
        );
        expect(await control.ttl(engineKey)).toBeLessThanOrEqual(
          world.e4.CLAIM_SECONDS
        );
        expect(
          await world.e4.claimSubmission('u9', `${keys}-sub`, 'fp')
        ).toEqual({
          state: 'IN_FLIGHT',
        });
        await world.e4.completeSubmission('u9', `${keys}-sub`, 'fp', OUTCOME);
        expect(await control.ttl(engineKey)).toBeGreaterThan(
          world.e4.DONE_SECONDS - 5
        );
        expect(await control.ttl(engineKey)).toBeLessThanOrEqual(
          world.e4.DONE_SECONDS
        );
        expect(
          await world.e4.claimSubmission('u9', `${keys}-sub`, 'fp')
        ).toEqual({
          state: 'DONE',
          outcome: OUTCOME,
        });
        await world.e4.releaseSubmission('u9', `${keys}-sub`);
        expect(await control.exists(engineKey)).toBe(0);

        // alerts publisher reaches a subscriber
        await subscriber.subscribe('alerts:changed');
        const heard = new Promise<string>((resolve) =>
          subscriber.once('message', (_channel, message) => resolve(message))
        );
        await world.invalidate.publishAlertsChanged({
          symbol: 'XAUUSD',
          timeframe: 'H1',
          reason: 'fixture-after',
        });
        let giveUp: ReturnType<typeof setTimeout> | undefined;
        const silence = new Promise<null>((resolve) => {
          giveUp = setTimeout(() => resolve(null), 5_000);
        });
        alertsMessage = await Promise.race([heard, silence]).finally(() =>
          clearTimeout(giveUp)
        );
        expect(alertsMessage).toContain('fixture-after');

        // FX store: written with the publisher's expiry, read back whole
        const table = validRates();
        await world.fx.writeSharedUsdRates(table);
        expect(await world.fx.readSharedUsdRates()).toEqual(table);
        const ttl = await control.ttl(world.fx.FX_USD_RATES_REDIS_KEY);
        expect(ttl).toBeGreaterThan(1_700);
        expect(ttl).toBeLessThanOrEqual(1_800);

        // world-gold read: nothing stored and no API key, so a clean null with no error
        expect(await world.gold.getWorldGoldFx(new Date())).toBeNull();
        expect(errorLog).not.toHaveBeenCalled(); // a healthy Redis logs nothing
        evidence('T6 after recovery', {
          rateLimit: show(results),
          alertsMessage,
        });
      } finally {
        control.disconnect();
        subscriber.disconnect();
      }
    });
  });
});
