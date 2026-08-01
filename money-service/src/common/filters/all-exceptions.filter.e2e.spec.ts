/**
 * Session 4B-4 (F13, Step 6) — proves AllExceptionsFilter is actually wired
 * app-wide against a real Nest app + real Express routing, not just
 * asserted via reading app.module.ts. Same real-Nest-app + supertest
 * pattern as correlation-id.middleware.e2e.spec.ts (Step 4) and
 * dlocal-webhook.throttle.spec.ts (Session 4A-W4).
 */
import {
  Body,
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  Post,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { CORRELATION_ID_HEADER } from '../middleware/correlation-id.middleware';
import { CorrelationIdMiddleware } from '../middleware/correlation-id.middleware';
import { AllExceptionsFilter } from './all-exceptions.filter';

class CreateThingDto {
  @IsString()
  name!: string;
}

@Controller()
class ThrowingController {
  @Post('things')
  create(@Body() _dto: CreateThingDto): { ok: true } {
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('genuinely unhandled');
  }
}

@Module({
  controllers: [ThrowingController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
class FilterTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('/{*splat}');
  }
}

describe('AllExceptionsFilter (app-wide wiring)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FilterTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('formats a 400 validation error into the unified response shape, carrying correlationId', async () => {
    const res = await request(app.getHttpServer())
      .post('/things')
      .set(CORRELATION_ID_HEADER, 'test-correlation-1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/things',
      correlationId: 'test-correlation-1',
    });
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('formats a 404 unmatched route into the unified response shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/does-not-exist')
      .set(CORRELATION_ID_HEADER, 'test-correlation-2');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      path: '/does-not-exist',
      correlationId: 'test-correlation-2',
    });
  });

  it('formats a genuinely unhandled error as a 500 without leaking the raw error message', async () => {
    const res = await request(app.getHttpServer())
      .get('/boom')
      .set(CORRELATION_ID_HEADER, 'test-correlation-3');

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
      correlationId: 'test-correlation-3',
    });
  });
});
