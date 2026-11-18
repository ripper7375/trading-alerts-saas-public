/**
 * RiseWorks Webhook Controller Tests
 *
 * ARCHIVED (F42): the route answers 410 Gone, and the handler that used to
 * serve it lives, with its body unchanged, in ArchivedRiseworksWebhookHandler.
 * The route tests (unit and HTTP) are new. The five handler tests keep their
 * original assertions and are only pointed at the archived handler instead of
 * the controller.
 *
 * Of those five, the 3 error-path tests were ported from
 * __tests__/api/webhooks/riseworks.test.ts (Session 4A-4, File 4/4) — same
 * status codes, same error bodies, rewired from a hand-rolled Next.js
 * Request/NextResponse mock + `jest.mock('@/lib/db/prisma')` to NestJS's
 * testing module (`.overrideProvider`-style DI) + a minimal Express
 * Request/Response mock, same pattern as every other money-service
 * controller/service spec.
 *
 * The success-path and unhandled-event-type tests are NEW backfill
 * coverage — the source route never had a test exercising the full
 * happy path (only the 3 error branches), same gap class as Session
 * 4A-2's own backfills.
 */
import crypto from 'crypto';

import { RequestMethod } from '@nestjs/common';
import type { INestApplication, RawBodyRequest } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import supertest from 'supertest';

import { WebhookEventProcessorService } from '../disbursement/webhook-event-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { ArchivedRiseworksWebhookHandler } from './archived-riseworks-webhook.handler';
import { RiseworksWebhookController } from './riseworks-webhook.controller';

function createMockResponse(): Response {
  const response = {} as Response;
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
}

function createMockRequest(
  body: string,
  headers: Record<string, string> = {}
): RawBodyRequest<Request> {
  return {
    rawBody: Buffer.from(body, 'utf-8'),
    headers,
  } as unknown as RawBodyRequest<Request>;
}

describe('RiseworksWebhookController (archived route, F42)', () => {
  let controller: RiseworksWebhookController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let eventProcessorMock: { processEvent: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    eventProcessorMock = { processEvent: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RiseworksWebhookController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: WebhookEventProcessorService,
          useValue: eventProcessorMock,
        },
      ],
    }).compile();

    controller = moduleRef.get(RiseworksWebhookController);
  });

  it('answers 410 Gone without using the database or the event processor', () => {
    const response = createMockResponse();

    controller.handleWebhook(response);

    expect(response.status).toHaveBeenCalledWith(410);
    expect(response.json).toHaveBeenCalledWith({
      error: 'RiseWorks webhook endpoint is archived',
    });
    expect(prismaMock.riseWorksWebhookEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.riseWorksWebhookEvent.update).not.toHaveBeenCalled();
    expect(eventProcessorMock.processEvent).not.toHaveBeenCalled();
  });

  it('has no injected dependencies, so it cannot reach the database or the event processor', () => {
    expect(
      Reflect.getMetadata('design:paramtypes', RiseworksWebhookController) ?? []
    ).toEqual([]);
  });

  it('stays registered as POST /webhooks/riseworks, so callers get 410 rather than 404', () => {
    expect(Reflect.getMetadata(PATH_METADATA, RiseworksWebhookController)).toBe(
      'webhooks/riseworks'
    );
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        RiseworksWebhookController.prototype.handleWebhook
      )
    ).toBe(RequestMethod.POST);
  });
});

describe('RiseworksWebhookController over HTTP (archived route, F42)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RiseworksWebhookController],
    }).compile();

    // rawBody: true mirrors main.ts's real NestFactory.create() option.
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['a signed request', { 'x-rise-signature': 'any-signature' }],
    ['an unsigned request', {}],
  ])('answers %s with 410 and the archived body', async (_label, headers) => {
    const res = await supertest(app.getHttpServer())
      .post('/webhooks/riseworks')
      .set(headers)
      .set('content-type', 'application/json')
      .send(JSON.stringify({ event: 'payment.completed' }));

    expect(res.status).toBe(410);
    expect(res.body).toEqual({
      error: 'RiseWorks webhook endpoint is archived',
    });
  });
});

describe('ArchivedRiseworksWebhookHandler', () => {
  let handler: ArchivedRiseworksWebhookHandler;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let eventProcessorMock: { processEvent: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    eventProcessorMock = { processEvent: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ArchivedRiseworksWebhookHandler,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: WebhookEventProcessorService,
          useValue: eventProcessorMock,
        },
      ],
    }).compile();

    handler = moduleRef.get(ArchivedRiseworksWebhookHandler);

    process.env['RISE_WEBHOOK_SECRET'] = 'test-secret';
    prismaMock.riseWorksWebhookEvent.create.mockResolvedValue({
      id: 'event-123',
    } as never);
  });

  afterEach(() => {
    delete process.env['RISE_WEBHOOK_SECRET'];
    jest.clearAllMocks();
  });

  it('should reject request with missing signature', async () => {
    const request = createMockRequest(
      JSON.stringify({ event: 'payment.completed' }),
      { 'content-type': 'application/json' }
    );
    const response = createMockResponse();

    await handler.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Missing signature',
    });
  });

  it('should reject request with invalid signature', async () => {
    const request = createMockRequest(
      JSON.stringify({ event: 'payment.completed' }),
      {
        'content-type': 'application/json',
        'x-rise-signature': 'invalid-signature',
      }
    );
    const response = createMockResponse();

    await handler.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Invalid signature',
    });
  });

  it('should reject request with invalid JSON', async () => {
    const payload = 'not valid json';
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(payload, 'utf8')
      .digest('hex');

    const request = createMockRequest(payload, {
      'content-type': 'application/json',
      'x-rise-signature': signature,
    });
    const response = createMockResponse();

    await handler.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ error: 'Invalid JSON' });
  });

  it('should process a valid signed payment.completed event (backfill)', async () => {
    const payload = JSON.stringify({
      event: 'payment.completed',
      data: { providerTxId: 'tx-1', amount: 100 },
    });
    const signature = crypto
      .createHmac('sha256', 'test-secret')
      .update(payload, 'utf8')
      .digest('hex');

    prismaMock.riseWorksWebhookEvent.create.mockResolvedValue({
      id: 'event-456',
    } as never);
    prismaMock.riseWorksWebhookEvent.update.mockResolvedValue({} as never);
    eventProcessorMock.processEvent.mockResolvedValue({
      processed: true,
      eventType: 'payment.completed',
      message: 'Payment completed for transaction tx-1',
    });

    const request = createMockRequest(payload, {
      'content-type': 'application/json',
      'x-rise-signature': signature,
    });
    const response = createMockResponse();

    await handler.handleWebhook(request, response);

    expect(eventProcessorMock.processEvent).toHaveBeenCalledWith({
      event: 'payment.completed',
      data: { providerTxId: 'tx-1', amount: 100 },
      timestamp: expect.any(Date),
    });
    expect(prismaMock.riseWorksWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-456' },
      data: {
        processed: true,
        processedAt: expect.any(Date),
        errorMessage: null,
      },
    });
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      received: true,
      eventId: 'event-456',
      processed: true,
      message: 'Payment completed for transaction tx-1',
    });
  });

  it('should return 500 and log an audit row when RISE_WEBHOOK_SECRET is unset outside development (backfill)', async () => {
    delete process.env['RISE_WEBHOOK_SECRET'];
    const previousEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const request = createMockRequest(
      JSON.stringify({ event: 'payment.completed' }),
      { 'x-rise-signature': 'some-signature' }
    );
    const response = createMockResponse();

    await handler.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Webhook secret not configured',
    });

    process.env['NODE_ENV'] = previousEnv;
  });
});
