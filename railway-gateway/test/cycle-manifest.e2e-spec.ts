process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CycleManifest } from '../src/cycle/cycle-manifest.contract';
import {
  FakePrisma,
  FakeQueue,
  landBars,
  landStatistics,
} from './helpers/fake-cycle-store';

/**
 * POST /api/v1/cycle-manifest, through the real application module (ADR-009).
 *
 * Three things are being shown, each of which a unit test of a single class
 * cannot show:
 *   1. the endpoint: API key, validation against the contract, the queue job it
 *      leaves behind and what it answers a sender that retries;
 *   2. the wiring: market-data-sync is processed by exactly ONE handler with
 *      concurrency 1, so a manifest runs behind the rows queued before it;
 *   3. the whole path: a manifest accepted here, run through the handler the
 *      worker registered, ends as a READY market_cycles row and one cycle-ready
 *      job keyed by the slot.
 *
 * The bodies are the real sender's manifests (scripts/generate_cycle_manifest_fixtures.py).
 */

const KEY = 'Bearer push_worker_v5_test_key';
const URL = '/api/v1/cycle-manifest';

function fixture(name: string): CycleManifest {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

const refresh = fixture('cycle-manifest-refresh-slot.json');
const plain = fixture('cycle-manifest-plain-slot.json');
const closedNewest = fixture('cycle-manifest-closed-newest.json');

/** The same manifest, moved to another slot (every timestamp by the same whole number of M15 bars). */
function shifted(manifest: CycleManifest, slot: number): CycleManifest {
  const delta = slot - manifest.slot;
  expect(delta % 900).toBe(0);
  const copy: CycleManifest = JSON.parse(JSON.stringify(manifest));
  copy.slot = slot;
  copy.built_at += delta;
  for (const cycle of Object.values(copy.timeframes)) {
    cycle.started_at += delta;
    cycle.validated_at += delta;
    cycle.export_mtime += delta;
    cycle.oldest_bar_ts += delta;
    cycle.newest_bar_ts += delta;
  }
  return copy;
}

function without(manifest: CycleManifest, field: string): unknown {
  const copy: Record<string, unknown> = JSON.parse(JSON.stringify(manifest));
  delete copy[field];
  return copy;
}

function queueMock() {
  return {
    add: jest
      .fn()
      .mockImplementation((_name, data, opts) =>
        Promise.resolve({ id: opts.jobId, data })
      ),
    getJob: jest.fn().mockResolvedValue(null),
    client: { ping: jest.fn().mockResolvedValue('PONG') },
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getPausedCount: jest.fn().mockResolvedValue(0),
    // @nestjs/bull's BullExplorer calls these on every queue that has a
    // processor during app.init(); here they also record what it registered.
    process: jest.fn(),
    on: jest.fn(),
  };
}

describe('POST /api/v1/cycle-manifest (e2e)', () => {
  let app: INestApplication;
  let syncQueue: ReturnType<typeof queueMock>;
  let otherQueue: ReturnType<typeof queueMock>;
  let readyQueue: FakeQueue;
  let prisma: FakePrisma;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    // market-data-sync gets its own mock: what the worker registers on it is
    // under test. The other lanes share one, as in the other e2e specs.
    syncQueue = queueMock();
    otherQueue = queueMock();
    readyQueue = new FakeQueue();
    prisma = new FakePrisma();
    Object.assign(prisma, {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(syncQueue)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('currency-gold-indices-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('cycle-ready'))
      .useValue(readyQueue)
      // The symbol-specs queue (build step 2 part 8) -- same reason.
      .overrideProvider(getQueueToken('symbol-specs-sync'))
      .useValue(otherQueue)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  /** What app.init() registered, read before any test clears the mocks. */
  const registered = () => syncQueue.process.mock.calls.slice();
  let registrationsAtInit: unknown[][];
  beforeAll(() => {
    registrationsAtInit = registered();
  });

  beforeEach(() => {
    syncQueue.add.mockClear();
  });

  const post = (body?: unknown, auth: string | null = KEY) => {
    const req = request(app.getHttpServer()).post(URL);
    if (auth !== null) req.set('Authorization', auth);
    return body === undefined ? req.send() : req.send(body as object);
  };

  describe('the API key', () => {
    it('401s a missing Authorization header', async () => {
      await post(refresh, null).expect(401);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('401s a wrong key', async () => {
      await post(refresh, 'Bearer wrong_key').expect(401);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('401s a key that is not a Bearer token', async () => {
      await post(refresh, 'push_worker_v5_test_key').expect(401);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('checks the key before the body: a bad body without a key is a 401, not a 400', async () => {
      await post({ nonsense: true }, null).expect(401);
    });
  });

  describe('a valid manifest', () => {
    it.each([
      ['a refresh slot (M5 and M15)', refresh],
      ['a plain slot (M5 only)', plain],
      ['a slot whose newest row was quarantined', closedNewest],
    ])('accepts %s and queues it behind the rows', async (_label, manifest) => {
      const before = Math.floor(Date.now() / 1000);
      const res = await post(manifest).expect(200);
      const after = Math.floor(Date.now() / 1000);

      const jobId = `cycle_manifest_XAUUSD_${manifest.slot}`;
      expect(res.body).toEqual({
        status: 'queued',
        slot: manifest.slot,
        jobId,
      });
      expect(syncQueue.add).toHaveBeenCalledTimes(1);
      const [name, data, opts] = syncQueue.add.mock.calls[0];
      expect(name).toBe('cycle-manifest');
      expect(opts).toEqual({ jobId });
      expect(data.manifest).toEqual(manifest); // the body as sent, nothing dropped or added
      // the gateway's own arrival time, not the sender's clock
      expect(data.receivedAt).toBeGreaterThanOrEqual(before);
      expect(data.receivedAt).toBeLessThanOrEqual(after);
    });

    it('answers a repeat with 200 and the same job id (the sender retries until acknowledged)', async () => {
      const first = await post(refresh).expect(200);
      const second = await post(refresh).expect(200);
      expect(second.body).toEqual(first.body);
      // both were offered to Bull under the one id; Bull keeps the first
      const ids = syncQueue.add.mock.calls.map((c) => c[2].jobId);
      expect(new Set(ids)).toEqual(
        new Set([`cycle_manifest_XAUUSD_${refresh.slot}`])
      );
    });

    it('different slots get different job ids', async () => {
      const a = await post(refresh).expect(200);
      const b = await post(plain).expect(200);
      expect(a.body.jobId).not.toBe(b.body.jobId);
    });

    it('accepts a slot a few minutes ahead of the gateway clock (clock skew)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const slot = Math.floor((now + 300) / 900) * 900;
      await post(shifted(refresh, slot)).expect(200);
    });
  });

  describe('a manifest the contract refuses', () => {
    const cases: Array<[string, () => unknown, RegExp]> = [
      [
        'a missing top-level field',
        () => without(refresh, 'built_at'),
        /built_at/,
      ],
      [
        'a contract version it does not know',
        () => ({ ...refresh, schema: 'cycle-manifest/2' }),
        /schema/,
      ],
      [
        'a field the contract does not have',
        () => ({ ...refresh, extra: 1 }),
        /extra/,
      ],
      [
        'a slot that is not on a 5-minute boundary',
        () => ({ ...refresh, slot: refresh.slot + 1 }),
        /slot/,
      ],
      [
        'a timeframe cycle without its attempts',
        () => {
          const m = JSON.parse(JSON.stringify(refresh));
          delete m.timeframes.M5.attempts;
          return m;
        },
        /attempts/,
      ],
      [
        'a negative backlog',
        () => ({ ...refresh, backlog_rows: -1 }),
        /backlog_rows/,
      ],
      [
        'a timeframe the pipeline does not carry',
        () => ({
          ...refresh,
          timeframes: { ...refresh.timeframes, H1: refresh.timeframes.M5 },
        }),
        /H1/,
      ],
    ];

    it.each(cases)(
      '400s %s, names the problem, and queues nothing',
      async (_label, make, mentions) => {
        const res = await post(make()).expect(400);
        expect(Array.isArray(res.body.message)).toBe(true);
        expect(res.body.message.join(' ')).toMatch(mentions);
        expect(syncQueue.add).not.toHaveBeenCalled();
      }
    );

    it('400s a body that is not an object (an array)', async () => {
      await post([refresh]).expect(400);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('400s an empty body', async () => {
      const res = await post().expect(400);
      expect(res.body.message.join(' ')).toMatch(/body must be object/);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });

    it('400s a slot that has not happened yet (more than 10 minutes ahead)', async () => {
      const now = Math.floor(Date.now() / 1000);
      const slot = Math.floor((now + 7200) / 900) * 900;
      const res = await post(shifted(refresh, slot)).expect(400);
      expect(res.body.message.join(' ')).toMatch(/ahead of the gateway clock/);
      expect(syncQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('one loop on market-data-sync', () => {
    it('the worker registered exactly one handler on it: the wildcard, concurrency 1', () => {
      expect(registrationsAtInit).toHaveLength(1);
      const [name, concurrency, handler] = registrationsAtInit[0];
      expect(name).toBe('*');
      expect(concurrency).toBe(1);
      expect(typeof handler).toBe('function');
    });

    it('registers nothing on the other lanes that could pick the manifest up', () => {
      // every other process() registration belongs to its own queue's processor
      for (const [name] of otherQueue.process.mock.calls) {
        expect(name).not.toBe('cycle-manifest');
      }
    });
  });

  describe('the whole path: endpoint, queue, handler, database, announcement', () => {
    /**
     * A manifest for the current slot, so it is neither stale nor in the future.
     * Fixed once: both tests below are about the SAME slot.
     */
    const current = shifted(refresh, Math.floor(Date.now() / 1000 / 900) * 900);

    async function runQueuedJob(): Promise<unknown> {
      const [name, data, opts] = syncQueue.add.mock.calls[0];
      const handler = registrationsAtInit[0][2] as (
        job: unknown
      ) => Promise<unknown>;
      return handler({ name, id: opts.jobId, data });
    }

    it('a manifest whose rows landed becomes one READY row and one cycle-ready job', async () => {
      const manifest = current;
      landBars(prisma, manifest);
      landStatistics(prisma, manifest);

      await post(manifest).expect(200);
      const result = await runQueuedJob();

      expect(result).toEqual({ outcome: 'ready' });
      const row = prisma.cycle('XAUUSD', manifest.slot)!;
      expect(row['state']).toBe('READY');
      expect(['FRESH', 'DELAYED']).toContain(row['data_status']);
      expect(row['attempts']).toBe(2);
      expect(row['closed_bars_digest']).toMatch(/^[0-9a-f]{64}$/);

      expect(readyQueue.adds).toHaveLength(1);
      expect(readyQueue.adds[0].name).toBe('cycle-ready');
      expect(readyQueue.adds[0].opts.jobId).toBe(`XAUUSD_${manifest.slot}`);
      expect(readyQueue.adds[0].data).toMatchObject({
        symbol: 'XAUUSD',
        slot: manifest.slot,
        dataStatus: row['data_status'],
        closedBarsDigest: row['closed_bars_digest'],
      });
    });

    it('the same manifest arriving and running again changes nothing (one row, one announcement)', async () => {
      const manifest = current; // landed above
      await post(manifest).expect(200);
      const again = await runQueuedJob();
      expect(again).toEqual({ outcome: 'already-ready' });
      expect(prisma.cycles.size).toBe(1);
      expect(readyQueue.adds).toHaveLength(1);
    });
  });
});
