/**
 * dLocal Payment Controller Tests (Session 4A-9, File 6/10, File 9/10)
 */
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { DlocalPaymentController } from './dlocal-payment.controller';

jest.mock('./currency-converter.service', () => ({
  convertUSDToLocal: jest.fn(),
}));
jest.mock('./dlocal-payment.service', () => ({
  acquireCreatePaymentLock: jest.fn(),
  createPayment: jest.fn(),
  getMissingDLocalConfig: jest.fn().mockReturnValue([]),
}));
jest.mock('./payment-methods.service', () => ({
  isValidPaymentMethod: jest.fn(),
}));

import { convertUSDToLocal } from './currency-converter.service';
import {
  acquireCreatePaymentLock,
  createPayment,
  getMissingDLocalConfig,
} from './dlocal-payment.service';
import { isValidPaymentMethod } from './payment-methods.service';

describe('DlocalPaymentController', () => {
  let controller: DlocalPaymentController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  const redisClient = { get: jest.fn(), set: jest.fn() };

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
        {
          provide: AffiliateConfigService,
          useValue: {
            getBasePriceUsd: jest.fn().mockResolvedValue(35),
            getThreeDayPriceUsd: jest.fn().mockResolvedValue(2.49),
            getCodesPerMonth: jest.fn().mockResolvedValue(12),
            getAnnualPriceUsd: jest.fn().mockResolvedValue(350),
          },
        },
        { provide: RedisService, useValue: { getClient: () => redisClient } },
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

  it('charges the SystemConfig price, not the fixed $29 / $1.99 defaults', async () => {
    await controller.create(makeRequest(), validBody);
    expect(convertUSDToLocal).toHaveBeenLastCalledWith(
      35,
      expect.any(String),
      redisClient
    );
    expect(prismaMock.payment.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountUSD: 35 }),
      })
    );
  });

  it('charges the SystemConfig annual price for the YEARLY plan', async () => {
    await controller.create(makeRequest(), {
      ...validBody,
      planType: 'YEARLY',
    });
    expect(convertUSDToLocal).toHaveBeenLastCalledWith(
      350,
      expect.any(String),
      redisClient
    );
    expect(prismaMock.payment.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amountUSD: 350, planType: 'YEARLY' }),
      })
    );
  });

  describe('fails closed when payments are not configured (Remediation Tier 2 §6.5)', () => {
    it('answers 503 PAYMENTS_NOT_CONFIGURED before it reads the user, takes the lock or writes a Payment row', async () => {
      (getMissingDLocalConfig as jest.Mock).mockReturnValueOnce([
        'DLOCAL_API_KEY',
      ]);

      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({
        status: 503,
        response: expect.objectContaining({ code: 'PAYMENTS_NOT_CONFIGURED' }),
      });

      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(acquireCreatePaymentLock).not.toHaveBeenCalled();
      expect(prismaMock.payment.create).not.toHaveBeenCalled();
      expect(createPayment).not.toHaveBeenCalled();
    });

    it('does not tell the caller which variable is missing', async () => {
      (getMissingDLocalConfig as jest.Mock).mockReturnValueOnce([
        'DLOCAL_API_KEY',
        'NEXTAUTH_URL',
      ]);

      const error = await controller
        .create(makeRequest(), validBody)
        .catch((e: unknown) => e);

      expect(
        JSON.stringify((error as { response: unknown }).response)
      ).not.toMatch(/DLOCAL_API_KEY|NEXTAUTH_URL/);
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

  describe('an early renewal by an active dLocal subscriber (Manage Subscription S4, W6)', () => {
    const activeDlocal = {
      status: 'ACTIVE',
      dLocalPaymentId: 'dl-old',
      stripeSubscriptionId: null,
      expiresAt: new Date('2026-10-30T00:00:00.000Z'),
    };

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tier: 'PRO',
        hasUsedThreeDayPlan: true,
      } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        activeDlocal as never
      );
    });

    it('creates the payment when the request says renew and the plan is a live dLocal one', async () => {
      const result = await controller.create(makeRequest(), {
        ...validBody,
        renew: true,
      });

      expect(result).toEqual(
        expect.objectContaining({ paymentId: 'dlocal-pay-1' })
      );
      expect(prismaMock.payment.create).toHaveBeenCalledTimes(1);
    });

    it('still answers 403 without the renew flag: an old client cannot slip through', async () => {
      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({ status: 403 });
      expect(prismaMock.payment.create).not.toHaveBeenCalled();
    });

    it('answers 403 when renew is claimed by an active STRIPE subscriber', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        dLocalPaymentId: null,
        stripeSubscriptionId: 'sub_1',
      } as never);

      await expect(
        controller.create(makeRequest(), { ...validBody, renew: true })
      ).rejects.toMatchObject({ status: 403 });
      expect(prismaMock.payment.create).not.toHaveBeenCalled();
    });

    it('answers 403 when renew is claimed and the row has no provider', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        dLocalPaymentId: null,
        stripeSubscriptionId: null,
      } as never);

      await expect(
        controller.create(makeRequest(), { ...validBody, renew: true })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('ignores a discount code on a renewal: the full price is charged and no code is stored', async () => {
      await controller.create(makeRequest(), {
        ...validBody,
        renew: true,
        discountCode: 'SAVE10',
      });

      expect(prismaMock.affiliateCode.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountCode: null,
            discountAmount: 0,
          }),
        })
      );
    });

    it('rejects a non-boolean renew flag as a bad request', async () => {
      await expect(
        controller.create(makeRequest(), { ...validBody, renew: 'yes' })
      ).rejects.toMatchObject({ status: 400 });
    });

    it('a FREE user who sends renew is treated as any new buyer (the flag changes nothing)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tier: 'FREE',
        hasUsedThreeDayPlan: false,
      } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.affiliateCode.findFirst.mockResolvedValue(null as never);

      await expect(
        controller.create(makeRequest(), {
          ...validBody,
          renew: true,
          discountCode: 'SAVE10',
        })
      ).rejects.toMatchObject({ status: 400 });
      // The code was still checked: the flag only matters to an active subscriber.
      expect(prismaMock.affiliateCode.findFirst).toHaveBeenCalled();
    });
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

  describe('a failed dLocal attempt does not linger as PENDING', () => {
    it("marks the Payment row FAILED and still answers with dLocal's reason when dLocal rejects the payment", async () => {
      (createPayment as jest.Mock).mockRejectedValue(
        new Error('The payment was rejected.')
      );

      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({
        status: 500,
        response: { error: 'The payment was rejected.' },
      });

      expect(prismaMock.payment.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'FAILED' },
      });
    });

    it('marks the row FAILED when saving the dLocal payment id fails after dLocal accepted it', async () => {
      prismaMock.payment.update
        .mockRejectedValueOnce(new Error('db down'))
        .mockResolvedValueOnce({} as never);

      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({ status: 500, response: { error: 'db down' } });

      expect(prismaMock.payment.update).toHaveBeenLastCalledWith({
        where: { id: 'payment-1' },
        data: { status: 'FAILED' },
      });
    });

    it('still throws the original error when marking the row FAILED itself fails', async () => {
      (createPayment as jest.Mock).mockRejectedValue(
        new Error('The payment was rejected.')
      );
      prismaMock.payment.update.mockRejectedValue(new Error('db down'));

      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({
        status: 500,
        response: { error: 'The payment was rejected.' },
      });
    });

    it('touches no Payment row when the failure happens before one exists', async () => {
      (convertUSDToLocal as jest.Mock).mockRejectedValue(new Error('no rate'));

      await expect(
        controller.create(makeRequest(), validBody)
      ).rejects.toMatchObject({ status: 500 });

      expect(prismaMock.payment.create).not.toHaveBeenCalled();
      expect(prismaMock.payment.update).not.toHaveBeenCalled();
    });
  });
});
