/**
 * Stripe Subscription Controller Tests (Session 4A-9, File 3/10; Manage
 * Subscription S1 for the card portal, S2 for cancel at period end and resume)
 */
import { INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { StripeSubscriptionController } from './stripe-subscription.controller';
import { StripeService } from './stripe.service';

describe('StripeSubscriptionController', () => {
  let controller: StripeSubscriptionController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let stripeServiceMock: {
    setCancelAtPeriodEnd: jest.Mock;
    createPaymentMethodUpdateSession: jest.Mock;
    getSubscription: jest.Mock;
    releaseSubscriptionSchedule: jest.Mock;
    proLineItemFor: jest.Mock;
    previewYearlyUpgrade: jest.Mock;
    upgradeToYearlyNow: jest.Mock;
    scheduleSwitchToMonthly: jest.Mock;
  };
  let affiliateConfigMock: {
    getAnnualPriceUsd: jest.Mock;
    getBasePriceUsd: jest.Mock;
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
      setCancelAtPeriodEnd: jest.fn().mockResolvedValue({}),
      createPaymentMethodUpdateSession: jest
        .fn()
        .mockResolvedValue({ url: 'https://billing.stripe.com/p/session/x' }),
      // No schedule attached unless a test says so (S3).
      getSubscription: jest.fn().mockResolvedValue({ schedule: null }),
      releaseSubscriptionSchedule: jest.fn().mockResolvedValue('released'),
      proLineItemFor: jest.fn().mockResolvedValue({ price: 'price_pro' }),
      previewYearlyUpgrade: jest.fn(),
      upgradeToYearlyNow: jest.fn(),
      scheduleSwitchToMonthly: jest.fn(),
    };
    affiliateConfigMock = {
      getAnnualPriceUsd: jest.fn().mockResolvedValue(290),
      getBasePriceUsd: jest.fn().mockResolvedValue(29),
    };
    outboxServiceMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    env = {
      STRIPE_PORTAL_CONFIGURATION_ID: 'bpc_test_1',
      NEXTAUTH_URL: 'https://app.example.com',
      STRIPE_PRO_PRICE_ID: 'price_pro',
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeSubscriptionController],
      providers: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: OutboxService, useValue: outboxServiceMock },
        { provide: AffiliateConfigService, useValue: affiliateConfigMock },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
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

    controller = moduleRef.get(StripeSubscriptionController);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Manage Subscription S2: cancel at the END of the period (W3, D1), resume
  // (W4), and no cancel for a dLocal plan (D8).
  // ───────────────────────────────────────────────────────────────────────────

  const PERIOD_END = new Date('2026-11-21T00:00:00.000Z');
  const PERIOD_END_SECONDS = PERIOD_END.getTime() / 1000;

  const stripeRow = (overrides: Record<string, unknown> = {}): never =>
    ({
      id: 'sub-row-1',
      status: 'ACTIVE',
      stripeSubscriptionId: 'sub_stripe_123',
      stripeCurrentPeriodEnd: new Date(Date.now() + 5 * 86_400_000),
      dLocalPaymentId: null,
      expiresAt: PERIOD_END,
      cancelAtPeriodEnd: false,
      ...overrides,
    }) as never;

  describe('cancel (W3)', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(stripeRow());
      stripeServiceMock.setCancelAtPeriodEnd.mockResolvedValue({
        cancel_at: PERIOD_END_SECONDS,
        current_period_end: PERIOD_END_SECONDS,
      });
    });

    it('asks Stripe to cancel at the period end, records the request, keeps the user on PRO, and emits SUBSCRIPTION_CANCELLED with the date', async () => {
      const result = await controller.cancel(makeRequest(), {
        reason: 'too_expensive',
      });

      expect(stripeServiceMock.setCancelAtPeriodEnd).toHaveBeenCalledWith(
        'sub_stripe_123',
        true
      );
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          cancelAtPeriodEnd: true,
          cancelRequestedAt: expect.any(Date),
          cancellationReason: 'too_expensive',
        },
      });
      // Tier and status stay: the deleted webhook ends PRO at the period end.
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        {
          aggregateType: 'User',
          aggregateId: 'user-1',
          eventType: 'SUBSCRIPTION_CANCELLED',
          payload: {
            tier: 'PRO',
            subscriptionId: 'sub-row-1',
            provider: 'STRIPE',
            cancelAt: '2026-11-21T00:00:00.000Z',
            scheduled: true,
          },
        }
      );
      expect(result).toEqual({
        success: true,
        message:
          'Your subscription will end at the close of the current period',
        tier: 'PRO',
        cancelAtPeriodEnd: true,
        cancelAt: '2026-11-21T00:00:00.000Z',
      });
    });

    it('calls Stripe before it writes anything, so a refusal leaves no trace', async () => {
      await controller.cancel(makeRequest(), {});

      const stripeOrder =
        stripeServiceMock.setCancelAtPeriodEnd.mock.invocationCallOrder[0]!;
      const writeOrder =
        prismaMock.subscription.update.mock.invocationCallOrder[0]!;
      expect(stripeOrder).toBeLessThan(writeOrder);
    });

    it('writes the subscription row and the outbox event in ONE transaction', async () => {
      await controller.cancel(makeRequest(), {});

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reads the user and the subscription with explicit selects (F21)', async () => {
      await controller.cancel(makeRequest(), {});

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { tier: true },
      });
      expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          id: true,
          status: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
          dLocalPaymentId: true,
          expiresAt: true,
          cancelAtPeriodEnd: true,
          pendingPlanType: true,
          stripeScheduleId: true,
        },
      });
    });

    it('uses current_period_end when Stripe sends no cancel_at', async () => {
      stripeServiceMock.setCancelAtPeriodEnd.mockResolvedValue({
        cancel_at: null,
        current_period_end: PERIOD_END_SECONDS,
      });

      const result = await controller.cancel(makeRequest(), {});

      expect(result.cancelAt).toBe('2026-11-21T00:00:00.000Z');
    });

    it('cancels a trial the same way: it ends at the trial end, with no charge', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({ status: 'TRIALING' })
      );

      const result = await controller.cancel(makeRequest(), {});

      expect(result.success).toBe(true);
      expect(stripeServiceMock.setCancelAtPeriodEnd).toHaveBeenCalledWith(
        'sub_stripe_123',
        true
      );
    });

    describe('the reason (B6)', () => {
      it.each([
        ['a code', { reason: 'not_using' }, 'not_using'],
        [
          'free text, trimmed',
          { reason: '  other: too slow ' },
          'other: too slow',
        ],
        [
          'control characters become spaces',
          { reason: 'a\u0000b\nc' },
          'a b c',
        ],
        ['an empty string', { reason: '   ' }, null],
        ['no reason', {}, null],
        ['no body', undefined, null],
        ['a null body', null, null],
        ['a body that is not an object', 'just text', null],
      ])('%s', async (_name, body, expected) => {
        await controller.cancel(makeRequest(), body);

        expect(
          prismaMock.subscription.update.mock.calls[0]![0]!.data
        ).toMatchObject({ cancellationReason: expected });
      });

      it.each([
        ['501 characters', { reason: 'x'.repeat(501) }],
        ['a number', { reason: 5 }],
        ['an object', { reason: { code: 'x' } }],
      ])('refuses %s before it reads anything', async (_name, body) => {
        await expect(
          controller.cancel(makeRequest(), body)
        ).rejects.toMatchObject({
          response: { code: 'INVALID_REASON' },
          status: 400,
        });
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        expect(stripeServiceMock.setCancelAtPeriodEnd).not.toHaveBeenCalled();
      });
    });

    describe('refusals (nothing is called or written)', () => {
      const expectUntouched = (): void => {
        expect(stripeServiceMock.setCancelAtPeriodEnd).not.toHaveBeenCalled();
        expect(prismaMock.subscription.update).not.toHaveBeenCalled();
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
      };

      it('DLOCAL_NO_CANCEL for a dLocal plan, with its expiry (D8, B7)', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({ dLocalPaymentId: 'dl_1', stripeSubscriptionId: null })
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: {
            code: 'DLOCAL_NO_CANCEL',
            expiresAt: '2026-11-21T00:00:00.000Z',
          },
          status: 400,
        });
        expectUntouched();
      });

      it('treats a row with both ids as dLocal, the precedence the page has always had', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({ dLocalPaymentId: 'dl_1' })
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'DLOCAL_NO_CANCEL' },
        });
        expectUntouched();
      });

      it('NO_SUBSCRIPTION for a FREE user', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ tier: 'FREE' } as never);
        prismaMock.subscription.findUnique.mockResolvedValue(null);

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'NO_SUBSCRIPTION' },
          status: 400,
        });
        expectUntouched();
      });

      it('NO_SUBSCRIPTION when there is no row', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(null);

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'NO_SUBSCRIPTION' },
        });
      });

      it('USER_NOT_FOUND when the user record is missing', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'USER_NOT_FOUND' },
          status: 404,
        });
      });

      it('NO_STRIPE_SUBSCRIPTION for a row with neither provider', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({ stripeSubscriptionId: null })
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'NO_STRIPE_SUBSCRIPTION' },
          status: 400,
        });
        expectUntouched();
      });

      it('ALREADY_SCHEDULED when the cancellation is already recorded (a second call changes nothing)', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({ cancelAtPeriodEnd: true })
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'ALREADY_SCHEDULED' },
          status: 400,
        });
        expectUntouched();
      });

      it.each(['PAST_DUE', 'UNPAID'])(
        'ACTION_NOT_ALLOWED while the payment is %s: pay first (plan §6)',
        async (status) => {
          prismaMock.subscription.findUnique.mockResolvedValue(
            stripeRow({ status })
          );

          await expect(
            controller.cancel(makeRequest(), {})
          ).rejects.toMatchObject({
            response: { code: 'ACTION_NOT_ALLOWED' },
            status: 400,
          });
          expectUntouched();
        }
      );
    });

    describe('failures', () => {
      it('records and emits nothing when Stripe refuses, and the user can try again', async () => {
        stripeServiceMock.setCancelAtPeriodEnd.mockRejectedValue(
          new Error('stripe down')
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'CANCEL_ERROR' },
          status: 500,
        });
        expect(prismaMock.subscription.update).not.toHaveBeenCalled();
        expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
      });

      it('answers CANCEL_ERROR when the transaction fails after Stripe agreed (a retry is allowed: the flag is still off in the row)', async () => {
        prismaMock.subscription.update.mockRejectedValue(new Error('db down'));

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: { code: 'CANCEL_ERROR' },
          status: 500,
        });
      });

      it('does not leak Stripe’s message', async () => {
        stripeServiceMock.setCancelAtPeriodEnd.mockRejectedValue(
          new Error('No such subscription: sub_stripe_123')
        );

        await expect(
          controller.cancel(makeRequest(), {})
        ).rejects.toMatchObject({
          response: {
            message: 'Failed to cancel subscription. Please try again.',
          },
        });
      });
    });
  });

  describe('resume (W4)', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({ cancelAtPeriodEnd: true })
      );
      stripeServiceMock.setCancelAtPeriodEnd.mockResolvedValue({
        current_period_end: PERIOD_END_SECONDS,
      });
    });

    it('tells Stripe to stop cancelling, clears the three columns, and emits SUBSCRIPTION_RESUMED with the renewal date', async () => {
      const result = await controller.resume(makeRequest());

      expect(stripeServiceMock.setCancelAtPeriodEnd).toHaveBeenCalledWith(
        'sub_stripe_123',
        false
      );
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          cancelAtPeriodEnd: false,
          cancelRequestedAt: null,
          cancellationReason: null,
        },
      });
      expect(outboxServiceMock.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        {
          aggregateType: 'User',
          aggregateId: 'user-1',
          eventType: 'SUBSCRIPTION_RESUMED',
          payload: {
            tier: 'PRO',
            subscriptionId: 'sub-row-1',
            provider: 'STRIPE',
            renewsAt: '2026-11-21T00:00:00.000Z',
          },
        }
      );
      expect(result).toEqual({
        success: true,
        message: 'Your subscription will continue',
        tier: 'PRO',
        cancelAtPeriodEnd: false,
        renewsAt: '2026-11-21T00:00:00.000Z',
      });
    });

    it('calls Stripe before it writes anything, and writes in ONE transaction', async () => {
      await controller.resume(makeRequest());

      expect(
        stripeServiceMock.setCancelAtPeriodEnd.mock.invocationCallOrder[0]!
      ).toBeLessThan(
        prismaMock.subscription.update.mock.invocationCallOrder[0]!
      );
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('never touches the user’s tier', async () => {
      await controller.resume(makeRequest());

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('resumes a trial that was set to end', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({ cancelAtPeriodEnd: true, status: 'TRIALING' })
      );

      await expect(controller.resume(makeRequest())).resolves.toMatchObject({
        success: true,
      });
    });

    it('resumes when the stored period end is unknown and lets Stripe judge', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({ cancelAtPeriodEnd: true, stripeCurrentPeriodEnd: null })
      );

      await expect(controller.resume(makeRequest())).resolves.toMatchObject({
        success: true,
      });
    });

    describe('refusals (nothing is called or written)', () => {
      const expectUntouched = (): void => {
        expect(stripeServiceMock.setCancelAtPeriodEnd).not.toHaveBeenCalled();
        expect(prismaMock.subscription.update).not.toHaveBeenCalled();
        expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
      };

      it('NOT_SCHEDULED when no cancellation is recorded', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(stripeRow());

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'NOT_SCHEDULED' },
          status: 400,
        });
        expectUntouched();
      });

      it('PERIOD_ENDED once the period end has passed', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({
            cancelAtPeriodEnd: true,
            stripeCurrentPeriodEnd: new Date(Date.now() - 1000),
          })
        );

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'PERIOD_ENDED' },
          status: 400,
        });
        expectUntouched();
      });

      it('NO_STRIPE_SUBSCRIPTION for a dLocal plan: nothing to resume (D8)', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          stripeRow({
            cancelAtPeriodEnd: true,
            dLocalPaymentId: 'dl_1',
            stripeSubscriptionId: null,
          })
        );

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'NO_STRIPE_SUBSCRIPTION' },
          status: 400,
        });
        expectUntouched();
      });

      it('NO_SUBSCRIPTION for a FREE user or a missing row', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ tier: 'FREE' } as never);
        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'NO_SUBSCRIPTION' },
        });

        prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
        prismaMock.subscription.findUnique.mockResolvedValue(null);
        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'NO_SUBSCRIPTION' },
        });
        expectUntouched();
      });

      it('USER_NOT_FOUND when the user record is missing', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'USER_NOT_FOUND' },
          status: 404,
        });
      });

      it.each(['PAST_DUE', 'UNPAID'])(
        'ACTION_NOT_ALLOWED while the payment is %s: pay first',
        async (status) => {
          prismaMock.subscription.findUnique.mockResolvedValue(
            stripeRow({ cancelAtPeriodEnd: true, status })
          );

          await expect(controller.resume(makeRequest())).rejects.toMatchObject({
            response: { code: 'ACTION_NOT_ALLOWED' },
            status: 400,
          });
          expectUntouched();
        }
      );
    });

    describe('failures', () => {
      it('records and emits nothing when Stripe refuses (for example the subscription just ended)', async () => {
        stripeServiceMock.setCancelAtPeriodEnd.mockRejectedValue(
          new Error('No such subscription')
        );

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'RESUME_ERROR' },
          status: 500,
        });
        expect(prismaMock.subscription.update).not.toHaveBeenCalled();
        expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
      });

      it('answers RESUME_ERROR when the transaction fails after Stripe agreed', async () => {
        prismaMock.subscription.update.mockRejectedValue(new Error('db down'));

        await expect(controller.resume(makeRequest())).rejects.toMatchObject({
          response: { code: 'RESUME_ERROR' },
          status: 500,
        });
      });
    });
  });

  describe('idempotency', () => {
    it.each(['cancel', 'resume'] as const)(
      'the %s route is behind the Idempotency-Key interceptor, like the other write routes',
      (name) => {
        const interceptors = Reflect.getMetadata(
          INTERCEPTORS_METADATA,
          StripeSubscriptionController.prototype[name]
        ) as unknown[];
        expect(interceptors).toContain(IdempotencyInterceptor);
      }
    );

    it('the card-update route is not: a cached portal link would be dead within minutes', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        StripeSubscriptionController.prototype.createPaymentMethodSession
      ) as unknown[] | undefined;
      expect(interceptors ?? []).not.toContain(IdempotencyInterceptor);
    });
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

  // ───────────────────────────────────────────────────────────────────────────
  // Manage Subscription S3: cancelling releases a plan-switch schedule first.
  // Stripe refuses `cancel_at_period_end` while a schedule manages the
  // subscription (observed in test mode), including the finished phase 2 of a
  // switch to monthly.
  // ───────────────────────────────────────────────────────────────────────────
  describe('cancel with a plan-switch schedule (S3, W3)', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
      stripeServiceMock.setCancelAtPeriodEnd.mockResolvedValue({
        cancel_at: PERIOD_END_SECONDS,
        current_period_end: PERIOD_END_SECONDS,
      });
    });

    it('releases the schedule Stripe shows, clears the pending fields, and only then cancels', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({
          pendingPlanType: 'MONTHLY',
          stripeScheduleId: 'sub_sched_1',
        })
      );
      stripeServiceMock.getSubscription.mockResolvedValue({
        schedule: 'sub_sched_1',
      });
      const calls: string[] = [];
      stripeServiceMock.releaseSubscriptionSchedule.mockImplementation(
        async () => {
          calls.push('release');
          return 'released';
        }
      );
      prismaMock.subscription.update.mockImplementation((async (args: {
        data: Record<string, unknown>;
      }) => {
        calls.push(
          'cancelAtPeriodEnd' in args.data ? 'row-cancel' : 'row-clear'
        );
        return {};
      }) as never);
      stripeServiceMock.setCancelAtPeriodEnd.mockImplementation(async () => {
        calls.push('stripe-cancel');
        return {
          cancel_at: PERIOD_END_SECONDS,
          current_period_end: PERIOD_END_SECONDS,
        };
      });

      await controller.cancel(makeRequest(), { reason: 'too_expensive' });

      expect(stripeServiceMock.getSubscription).toHaveBeenCalledWith(
        'sub_stripe_123'
      );
      expect(
        stripeServiceMock.releaseSubscriptionSchedule
      ).toHaveBeenCalledWith('sub_sched_1');
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      });
      expect(calls).toEqual([
        'release',
        'row-clear',
        'stripe-cancel',
        'row-cancel',
      ]);
    });

    it('releases a schedule the row does not know about (the finished phase 2), since it blocks the cancel the same way', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(stripeRow());
      stripeServiceMock.getSubscription.mockResolvedValue({
        schedule: { id: 'sub_sched_orphan' },
      });

      await controller.cancel(makeRequest(), {});

      expect(
        stripeServiceMock.releaseSubscriptionSchedule
      ).toHaveBeenCalledWith('sub_sched_orphan');
      expect(stripeServiceMock.setCancelAtPeriodEnd).toHaveBeenCalled();
    });

    it('releases the schedule the row names when Stripe no longer shows one', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({
          pendingPlanType: 'MONTHLY',
          stripeScheduleId: 'sub_sched_1',
        })
      );
      stripeServiceMock.getSubscription.mockResolvedValue({ schedule: null });

      await controller.cancel(makeRequest(), {});

      expect(
        stripeServiceMock.releaseSubscriptionSchedule
      ).toHaveBeenCalledWith('sub_sched_1');
    });

    it('clears pending fields that name no schedule, without calling Stripe to release one', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({ pendingPlanType: 'MONTHLY', stripeScheduleId: null })
      );

      await controller.cancel(makeRequest(), {});

      expect(
        stripeServiceMock.releaseSubscriptionSchedule
      ).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      });
    });

    it('with no schedule anywhere it releases nothing and makes no extra write', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(stripeRow());

      await controller.cancel(makeRequest(), {});

      expect(
        stripeServiceMock.releaseSubscriptionSchedule
      ).not.toHaveBeenCalled();
      // One write only: the cancellation itself.
      expect(prismaMock.subscription.update).toHaveBeenCalledTimes(1);
    });

    it('answers CANCEL_ERROR and does not cancel when the schedule cannot be released', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({
          pendingPlanType: 'MONTHLY',
          stripeScheduleId: 'sub_sched_1',
        })
      );
      stripeServiceMock.getSubscription.mockResolvedValue({
        schedule: 'sub_sched_1',
      });
      stripeServiceMock.releaseSubscriptionSchedule.mockRejectedValue(
        new Error('Stripe is down')
      );

      await expect(controller.cancel(makeRequest(), {})).rejects.toMatchObject({
        response: { code: 'CANCEL_ERROR' },
        status: 500,
      });
      expect(stripeServiceMock.setCancelAtPeriodEnd).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(outboxServiceMock.recordInTransaction).not.toHaveBeenCalled();
    });

    it('a pending switch does not stop the cancel being offered or accepted', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        stripeRow({
          pendingPlanType: 'MONTHLY',
          stripeScheduleId: 'sub_sched_1',
        })
      );
      stripeServiceMock.getSubscription.mockResolvedValue({
        schedule: 'sub_sched_1',
      });

      await expect(controller.cancel(makeRequest(), {})).resolves.toMatchObject(
        { success: true, cancelAtPeriodEnd: true }
      );
    });
  });
});
