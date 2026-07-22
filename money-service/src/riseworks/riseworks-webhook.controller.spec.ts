/**
 * RiseWorks Webhook Controller Tests
 *
 * The 3 error-path tests are ported from __tests__/api/webhooks/riseworks.test.ts
 * (Session 4A-4, File 4/4) — assertions unchanged (same status codes, same
 * error bodies), rewired from a hand-rolled Next.js Request/NextResponse
 * mock + `jest.mock('@/lib/db/prisma')` to NestJS's testing module
 * (`.overrideProvider`-style DI) + a minimal Express Request/Response mock,
 * same pattern as every other money-service controller/service spec.
 *
 * The success-path and unhandled-event-type tests are NEW backfill
 * coverage — the source route never had a test exercising the full
 * happy path (only the 3 error branches), same gap class as Session
 * 4A-2's own backfills.
 */
import crypto from 'crypto';

import type { RawBodyRequest } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { WebhookEventProcessorService } from '../disbursement/webhook-event-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

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

describe('RiseworksWebhookController', () => {
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

    await controller.handleWebhook(request, response);

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

    await controller.handleWebhook(request, response);

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

    await controller.handleWebhook(request, response);

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

    await controller.handleWebhook(request, response);

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

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Webhook secret not configured',
    });

    process.env['NODE_ENV'] = previousEnv;
  });
});
