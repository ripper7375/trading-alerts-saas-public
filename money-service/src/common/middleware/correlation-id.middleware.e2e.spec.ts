/**
 * Session 4B-4 (F13, Step 4) — proves CorrelationIdMiddleware is actually
 * wired app-wide against a real Nest app + real Express routing, not just
 * asserted via reading app.module.ts. Mirrors the established real-Nest-
 * app + supertest pattern from dlocal-webhook.throttle.spec.ts
 * (Session 4A-W4).
 */
import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Controller,
  Get,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  CORRELATION_ID_HEADER,
  CorrelationIdMiddleware,
} from './correlation-id.middleware';

@Controller()
class PingController {
  @Get('ping')
  ping(): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [PingController] })
class CorrelationTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('/{*splat}');
  }
}

describe('CorrelationIdMiddleware (app-wide wiring)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CorrelationTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a req_<uuid> correlation ID and returns it as a response header when none is sent', async () => {
    const res = await request(app.getHttpServer()).get('/ping');

    expect(res.status).toBe(200);
    expect(res.headers[CORRELATION_ID_HEADER]).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  it('preserves an incoming x-correlation-id header instead of generating a new one', async () => {
    const res = await request(app.getHttpServer())
      .get('/ping')
      .set(CORRELATION_ID_HEADER, 'caller-supplied-id-123');

    expect(res.status).toBe(200);
    expect(res.headers[CORRELATION_ID_HEADER]).toBe('caller-supplied-id-123');
  });

  it('assigns a distinct correlation ID to each request', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).get('/ping'),
      request(app.getHttpServer()).get('/ping'),
    ]);

    expect(first.headers[CORRELATION_ID_HEADER]).not.toBe(
      second.headers[CORRELATION_ID_HEADER]
    );
  });
});
