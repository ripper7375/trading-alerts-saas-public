/**
 * Plan-change Stripe calls in StripeService (Manage Subscription S3, workflows
 * W5a and W5b; decisions D2, E2, E3, E4). The Stripe SDK is a mock; what it
 * returns is the shape seen in test mode. The same cases run against the
 * monolith's lib/stripe/stripe.ts in __tests__/lib/stripe/stripe-plan-change.test.ts.
 */
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type Stripe from 'stripe';

const mockInvoicesRetrieveUpcoming = jest.fn();
const mockInvoicesList = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockSchedulesCreate = jest.fn();
const mockSchedulesUpdate = jest.fn();
const mockSchedulesRelease = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    invoices: {
      retrieveUpcoming: mockInvoicesRetrieveUpcoming,
      list: mockInvoicesList,
    },
    subscriptions: { update: mockSubscriptionsUpdate },
    subscriptionSchedules: {
      create: mockSchedulesCreate,
      update: mockSchedulesUpdate,
      release: mockSchedulesRelease,
    },
  }));
});

const allMocks = [
  mockInvoicesRetrieveUpcoming,
  mockInvoicesList,
  mockSubscriptionsUpdate,
  mockSchedulesCreate,
  mockSchedulesUpdate,
  mockSchedulesRelease,
];

import {
  StripeService,
  isScheduleAlreadyReleased,
  isStripeCardError,
  proItemOf,
} from './stripe.service';

describe('StripeService: plan change', () => {
  let service: StripeService;
  const api = {
    priceFields: (item: Stripe.Checkout.SessionCreateParams.LineItem) =>
      service.proPriceFields(item),
    preview: (input: Parameters<StripeService['previewYearlyUpgrade']>[0]) =>
      service.previewYearlyUpgrade(input),
    upgrade: (input: Parameters<StripeService['upgradeToYearlyNow']>[0]) =>
      service.upgradeToYearlyNow(input),
    schedule: (
      input: Parameters<StripeService['scheduleSwitchToMonthly']>[0]
    ) => service.scheduleSwitchToMonthly(input),
    release: (id: string) => service.releaseSubscriptionSchedule(id),
    invoiceMonths: (id: string) => service.getInvoiceMonthsById(id),
  };

  beforeEach(async () => {
    allMocks.forEach((mock) => mock.mockReset());
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_PRO_PRICE_ID: 'price_pro',
              })[key],
          },
        },
      ],
    }).compile();
    service = moduleRef.get(StripeService);
  });

  const PERIOD_END = 1_795_227_300;
  const PRO_MONTHLY_ITEM = {
    id: 'si_1',
    price: { recurring: { interval: 'month' } },
  };

  const monthlyLine = {
    price: 'price_pro',
  } as Stripe.Checkout.SessionCreateParams.LineItem;
  const yearlyInline = {
    price_data: {
      currency: 'usd',
      unit_amount: 29000,
      product: 'prod_pro',
      recurring: { interval: 'year' as const, interval_count: 1 },
      tax_behavior: 'exclusive' as const,
    },
    quantity: 1,
  } as Stripe.Checkout.SessionCreateParams.LineItem;

  const creditLine = {
    type: 'invoiceitem',
    proration: true,
    amount: -1965,
    period: { start: 1_793_412_900, end: PERIOD_END },
    price: {
      currency: 'usd',
      unit_amount: 2900,
      recurring: { interval: 'month' },
    },
  };
  const yearlyPlanLine = {
    type: 'subscription',
    proration: false,
    amount: 29000,
    period: { start: 1_793_412_900, end: 1_824_948_900 },
    price: {
      currency: 'usd',
      unit_amount: 29000,
      recurring: { interval: 'year' },
    },
  };

  describe('proPriceFields', () => {
    it('passes a configured Price through', () => {
      expect(api.priceFields(monthlyLine)).toEqual({ price: 'price_pro' });
    });

    it('maps an inline price, keeping the tax behaviour and defaulting interval_count to 1', () => {
      expect(api.priceFields(yearlyInline)).toEqual({
        price_data: {
          currency: 'usd',
          unit_amount: 29000,
          product: 'prod_pro',
          recurring: { interval: 'year', interval_count: 1 },
          tax_behavior: 'exclusive',
        },
      });
      const noCount = {
        price_data: {
          currency: 'usd',
          unit_amount: 2900,
          product: 'prod_pro',
          recurring: { interval: 'month' },
        },
      } as Stripe.Checkout.SessionCreateParams.LineItem;
      expect(api.priceFields(noCount)).toEqual({
        price_data: {
          currency: 'usd',
          unit_amount: 2900,
          product: 'prod_pro',
          recurring: { interval: 'month', interval_count: 1 },
        },
      });
    });

    it.each([
      [{}],
      [{ price_data: { currency: 'usd', unit_amount: 1 } }],
      [
        {
          price_data: {
            currency: 'usd',
            product: 'p',
            recurring: { interval: 'month' },
          },
        },
      ],
    ])('refuses a line item with no usable price: %j', (item) => {
      expect(() =>
        api.priceFields(item as Stripe.Checkout.SessionCreateParams.LineItem)
      ).toThrow('no usable price');
    });
  });

  describe('proItemOf', () => {
    const sub = (data: unknown[]) =>
      ({ items: { data } }) as unknown as Stripe.Subscription;

    it('returns the one item and its interval', () => {
      expect(proItemOf(sub([PRO_MONTHLY_ITEM]))).toEqual({
        id: 'si_1',
        interval: 'month',
      });
    });

    it('leaves a subscription alone that has no item or more than one', () => {
      expect(proItemOf(sub([]))).toBeNull();
      expect(proItemOf(sub([PRO_MONTHLY_ITEM, PRO_MONTHLY_ITEM]))).toBeNull();
      expect(proItemOf({} as Stripe.Subscription)).toBeNull();
    });

    it('reports an unknown interval as null', () => {
      expect(proItemOf(sub([{ id: 'si_1', price: {} }]))).toEqual({
        id: 'si_1',
        interval: null,
      });
    });
  });

  describe('isStripeCardError', () => {
    it('recognises a card error by type or by the 402 status', () => {
      expect(isStripeCardError({ type: 'StripeCardError' })).toBe(true);
      expect(isStripeCardError({ statusCode: 402 })).toBe(true);
    });

    it.each([
      [new Error('boom')],
      [{ type: 'StripeInvalidRequestError', statusCode: 400 }],
      [null],
      [undefined],
      ['StripeCardError'],
    ])('does not mistake %p for one', (error) => {
      expect(isStripeCardError(error)).toBe(false);
    });
  });

  describe('isScheduleAlreadyReleased', () => {
    it('recognises a missing schedule', () => {
      expect(isScheduleAlreadyReleased({ code: 'resource_missing' })).toBe(
        true
      );
      expect(
        isScheduleAlreadyReleased({
          message: 'No such subscription schedule: sub_sched_1',
        })
      ).toBe(true);
    });

    it.each([
      [new Error('Your card was declined.')],
      [{ message: 'Rate limit exceeded', code: 'rate_limit' }],
      [null],
      ['released'],
    ])('does not mistake %p for one', (error) => {
      expect(isScheduleAlreadyReleased(error)).toBe(false);
    });
  });

  describe('previewYearlyUpgrade (W5a quote)', () => {
    const upcomingUpgrade = {
      amount_due: 27035,
      tax: 0,
      // The credit line comes first, as Stripe returned it in test mode.
      lines: { data: [creditLine, yearlyPlanLine] },
    };
    const input = (subscription: Record<string, unknown> = {}) => ({
      customerId: 'cus_1',
      subscription: {
        id: 'sub_1',
        status: 'active',
        trial_end: null,
        ...subscription,
      } as unknown as Stripe.Subscription,
      itemId: 'si_1',
      yearlyLineItem: yearlyInline,
      prorationDate: 1_793_412_900,
    });

    it('asks Stripe for the invoice the change would create, at the quote time, and sends nothing else', async () => {
      mockInvoicesRetrieveUpcoming.mockResolvedValue(upcomingUpgrade);

      await api.preview(input());

      expect(mockInvoicesRetrieveUpcoming).toHaveBeenCalledWith({
        customer: 'cus_1',
        subscription: 'sub_1',
        subscription_items: [
          {
            id: 'si_1',
            price_data: expect.objectContaining({
              unit_amount: 29000,
              recurring: { interval: 'year', interval_count: 1 },
            }),
          },
        ],
        subscription_proration_behavior: 'always_invoice',
        subscription_proration_date: 1_793_412_900,
      });
      expect(mockSubscriptionsUpdate).not.toHaveBeenCalled();
    });

    it('reads the amount due, the credit and the renewal date from the right lines whatever their order', async () => {
      mockInvoicesRetrieveUpcoming.mockResolvedValue(upcomingUpgrade);
      const first = await api.preview(input());

      mockInvoicesRetrieveUpcoming.mockResolvedValue({
        ...upcomingUpgrade,
        lines: { data: [yearlyPlanLine, creditLine] },
      });
      const second = await api.preview(input());

      expect(first).toEqual({
        amountDueNowUsd: 270.35,
        creditUsd: 19.65,
        taxUsd: 0,
        renewsOn: new Date(1_824_948_900 * 1000),
        inTrial: false,
      });
      expect(second).toEqual(first);
    });

    it('reports tax when Stripe adds it', async () => {
      mockInvoicesRetrieveUpcoming.mockResolvedValue({
        ...upcomingUpgrade,
        amount_due: 32442,
        tax: 5407,
      });
      expect(await api.preview(input())).toMatchObject({
        amountDueNowUsd: 324.42,
        taxUsd: 54.07,
      });
    });

    it('in a free trial nothing is due now and the date is the trial end (E3)', async () => {
      mockInvoicesRetrieveUpcoming.mockResolvedValue({
        amount_due: 0,
        tax: 0,
        lines: {
          data: [
            {
              type: 'subscription',
              proration: false,
              amount: 0,
              period: { start: 1_792_548_945, end: 1_793_153_745 },
              price: yearlyPlanLine.price,
            },
          ],
        },
      });

      expect(
        await api.preview(
          input({ status: 'trialing', trial_end: 1_793_153_745 })
        )
      ).toEqual({
        amountDueNowUsd: 0,
        creditUsd: 0,
        taxUsd: 0,
        renewsOn: new Date(1_793_153_745 * 1000),
        inTrial: true,
      });
    });

    it('a renewal date Stripe does not give is null, never invented', async () => {
      mockInvoicesRetrieveUpcoming.mockResolvedValue({
        amount_due: 100,
        tax: null,
        lines: { data: [] },
      });
      expect(await api.preview(input())).toMatchObject({
        renewsOn: null,
        creditUsd: 0,
        taxUsd: 0,
      });
    });
  });

  describe('upgradeToYearlyNow (W5a, E2)', () => {
    it('moves the item to the yearly price with proration invoiced now, at the quote time, failing rather than leaving the payment incomplete', async () => {
      mockSubscriptionsUpdate.mockResolvedValue({ id: 'sub_1' });

      await api.upgrade({
        subscriptionId: 'sub_1',
        itemId: 'si_1',
        yearlyLineItem: yearlyInline,
        prorationDate: 1_793_412_900,
        idempotencyKey: 'change-plan:sub_1:yearly:1793412900',
      });

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_1',
        {
          items: [
            {
              id: 'si_1',
              price_data: expect.objectContaining({ unit_amount: 29000 }),
            },
          ],
          proration_behavior: 'always_invoice',
          proration_date: 1_793_412_900,
          payment_behavior: 'error_if_incomplete',
          expand: ['latest_invoice'],
        },
        { idempotencyKey: 'change-plan:sub_1:yearly:1793412900' }
      );
    });

    it('lets a card refusal reach the caller untouched', async () => {
      const refusal = Object.assign(new Error('Your card was declined.'), {
        type: 'StripeCardError',
        statusCode: 402,
      });
      mockSubscriptionsUpdate.mockRejectedValue(refusal);

      await expect(
        api.upgrade({
          subscriptionId: 'sub_1',
          itemId: 'si_1',
          yearlyLineItem: yearlyInline,
          prorationDate: 1,
          idempotencyKey: 'k',
        })
      ).rejects.toBe(refusal);
    });
  });

  describe('scheduleSwitchToMonthly (W5b)', () => {
    const createdSchedule = (over: Record<string, unknown> = {}) => ({
      id: 'sub_sched_1',
      phases: [
        {
          start_date: 1_792_548_971,
          end_date: 1_824_084_971,
          items: [{ price: 'price_year_inline', quantity: 1 }],
          automatic_tax: { enabled: true },
          default_payment_method: 'pm_1',
          ...over,
        },
      ],
    });

    it('creates the schedule from the subscription, keeps phase 1 as it is until the period end, and bills the monthly price in phase 2, with no proration', async () => {
      mockSchedulesCreate.mockResolvedValue(createdSchedule());
      mockSchedulesUpdate.mockResolvedValue({ id: 'sub_sched_1' });

      const result = await api.schedule({
        subscriptionId: 'sub_1',
        monthlyLineItem: monthlyLine,
      });

      expect(mockSchedulesCreate).toHaveBeenCalledWith({
        from_subscription: 'sub_1',
      });
      expect(mockSchedulesUpdate).toHaveBeenCalledWith('sub_sched_1', {
        end_behavior: 'release',
        phases: [
          {
            start_date: 1_792_548_971,
            end_date: 1_824_084_971,
            items: [{ price: 'price_year_inline', quantity: 1 }],
            proration_behavior: 'none',
            automatic_tax: { enabled: true },
            default_payment_method: 'pm_1',
          },
          {
            items: [{ price: 'price_pro', quantity: 1 }],
            proration_behavior: 'none',
            automatic_tax: { enabled: true },
            default_payment_method: 'pm_1',
          },
        ],
      });
      expect(result).toEqual({ id: 'sub_sched_1' });
    });

    it('reads a phase item whose price came back as an object', async () => {
      mockSchedulesCreate.mockResolvedValue(
        createdSchedule({
          items: [{ price: { id: 'price_obj' }, quantity: 2 }],
        })
      );
      mockSchedulesUpdate.mockResolvedValue({ id: 'sub_sched_1' });

      await api.schedule({
        subscriptionId: 'sub_1',
        monthlyLineItem: monthlyLine,
      });

      const phases = mockSchedulesUpdate.mock.calls[0]![1].phases;
      expect(phases[0].items).toEqual([{ price: 'price_obj', quantity: 2 }]);
    });

    it('omits options the subscription did not have (no automatic tax, no default card)', async () => {
      mockSchedulesCreate.mockResolvedValue(
        createdSchedule({
          automatic_tax: undefined,
          default_payment_method: null,
        })
      );
      mockSchedulesUpdate.mockResolvedValue({ id: 'sub_sched_1' });

      await api.schedule({
        subscriptionId: 'sub_1',
        monthlyLineItem: monthlyLine,
      });

      const [phase1, phase2] = mockSchedulesUpdate.mock.calls[0]![1].phases;
      for (const phase of [phase1, phase2]) {
        expect(phase).not.toHaveProperty('automatic_tax');
        expect(phase).not.toHaveProperty('default_payment_method');
      }
    });

    it('takes the schedule back and rethrows when its phases cannot be set', async () => {
      mockSchedulesCreate.mockResolvedValue(createdSchedule());
      const failure = new Error('Invalid phases');
      mockSchedulesUpdate.mockRejectedValue(failure);
      mockSchedulesRelease.mockResolvedValue({});

      await expect(
        api.schedule({ subscriptionId: 'sub_1', monthlyLineItem: monthlyLine })
      ).rejects.toBe(failure);
      expect(mockSchedulesRelease).toHaveBeenCalledWith('sub_sched_1');
    });

    it('rethrows the original failure even if taking the schedule back also fails', async () => {
      mockSchedulesCreate.mockResolvedValue(createdSchedule());
      const failure = new Error('Invalid phases');
      mockSchedulesUpdate.mockRejectedValue(failure);
      mockSchedulesRelease.mockRejectedValue(new Error('release failed'));

      await expect(
        api.schedule({ subscriptionId: 'sub_1', monthlyLineItem: monthlyLine })
      ).rejects.toBe(failure);
    });

    it('refuses a schedule that has no current phase to continue, and takes it back', async () => {
      mockSchedulesCreate.mockResolvedValue({ id: 'sub_sched_1', phases: [] });
      mockSchedulesRelease.mockResolvedValue({});

      await expect(
        api.schedule({ subscriptionId: 'sub_1', monthlyLineItem: monthlyLine })
      ).rejects.toThrow('no current phase');
      expect(mockSchedulesUpdate).not.toHaveBeenCalled();
      expect(mockSchedulesRelease).toHaveBeenCalledWith('sub_sched_1');
    });

    it('creates nothing further when Stripe refuses the schedule itself', async () => {
      mockSchedulesCreate.mockRejectedValue(new Error('already managed'));
      await expect(
        api.schedule({ subscriptionId: 'sub_1', monthlyLineItem: monthlyLine })
      ).rejects.toThrow('already managed');
      expect(mockSchedulesUpdate).not.toHaveBeenCalled();
      expect(mockSchedulesRelease).not.toHaveBeenCalled();
    });
  });

  describe('releaseSubscriptionSchedule', () => {
    it('releases the schedule', async () => {
      mockSchedulesRelease.mockResolvedValue({});
      expect(await api.release('sub_sched_1')).toBe('released');
      expect(mockSchedulesRelease).toHaveBeenCalledWith('sub_sched_1');
    });

    it('counts a schedule that is already gone as released', async () => {
      mockSchedulesRelease.mockRejectedValue(
        Object.assign(new Error('No such subscription schedule: sub_sched_1'), {
          code: 'resource_missing',
        })
      );
      expect(await api.release('sub_sched_1')).toBe('already_released');
    });

    it('rethrows any other failure: the caller must not assume it was released', async () => {
      const failure = new Error('Stripe is down');
      mockSchedulesRelease.mockRejectedValue(failure);
      await expect(api.release('sub_sched_1')).rejects.toBe(failure);
    });
  });

  describe('getInvoiceMonthsById (E4)', () => {
    it('lists the subscription’s own invoices and says how many months each covers, the prorated upgrade invoice as 12 whatever its line order', async () => {
      mockInvoicesList.mockResolvedValue({
        data: [
          { id: 'in_upgrade', lines: { data: [creditLine, yearlyPlanLine] } },
          {
            id: 'in_monthly',
            lines: {
              data: [
                {
                  type: 'subscription',
                  proration: false,
                  price: {
                    currency: 'usd',
                    unit_amount: 2900,
                    recurring: { interval: 'month' },
                  },
                },
              ],
            },
          },
          { id: 'in_yearly', lines: { data: [yearlyPlanLine] } },
          { id: 'in_no_lines', lines: { data: [] } },
        ],
      });

      expect(await api.invoiceMonths('sub_1')).toEqual({
        in_upgrade: 12,
        in_monthly: 1,
        in_yearly: 12,
        in_no_lines: 1,
      });
      expect(mockInvoicesList).toHaveBeenCalledWith({
        subscription: 'sub_1',
        limit: 100,
      });
    });

    it('lets a Stripe failure reach the caller, which then falls back', async () => {
      mockInvoicesList.mockRejectedValue(new Error('Stripe is down'));
      await expect(api.invoiceMonths('sub_1')).rejects.toThrow(
        'Stripe is down'
      );
    });
  });

  describe('proLineItemFor', () => {
    it('is the checkout line item for the configured Price at the given amount and period', async () => {
      const spy = jest.spyOn(service, 'buildProLineItem').mockResolvedValue({
        price: 'price_pro',
        quantity: 1,
      });
      await expect(service.proLineItemFor(290, 'yearly')).resolves.toEqual({
        price: 'price_pro',
        quantity: 1,
      });
      expect(spy).toHaveBeenCalledWith('price_pro', 290, 'yearly');
    });
  });
});
