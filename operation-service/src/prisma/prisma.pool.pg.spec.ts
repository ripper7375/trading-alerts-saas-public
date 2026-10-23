import * as fs from 'fs';
import * as net from 'net';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { PrismaService } from './prisma.service';

/**
 * Real-fixture proof of PrismaService's pool checkout and connect deadline (Unit P-operation of the
 * database-scaling second wave). The real PrismaService, the real @prisma/adapter-pg and pg-pool, a
 * scratch PostgreSQL that accepts TLS only (the service forces TLS with `ssl: { rejectUnauthorized:
 * false }`). Gated: skipped unless OPS_POOL_PG_URL is a localhost URL AND OPS_POOL_PG_ALLOW_WIPE=yes
 * (it creates and drops one table, pool_fixture_probe, in that database), so `npm test` shows it as
 * skipped.
 *
 * Recipe (a scratch PostgreSQL 18 with ssl=on and a pg_hba.conf of `hostssl ... trust` plus
 * `hostnossl ... reject`, on a random high port, never the developer's own server):
 *   OPS_POOL_PG_URL=postgresql://postgres@127.0.0.1:55471/pool_fixture OPS_POOL_PG_ALLOW_WIPE=yes \
 *     npx jest src/prisma/prisma.pool.pg.spec.ts --runInBand
 * Do not put `sslmode` in the URL: pg-connection-string would then override the service's own `ssl`.
 * OPS_POOL_PG_REPORT=<file> also writes every observation (elapsed times, error classes, backend
 * counts) as JSON.
 *
 * Error classes are recorded as observed and never pinned.
 */
const url = process.env['OPS_POOL_PG_URL'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const enabled =
  !!url &&
  LOCAL_HOSTS.has(new URL(url).hostname) &&
  process.env['OPS_POOL_PG_ALLOW_WIPE'] === 'yes';
const describeGated = enabled ? describe : describe.skip;

jest.setTimeout(60_000);

const APP = 'ops_pool_fixture';
const MONITOR_APP = 'ops_pool_monitor';
const POOL_MAX = 10;
const SLEEP_SECONDS = 4;

function withApplicationName(base: string, name: string): string {
  const u = new URL(base);
  u.searchParams.set('application_name', name);
  return u.toString();
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface Described {
  class?: string;
  name?: string;
  message?: string;
  code?: unknown;
  meta?: unknown;
}

function describeError(error: unknown): Described {
  const e = error as {
    constructor?: { name?: string };
    name?: string;
    message?: string;
    code?: unknown;
    meta?: unknown;
  };
  return {
    class: e?.constructor?.name,
    name: e?.name,
    message: String(e?.message ?? error).slice(0, 400),
    code: e?.code,
    meta: e?.meta,
  };
}

type Outcome =
  | { ok: true; ms: number; value: unknown }
  | { ok: false; ms: number; error: Described };

/** Runs `work`, never throws: the elapsed time and the outcome are the evidence. */
async function timed(work: () => Promise<unknown>): Promise<Outcome> {
  const start = Date.now();
  try {
    const value = await work();
    return { ok: true, ms: Date.now() - start, value };
  } catch (error) {
    return { ok: false, ms: Date.now() - start, error: describeError(error) };
  }
}

/** A hung call (the unmodified service) must show up as a result, not hang the run. */
function raceHang<T>(work: Promise<T>, ms: number): Promise<T | 'HUNG'> {
  return Promise.race([work, sleep(ms).then(() => 'HUNG' as const)]);
}

interface BackendRow {
  state: string | null;
  n: number;
  all_tls: boolean;
}

describeGated(
  'PrismaService pool checkout and connect deadline (real fixture)',
  () => {
    const observations: Record<string, unknown> = {};
    const record = (key: string, value: unknown): void => {
      observations[key] = value;
    };

    let originalDatabaseUrl: string | undefined;
    let monitor: PrismaClient;
    let service: PrismaService | null = null;
    let sleepers: Array<Promise<unknown>> = [];

    async function backends(): Promise<{
      total: number;
      byState: Record<string, number>;
      allTls: boolean;
    }> {
      const rows = await monitor.$queryRaw<BackendRow[]>`
      SELECT a.state, count(*)::int AS n, bool_and(coalesce(s.ssl, false)) AS all_tls
      FROM pg_stat_activity a LEFT JOIN pg_stat_ssl s ON s.pid = a.pid
      WHERE a.application_name = ${APP} AND a.backend_type = 'client backend'
      GROUP BY a.state`;
      const byState: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        byState[row.state ?? 'null'] = row.n;
        total += row.n;
      }
      return { total, byState, allTls: rows.every((r) => r.all_tls) };
    }

    async function waitForBackends(
      predicate: (b: Awaited<ReturnType<typeof backends>>) => boolean,
      timeoutMs: number
    ): Promise<Awaited<ReturnType<typeof backends>>> {
      const deadline = Date.now() + timeoutMs;
      let last = await backends();
      while (!predicate(last) && Date.now() < deadline) {
        await sleep(100);
        last = await backends();
      }
      return last;
    }

    /** Backends of the service that sit in a transaction without running a statement. */
    async function openTransactionBackends(): Promise<number> {
      const rows = await monitor.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE application_name = ${APP} AND backend_type = 'client backend'
        AND state <> 'active' AND (state LIKE 'idle in transaction%' OR xact_start IS NOT NULL)`;
      return rows[0].n;
    }

    async function probeRows(note: string): Promise<number> {
      const rows = await monitor.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pool_fixture_probe WHERE note = ${note}`;
      return rows[0].n;
    }

    /** Holds `count` pooled connections busy for SLEEP_SECONDS each. */
    function holdConnections(count: number): void {
      const svc = service as PrismaService;
      sleepers = Array.from({ length: count }, () =>
        svc
          .$queryRawUnsafe(`SELECT 1 AS n FROM pg_sleep(${SLEEP_SECONDS})`)
          .catch((error: unknown) => describeError(error))
      );
    }

    async function safeDisconnect(svc: PrismaService | null): Promise<void> {
      if (!svc) return;
      await raceHang(svc.onApplicationShutdown(), 10_000);
    }

    beforeAll(async () => {
      originalDatabaseUrl = process.env['DATABASE_URL'];
      monitor = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: withApplicationName(url as string, MONITOR_APP),
          ssl: { rejectUnauthorized: false },
        }),
      });
      await monitor.$executeRawUnsafe(
        'DROP TABLE IF EXISTS pool_fixture_probe'
      );
      await monitor.$executeRawUnsafe(
        'CREATE TABLE pool_fixture_probe (id serial PRIMARY KEY, note text NOT NULL, at timestamptz NOT NULL DEFAULT now())'
      );
    });

    beforeEach(() => {
      process.env['DATABASE_URL'] = withApplicationName(url as string, APP);
      service = new PrismaService();
      sleepers = [];
    });

    afterEach(async () => {
      await Promise.allSettled(sleepers);
      await safeDisconnect(service);
      service = null;
      if (originalDatabaseUrl === undefined) delete process.env['DATABASE_URL'];
      else process.env['DATABASE_URL'] = originalDatabaseUrl;
      await monitor.$executeRawUnsafe('DELETE FROM pool_fixture_probe');
    });

    afterAll(async () => {
      try {
        await monitor.$executeRawUnsafe(
          'DROP TABLE IF EXISTS pool_fixture_probe'
        );
      } finally {
        await monitor.$disconnect();
        const report = process.env['OPS_POOL_PG_REPORT'];
        if (report)
          fs.writeFileSync(report, JSON.stringify(observations, null, 2));
      }
    });

    it('does not open a connection on $connect (the pool is lazy), and shutdown completes with nothing held', async () => {
      const svc = service as PrismaService;
      await svc.onModuleInit();
      const afterConnect = await backends();
      record('lazy_connect_backends', afterConnect);
      expect(afterConnect.total).toBe(0);

      await svc.$queryRawUnsafe('SELECT 1 AS n');
      expect((await backends()).total).toBe(1);

      const shutdown = await timed(() => svc.onApplicationShutdown());
      const afterShutdown = await waitForBackends((b) => b.total === 0, 5000);
      record('shutdown', { ms: shutdown.ms, backends: afterShutdown });
      expect(shutdown.ok).toBe(true);
      expect(afterShutdown.total).toBe(0);
    });

    it('normal read and write succeed on an idle pool, over TLS', async () => {
      const svc = service as PrismaService;
      const write = await timed(() =>
        svc.$executeRawUnsafe(
          "INSERT INTO pool_fixture_probe (note) VALUES ('normal')"
        )
      );
      const read = await timed(() =>
        svc.$queryRawUnsafe<Array<{ n: number }>>(
          "SELECT count(*)::int AS n FROM pool_fixture_probe WHERE note = 'normal'"
        )
      );
      const seen = await backends();
      record('normal_read_write', { write, read, backends: seen });
      expect(write.ok).toBe(true);
      expect(read.ok).toBe(true);
      expect(read.ok && (read.value as Array<{ n: number }>)[0].n).toBe(1);
      expect(seen.total).toBeGreaterThanOrEqual(1);
      expect(seen.allTls).toBe(true);
    });

    it('is not a statement timeout: one pg_sleep(3) on an idle pool completes', async () => {
      const svc = service as PrismaService;
      const slow = await timed(() =>
        svc.$queryRawUnsafe('SELECT 1 AS n FROM pg_sleep(3)')
      );
      record('statement_not_bounded', slow);
      expect(slow.ok).toBe(true);
      expect(slow.ms).toBeGreaterThanOrEqual(2900);
    });

    it('pool shape: ten busy queries open exactly ten backends (max 10), all over TLS, and nothing more connects', async () => {
      holdConnections(POOL_MAX);
      const busy = await waitForBackends(
        (b) => b.total === POOL_MAX && b.byState['active'] === POOL_MAX,
        5000
      );
      await sleep(500);
      const later = await backends();
      record('pool_shape', { busy, later });
      expect(busy.total).toBe(POOL_MAX);
      expect(busy.byState['active']).toBe(POOL_MAX);
      expect(busy.allTls).toBe(true);
      expect(later.total).toBe(POOL_MAX);
    });

    it('pool shape: idle connections are evicted after about 10 s (idleTimeoutMillis 10,000)', async () => {
      holdConnections(2);
      await Promise.all(sleepers);
      const released = Date.now();
      const idle = await backends();
      const gone = await waitForBackends((b) => b.total === 0, 20_000);
      const evictedAfterMs = Date.now() - released;
      record('idle_eviction', { idle, evictedAfterMs, remaining: gone });
      expect(idle.byState['idle']).toBe(2);
      expect(gone.total).toBe(0);
      expect(evictedAfterMs).toBeGreaterThanOrEqual(8_000);
      expect(evictedAfterMs).toBeLessThanOrEqual(14_000);
    }, 40_000);

    it('saturation: the eleventh query fails after about 2 s, then the pool recovers with no late insert', async () => {
      const svc = service as PrismaService;
      holdConnections(POOL_MAX);
      await waitForBackends((b) => b.byState['active'] === POOL_MAX, 5000);

      const eleventh = await raceHang(
        timed(() =>
          svc.$executeRawUnsafe(
            "INSERT INTO pool_fixture_probe (note) VALUES ('saturation')"
          )
        ),
        15_000
      );
      record('saturation_eleventh', eleventh);

      await Promise.all(sleepers);
      // A removed waiter must not be served when a connection frees up.
      await sleep(700);
      const recovery = await timed(() => svc.$queryRawUnsafe('SELECT 1 AS n'));
      const settled = await waitForBackends(
        (b) => !b.byState['active'] && !b.byState['idle in transaction'],
        5000
      );
      const lateRows = await probeRows('saturation');
      record('saturation_after', { recovery, settled, lateRows });

      expect(eleventh).not.toBe('HUNG');
      const outcome = eleventh as Outcome;
      expect(outcome.ok).toBe(false);
      expect(outcome.ms).toBeGreaterThanOrEqual(1800);
      expect(outcome.ms).toBeLessThanOrEqual(3500);
      expect(recovery.ok).toBe(true);
      expect(recovery.ms).toBeLessThan(500);
      expect(settled.total).toBeLessThanOrEqual(POOL_MAX);
      expect(settled.byState['active'] ?? 0).toBe(0);
      expect(lateRows).toBe(0);
    });

    it('connect timeout: a server that accepts and never answers fails at about 2 s; a refused port is only a control', async () => {
      const sockets = new Set<net.Socket>();
      const blackHole = net.createServer((socket) => {
        sockets.add(socket);
        socket.on('error', () => undefined);
      });
      await new Promise<void>((resolve) =>
        blackHole.listen(0, '127.0.0.1', resolve)
      );
      const port = (blackHole.address() as net.AddressInfo).port;

      const closed = net.createServer();
      await new Promise<void>((resolve) =>
        closed.listen(0, '127.0.0.1', resolve)
      );
      const closedPort = (closed.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => closed.close(() => resolve()));

      let hangService: PrismaService | null = null;
      let refusedService: PrismaService | null = null;
      try {
        process.env['DATABASE_URL'] =
          `postgresql://postgres@127.0.0.1:${closedPort}/pool_fixture`;
        refusedService = new PrismaService();
        const refused = await timed(() =>
          (refusedService as PrismaService).$queryRawUnsafe('SELECT 1 AS n')
        );
        record('connect_refused_control', refused);

        process.env['DATABASE_URL'] =
          `postgresql://postgres@127.0.0.1:${port}/pool_fixture`;
        hangService = new PrismaService();
        const hung = await raceHang(
          timed(() =>
            (hangService as PrismaService).$queryRawUnsafe('SELECT 1 AS n')
          ),
          15_000
        );
        record('connect_black_hole', {
          outcome: hung,
          connectionsAccepted: sockets.size,
        });

        expect(refused.ok).toBe(false);
        expect(refused.ms).toBeLessThan(1000);
        expect(hung).not.toBe('HUNG');
        const outcome = hung as Outcome;
        expect(outcome.ok).toBe(false);
        expect(outcome.ms).toBeGreaterThanOrEqual(1800);
        expect(outcome.ms).toBeLessThanOrEqual(3500);
      } finally {
        await safeDisconnect(hangService);
        await safeDisconnect(refusedService);
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => blackHole.close(() => resolve()));
      }
    });

    it('interactive transaction under saturation: the default fails at about 2 s, maxWait 10 s still fails at about 2 s, nothing is left open, the pool recovers', async () => {
      const svc = service as PrismaService;

      holdConnections(POOL_MAX);
      await waitForBackends((b) => b.byState['active'] === POOL_MAX, 5000);
      const withDefaults = await raceHang(
        timed(() =>
          svc.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
              "INSERT INTO pool_fixture_probe (note) VALUES ('tx_default')"
            );
          })
        ),
        15_000
      );
      record('tx_default', withDefaults);
      await Promise.all(sleepers);
      const openAfterDefault = await waitForBackends(
        (b) => !b.byState['active'],
        5000
      ).then(() => sleep(1500).then(openTransactionBackends));
      const lateDefault = await probeRows('tx_default');

      holdConnections(POOL_MAX);
      await waitForBackends((b) => b.byState['active'] === POOL_MAX, 5000);
      const withLongWait = await raceHang(
        timed(() =>
          svc.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe(
                "INSERT INTO pool_fixture_probe (note) VALUES ('tx_maxwait')"
              );
            },
            { maxWait: 10_000, timeout: 5_000 }
          )
        ),
        20_000
      );
      record('tx_maxwait_10s', withLongWait);
      await Promise.all(sleepers);
      const openAfterLong = await waitForBackends(
        (b) => !b.byState['active'],
        5000
      ).then(() => sleep(1500).then(openTransactionBackends));
      const lateLong = await probeRows('tx_maxwait');
      const recovery = await timed(() => svc.$queryRawUnsafe('SELECT 1 AS n'));
      record('tx_after', {
        openAfterDefault,
        lateDefault,
        openAfterLong,
        lateLong,
        recovery,
      });

      expect(withDefaults).not.toBe('HUNG');
      const a = withDefaults as Outcome;
      expect(a.ok).toBe(false);
      expect(a.ms).toBeGreaterThanOrEqual(1500);
      expect(a.ms).toBeLessThanOrEqual(3500);
      expect(openAfterDefault).toBe(0);
      expect(lateDefault).toBe(0);

      expect(withLongWait).not.toBe('HUNG');
      const b = withLongWait as Outcome;
      expect(b.ok).toBe(false);
      expect(b.ms).toBeGreaterThanOrEqual(1800);
      expect(b.ms).toBeLessThanOrEqual(3500);
      expect(openAfterLong).toBe(0);
      expect(lateLong).toBe(0);
      expect(recovery.ok).toBe(true);
    }, 90_000);
  }
);
