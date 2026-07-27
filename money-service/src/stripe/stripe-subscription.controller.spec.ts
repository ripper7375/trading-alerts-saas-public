/**
 * Stripe Subscription Controller Tests (Session 4A-9, File 3/10)
 */
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { StripeSubscriptionController } from './stripe-subscription.controller';
import { StripeService } from './stripe.service';

describe('StripeSubscriptionController', () => {
  let controller: StripeSubscriptionController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let stripeServiceMock: { cancelSubscription: jest.Mock };
  let outboxServiceMock: { recordInTransaction: jest.Mock };

  const makeRequest = (userId = 'user-1'): AuthenticatedRequest =>
    ({
      user: {
        id: userId,
        email: 'user@example.com',
        tier: 'PRO',
        role: 'USER',
        isAffiliate: false,
      },
    }) as AuthenticatedRequest;

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    stripeServiceMock = { cancelSubscription: jest.fn().mockResolvedValue({}) };
    outboxServiceMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeSubscriptionController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: OutboxService, useValue: outboxServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(StripeSubscriptionController);
  });

  it('downgrades the user to FREE, cancels in Stripe, and emits SUBSCRIPTION_CANCELLED', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'PRO',
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-row-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_stripe_123',
    } as never);

    const result = await controller.cancel(makeRequest());

    expect(result).toEqual({
      success: true,
      message: 'Subscription cancelled successfully',
      tier: 'FREE',
    });
    expect(stripeServiceMock.cancelSubscription).toHaveBeenCalledWith(
      'sub_stripe_123'
    );
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        tier: 'FREE',
        trialStatus: 'CANCELLED',
      }),
    });
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-row-1' },
      data: { status: 'CANCELED' },
    });
    expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        aggregateType: 'User',
        aggregateId: 'user-1',
        eventType: 'SUBSCRIPTION_CANCELLED',
      })
    );
  });

  it('returns 400 NO_SUBSCRIPTION when the user is already FREE', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'FREE',
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    await expect(controller.cancel(makeRequest())).rejects.toMatchObject({
      response: { code: 'NO_SUBSCRIPTION' },
      status: 400,
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 USER_NOT_FOUND when the user record is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(controller.cancel(makeRequest())).rejects.toMatchObject({
      response: { code: 'USER_NOT_FOUND' },
      status: 404,
    });
  });

  it('continues local cancellation even if the Stripe API call fails (idempotent-by-construction, 4A-W4)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'PRO',
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-row-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_stripe_123',
    } as never);
    stripeServiceMock.cancelSubscription.mockRejectedValue(
      new Error('already canceled')
    );

    const result = await controller.cancel(makeRequest());

    expect(result.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalled();
  });

  it('is safe to call twice in a row (idempotent by construction)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tier: 'PRO',
    } as never);
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-row-1',
      userId: 'user-1',
      stripeSubscriptionId: 'sub_stripe_123',
    } as never);

    const first = await controller.cancel(makeRequest());
    const second = await controller.cancel(makeRequest());

    expect(first).toEqual(second);
  });
});
