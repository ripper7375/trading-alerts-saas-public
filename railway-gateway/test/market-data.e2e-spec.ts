process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function validBody(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    terminal_id: 'push_worker_v5',
    timestamp: now - 300,
    symbol: 'XAUUSD',
    timeframe: 'M5',
    open: 2382.14,
    high: 2383.02,
    low: 2381.55,
    close: 2382.77,
    volume: 214,
    cycle_id: 1,
    collected_at: now,
    calculated_at: now,
    ...overrides,
  };
}

describe('MarketDataController (e2e)', () => {
  let app: INestApplication;
  let queueMock: {
    add: jest.Mock;
    getJob: jest.Mock;
    client: { ping: jest.Mock };
    getWaitingCount: jest.Mock;
    getActiveCount: jest.Mock;
    getCompletedCount: jest.Mock;
    getFailedCount: jest.Mock;
    getDelayedCount: jest.Mock;
    getPausedCount: jest.Mock;
    // Not exercised by these HTTP-level specs, but @nestjs/bull's
    // BullExplorer calls these on every queue during app.init() to wire up
    // MarketDataProcessor's @Process/@OnQueue* handlers — must exist even on
    // a mock queue, or app.init() itself throws.
    process: jest.Mock;
    on: jest.Mock;
  };
  let prismaMock: { $queryRaw: jest.Mock; marketDataV6: { upsert: jest.Mock } };

  beforeAll(async () => {
    queueMock = {
      add: jest.fn().mockImplementation((_name, data, opts) =>
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
      process: jest.fn(),
      on: jest.fn(),
    };
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      marketDataV6: { upsert: jest.fn().mockResolvedValue({}) },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(queueMock)
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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

  it('200s a well-formed payload and returns the idempotency jobId', async () => {
    const body = validBody();
    const res = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(body)
      .expect(200);

    expect(res.body.status).toBe('queued');
    expect(res.body.jobId).toBe('XAUUSD_M5_' + body.timestamp);
    expect(queueMock.add).toHaveBeenCalledWith(
      'process',
      expect.objectContaining({ symbol: 'XAUUSD' }),
      expect.objectContaining({ jobId: 'XAUUSD_M5_' + body.timestamp })
    );
  });

  it('400s malformed OHLC (high < low)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(validBody({ high: 100, low: 200 }))
      .expect(400);

    expect(res.body.message).toMatch(/high.*cannot be less than low/i);
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it('401s a missing Authorization header', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .send(validBody())
      .expect(401);
  });

  it('401s an invalid API key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer wrong_key')
      .send(validBody())
      .expect(401);
  });

  it('rejects a payload missing a required field', async () => {
    const body = validBody() as Record<string, unknown>;
    delete body['volume'];
    const res = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(body)
      .expect(400);

    expect(res.body.message.join(' ')).toMatch(/volume/i);
  });

  it('rejects a payload with an additional, non-contract field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(validBody({ tema: 1234.5 }))
      .expect(400);

    expect(res.body.message.join(' ')).toMatch(/tema/i);
  });

  it('re-posting the same (symbol, timeframe, timestamp) reuses the same jobId (idempotent)', async () => {
    const body = validBody();
    const first = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(body)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post('/api/v1/market-data')
      .set('Authorization', 'Bearer push_worker_v5_test_key')
      .send(body)
      .expect(200);

    expect(first.body.jobId).toBe(second.body.jobId);
  });

  it('health check reports up when redis/queue/db are reachable', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('healthy');
  });

  it('queue stats endpoint responds with job counts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/queue/stats').expect(200);
    expect(res.body.queue).toBe('market-data-sync');
    expect(res.body.jobs).toEqual(
      expect.objectContaining({ waiting: 0, active: 0, completed: 0, failed: 0 })
    );
  });
});
