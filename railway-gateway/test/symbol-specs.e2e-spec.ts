process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { Job } from 'bull';
import { PrismaService } from '../src/prisma/prisma.service';
import { SymbolSpecDto } from '../src/gateway/dto/symbol-spec.dto';
import { SymbolSpecsProcessor } from '../src/worker/symbol-specs.processor';

/**
 * POST /api/v1/symbol-specs (build step 2 part 8; ADR-066): the broker's
 * figures, one queue job per element, behind the same API-key guard as the
 * other lanes. The contract is gateway_contract_symbol_specs.schema.json; the
 * agreement of the DTO with it is test/symbol-specs-contract.spec.ts.
 */

const CAPTURED_AT = 1789000000;

function validSpec(overrides: Record<string, unknown> = {}) {
  return {
    terminal_id: 'MT5-A',
    symbol: 'XAUUSD',
    captured_at: CAPTURED_AT,
    contract_size: 100,
    volume_min: 0.01,
    volume_step: 0.01,
    volume_max: 100,
    tick_size: 0.01,
    typical_spread: 18,
    swap_long: -25.3,
    swap_short: 0, // a REAL zero
    point: 0.01,
    digits: 2,
    swap_mode: 1,
    ...overrides,
  };
}

function queueMock() {
  return {
    add: jest
      .fn()
      .mockImplementation((_name, data, opts) =>
        Promise.resolve({ id: opts?.jobId, data })
      ),
    getJob: jest.fn().mockResolvedValue(null),
    client: { ping: jest.fn().mockResolvedValue('PONG') },
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getPausedCount: jest.fn().mockResolvedValue(0),
    // BullExplorer calls these during app.init() to wire @Process handlers.
    process: jest.fn(),
    on: jest.fn(),
  };
}

describe('SymbolSpecsController (e2e)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let specsQueue: ReturnType<typeof queueMock>;
  let otherQueue: ReturnType<typeof queueMock>;
  // What Bull was told to run on the specs queue while the app started.
  let registered: unknown[][];
  const symbolSpec = {
    findUnique: jest.fn().mockResolvedValue(null),
    aggregate: jest.fn().mockResolvedValue({ _max: { version: null } }),
    create: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    specsQueue = queueMock();
    otherQueue = queueMock();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Every queue must be overridden. An un-mocked queue genuinely reaches for
      // Redis and fails the suite in teardown while every test still passes.
      .overrideProvider(getQueueToken('symbol-specs-sync'))
      .useValue(specsQueue)
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('currency-gold-indices-sync'))
      .useValue(otherQueue)
      .overrideProvider(getQueueToken('cycle-ready'))
      .useValue(otherQueue)
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        marketDataV6: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorConfig: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorStatistic: { upsert: jest.fn().mockResolvedValue({}) },
        economicEvent: { upsert: jest.fn().mockResolvedValue({}) },
        currencyGoldIndex: { upsert: jest.fn().mockResolvedValue({}) },
        symbolSpec,
      })
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
    registered = specsQueue.process.mock.calls.map((call) => [...call]);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const post = () =>
    request(app.getHttpServer())
      .post('/api/v1/symbol-specs')
      .set('Authorization', 'Bearer push_worker_v5_test_key');

  const jobsQueued = () => specsQueue.add.mock.calls;

  describe('is wired into the app', () => {
    it('has Bull run exactly one handler on the specs queue: the job the controller enqueues, one at a time', () => {
      expect(registered).toHaveLength(1);
      expect(registered[0].slice(0, 2)).toEqual(['process', 1]);
      expect(typeof registered[0][2]).toBe('function');
    });

    it('has the processor in the worker module, built with the real dependency graph', () => {
      expect(
        moduleRef.get(SymbolSpecsProcessor, { strict: false })
      ).toBeInstanceOf(SymbolSpecsProcessor);
    });

    it('records what the controller queued: the two ends fit together, versions in order', async () => {
      await post()
        .send([validSpec(), validSpec({ captured_at: CAPTURED_AT + 86400 })])
        .expect(200);
      const processor = moduleRef.get(SymbolSpecsProcessor, { strict: false });

      symbolSpec.aggregate
        .mockResolvedValueOnce({ _max: { version: null } })
        .mockResolvedValueOnce({ _max: { version: 1 } });
      for (const [name, data, options] of jobsQueued()) {
        await processor.process({
          name,
          id: options.jobId,
          data,
        } as unknown as Job<SymbolSpecDto>);
      }

      expect(
        symbolSpec.create.mock.calls.map(
          (call: [{ data: { version: number; captured_at: number } }]) => [
            call[0].data.captured_at,
            call[0].data.version,
          ]
        )
      ).toEqual([
        [CAPTURED_AT, 1],
        [CAPTURED_AT + 86400, 2],
      ]);
    });
  });

  describe('accepts', () => {
    it('a batch, with one job per element', async () => {
      const res = await post()
        .send([validSpec(), validSpec({ captured_at: CAPTURED_AT + 86400 })])
        .expect(200);

      expect(res.body.queued).toBe(2);
      expect(res.body.jobIds).toEqual([
        `XAUUSD_${CAPTURED_AT}`,
        `XAUUSD_${CAPTURED_AT + 86400}`,
      ]);
      expect(jobsQueued()).toHaveLength(2);
    });

    it("a single element, the day's normal case", async () => {
      const res = await post().send([validSpec()]).expect(200);
      expect(res.body).toEqual({
        queued: 1,
        jobIds: [`XAUUSD_${CAPTURED_AT}`],
      });
    });

    it('a batch as large as the sender ever sends', async () => {
      const batch = Array.from({ length: 20 }, (_, i) =>
        validSpec({ captured_at: CAPTURED_AT + i * 86400 })
      );
      const res = await post().send(batch).expect(200);
      expect(res.body.queued).toBe(20);
      expect(new Set(res.body.jobIds).size).toBe(20);
    });

    it('an empty batch, queueing nothing', async () => {
      const res = await post().send([]).expect(200);
      expect(res.body).toEqual({ queued: 0, jobIds: [] });
      expect(jobsQueued()).toHaveLength(0);
    });

    it('enqueues the named job the processor handles, on the specs queue only', async () => {
      await post().send([validSpec()]).expect(200);
      expect(specsQueue.add).toHaveBeenCalledWith(
        'process',
        expect.objectContaining({ symbol: 'XAUUSD', captured_at: CAPTURED_AT }),
        { jobId: `XAUUSD_${CAPTURED_AT}` }
      );
      expect(otherQueue.add).not.toHaveBeenCalled();
    });

    it('hands the processor the figures exactly as sent', async () => {
      await post().send([validSpec()]).expect(200);
      expect(jobsQueued()[0][1]).toEqual(validSpec());
    });

    it('keys the job by (symbol, captured_at): a retry reuses it, a new observation does not', async () => {
      await post().send([validSpec()]).expect(200);
      const first = jobsQueued()[0][2].jobId;
      jest.clearAllMocks();
      await post().send([validSpec()]).expect(200);
      expect(jobsQueued()[0][2].jobId).toBe(first);
      jest.clearAllMocks();
      await post()
        .send([validSpec({ captured_at: CAPTURED_AT + 300 })])
        .expect(200);
      expect(jobsQueued()[0][2].jobId).not.toBe(first);
      jest.clearAllMocks();
      await post()
        .send([validSpec({ symbol: 'XAUUSD.i' })])
        .expect(200);
      expect(jobsQueued()[0][2].jobId).not.toBe(first);
    });

    it('a real zero stays a zero, and a negative swap stays negative', async () => {
      await post()
        .send([
          validSpec({ swap_long: -25.3, swap_short: 0, typical_spread: 0 }),
        ])
        .expect(200);
      const queued = jobsQueued()[0][1];
      expect(queued.swap_short).toBe(0);
      expect(queued.typical_spread).toBe(0);
      expect(queued.swap_long).toBe(-25.3);
    });
  });

  describe('refuses with 401', () => {
    it('a request with no authorization header', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .send([validSpec()])
        .expect(401);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('a wrong key', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .set('Authorization', 'Bearer not_the_key')
        .send([validSpec()])
        .expect(401);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('a key that is not a Bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .set('Authorization', 'push_worker_v5_test_key')
        .send([validSpec()])
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .set('Authorization', 'Basic push_worker_v5_test_key')
        .send([validSpec()])
        .expect(401);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('an empty Bearer token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .set('Authorization', 'Bearer ')
        .send([validSpec()])
        .expect(401);
    });

    it('checks the key before the body: an invalid body without a key is a 401, not a 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/symbol-specs')
        .send([{ nonsense: true }])
        .expect(401);
    });
  });

  describe('refuses with 400', () => {
    it('an unknown field, not a silent 200', async () => {
      // ParseArrayPipe builds its OWN internal ValidationPipe and does not
      // inherit the global one from main.ts. Without whitelist/forbidNonWhitelisted
      // passed explicitly in the controller this returns 200 and the stray field
      // goes on to the queue.
      await post()
        .send([{ ...validSpec(), not_a_real_field: 'x' }])
        .expect(400);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('commission, which MT5 does not expose and which is not part of this contract', async () => {
      await post()
        .send([validSpec({ commission: 7 })])
        .expect(400);
    });

    it('a missing required field, for every field', async () => {
      for (const field of Object.keys(validSpec())) {
        const complete: Record<string, unknown> = validSpec();
        const { [field]: _dropped, ...without } = complete;
        await post().send([without]).expect(400);
      }
      expect(jobsQueued()).toHaveLength(0);
    });

    it('a null in place of a figure (missing is never zero)', async () => {
      for (const field of Object.keys(validSpec())) {
        await post()
          .send([validSpec({ [field]: null })])
          .expect(400);
      }
      expect(jobsQueued()).toHaveLength(0);
    });

    it('a figure the contract refuses', async () => {
      for (const bad of [
        { contract_size: 0 },
        { contract_size: -100 },
        { volume_min: 0 },
        { volume_step: -0.01 },
        { volume_max: 0 },
        { tick_size: 0 },
        { point: 0 },
        { typical_spread: -1 },
        { digits: -1 },
        { digits: 2.5 },
        { swap_mode: -1 },
        { captured_at: 0 },
        { captured_at: 1.5 },
        { captured_at: 2147483648 },
        { symbol: 'XAU:USD' },
        { symbol: '' },
        { symbol: 'A'.repeat(33) },
        { terminal_id: '' },
      ]) {
        await post()
          .send([validSpec(bad)])
          .expect(400);
      }
      expect(jobsQueued()).toHaveLength(0);
    });

    it('a number sent as text', async () => {
      await post()
        .send([validSpec({ contract_size: '100' })])
        .expect(400);
      await post()
        .send([validSpec({ captured_at: '1789000000' })])
        .expect(400);
    });

    it('a text sent as a number', async () => {
      await post()
        .send([validSpec({ symbol: 5 })])
        .expect(400);
    });

    it('a body that is not an array', async () => {
      await post().send(validSpec()).expect(400);
      await post().send({}).expect(400);
      await post().send('text').expect(400);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('no body at all', async () => {
      await post().expect(400);
    });

    it('a batch with one bad element: the WHOLE batch is refused and nothing is queued', async () => {
      // The sender quarantines a refused batch as a whole, so a refusal must not
      // leave half of it queued.
      await post()
        .send([
          validSpec(),
          validSpec({ captured_at: CAPTURED_AT + 1, contract_size: 0 }),
        ])
        .expect(400);
      expect(jobsQueued()).toHaveLength(0);
    });

    it('says which field is wrong', async () => {
      const res = await post()
        .send([validSpec({ contract_size: 0 })])
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('contract_size');
    });
  });
});
