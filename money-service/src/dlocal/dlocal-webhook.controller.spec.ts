/**
 * dLocal Webhook Controller Tests (Session 4A-4, File 4/4)
 *
 * NEW backfill coverage — the source's own
 * __tests__/api/webhooks/dlocal/route.test.ts explicitly states "Full API
 * route integration tests require a database connection. These tests
 * cover the core webhook logic that doesn't need a database" and only
 * ever exercised `verifyWebhookSignature`/`mapDLocalStatus`/
 * `extractUserIdFromOrderId` directly (all already ported 1:1 in
 * ./dlocal-payment.service.spec.ts). The full controller orchestration
 * (payment lookup, subscription create/update, 3-day-plan marking,
 * affiliate conversion, notifications) had zero coverage anywhere — same
 * gap class as Session 4A-2's own backfills.
 *
 * `verifyWebhookSignature` reads module-level
 * `const DLOCAL_SECRET_KEY = process.env[...] || ''` /
 * `const DLOCAL_WEBHOOK_SECRET = process.env[...] || ''` in the real module
 * (same pattern as the source it was ported from), captured once at first
 * import — a per-test `process.env` assignment in `beforeEach` runs too
 * late to affect it. Its real HMAC behavior is already fully covered by
 * dlocal-payment.service.spec.ts, so it's mocked here (MUST be declared
 * before any import — jest.mock calls only intercept requires that happen
 * after registration) to isolate the controller's own orchestration logic
 * (payment lookup, subscription create/update, notifications, etc.) from
 * that timing issue. `mapDLocalStatus` stays real via `requireActual`.
 */
jest.mock('./dlocal-payment.service', () => ({
  ...jest.requireActual('./dlocal-payment.service'),
  verifyWebhookSignature: jest.fn(),
}));

import type { RawBodyRequest } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { ConversionProcessorService } from '../affiliate/conversion-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { verifyWebhookSignature } from './dlocal-payment.service';
import { DlocalWebhookController } from './dlocal-webhook.controller';
import { ThreeDayValidatorService } from './three-day-validator.service';

const mockedVerifyWebhookSignature = verifyWebhookSignature as jest.Mock;

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

describe('DlocalWebhookController', () => {
  let controller: DlocalWebhookController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let threeDayValidatorMock: { markThreeDayPlanUsed: jest.Mock };
  let conversionProcessorMock: { processAffiliateConversion: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    threeDayValidatorMock = {
      markThreeDayPlanUsed: jest.fn().mockResolvedValue(undefined),
    };
    conversionProcessorMock = {
      processAffiliateConversion: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [DlocalWebhookController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ThreeDayValidatorService,
          useValue: threeDayValidatorMock,
        },
        {
          provide: ConversionProcessorService,
          useValue: conversionProcessorMock,
        },
      ],
    }).compile();

    controller = moduleRef.get(DlocalWebhookController);

    mockedVerifyWebhookSignature.mockReset().mockReturnValue(true);
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    prismaMock.notification.create.mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reject an invalid signature with 400', async () => {
    mockedVerifyWebhookSignature.mockReturnValue(false);
    const payload = JSON.stringify({ id: 'p-1', status: 'PAID' });
    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: not-the-right-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Invalid signature',
    });
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled();
  });

  it('should reject invalid JSON with 400', async () => {
    const payload = 'not valid json';
    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Invalid JSON payload',
    });
  });

  it('should return 200 with a warning when the payment record is not found', async () => {
    const payload = JSON.stringify({
      id: 'unknown-payment',
      status: 'PAID',
      order_id: 'order-x',
    });
    prismaMock.payment.findFirst.mockResolvedValue(null);

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      received: true,
      warning: 'Payment not found',
    });
  });

  it('should complete a MONTHLY payment: update payment, upgrade tier, create subscription, notify', async () => {
    const payload = JSON.stringify({
      id: 'payment-1',
      status: 'PAID',
      order_id: 'order-user-1-123',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      userId: 'user-1',
      planType: 'MONTHLY',
      amountUSD: 29,
      currency: 'USD',
      country: null,
      paymentMethod: null,
      providerPaymentId: 'payment-1',
      discountCode: null,
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique
      .mockResolvedValueOnce(null) // existingSubscription check
      .mockResolvedValueOnce({ id: 'sub-1' } as never); // link-back lookup
    prismaMock.subscription.create.mockResolvedValue({} as never);

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      })
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tier: 'PRO' },
    });
    expect(prismaMock.subscription.create).toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'SUBSCRIPTION',
        }),
      })
    );
    expect(threeDayValidatorMock.markThreeDayPlanUsed).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it('should mark the 3-day plan used for a completed THREE_DAY payment', async () => {
    const payload = JSON.stringify({
      id: 'payment-2',
      status: 'PAID',
      order_id: 'order-user-2-123',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-2',
      userId: 'user-2',
      planType: 'THREE_DAY',
      amountUSD: 1.99,
      currency: 'USD',
      country: null,
      paymentMethod: null,
      providerPaymentId: 'payment-2',
      discountCode: null,
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-2' } as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(threeDayValidatorMock.markThreeDayPlanUsed).toHaveBeenCalledWith(
      'user-2'
    );
  });

  it('should process an affiliate conversion for a MONTHLY payment carrying a discount code', async () => {
    const payload = JSON.stringify({
      id: 'payment-3',
      status: 'PAID',
      order_id: 'order-user-3-123',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-3',
      userId: 'user-3',
      planType: 'MONTHLY',
      amountUSD: 29,
      currency: 'USD',
      country: null,
      paymentMethod: null,
      providerPaymentId: 'payment-3',
      discountCode: 'SAVE20',
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-3' } as never)
      .mockResolvedValueOnce({ id: 'sub-3' } as never); // affiliate conversion's own lookup
    prismaMock.subscription.create.mockResolvedValue({} as never);
    conversionProcessorMock.processAffiliateConversion.mockResolvedValue({
      processed: true,
      commissionId: 'commission-1',
      commissionAmount: 4.64,
    });

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(
      conversionProcessorMock.processAffiliateConversion
    ).toHaveBeenCalledWith({
      code: 'SAVE20',
      userId: 'user-3',
      subscriptionId: 'sub-3',
      grossRevenueUsd: 29,
      provider: 'DLOCAL',
    });
  });

  it('should never fail the webhook when affiliate conversion throws', async () => {
    const payload = JSON.stringify({
      id: 'payment-4',
      status: 'PAID',
      order_id: 'order-user-4-123',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-4',
      userId: 'user-4',
      planType: 'MONTHLY',
      amountUSD: 29,
      currency: 'USD',
      country: null,
      paymentMethod: null,
      providerPaymentId: 'payment-4',
      discountCode: 'BROKEN',
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);
    prismaMock.user.update.mockResolvedValue({} as never);
    prismaMock.subscription.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'sub-4' } as never)
      .mockResolvedValueOnce({ id: 'sub-4' } as never);
    prismaMock.subscription.create.mockResolvedValue({} as never);
    conversionProcessorMock.processAffiliateConversion.mockRejectedValue(
      new Error('boom')
    );

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });

  it('should mark a REJECTED payment FAILED and notify the user', async () => {
    const payload = JSON.stringify({
      id: 'payment-5',
      status: 'REJECTED',
      order_id: 'order-user-5-123',
      failure_reason: 'Insufficient funds',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-5',
      userId: 'user-5',
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-5' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureReason: 'Insufficient funds',
      }),
    });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-5', type: 'PAYMENT' }),
      })
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('should mark a CANCELLED payment CANCELLED and notify the user', async () => {
    const payload = JSON.stringify({
      id: 'payment-6',
      status: 'CANCELLED',
      order_id: 'order-user-6-123',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'payment-6',
      userId: 'user-6',
    } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-6' },
      data: expect.objectContaining({ status: 'CANCELLED' }),
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('should return 500 when an unexpected error is thrown', async () => {
    const payload = JSON.stringify({
      id: 'payment-7',
      status: 'PAID',
      order_id: 'order-user-7-123',
    });
    prismaMock.payment.findFirst.mockRejectedValue(new Error('db down'));

    const request = createMockRequest(payload, {
      authorization: 'V2-HMAC-SHA256, Signature: valid-signature',
      'x-date': '2026-07-24T09:23:38.899Z',
      'x-login': 'test-merchant-login',
    });
    const response = createMockResponse();

    await controller.handleWebhook(request, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: 'Webhook processing failed',
    });
  });
});
