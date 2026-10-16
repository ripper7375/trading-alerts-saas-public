// Must be set before AppModule is imported: ThrottlerModule.forRoot() reads it
// when the module metadata is evaluated.
process.env['RATE_LIMIT_MAX'] = '3';
process.env['API_KEYS'] = 'throttle_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import { getQueueToken } from '@nestjs/bull';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { CurrencyGoldIndicesController } from '../src/gateway/currency-gold-indices.controller';
import { CycleManifestController } from '../src/gateway/cycle-manifest.controller';
import { CyclesController } from '../src/gateway/cycles.controller';
import { EconomicEventsController } from '../src/gateway/economic-events.controller';
import { IndicatorStatisticsController } from '../src/gateway/indicator-statistics.controller';
import { MarketDataController } from '../src/gateway/market-data.controller';
import { ActiveIndicatorController } from '../src/gateway/active-indicator.controller';
import { SymbolSpecsController } from '../src/gateway/symbol-specs.controller';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Remediation Tier 1 §5.6 (approved by Davin 2026-10-16): main.ts turns on
 * `trust proxy`, so ThrottlerGuard counts callers by their real address, and
 * the six API-key-authenticated ingestion POSTs carry @SkipThrottle() so a
 * burst from the single Vultr VPS address is never throttled. Reads stay
 * throttled. ThrottlerGuard is a global guard and runs BEFORE ApiKeyGuard,
 * so a request with a wrong key reaches 401 only if it was not throttled.
 */

// metadata key written by @SkipThrottle() for the default throttler
const SKIP_KEY = 'THROTTLER:SKIPdefault';

const INGESTION_POSTS: Array<[string, string, Function, string]> = [
  [
    'MarketDataController',
    '/api/v1/market-data',
    MarketDataController,
    'publishMarketData',
  ],
  [
    'IndicatorStatisticsController',
    '/api/v1/indicator-statistics',
    IndicatorStatisticsController,
    'publishStatistics',
  ],
  [
    'EconomicEventsController',
    '/api/v1/economic-events',
    EconomicEventsController,
    'publishEvents',
  ],
  [
    'CurrencyGoldIndicesController',
    '/api/v1/currency-gold-indices',
    CurrencyGoldIndicesController,
    'publishIndices',
  ],
  [
    'SymbolSpecsController',
    '/api/v1/symbol-specs',
    SymbolSpecsController,
    'publishSpecs',
  ],
  [
    'CycleManifestController',
    '/api/v1/cycle-manifest',
    CycleManifestController,
    'publishManifest',
  ],
];

describe('ingestion throttling (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const queueMock = {
      add: jest.fn(),
      getJob: jest.fn().mockResolvedValue(null),
      client: { ping: jest.fn().mockResolvedValue('PONG') },
      process: jest.fn(),
      on: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('currency-gold-indices-sync'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('cycle-ready'))
      .useValue(queueMock)
      .overrideProvider(getQueueToken('symbol-specs-sync'))
      .useValue(queueMock)
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    // as main.ts does
    app.set('trust proxy', 1);
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

  describe('the six ingestion POSTs opt out', () => {
    it.each(INGESTION_POSTS)(
      '%s: the handler carries @SkipThrottle()',
      (_name, _path, controller, handler) => {
        const method = controller.prototype[handler] as object;
        expect(Reflect.getMetadata(SKIP_KEY, method)).toBe(true);
      }
    );

    it.each(INGESTION_POSTS)(
      '%s: %s is never answered 429, however many requests arrive from one address',
      async (_name, path) => {
        // limit is 3 per minute; a throttled route would answer 429 from the 4th request
        const statuses: number[] = [];
        for (let i = 0; i < 8; i++) {
          const res = await request(app.getHttpServer())
            .post(path)
            .set('X-Forwarded-For', '203.0.113.7')
            .set('Authorization', 'Bearer wrong-key')
            .send({});
          statuses.push(res.status);
        }
        expect(statuses).not.toContain(429);
        // it still reached the API-key guard
        expect(new Set(statuses)).toEqual(new Set([401]));
      }
    );
  });

  describe('everything else stays throttled', () => {
    const STILL_THROTTLED: Array<[string, Function, string]> = [
      ['CyclesController.current', CyclesController, 'current'],
      ['ActiveIndicatorController.list', ActiveIndicatorController, 'list'],
      ['ActiveIndicatorController.set', ActiveIndicatorController, 'set'],
    ];

    it.each(STILL_THROTTLED)(
      '%s has no skip metadata',
      (_name, controller, handler) => {
        const method = controller.prototype[handler] as object;
        expect(Reflect.getMetadata(SKIP_KEY, method)).toBeUndefined();
        expect(Reflect.getMetadata(SKIP_KEY, controller)).toBeUndefined();
      }
    );

    it('answers 429 to a read endpoint once the per-address limit is spent', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/cycles/current')
          .set('X-Forwarded-For', '198.51.100.1')
          .set('Authorization', 'Bearer wrong-key');
        statuses.push(res.status);
      }
      expect(statuses).toEqual([401, 401, 401, 429, 429]);
    });
  });

  describe('trust proxy: callers are counted by their real address', () => {
    it('gives each X-Forwarded-For address its own bucket', async () => {
      const hit = async (ip: string) =>
        (
          await request(app.getHttpServer())
            .get('/api/v1/active-indicator')
            .set('X-Forwarded-For', ip)
            .set('Authorization', 'Bearer wrong-key')
        ).status;

      // spend address A's whole allowance
      expect([await hit('192.0.2.10'), await hit('192.0.2.10')]).toEqual([
        401, 401,
      ]);
      expect(await hit('192.0.2.10')).toBe(401);
      expect(await hit('192.0.2.10')).toBe(429);

      // address B is unaffected by A's traffic
      expect(await hit('192.0.2.11')).toBe(401);
    });
  });
});
