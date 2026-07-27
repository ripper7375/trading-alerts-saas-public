/**
 * dLocal Payment Controller Tests (Session 4A-9, File 6/10, File 9/10)
 */
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { DlocalPaymentController } from './dlocal-payment.controller';

jest.mock('./currency-converter.service', () => ({
  convertUSDToLocal: jest.fn(),
}));
jest.mock('./dlocal-payment.service', () => ({
  acquireCreatePaymentLock: jest.fn(),
  createPayment: jest.fn(),
}));
jest.mock('./payment-methods.service', () => ({
  isValidPaymentMethod: jest.fn(),
}));

import { convertUSDToLocal } from './currency-converter.service';
import {
  acquireCreatePaymentLock,
  createPayment,
} from './dlocal-payment.service';
import { isValidPaymentMethod } from './payment-methods.service';

describe('DlocalPaymentController', () => {
  let controller: DlocalPaymentController;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const validBody = {
    country: 'IN',
    paymentMethod: 'UPI',
    planType: 'MONTHLY',
    currency: 'INR',
  };

  const makeRequest = (): AuthenticatedRequest =>
    ({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        tier: 'FREE',
        role: 'USER',
        isAffiliate: false,
      },
    }) as AuthenticatedRequest;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = createPrismaMock();

    (isValidPaymentMethod as jest.Mock).mockReturnValue(true);
    (convertUSDToLocal as jest.Mock).mockResolvedValue({
      localAmount: 2412.5,
      currency: 'INR',
      exchangeRate: 83.19,
      usdAmount: 29,
    });
    (acquireCreatePaymentLock as jest.Mock).mockResolvedValue(true);
    (createPayment as jest.Mock).mockResolvedValue({
      paymentId: 'dlocal-pay-1',
      orderId: 'order-user-1-123',
      paymentUrl: 'https://sandbox.dlocal.com/pay/1',
      status: 'PENDING',
      amount: 29,
      currency: 'INR',
    });

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      tier: 'FREE',
      hasUsedThreeDayPlan: false,
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.payment.create.mockResolvedValue({ id: 'payment-1' } as never);
    prismaMock.payment.update.mockResolvedValue({} as never);

    const moduleRef = await Test.createTestingModule({
      controllers: [DlocalPaymentController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        IdempotencyInterceptor,
        {
          provide: IdempotencyStore,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            claim: jest.fn().mockResolvedValue(true),
            save: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(DlocalPaymentController);
  });

  it('creates a payment and returns the dLocal redirect details', async () => {
    const result = await controller.create(makeRequest(), validBody);

    expect(result).toEqual(
      expect.objectContaining({
        paymentId: 'dlocal-pay-1',
        orderId: 'order-user-1-123',
        paymentUrl: 'https://sandbox.dlocal.com/pay/1',
      })
    );
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          provider: 'DLOCAL',
          status: 'PENDING',
        }),
      })
    );
    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { providerPaymentId: 'dlocal-pay-1' },
    });
  });

  it('returns 400 for an invalid request body', async () => {
    await expect(
      controller.create(makeRequest(), { country: 'XX' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns 400 for a payment method invalid for the country', async () => {
    (isValidPaymentMethod as jest.Mock).mockReturnValue(false);

    await expect(
      controller.create(makeRequest(), validBody)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns 403 when the user already has an active subscription', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'PRO',
      hasUsedThreeDayPlan: false,
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
    } as never);

    await expect(
      controller.create(makeRequest(), validBody)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 403 when re-attempting an already-used 3-day plan', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'FREE',
      hasUsedThreeDayPlan: true,
    } as never);

    await expect(
      controller.create(makeRequest(), { ...validBody, planType: 'THREE_DAY' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns 400 when a discount code is supplied for a THREE_DAY plan', async () => {
    await expect(
      controller.create(makeRequest(), {
        ...validBody,
        planType: 'THREE_DAY',
        discountCode: 'SAVE10',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns 400 for an invalid/expired discount code', async () => {
    prismaMock.affiliateCode.findFirst.mockResolvedValue(null);

    await expect(
      controller.create(makeRequest(), {
        ...validBody,
        discountCode: 'BADCODE',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns 409 DUPLICATE_PAYMENT_REQUEST when the idempotency lock is already held', async () => {
    (acquireCreatePaymentLock as jest.Mock).mockResolvedValue(false);

    await expect(
      controller.create(makeRequest(), validBody)
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'DUPLICATE_PAYMENT_REQUEST' },
    });
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});
