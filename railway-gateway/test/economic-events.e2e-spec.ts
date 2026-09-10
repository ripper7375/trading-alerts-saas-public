process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const CAPTURED_AT = 1789000000;
const VALUE_ID = '18446744073709551615'; // ULONG_MAX — must survive as a string

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    terminal_id: 'push_worker_v5',
    value_id: VALUE_ID,
    captured_at: CAPTURED_AT,
    event_id: '840010013',
    event_time: CAPTURED_AT + 12345,
    event_period: null,
    revision: 0,
    country_code: 'MX',
    currency: 'MXN',
    event_name: 'Banco de México Rate Decision',
    importance: 'HIGH',
    event_type: 1,
    sector: 2,
    frequency: 3,
    time_mode: 0,
    unit: 4,
    multiplier: 0,
    digits: 2,
    event_code: 'MX-RATE',
    source_url: 'https://banxico.org.mx',
    actual_value: null, // not published yet
    forecast_value: -0.3,
    prev_value: 0.0, // a REAL zero
    revised_prev_value: null,
    impact_type: 2,
    ...overrides,
  };
}

describe('EconomicEventsController (e2e)', () => {
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
      // All three queues must be overridden. An un-mocked queue genuinely
      // reaches for Redis and fails the suite in teardown while every test
      // still passes.
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('market-data-sync'))
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

  const post = () =>
    request(app.getHttpServer())
      .post('/api/v1/economic-events')
      .set('Authorization', 'Bearer push_worker_v5_test_key');

  it('accepts a batch and enqueues one job per element', async () => {
    const res = await post()
      .send([validEvent(), validEvent({ value_id: '999' })])
      .expect(200);

    expect(res.body.queued).toBe(2);
    expect(res.body.jobIds).toHaveLength(2);
    expect(queueMock['add']).toHaveBeenCalledTimes(2);
  });

  it('builds the idempotency key from (value_id, captured_at)', async () => {
    await post().send([validEvent()]).expect(200);

    expect(queueMock['add']).toHaveBeenCalledWith(
      'process',
      expect.anything(),
      {
        jobId: `${VALUE_ID}_${CAPTURED_AT}`,
      }
    );
  });

  it('a later observation of the same release is a DIFFERENT job', async () => {
    // This is what makes the stream append-only rather than self-overwriting:
    // a revised forecast has a new captured_at, so it cannot collide with the
    // pre-release row.
    await post()
      .send([
        validEvent(),
        validEvent({ captured_at: CAPTURED_AT + 900, forecast_value: -0.25 }),
      ])
      .expect(200);

    const jobIds = (queueMock['add'] as jest.Mock).mock.calls.map(
      (c) => c[2].jobId
    );
    expect(new Set(jobIds).size).toBe(2);
  });

  it('re-posting the same observation reuses the jobId (idempotent retry)', async () => {
    await post().send([validEvent()]).expect(200);
    const first = (queueMock['add'] as jest.Mock).mock.calls[0][2].jobId;
    jest.clearAllMocks();
    await post().send([validEvent()]).expect(200);
    const second = (queueMock['add'] as jest.Mock).mock.calls[0][2].jobId;
    expect(second).toBe(first);
  });

  it('preserves a 64-bit value_id as a string', async () => {
    await post().send([validEvent()]).expect(200);
    const queued = (queueMock['add'] as jest.Mock).mock.calls[0][1];
    expect(queued.value_id).toBe(VALUE_ID);
    expect(typeof queued.value_id).toBe('string');
  });

  it('passes nulls through as null, and a real 0.0 as 0', async () => {
    await post().send([validEvent()]).expect(200);
    const queued = (queueMock['add'] as jest.Mock).mock.calls[0][1];
    expect(queued.actual_value).toBeNull();
    expect(queued.revised_prev_value).toBeNull();
    expect(queued.prev_value).toBe(0);
  });

  it('rejects an unknown field with 400, not a silent 200', async () => {
    // ParseArrayPipe builds its OWN internal ValidationPipe and does not
    // inherit the global one from main.ts. Without whitelist/
    // forbidNonWhitelisted passed explicitly in the controller, this returns
    // 200 and the stray field reaches Prisma as an unknown column. That was a
    // real gap found on the indicator-statistics endpoint.
    await post()
      .send([{ ...validEvent(), not_a_real_field: 'x' }])
      .expect(400);
  });

  it('rejects an invalid importance value', async () => {
    await post()
      .send([validEvent({ importance: 'CRITICAL' })])
      .expect(400);
  });

  it('rejects a numeric value_id (64-bit precision guard)', async () => {
    await post()
      .send([validEvent({ value_id: 18446744073709551615 })])
      .expect(400);
  });

  it('rejects a missing required field', async () => {
    const { importance: _dropped, ...withoutImportance } = validEvent();
    await post().send([withoutImportance]).expect(400);
  });

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/economic-events')
      .send([validEvent()])
      .expect(401);
  });
});
