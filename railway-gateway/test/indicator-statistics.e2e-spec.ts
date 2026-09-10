process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CAPTURED_AT = 1788930000;

function validStat(overrides: Record<string, unknown> = {}) {
  return {
    terminal_id: 'push_worker_v5',
    symbol: 'XAUUSD',
    timeframe: 'M5',
    source: 'non_a',
    captured_at: CAPTURED_AT,
    live_bar_ts: CAPTURED_AT - 300,
    cycle_id: 42,
    raw_slope: -0.05018,
    anchored_y_int: 4099.00227,
    regression_angle: -6.92,
    window_bars: 616,
    math_lookback: 3000,
    crossings_n: 63,
    model_a_n: 63,
    model_a_r2: -0.0936,
    model_a_mse: 3168.7947,
    model_b_n: 616,
    model_b_r2: -0.1221,
    model_b_mse: 3150.3925,
    uoedt_offset: 76.27874,
    loedt_offset: -107.26911,
    containment_n: 616,
    containment_count: 580,
    containment_rate: 94.16,
    config_hash: 'a'.repeat(64),
    config_params: { 'Regression Centroids (Box B)': '6' },
    ...overrides,
  };
}

describe('IndicatorStatisticsController (e2e)', () => {
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
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(queueMock)
      // Every registered queue must be overridden, not just this spec's own.
      // An un-mocked queue genuinely tries to reach Redis and fails the suite
      // in teardown while every test still passes.
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(queueMock)
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        marketDataV6: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorConfig: { upsert: jest.fn().mockResolvedValue({}) },
        indicatorStatistic: { upsert: jest.fn().mockResolvedValue({}) },
        economicEvent: { upsert: jest.fn().mockResolvedValue({}) },
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

  it('accepts a batch and enqueues one job per element', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([validStat(), validStat({ source: 'cherry_a' })])
      .expect(200);

    expect(res.body.queued).toBe(2);
    expect(res.body.jobIds).toHaveLength(2);
    expect(queueMock['add']).toHaveBeenCalledTimes(2);
  });

  it('builds the idempotency key from (symbol, timeframe, source, captured_at)', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([validStat()])
      .expect(200);

    expect(queueMock['add']).toHaveBeenCalledWith(
      'process',
      expect.anything(),
      { jobId: `XAUUSD_M5_non_a_${CAPTURED_AT}` }
    );
  });

  it('re-posting the same snapshot reuses the same jobId (idempotent)', async () => {
    const send = () =>
      auth(request(app.getHttpServer()).post('/api/v1/indicator-statistics'))
        .send([validStat()])
        .expect(200);

    const first = await send();
    const second = await send();
    expect(first.body.jobIds[0]).toBe(second.body.jobIds[0]);
  });

  it('401s a missing Authorization header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/indicator-statistics')
      .send([validStat()])
      .expect(401);
  });

  it('rejects a payload missing a required field', async () => {
    const bad = validStat();
    delete (bad as Record<string, unknown>)['config_hash'];
    await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([bad])
      .expect(400);
  });

  it('rejects an unknown source', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([validStat({ source: 'not_a_real_indicator' })])
      .expect(400);
  });

  it('rejects an additional, non-contract field', async () => {
    await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([validStat({ smuggled: 'nope' })])
      .expect(400);
  });

  it('accepts a line-indicator snapshot with the channel fields absent', async () => {
    // resistance/support are single lines, not channels: no MODEL A, no EDT
    // fields. Those columns must be optional, not merely nullable.
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/indicator-statistics')
    )
      .send([
        {
          terminal_id: 'push_worker_v5',
          symbol: 'XAUUSD',
          timeframe: 'M5',
          source: 'resistance',
          captured_at: CAPTURED_AT,
          live_bar_ts: CAPTURED_AT - 300,
          cycle_id: 42,
          solution_found: true,
          raw_slope: 0.02074561,
          anchored_y_int: 4364.6782,
          touches: 28,
          model_b_n: 1440,
          model_b_r2: -0.31,
          config_hash: 'b'.repeat(64),
          config_params: { 'Min Touches': '2' },
        },
      ])
      .expect(200);

    expect(res.body.queued).toBe(1);
  });
});
