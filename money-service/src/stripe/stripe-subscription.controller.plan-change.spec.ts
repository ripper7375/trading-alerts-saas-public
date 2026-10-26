/**
 * Stripe Subscription Controller: the billing-period endpoints (Manage
 * Subscription S3, workflows W5a and W5b; decisions D2, D3, E2, E3).
 *
 * Stripe is a mock: what it returns here is the shape observed in test mode
 * (the credit line first on a prorated invoice, `error_if_incomplete` giving a
 * 402 card error, a trial staying `trialing` with a $0 invoice, a schedule that
 * stays attached through phase 2).
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

describe('StripeSubscriptionController: billing period (S3)', () => {
  let controller: StripeSubscriptionController;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let stripe: {
    setCancelAtPeriodEnd: jest.Mock;
    createPaymentMethodUpdateSession: jest.Mock;
    getSubscription: jest.Mock;
    releaseSubscriptionSchedule: jest.Mock;
    proLineItemFor: jest.Mock;
    previewYearlyUpgrade: jest.Mock;
    upgradeToYearlyNow: jest.Mock;
    scheduleSwitchToMonthly: jest.Mock;
  };
  let outbox: { recordInTransaction: jest.Mock };
  let affiliateConfig: {
    getAnnualPriceUsd: jest.Mock;
    getBasePriceUsd: jest.Mock;
  };
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

  const PERIOD_END = new Date('2026-11-21T00:00:00.000Z');
  const PERIOD_END_S = PERIOD_END.getTime() / 1000;
  const nowS = (): number => Math.floor(Date.now() / 1000);

  /** The row as the controller's explicit select returns it. */
  const row = (overrides: Record<string, unknown> = {}): never =>
    ({
      id: 'sub-row-1',
      status: 'ACTIVE',
      planType: 'MONTHLY',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_stripe_123',
      stripeCurrentPeriodEnd: PERIOD_END,
      dLocalPaymentId: null,
      cancelAtPeriodEnd: false,
      pendingPlanType: null,
      pendingPlanEffectiveAt: null,
      stripeScheduleId: null,
      ...overrides,
    }) as never;

  /** Stripe's live subscription. */
  const live = (
    interval: 'month' | 'year',
    overrides: Record<string, unknown> = {}
  ) => ({
    id: 'sub_stripe_123',
    status: 'active',
    customer: 'cus_1',
    schedule: null,
    cancel_at_period_end: false,
    current_period_end: PERIOD_END_S,
    trial_end: null,
    items: { data: [{ id: 'si_1', price: { recurring: { interval } } }] },
    ...overrides,
  });

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    prismaMock.$transaction.mockImplementation(async (cb: unknown) =>
      (cb as (tx: unknown) => unknown)(prismaMock)
    );
    stripe = {
      setCancelAtPeriodEnd: jest.fn(),
      createPaymentMethodUpdateSession: jest.fn(),
      getSubscription: jest.fn().mockResolvedValue(live('month')),
      releaseSubscriptionSchedule: jest.fn().mockResolvedValue('released'),
      proLineItemFor: jest
        .fn()
        .mockImplementation(async (amount: number, period: string) => ({
          price_data: { unit_amount: amount * 100, period },
        })),
      previewYearlyUpgrade: jest.fn().mockResolvedValue({
        amountDueNowUsd: 270.35,
        creditUsd: 19.65,
        taxUsd: 0,
        renewsOn: new Date('2027-10-31T03:15:00.000Z'),
        inTrial: false,
      }),
      upgradeToYearlyNow: jest.fn().mockResolvedValue({
        id: 'sub_stripe_123',
        current_period_end: PERIOD_END_S + 365 * 86_400,
        latest_invoice: { amount_paid: 27035 },
      }),
      scheduleSwitchToMonthly: jest
        .fn()
        .mockResolvedValue({ id: 'sub_sched_1' }),
    };
    outbox = { recordInTransaction: jest.fn().mockResolvedValue(undefined) };
    affiliateConfig = {
      getAnnualPriceUsd: jest.fn().mockResolvedValue(290),
      getBasePriceUsd: jest.fn().mockResolvedValue(29),
    };
    env = {
      STRIPE_PRO_PRICE_ID: 'price_pro',
      NEXTAUTH_URL: 'https://app.example.com',
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StripeSubscriptionController],
      providers: [
        { provide: StripeService, useValue: stripe },
        { provide: PrismaService, useValue: prismaMock },
        { provide: OutboxService, useValue: outbox },
        { provide: AffiliateConfigService, useValue: affiliateConfig },
        { provide: ConfigService, useValue: { get: (k: string) => env[k] } },
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
    prismaMock.user.findUnique.mockResolvedValue({ tier: 'PRO' } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(row());
  });

  const expectNothingChanged = (): void => {
    expect(stripe.upgradeToYearlyNow).not.toHaveBeenCalled();
    expect(stripe.scheduleSwitchToMonthly).not.toHaveBeenCalled();
    expect(stripe.releaseSubscriptionSchedule).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(outbox.recordInTransaction).not.toHaveBeenCalled();
  };

  // ───────────────────────────────────────────────────────────────────────────
  describe('previewChangePlan (W5a quote)', () => {
    it('quotes the upgrade at the SystemConfig yearly price and returns the quote time to confirm with', async () => {
      const before = nowS();
      const result = await controller.previewChangePlan(
        makeRequest(),
        'yearly'
      );
      const after = nowS();

      expect(result).toMatchObject({
        amountDueNowUsd: 270.35,
        yearlyPriceUsd: 290,
        creditUsd: 19.65,
        taxUsd: 0,
        renewsOn: '2027-10-31T03:15:00.000Z',
        inTrial: false,
      });
      expect(result.prorationDate).toBeGreaterThanOrEqual(before);
      expect(result.prorationDate).toBeLessThanOrEqual(after);

      expect(stripe.proLineItemFor).toHaveBeenCalledWith(290, 'yearly');
      expect(stripe.previewYearlyUpgrade).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cus_1',
          itemId: 'si_1',
          prorationDate: result.prorationDate,
        })
      );
    });

    it('quotes a free-trial upgrade as nothing due now (E3)', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('month', { status: 'trialing' })
      );
      stripe.previewYearlyUpgrade.mockResolvedValue({
        amountDueNowUsd: 0,
        creditUsd: 0,
        taxUsd: 0,
        renewsOn: new Date('2026-10-28T00:00:00.000Z'),
        inTrial: true,
      });

      const result = await controller.previewChangePlan(
        makeRequest(),
        'yearly'
      );

      expect(result).toMatchObject({
        amountDueNowUsd: 0,
        inTrial: true,
        renewsOn: '2026-10-28T00:00:00.000Z',
      });
    });

    it('a row that still says ACTIVE during a trial is read as TRIALING from Stripe, so the upgrade is offered', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('month', { status: 'trialing' })
      );
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).resolves.toBeDefined();
    });

    it.each([[undefined], ['monthly'], ['weekly'], ['']])(
      'INVALID_BILLING_PERIOD for %p, before anything is read',
      async (period) => {
        await expect(
          controller.previewChangePlan(makeRequest(), period)
        ).rejects.toMatchObject({
          response: { code: 'INVALID_BILLING_PERIOD' },
          status: 400,
        });
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        expect(stripe.previewYearlyUpgrade).not.toHaveBeenCalled();
      }
    );

    it('refuses a plan that is already yearly', async () => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      prismaMock.subscription.findUnique.mockResolvedValue(
        row({ planType: 'YEARLY' })
      );
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({
        response: { code: 'ACTION_NOT_ALLOWED' },
        status: 400,
      });
    });

    it('Stripe decides the plan: a row that says MONTHLY on a subscription Stripe bills yearly is refused', async () => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
    });

    it.each([
      ['a scheduled cancellation', { cancel_at_period_end: true }, 'ACTIVE'],
      ['a failed payment', {}, 'PAST_DUE'],
    ])('refuses during %s', async (_label, liveOverrides, status) => {
      stripe.getSubscription.mockResolvedValue(live('month', liveOverrides));
      prismaMock.subscription.findUnique.mockResolvedValue(row({ status }));
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
    });

    it('DLOCAL_NO_CHANGE for a dLocal plan', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        row({ dLocalPaymentId: 'dl_1' })
      );
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({
        response: { code: 'DLOCAL_NO_CHANGE' },
        status: 400,
      });
      expect(stripe.getSubscription).not.toHaveBeenCalled();
    });

    it('UNSUPPORTED_SUBSCRIPTION when the subscription has more than one item', async () => {
      stripe.getSubscription.mockResolvedValue({
        ...live('month'),
        items: {
          data: [
            { id: 'si_1', price: { recurring: { interval: 'month' } } },
            { id: 'si_2', price: { recurring: { interval: 'month' } } },
          ],
        },
      });
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({
        response: { code: 'UNSUPPORTED_SUBSCRIPTION' },
      });
    });

    it.each([
      ['a FREE user', { tier: 'FREE' }, row(), 'NO_SUBSCRIPTION'],
      ['no row', { tier: 'PRO' }, null, 'NO_SUBSCRIPTION'],
      ['no user', null, row(), 'USER_NOT_FOUND'],
    ])('%s', async (_label, user, subscription, code) => {
      prismaMock.user.findUnique.mockResolvedValue(user as never);
      prismaMock.subscription.findUnique.mockResolvedValue(
        subscription as never
      );
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({ response: { code } });
    });

    it('503 PLAN_CHANGE_UNAVAILABLE when STRIPE_PRO_PRICE_ID is unset, before reading anything', async () => {
      env['STRIPE_PRO_PRICE_ID'] = undefined;
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({
        response: { code: 'PLAN_CHANGE_UNAVAILABLE' },
        status: 503,
      });
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('500 PREVIEW_ERROR when Stripe fails, without leaking its message', async () => {
      stripe.previewYearlyUpgrade.mockRejectedValue(
        new Error('No such price: price_secret')
      );
      await expect(
        controller.previewChangePlan(makeRequest(), 'yearly')
      ).rejects.toMatchObject({
        response: { code: 'PREVIEW_ERROR' },
        status: 500,
      });
    });

    it('reads the row with an explicit select and writes nothing', async () => {
      await controller.previewChangePlan(makeRequest(), 'yearly');
      expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          id: true,
          status: true,
          planType: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeCurrentPeriodEnd: true,
          dLocalPaymentId: true,
          cancelAtPeriodEnd: true,
          pendingPlanType: true,
          pendingPlanEffectiveAt: true,
          stripeScheduleId: true,
        },
      });
      expectNothingChanged();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('changePlan: monthly to yearly, now (W5a)', () => {
    const upgradeBody = (over: Record<string, unknown> = {}) => ({
      billingPeriod: 'yearly',
      prorationDate: nowS() - 5,
      ...over,
    });

    it('charges through Stripe at the quoted time, records YEARLY at the yearly price, and emits SUBSCRIPTION_UPGRADED with the amount charged', async () => {
      const body = upgradeBody();
      const result = await controller.changePlan(makeRequest(), body);

      expect(stripe.upgradeToYearlyNow).toHaveBeenCalledWith({
        subscriptionId: 'sub_stripe_123',
        itemId: 'si_1',
        yearlyLineItem: expect.anything(),
        prorationDate: body.prorationDate,
        idempotencyKey: `change-plan:sub_stripe_123:yearly:${body.prorationDate}`,
      });
      const newEnd = new Date((PERIOD_END_S + 365 * 86_400) * 1000);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          planType: 'YEARLY',
          amountUsd: 290,
          stripeCurrentPeriodEnd: newEnd,
          expiresAt: newEnd,
          pendingPlanType: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      });
      expect(outbox.recordInTransaction).toHaveBeenCalledWith(prismaMock, {
        aggregateType: 'User',
        aggregateId: 'user-1',
        eventType: 'SUBSCRIPTION_UPGRADED',
        payload: {
          tier: 'PRO',
          subscriptionId: 'sub-row-1',
          provider: 'STRIPE',
          amountChargedUsd: 270.35,
          yearlyPriceUsd: 290,
          nextBillingDate: newEnd.toISOString(),
          inTrial: false,
        },
      });
      expect(result).toMatchObject({
        success: true,
        billingPeriod: 'yearly',
        amountChargedUsd: 270.35,
        renewsOn: newEnd.toISOString(),
        inTrial: false,
      });
    });

    it('writes the row and the outbox event in ONE transaction, after Stripe', async () => {
      await controller.changePlan(makeRequest(), upgradeBody());
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(
        stripe.upgradeToYearlyNow.mock.invocationCallOrder[0]
      ).toBeLessThan(prismaMock.$transaction.mock.invocationCallOrder[0]!);
    });

    it('in a free trial the price changes, nothing is charged, and the e-mail says so (E3)', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('month', { status: 'trialing' })
      );
      stripe.upgradeToYearlyNow.mockResolvedValue({
        id: 'sub_stripe_123',
        current_period_end: PERIOD_END_S,
        latest_invoice: { amount_paid: 0 },
      });

      const result = await controller.changePlan(makeRequest(), upgradeBody());

      expect(result).toMatchObject({
        amountChargedUsd: 0,
        inTrial: true,
        renewsOn: PERIOD_END.toISOString(),
      });
      // $0 invoices are skipped by the invoice webhook, so the row is written here.
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planType: 'YEARLY',
            amountUsd: 290,
          }),
        })
      );
      expect(outbox.recordInTransaction).toHaveBeenCalledWith(
        prismaMock,
        expect.objectContaining({
          payload: expect.objectContaining({
            amountChargedUsd: 0,
            inTrial: true,
          }),
        })
      );
    });

    it('treats a latest invoice that Stripe did not expand as nothing charged to report', async () => {
      stripe.upgradeToYearlyNow.mockResolvedValue({
        id: 'sub_stripe_123',
        current_period_end: PERIOD_END_S,
        latest_invoice: 'in_123',
      });
      const result = await controller.changePlan(makeRequest(), upgradeBody());
      expect(result).toMatchObject({ amountChargedUsd: 0 });
    });

    it('E2: a declined card is a 402 PAYMENT_FAILED; the user stays monthly, nothing is recorded or emitted', async () => {
      stripe.upgradeToYearlyNow.mockRejectedValue(
        Object.assign(new Error('Your card was declined.'), {
          type: 'StripeCardError',
          statusCode: 402,
          code: 'card_declined',
        })
      );

      await expect(
        controller.changePlan(makeRequest(), upgradeBody())
      ).rejects.toMatchObject({
        response: { code: 'PAYMENT_FAILED' },
        status: 402,
      });
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(outbox.recordInTransaction).not.toHaveBeenCalled();
    });

    it('E2: a 3-D Secure request (a 402 without a card-error type) is refused the same way', async () => {
      stripe.upgradeToYearlyNow.mockRejectedValue(
        Object.assign(new Error('authentication_required'), {
          statusCode: 402,
        })
      );
      await expect(
        controller.changePlan(makeRequest(), upgradeBody())
      ).rejects.toMatchObject({
        response: { code: 'PAYMENT_FAILED' },
        status: 402,
      });
    });

    it('any other Stripe failure is a 500 CHANGE_PLAN_ERROR that does not leak Stripe’s message', async () => {
      stripe.upgradeToYearlyNow.mockRejectedValue(
        new Error('No such subscription item: si_secret')
      );
      await expect(
        controller.changePlan(makeRequest(), upgradeBody())
      ).rejects.toMatchObject({
        response: { code: 'CHANGE_PLAN_ERROR' },
        status: 500,
      });
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('still answers success when Stripe has switched and charged but the row write fails (the webhooks bring the row in line)', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('db down'));
      const result = await controller.changePlan(makeRequest(), upgradeBody());
      expect(result).toMatchObject({ success: true, billingPeriod: 'yearly' });
    });

    it('PRICE_CHANGED (409) when the price on screen is no longer the yearly price, before anything is charged', async () => {
      await expect(
        controller.changePlan(
          makeRequest(),
          upgradeBody({ expectedYearlyPriceUsd: 250 })
        )
      ).rejects.toMatchObject({
        response: { code: 'PRICE_CHANGED', currentYearlyPriceUsd: 290 },
        status: 409,
      });
      expectNothingChanged();
    });

    it('proceeds when the price on screen matches to the cent', async () => {
      await expect(
        controller.changePlan(
          makeRequest(),
          upgradeBody({ expectedYearlyPriceUsd: 290 })
        )
      ).resolves.toMatchObject({ success: true });
    });

    it('releases a schedule left attached before changing the subscription', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('month', { schedule: 'sub_sched_leftover' })
      );
      await controller.changePlan(makeRequest(), upgradeBody());
      expect(stripe.releaseSubscriptionSchedule).toHaveBeenCalledWith(
        'sub_sched_leftover'
      );
      expect(
        stripe.releaseSubscriptionSchedule.mock.invocationCallOrder[0]
      ).toBeLessThan(stripe.upgradeToYearlyNow.mock.invocationCallOrder[0]!);
    });

    describe('the quote time cannot be used to buy a bigger credit', () => {
      it.each([
        ['missing', undefined, 'INVALID_PRORATION_DATE'],
        ['not a number', '1799999999', 'INVALID_PRORATION_DATE'],
        ['a fraction', nowS() - 5.5, 'INVALID_PRORATION_DATE'],
        ['an hour old', nowS() - 3600, 'PRORATION_EXPIRED'],
        ['the start of the period', nowS() - 20 * 86_400, 'PRORATION_EXPIRED'],
        ['in the future', nowS() + 3600, 'PRORATION_EXPIRED'],
      ])(
        'refuses a quote time that is %s',
        async (_label, prorationDate, code) => {
          await expect(
            controller.changePlan(makeRequest(), {
              billingPeriod: 'yearly',
              prorationDate,
            })
          ).rejects.toMatchObject({ response: { code }, status: 400 });
          expect(stripe.getSubscription).not.toHaveBeenCalled();
          expectNothingChanged();
        }
      );
    });

    describe('refusals (nothing is called or written)', () => {
      it.each([[undefined], [null], [{}], [{ billingPeriod: 'weekly' }]])(
        'INVALID_BILLING_PERIOD for %j',
        async (body) => {
          await expect(
            controller.changePlan(makeRequest(), body)
          ).rejects.toMatchObject({
            response: { code: 'INVALID_BILLING_PERIOD' },
          });
          expectNothingChanged();
        }
      );

      it('ACTION_NOT_ALLOWED when the plan is already yearly', async () => {
        stripe.getSubscription.mockResolvedValue(live('year'));
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
        expectNothingChanged();
      });

      it('ACTION_NOT_ALLOWED while a switch to monthly is pending (keep yearly first)', async () => {
        stripe.getSubscription.mockResolvedValue(
          live('year', { schedule: 'sub_sched_1' })
        );
        prismaMock.subscription.findUnique.mockResolvedValue(
          row({
            planType: 'YEARLY',
            pendingPlanType: 'MONTHLY',
            pendingPlanEffectiveAt: PERIOD_END,
            stripeScheduleId: 'sub_sched_1',
          })
        );
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
        expectNothingChanged();
      });

      it('ACTION_NOT_ALLOWED after a cancellation is scheduled', async () => {
        stripe.getSubscription.mockResolvedValue(
          live('month', { cancel_at_period_end: true })
        );
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
        expectNothingChanged();
      });

      it('ACTION_NOT_ALLOWED with a failed payment: pay first', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          row({ status: 'PAST_DUE' })
        );
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
        expectNothingChanged();
      });

      it('DLOCAL_NO_CHANGE for a dLocal plan', async () => {
        prismaMock.subscription.findUnique.mockResolvedValue(
          row({ dLocalPaymentId: 'dl_1' })
        );
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'DLOCAL_NO_CHANGE' } });
        expectNothingChanged();
      });

      it('NO_SUBSCRIPTION for a FREE user', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ tier: 'FREE' } as never);
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({ response: { code: 'NO_SUBSCRIPTION' } });
        expectNothingChanged();
      });

      it('503 PLAN_CHANGE_UNAVAILABLE when STRIPE_PRO_PRICE_ID is unset', async () => {
        env['STRIPE_PRO_PRICE_ID'] = undefined;
        await expect(
          controller.changePlan(makeRequest(), upgradeBody())
        ).rejects.toMatchObject({
          response: { code: 'PLAN_CHANGE_UNAVAILABLE' },
          status: 503,
        });
        expectNothingChanged();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('changePlan: yearly to monthly, at the renewal (W5b)', () => {
    const yearlyRow = (over: Record<string, unknown> = {}) =>
      row({ planType: 'YEARLY', ...over });

    beforeEach(() => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      prismaMock.subscription.findUnique.mockResolvedValue(yearlyRow());
    });

    it('schedules the switch at the period end at the SystemConfig monthly price, stores it, and emits SUBSCRIPTION_DOWNGRADE_SCHEDULED', async () => {
      const result = await controller.changePlan(makeRequest(), {
        billingPeriod: 'monthly',
      });

      expect(stripe.proLineItemFor).toHaveBeenCalledWith(29, 'monthly');
      expect(stripe.scheduleSwitchToMonthly).toHaveBeenCalledWith({
        subscriptionId: 'sub_stripe_123',
        monthlyLineItem: expect.anything(),
      });
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          pendingPlanType: 'MONTHLY',
          pendingPlanEffectiveAt: PERIOD_END,
          stripeScheduleId: 'sub_sched_1',
        },
      });
      expect(outbox.recordInTransaction).toHaveBeenCalledWith(prismaMock, {
        aggregateType: 'User',
        aggregateId: 'user-1',
        eventType: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
        payload: {
          tier: 'PRO',
          subscriptionId: 'sub-row-1',
          provider: 'STRIPE',
          effectiveAt: PERIOD_END.toISOString(),
          monthlyPriceUsd: 29,
        },
      });
      expect(result).toMatchObject({
        success: true,
        billingPeriod: 'monthly',
        effectiveAt: PERIOD_END.toISOString(),
        monthlyPriceUsd: 29,
      });
    });

    it('charges and refunds nothing: no upgrade call, no tier or status change', async () => {
      await controller.changePlan(makeRequest(), { billingPeriod: 'monthly' });
      expect(stripe.upgradeToYearlyNow).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('stores the schedule and writes the event in ONE transaction, after Stripe', async () => {
      await controller.changePlan(makeRequest(), { billingPeriod: 'monthly' });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(
        stripe.scheduleSwitchToMonthly.mock.invocationCallOrder[0]
      ).toBeLessThan(prismaMock.$transaction.mock.invocationCallOrder[0]!);
    });

    it('PRICE_CHANGED when the monthly price on screen is no longer the monthly price', async () => {
      await expect(
        controller.changePlan(makeRequest(), {
          billingPeriod: 'monthly',
          expectedMonthlyPriceUsd: 19,
        })
      ).rejects.toMatchObject({
        response: { code: 'PRICE_CHANGED', currentMonthlyPriceUsd: 29 },
        status: 409,
      });
      expectNothingChanged();
    });

    it('ALREADY_PENDING when a switch is already scheduled', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('year', { schedule: 'sub_sched_1' })
      );
      prismaMock.subscription.findUnique.mockResolvedValue(
        yearlyRow({
          pendingPlanType: 'MONTHLY',
          pendingPlanEffectiveAt: PERIOD_END,
          stripeScheduleId: 'sub_sched_1',
        })
      );
      await expect(
        controller.changePlan(makeRequest(), { billingPeriod: 'monthly' })
      ).rejects.toMatchObject({
        response: { code: 'ALREADY_PENDING' },
        status: 400,
      });
      expectNothingChanged();
    });

    it('a stale pending column Stripe no longer backs (schedule released in its dashboard) does not block a new switch', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        yearlyRow({
          pendingPlanType: 'MONTHLY',
          pendingPlanEffectiveAt: PERIOD_END,
          stripeScheduleId: 'sub_sched_gone',
        })
      );
      // live('year') has no schedule attached
      await expect(
        controller.changePlan(makeRequest(), { billingPeriod: 'monthly' })
      ).resolves.toMatchObject({ success: true });
    });

    it('releases a schedule attached while the row says nothing is pending (an orphan) before creating the new one', async () => {
      stripe.getSubscription.mockResolvedValue(
        live('year', { schedule: 'sub_sched_orphan' })
      );
      await controller.changePlan(makeRequest(), { billingPeriod: 'monthly' });
      expect(stripe.releaseSubscriptionSchedule).toHaveBeenCalledWith(
        'sub_sched_orphan'
      );
      expect(
        stripe.releaseSubscriptionSchedule.mock.invocationCallOrder[0]
      ).toBeLessThan(
        stripe.scheduleSwitchToMonthly.mock.invocationCallOrder[0]!
      );
    });

    it('is not offered on a monthly plan, in a free trial, after a cancellation, or with a failed payment', async () => {
      const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
        [live('month'), yearlyRow({ planType: 'MONTHLY' })],
        [live('year', { status: 'trialing' }), yearlyRow()],
        [live('year', { cancel_at_period_end: true }), yearlyRow()],
        [live('year'), yearlyRow({ status: 'PAST_DUE' })],
      ];
      for (const [liveSub, subscription] of cases) {
        stripe.getSubscription.mockResolvedValue(liveSub);
        prismaMock.subscription.findUnique.mockResolvedValue(
          subscription as never
        );
        await expect(
          controller.changePlan(makeRequest(), { billingPeriod: 'monthly' })
        ).rejects.toMatchObject({ response: { code: 'ACTION_NOT_ALLOWED' } });
      }
      expectNothingChanged();
    });

    it('takes the schedule back and answers CHANGE_PLAN_ERROR when the row cannot be written, so Stripe never holds a switch the page cannot show', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('db down'));

      await expect(
        controller.changePlan(makeRequest(), { billingPeriod: 'monthly' })
      ).rejects.toMatchObject({
        response: { code: 'CHANGE_PLAN_ERROR' },
        status: 500,
      });
      expect(stripe.releaseSubscriptionSchedule).toHaveBeenCalledWith(
        'sub_sched_1'
      );
    });

    it('records and emits nothing when Stripe cannot create the schedule', async () => {
      stripe.scheduleSwitchToMonthly.mockRejectedValue(
        new Error('Invalid phases: secret detail')
      );
      await expect(
        controller.changePlan(makeRequest(), { billingPeriod: 'monthly' })
      ).rejects.toMatchObject({
        response: { code: 'CHANGE_PLAN_ERROR' },
        status: 500,
      });
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
      expect(outbox.recordInTransaction).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('keepYearly (W5b undo)', () => {
    const pendingRow = (over: Record<string, unknown> = {}) =>
      row({
        planType: 'YEARLY',
        pendingPlanType: 'MONTHLY',
        pendingPlanEffectiveAt: PERIOD_END,
        stripeScheduleId: 'sub_sched_1',
        ...over,
      });

    beforeEach(() => {
      stripe.getSubscription.mockResolvedValue(
        live('year', { schedule: 'sub_sched_1' })
      );
      prismaMock.subscription.findUnique.mockResolvedValue(pendingRow());
    });

    it('releases the schedule and clears the three pending columns', async () => {
      const result = await controller.keepYearly(makeRequest());

      expect(stripe.releaseSubscriptionSchedule).toHaveBeenCalledWith(
        'sub_sched_1'
      );
      expect(prismaMock.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-row-1' },
        data: {
          pendingPlanType: null,
          pendingPlanEffectiveAt: null,
          stripeScheduleId: null,
        },
      });
      expect(result).toEqual({
        success: true,
        message: 'Your plan stays yearly.',
        billingPeriod: 'yearly',
      });
    });

    it('releases in Stripe before it clears the row', async () => {
      await controller.keepYearly(makeRequest());
      expect(
        stripe.releaseSubscriptionSchedule.mock.invocationCallOrder[0]
      ).toBeLessThan(
        prismaMock.subscription.update.mock.invocationCallOrder[0]!
      );
    });

    it('charges nothing and sends nothing', async () => {
      await controller.keepYearly(makeRequest());
      expect(stripe.upgradeToYearlyNow).not.toHaveBeenCalled();
      expect(outbox.recordInTransaction).not.toHaveBeenCalled();
    });

    it('only clears the row when Stripe already dropped the schedule (released in its dashboard)', async () => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      prismaMock.subscription.findUnique.mockResolvedValue(
        pendingRow({ stripeScheduleId: null })
      );

      await expect(controller.keepYearly(makeRequest())).resolves.toMatchObject(
        { success: true }
      );
      expect(stripe.releaseSubscriptionSchedule).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).toHaveBeenCalledTimes(1);
    });

    it('uses the schedule the row names when Stripe no longer shows one', async () => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      await controller.keepYearly(makeRequest());
      expect(stripe.releaseSubscriptionSchedule).toHaveBeenCalledWith(
        'sub_sched_1'
      );
    });

    it('NOT_PENDING when there is nothing to undo', async () => {
      stripe.getSubscription.mockResolvedValue(live('year'));
      prismaMock.subscription.findUnique.mockResolvedValue(
        row({ planType: 'YEARLY' })
      );
      await expect(controller.keepYearly(makeRequest())).rejects.toMatchObject({
        response: { code: 'NOT_PENDING' },
        status: 400,
      });
      expect(stripe.releaseSubscriptionSchedule).not.toHaveBeenCalled();
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('KEEP_YEARLY_ERROR, with the row untouched, when Stripe cannot release the schedule', async () => {
      stripe.releaseSubscriptionSchedule.mockRejectedValue(
        new Error('Stripe is down')
      );
      await expect(controller.keepYearly(makeRequest())).rejects.toMatchObject({
        response: { code: 'KEEP_YEARLY_ERROR' },
        status: 500,
      });
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('DLOCAL_NO_CHANGE for a dLocal plan', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(
        pendingRow({ dLocalPaymentId: 'dl_1' })
      );
      await expect(controller.keepYearly(makeRequest())).rejects.toMatchObject({
        response: { code: 'DLOCAL_NO_CHANGE' },
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it.each(['changePlan', 'keepYearly'] as const)(
      '%s sits behind the Idempotency-Key interceptor',
      (name) => {
        const interceptors = Reflect.getMetadata(
          INTERCEPTORS_METADATA,
          StripeSubscriptionController.prototype[name]
        ) as unknown[];
        expect(interceptors).toContain(IdempotencyInterceptor);
      }
    );

    it('the quote does not: it reads only, and a cached quote would carry a stale quote time', () => {
      const interceptors = Reflect.getMetadata(
        INTERCEPTORS_METADATA,
        StripeSubscriptionController.prototype.previewChangePlan
      ) as unknown[] | undefined;
      expect(interceptors ?? []).not.toContain(IdempotencyInterceptor);
    });
  });
});
