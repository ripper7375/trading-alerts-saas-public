/**
 * The billing-period part of the actions module (Manage Subscription S3,
 * workflows W5a and W5b; plan §6 and §7). The mirror test in
 * `subscription-actions.test.ts` keeps the money-service copy identical, so
 * these cases cover both stacks.
 *
 * @module __tests__/lib/stripe/subscription-actions-plan-change.test
 */

import {
  PRORATION_MAX_AGE_SECONDS,
  PRORATION_MAX_FUTURE_SECONDS,
  allowedActionsOf,
  displayStateOf,
  effectivePendingPlan,
  liveIntervalOf,
  parseChangePlanBody,
  planTypeForInterval,
  sameUsdPrice,
  scheduleIdOf,
  type SubscriptionFacts,
} from '@/lib/stripe/subscription-actions';

function facts(overrides: Partial<SubscriptionFacts>): SubscriptionFacts {
  return {
    tier: 'PRO',
    status: 'ACTIVE',
    provider: 'STRIPE',
    openInvoiceUrl: null,
    ...overrides,
  };
}

describe('allowedActionsOf: billing-period actions (plan §6)', () => {
  it('ACTIVE monthly: update card, upgrade to yearly now, cancel', () => {
    expect(allowedActionsOf(facts({ planType: 'MONTHLY' }))).toEqual([
      'update_card',
      'upgrade_to_yearly',
      'cancel',
    ]);
  });

  it('TRIALING monthly: the upgrade is offered too (decision E3)', () => {
    expect(
      allowedActionsOf(facts({ status: 'TRIALING', planType: 'MONTHLY' }))
    ).toEqual(['update_card', 'upgrade_to_yearly', 'cancel']);
  });

  it('ACTIVE yearly: update card, switch to monthly at renewal, cancel', () => {
    expect(allowedActionsOf(facts({ planType: 'YEARLY' }))).toEqual([
      'update_card',
      'switch_to_monthly',
      'cancel',
    ]);
  });

  it('TRIALING yearly: no switch to monthly (plan §6 lists none)', () => {
    expect(
      allowedActionsOf(facts({ status: 'TRIALING', planType: 'YEARLY' }))
    ).toEqual(['update_card', 'cancel']);
  });

  it.each([undefined, null, 'THREE_DAY', 'other'])(
    'an unknown plan type %p offers no billing-period action',
    (planType) => {
      expect(allowedActionsOf(facts({ planType }))).toEqual([
        'update_card',
        'cancel',
      ]);
    }
  );

  it('a pending switch to monthly: keep yearly, update card, cancel; no second switch, no upgrade', () => {
    const actions = allowedActionsOf(
      facts({ planType: 'YEARLY', pendingPlanType: 'MONTHLY' })
    );
    expect(actions).toEqual(['keep_yearly', 'update_card', 'cancel']);
    expect(actions).not.toContain('switch_to_monthly');
    expect(actions).not.toContain('upgrade_to_yearly');
  });

  it('a scheduled cancellation offers no billing-period action (no switch until resumed)', () => {
    const actions = allowedActionsOf(
      facts({
        planType: 'MONTHLY',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
      })
    );
    expect(actions).toEqual(['resume', 'update_card']);
  });

  it('a scheduled cancellation outranks a pending switch', () => {
    expect(
      allowedActionsOf(
        facts({
          planType: 'YEARLY',
          pendingPlanType: 'MONTHLY',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
        })
      )
    ).toEqual(['resume', 'update_card']);
  });

  it.each(['PAST_DUE', 'UNPAID'] as const)(
    'a failed payment (%s) offers no billing-period action: pay first',
    (status) => {
      const actions = allowedActionsOf(
        facts({
          status,
          tier: status === 'UNPAID' ? 'FREE' : 'PRO',
          planType: 'MONTHLY',
          openInvoiceUrl: 'https://invoice.stripe.com/i/x',
        })
      );
      expect(actions).toEqual(['pay_now', 'update_card']);
    }
  );

  it('a dLocal plan has no billing-period action (no dLocal switch)', () => {
    expect(
      allowedActionsOf(facts({ provider: 'DLOCAL', planType: 'MONTHLY' }))
    ).toEqual(['renew_now']);
    expect(
      allowedActionsOf(
        facts({
          provider: 'DLOCAL',
          planType: 'YEARLY',
          pendingPlanType: 'MONTHLY',
        })
      )
    ).toEqual(['renew_now']);
  });

  it('admin view-as hides every billing-period action', () => {
    expect(
      allowedActionsOf(facts({ planType: 'MONTHLY', viewing: true }))
    ).toEqual([]);
    expect(
      allowedActionsOf(
        facts({ planType: 'YEARLY', pendingPlanType: 'MONTHLY', viewing: true })
      )
    ).toEqual([]);
  });
});

describe('displayStateOf: DOWNGRADE_PENDING', () => {
  it('a Stripe subscription with a pending switch to monthly', () => {
    expect(
      displayStateOf({
        tier: 'PRO',
        status: 'ACTIVE',
        provider: 'STRIPE',
        pendingPlanType: 'MONTHLY',
      })
    ).toBe('DOWNGRADE_PENDING');
  });

  it('is not pending without the column, or for another value', () => {
    for (const pendingPlanType of [undefined, null, '', 'YEARLY']) {
      expect(
        displayStateOf({
          tier: 'PRO',
          status: 'ACTIVE',
          provider: 'STRIPE',
          pendingPlanType,
        })
      ).toBe('ACTIVE');
    }
  });

  it('a stale column on a dLocal row is ignored', () => {
    expect(
      displayStateOf({
        tier: 'PRO',
        status: 'ACTIVE',
        provider: 'DLOCAL',
        pendingPlanType: 'MONTHLY',
      })
    ).toBe('ACTIVE');
  });

  it('a failed payment and a scheduled cancellation both outrank it', () => {
    expect(
      displayStateOf({
        tier: 'PRO',
        status: 'PAST_DUE',
        provider: 'STRIPE',
        pendingPlanType: 'MONTHLY',
      })
    ).toBe('PAST_DUE');
    expect(
      displayStateOf({
        tier: 'PRO',
        status: 'ACTIVE',
        provider: 'STRIPE',
        cancelAtPeriodEnd: true,
        pendingPlanType: 'MONTHLY',
      })
    ).toBe('CANCEL_SCHEDULED');
  });
});

describe('liveIntervalOf', () => {
  const item = (interval: string | null) => ({
    price: { recurring: interval ? { interval } : null },
  });

  it('reads the interval of the one PRO item', () => {
    expect(liveIntervalOf({ items: { data: [item('year')] } })).toBe('year');
    expect(liveIntervalOf({ items: { data: [item('month')] } })).toBe('month');
  });

  it('is null for an unknown subscription, no items, or more than one item', () => {
    expect(liveIntervalOf(null)).toBeNull();
    expect(liveIntervalOf(undefined)).toBeNull();
    expect(liveIntervalOf({})).toBeNull();
    expect(liveIntervalOf({ items: { data: [] } })).toBeNull();
    expect(
      liveIntervalOf({ items: { data: [item('month'), item('year')] } })
    ).toBeNull();
  });

  it('is null for an item with no recurring price', () => {
    expect(liveIntervalOf({ items: { data: [item(null)] } })).toBeNull();
    expect(liveIntervalOf({ items: { data: [{ price: null }] } })).toBeNull();
  });
});

describe('planTypeForInterval and scheduleIdOf', () => {
  it.each([
    ['month', 'MONTHLY'],
    ['year', 'YEARLY'],
    ['week', null],
    ['day', null],
    [null, null],
    [undefined, null],
  ] as const)('interval %p -> %p', (interval, expected) => {
    expect(planTypeForInterval(interval)).toBe(expected);
  });

  it('reads the id of a schedule given as a string or an object', () => {
    expect(scheduleIdOf('sub_sched_1')).toBe('sub_sched_1');
    expect(scheduleIdOf({ id: 'sub_sched_2' })).toBe('sub_sched_2');
    expect(scheduleIdOf(null)).toBeNull();
    expect(scheduleIdOf(undefined)).toBeNull();
    expect(scheduleIdOf('')).toBeNull();
  });
});

describe('effectivePendingPlan', () => {
  const NOW = new Date('2027-03-01T00:00:00.000Z');
  const FUTURE = new Date('2027-03-20T00:00:00.000Z');
  const PAST = new Date('2027-02-20T00:00:00.000Z');
  const stored = (over: object = {}) => ({
    pendingPlanType: 'MONTHLY',
    pendingPlanEffectiveAt: FUTURE,
    ...over,
  });

  it('nothing is pending without the stored column', () => {
    expect(effectivePendingPlan({}, null, NOW)).toBeNull();
    expect(
      effectivePendingPlan({ pendingPlanType: null }, null, NOW)
    ).toBeNull();
    expect(
      effectivePendingPlan({ pendingPlanType: 'YEARLY' }, null, NOW)
    ).toBeNull();
  });

  describe('with Stripe read', () => {
    it('is pending while a schedule is attached and the subscription still bills yearly', () => {
      expect(
        effectivePendingPlan(
          stored(),
          { hasSchedule: true, interval: 'year' },
          NOW
        )
      ).toEqual({ planType: 'MONTHLY', effectiveAt: FUTURE });
    });

    it('is not pending when the schedule was released in Stripe', () => {
      expect(
        effectivePendingPlan(
          stored(),
          { hasSchedule: false, interval: 'year' },
          NOW
        )
      ).toBeNull();
    });

    it('is not pending once phase 2 has started, even with the webhook late and a schedule still attached', () => {
      expect(
        effectivePendingPlan(
          stored(),
          { hasSchedule: true, interval: 'month' },
          NOW
        )
      ).toBeNull();
    });
  });

  describe('without Stripe', () => {
    it('is pending before the stored date', () => {
      expect(effectivePendingPlan(stored(), null, NOW)).toEqual({
        planType: 'MONTHLY',
        effectiveAt: FUTURE,
      });
    });

    it('is not pending after the stored date', () => {
      expect(
        effectivePendingPlan(
          stored({ pendingPlanEffectiveAt: PAST }),
          null,
          NOW
        )
      ).toBeNull();
    });

    it('accepts the date as an ISO string', () => {
      expect(
        effectivePendingPlan(
          stored({ pendingPlanEffectiveAt: FUTURE.toISOString() }),
          null,
          NOW
        )
      ).toEqual({ planType: 'MONTHLY', effectiveAt: FUTURE });
    });

    it('a missing or unreadable date counts as still pending', () => {
      for (const pendingPlanEffectiveAt of [null, undefined, 'not a date']) {
        expect(
          effectivePendingPlan(stored({ pendingPlanEffectiveAt }), null, NOW)
        ).toEqual({ planType: 'MONTHLY', effectiveAt: null });
      }
    });
  });
});

describe('parseChangePlanBody', () => {
  const NOW = 1_800_000_000;

  it('the switch to monthly needs nothing else', () => {
    expect(parseChangePlanBody({ billingPeriod: 'monthly' }, NOW)).toEqual({
      ok: true,
      billingPeriod: 'monthly',
      expectedMonthlyPriceUsd: null,
    });
  });

  it('the switch to monthly may carry the price shown, and refuses a bad one', () => {
    expect(
      parseChangePlanBody(
        { billingPeriod: 'monthly', expectedMonthlyPriceUsd: 29 },
        NOW
      )
    ).toEqual({
      ok: true,
      billingPeriod: 'monthly',
      expectedMonthlyPriceUsd: 29,
    });
    for (const expectedMonthlyPriceUsd of [0, -29, '29', Number.NaN]) {
      expect(
        parseChangePlanBody(
          { billingPeriod: 'monthly', expectedMonthlyPriceUsd },
          NOW
        )
      ).toEqual({ ok: false, code: 'INVALID_EXPECTED_PRICE' });
    }
  });

  it('the upgrade carries the quote time and, optionally, the price shown', () => {
    expect(
      parseChangePlanBody(
        {
          billingPeriod: 'yearly',
          prorationDate: NOW - 5,
          expectedYearlyPriceUsd: 290,
        },
        NOW
      )
    ).toEqual({
      ok: true,
      billingPeriod: 'yearly',
      prorationDate: NOW - 5,
      expectedYearlyPriceUsd: 290,
    });
    expect(
      parseChangePlanBody({ billingPeriod: 'yearly', prorationDate: NOW }, NOW)
    ).toEqual({
      ok: true,
      billingPeriod: 'yearly',
      prorationDate: NOW,
      expectedYearlyPriceUsd: null,
    });
  });

  it.each([
    [undefined],
    [null],
    ['yearly'],
    [{}],
    [{ billingPeriod: 'weekly' }],
    [{ billingPeriod: 'YEARLY' }],
    [{ billingPeriod: 12 }],
  ])('refuses a body without a known billing period: %j', (body) => {
    expect(parseChangePlanBody(body, NOW)).toEqual({
      ok: false,
      code: 'INVALID_BILLING_PERIOD',
    });
  });

  it.each([
    [undefined],
    [null],
    ['1799999999'],
    [1_799_999_999.5],
    [0],
    [-1],
    [Number.NaN],
  ])('refuses an upgrade whose prorationDate is %p', (prorationDate) => {
    expect(
      parseChangePlanBody({ billingPeriod: 'yearly', prorationDate }, NOW)
    ).toEqual({ ok: false, code: 'INVALID_PRORATION_DATE' });
  });

  it('accepts the oldest and the newest allowed quote time, refuses one second beyond', () => {
    const at = (prorationDate: number) =>
      parseChangePlanBody({ billingPeriod: 'yearly', prorationDate }, NOW);
    expect(at(NOW - PRORATION_MAX_AGE_SECONDS)).toMatchObject({ ok: true });
    expect(at(NOW + PRORATION_MAX_FUTURE_SECONDS)).toMatchObject({ ok: true });
    expect(at(NOW - PRORATION_MAX_AGE_SECONDS - 1)).toEqual({
      ok: false,
      code: 'PRORATION_EXPIRED',
    });
    expect(at(NOW + PRORATION_MAX_FUTURE_SECONDS + 1)).toEqual({
      ok: false,
      code: 'PRORATION_EXPIRED',
    });
  });

  it('an old quote time cannot buy a bigger credit: the start of the period is refused', () => {
    expect(
      parseChangePlanBody(
        { billingPeriod: 'yearly', prorationDate: NOW - 20 * 86_400 },
        NOW
      )
    ).toEqual({ ok: false, code: 'PRORATION_EXPIRED' });
  });

  it.each([[0], [-290], ['290'], [Number.NaN], [Infinity]])(
    'refuses an expected yearly price of %p',
    (expectedYearlyPriceUsd) => {
      expect(
        parseChangePlanBody(
          {
            billingPeriod: 'yearly',
            prorationDate: NOW,
            expectedYearlyPriceUsd,
          },
          NOW
        )
      ).toEqual({ ok: false, code: 'INVALID_EXPECTED_PRICE' });
    }
  );

  it('the monthly switch ignores a stray prorationDate', () => {
    expect(
      parseChangePlanBody({ billingPeriod: 'monthly', prorationDate: 1 }, NOW)
    ).toEqual({
      ok: true,
      billingPeriod: 'monthly',
      expectedMonthlyPriceUsd: null,
    });
  });
});

describe('sameUsdPrice', () => {
  it('compares to the cent', () => {
    expect(sameUsdPrice(290, 290)).toBe(true);
    expect(sameUsdPrice(289.999, 290)).toBe(true);
    expect(sameUsdPrice(290.01, 290)).toBe(false);
    expect(sameUsdPrice(0.1 + 0.2, 0.3)).toBe(true);
  });
});
