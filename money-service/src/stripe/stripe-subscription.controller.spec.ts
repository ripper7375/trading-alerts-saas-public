/**
 * Stripe Subscription Controller Tests (Session 4A-9, File 3/10)
 */
import { ConfigService } from '@nestjs/config';
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
  let stripeServiceMock: {
    cancelSubscription: jest.Mock;
    createPaymentMethodUpdateSession: jest.Mock;
  };
  let outboxServiceMock: { recordInTransaction: jest.Mock };
  let env: Record<string, string | undefined>;

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
    stripeServiceMock = {
      cancelSubscription: jest.fn().mockResolvedValue({}),
      createPaymentMethodUpdateSession: jest
        .fn()
        .mockResolvedValue({ url: 'https://billing.stripe.com/p/session/x' }),
    };
    outboxServiceMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    env = {
      STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_test_1',
      NEXTAUTH_URL: 'https://app.example.com',
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeSubscriptionController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: OutboxService, useValue: outboxServiceMock },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
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

  describe('createPaymentMethodSession (Manage Subscription S1, W1)', () => {
    const stripeRow = (
      status: string,
      overrides: Record<string, unknown> = {}
    ): never =>
      ({
        status,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_stripe_123',
        dLocalPaymentId: null,
        ...overrides,
      }) as never;

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(stripeRow('ACTIVE'));
    });

    it('opens the card form only, under the configured portal, and returns to /settings/billing', async () => {
      const result = await controller.createPaymentMethodSession(makeRequest());

      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session/x' });
      expect(
        stripeServiceMock.createPaymentMethodUpdateSession
      ).toHaveBeenCalledWith(
        'cus_1',
        'bpc_test_1',
        'https://app.example.com/settings/billing',
        'https://app.example.com/settings/billing?done=card'
      );
    });

    it('reads the subscription with an explicit select', async () => {
      await controller.createPaymentMethodSession(makeRequest());

      expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          status: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          dLocalPaymentId: true,
        },
      });
    });

    it.each([
      ['PRO', 'ACTIVE'],
      ['PRO', 'TRIALING'],
      ['PRO', 'PAST_DUE'],
      // downgraded to FREE by UNPAID: still allowed to fix the card
      ['FREE', 'UNPAID'],
      ['FREE', 'PAST_DUE'],
    ])('allows a %s user whose subscription is %s', async (tier, status) => {
      prismaMock.user.findUnique.mockResolvedValue({ tier } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(stripeRow(status));

      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).resolves.toEqual({ url: 'https://billing.stripe.com/p/session/x' });
    });

    it.each([
      ['FREE', 'CANCELED'],
      ['FREE', 'INACTIVE'],
    ])(
      'refuses a %s user whose subscription is %s (ACTION_NOT_ALLOWED)',
      async (tier, status) => {
        prismaMock.user.findUnique.mockResolvedValue({ tier } as never);
        prismaMock.subscription.findUnique.mockResolvedValue(stripeRow(status));

        await expect(
          controller.createPaymentMethodSession(makeRequest())
        ).rejects.toMatchObject({
          response: { code: 'ACTION_NOT_ALLOWED' },
          status: 400,
        });
        expect(
          stripeServiceMock.createPaymentMethodUpdateSession
        ).not.toHaveBeenCalled();
      }
    );

    it('refuses a dLocal subscription (no card to update)', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow('ACTIVE', {
          dLocalPaymentId: 'dl_1',
          stripeCustomerId: 'cus_1',
        })
      );

      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).rejects.toMatchObject({
        response: { code: 'ACTION_NOT_ALLOWED' },
        status: 400,
      });
    });

    it('answers 400 NO_STRIPE_SUBSCRIPTION when there is no row or no Stripe customer', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).rejects.toMatchObject({
        response: { code: 'NO_STRIPE_SUBSCRIPTION' },
        status: 400,
      });

      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow('ACTIVE', { stripeCustomerId: null })
      );
      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).rejects.toMatchObject({
        response: { code: 'NO_STRIPE_SUBSCRIPTION' },
        status: 400,
      });
    });

    it('answers 404 USER_NOT_FOUND when the user record is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).rejects.toMatchObject({
        response: { code: 'USER_NOT_FOUND' },
        status: 404,
      });
    });

    it.each([['STRIPE_PORTAL_CONFIGURATION_ID'], ['NEXTAUTH_URL']])(
      'answers 503 PORTAL_NOT_CONFIGURED, before reading or creating anything, when %s is unset',
      async (name) => {
        env[name] = undefined;

        await expect(
          controller.createPaymentMethodSession(makeRequest())
        ).rejects.toMatchObject({
          response: { code: 'PORTAL_NOT_CONFIGURED' },
          status: 503,
        });
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        expect(
          stripeServiceMock.createPaymentMethodUpdateSession
        ).not.toHaveBeenCalled();
      }
    );

    it('answers 500 PORTAL_SESSION_ERROR when Stripe fails, without leaking its message', async () => {
      stripeServiceMock.createPaymentMethodUpdateSession.mockRejectedValue(
        new Error('No such configuration: bpc_test_1')
      );

      await expect(
        controller.createPaymentMethodSession(makeRequest())
      ).rejects.toMatchObject({
        response: { code: 'PORTAL_SESSION_ERROR' },
        status: 500,
      });
    });

    it('writes nothing: no user, subscription or outbox write', async () => {
      await controller.createPaymentMethodSession(makeRequest());

      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
    });
  });
});
