process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const BAR_TIME = 1789000000;
const SESSION_OPEN_BAR_TIME = 1788994800;

const ALL_INDEX_NAMES = [
  'XAUX',
  'USDX',
  'EURX',
  'JPYX',
  'GBPX',
  'AUDX',
  'NZDX',
  'CADX',
  'CHFX',
];

function validIndex(overrides: Record<string, unknown> = {}) {
  return {
    terminal_id: 'currency_gold_index_engine_v1',
    index_name: 'USDX',
    bar_time: BAR_TIME,
    value: 100.14,
    change_pct: 0.14,
    session_open_bar_time: SESSION_OPEN_BAR_TIME,
    ...overrides,
  };
}

function fullCycleBatch() {
  return ALL_INDEX_NAMES.map((name, i) =>
    validIndex({
      index_name: name,
      value: 100 + i * 0.1,
      change_pct: i * 0.1,
      // XAUX has its own, independent session-open bar (01:01 vs 00:00
      // server time) -- confirmed distinct in a real push, per
      // currency_gold_index_engine.py's compute_cycle().
      session_open_bar_time:
        name === 'XAUX' ? SESSION_OPEN_BAR_TIME + 60 : SESSION_OPEN_BAR_TIME,
    })
  );
}

describe('CurrencyGoldIndicesController (e2e)', () => {
  let app: INestApplication;
  let queueMock: Record<string, jest.Mock | object>;

  beforeAll(async () => {
    queueMock = {
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
      // BullExplorer calls these during app.init() to wire @Process handlers.
      process: jest.fn(),
      on: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Every registered queue must be overridden, not just this spec's own.
      // An un-mocked queue genuinely tries to reach Redis and fails the suite
      // in teardown while every test still passes.
      .overrideProvider(getQueueToken('currency-gold-indices-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(queueMock)
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        marketDataV6: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorConfig: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorStatistic: { upsert: jest.fn().mockResolvedValue({}) },
        economicEvent: { upsert: jest.fn().mockResolvedValue({}) },
        currencyGoldIndex: { upsert: jest.fn().mockResolvedValue({}) },
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
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const auth = (req: request.Test) =>
    req.set('Authorization', 'Bearer push_worker_v5_test_key');

  it('accepts a full 9-row push cycle (8 currency indices + XAUX) and enqueues one job per element', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send(fullCycleBatch())
      .expect(200);

    expect(res.body.queued).toBe(9);
    expect(res.body.jobIds).toHaveLength(9);
    expect(queueMock['add']).toHaveBeenCalledTimes(9);
  });

  it('accepts a partial push (e.g. only currency indices, gold session not yet open)', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([validIndex()])
      .expect(200);

    expect(res.body.queued).toBe(1);
  });

  it('builds the idempotency key from (index_name, bar_time)', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([validIndex()])
      .expect(200);

    expect(queueMock['add']).toHaveBeenCalledWith(
      'process',
      expect.anything(),
      { jobId: `USDX_${BAR_TIME}` }
    );
  });

  it('re-posting the same bar reuses the same jobId (idempotent)', async () => {
    const send = () =>
      auth(request(app.getHttpServer()).post('/api/v1/currency-gold-indices'))
        .send([validIndex()])
        .expect(200);

    const first = await send();
    const second = await send();
    expect(first.body.jobIds[0]).toBe(second.body.jobIds[0]);
  });

  it('a different index_name at the same bar_time is a DIFFERENT job (key includes index_name)', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([
        validIndex({ index_name: 'USDX' }),
        validIndex({ index_name: 'EURX' }),
      ])
      .expect(200);

    const jobIds = (queueMock['add'] as jest.Mock).mock.calls.map(
      (c) => c[2].jobId
    );
    expect(new Set(jobIds).size).toBe(2);
  });

  it('401s a missing Authorization header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/currency-gold-indices')
      .send([validIndex()])
      .expect(401);
  });

  it('401s an invalid API key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/currency-gold-indices')
      .set('Authorization', 'Bearer wrong_key')
      .send([validIndex()])
      .expect(401);
  });

  it('rejects an unknown index_name', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([validIndex({ index_name: 'DXY' })])
      .expect(400);
  });

  it('rejects a payload missing a required field', async () => {
    const bad = validIndex();
    delete (bad as Record<string, unknown>)['session_open_bar_time'];
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([bad])
      .expect(400);
  });

  it('rejects an unknown field with 400, not a silent 200', async () => {
    // ParseArrayPipe builds its OWN internal ValidationPipe and does not
    // inherit the global one from main.ts. Without whitelist/
    // forbidNonWhitelisted passed explicitly in the controller, this returns
    // 200 and the stray field reaches Prisma as an unknown column -- the
    // real gap first found on the indicator-statistics endpoint.
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([{ ...validIndex(), smuggled: 'nope' }])
      .expect(400);
  });

  it('rejects a non-array body (this lane is always a batch, even for one row)', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send(validIndex())
      .expect(400);
  });

  it('XAUX and the currency indices in the same batch can carry different session_open_bar_time (independent daily inceptions)', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/currency-gold-indices')
    )
      .send([
        validIndex({
          index_name: 'USDX',
          session_open_bar_time: SESSION_OPEN_BAR_TIME,
        }),
        validIndex({
          index_name: 'XAUX',
          session_open_bar_time: SESSION_OPEN_BAR_TIME + 60,
        }),
      ])
      .expect(200);

    expect(res.body.queued).toBe(2);
  });
});
