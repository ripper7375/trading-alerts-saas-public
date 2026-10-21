/**
 * GET  /api/subscription/change-plan/preview
 * POST /api/subscription/change-plan
 * DELETE /api/subscription/change-plan
 *
 * Manage Subscription S3, workflows W5a (monthly to yearly NOW, prorated,
 * decisions D2, E2, E3) and W5b (yearly to monthly at the RENEWAL, through a
 * Stripe Subscription Schedule, and the "keep yearly" undo). Stripe is a mock
 * returning the shapes seen in test mode.
 *
 * @module __tests__/api/subscription-change-plan.test
 */

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockUserFindUnique = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockSubscriptionUpdate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
      update: (...a: unknown[]) => mockSubscriptionUpdate(...a),
    },
  },
}));

const mockUseMoneyService = jest.fn();
jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  shouldUseMoneyServiceForStripeWrite: () => mockUseMoneyService(),
}));

const mockForward = jest.fn();
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  forwardWriteRequestToMoneyService: (...a: unknown[]) => mockForward(...a),
  MoneyServiceError: class MoneyServiceError extends Error {
    constructor(
      public status: number,
      public body: unknown
    ) {
      super('money-service error');
    }
  },
}));

const mockGetAnnualPrice = jest.fn();
const mockGetBasePrice = jest.fn();
jest.mock('@/lib/affiliate/db', () => ({
  __esModule: true,
  getAnnualPriceUsd: () => mockGetAnnualPrice(),
  getBasePriceUsd: () => mockGetBasePrice(),
}));

const mockGetSubscription = jest.fn();
const mockBuildProLineItem = jest.fn();
const mockPreview = jest.fn();
const mockUpgrade = jest.fn();
const mockSchedule = jest.fn();
const mockRelease = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  STRIPE_PRO_PRICE_ID: 'price_pro',
  getSubscription: (...a: unknown[]) => mockGetSubscription(...a),
  buildProLineItem: (...a: unknown[]) => mockBuildProLineItem(...a),
  previewYearlyUpgrade: (...a: unknown[]) => mockPreview(...a),
  upgradeToYearlyNow: (...a: unknown[]) => mockUpgrade(...a),
  scheduleSwitchToMonthly: (...a: unknown[]) => mockSchedule(...a),
  releaseSubscriptionSchedule: (...a: unknown[]) => mockRelease(...a),
  // The real, pure helpers (the mock replaces the whole module).
  proItemOf: (subscription: {
    items?: {
      data?: Array<{
        id: string;
        price?: { recurring?: { interval?: string } };
      }>;
    };
  }) => {
    const items = subscription.items?.data ?? [];
    const item = items.length === 1 ? items[0] : undefined;
    return item
      ? { id: item.id, interval: item.price?.recurring?.interval ?? null }
      : null;
  },
  isStripeCardError: (error: { type?: string; statusCode?: number } | null) =>
    error?.type === 'StripeCardError' || error?.statusCode === 402,
}));

const mockSendUpgraded = jest.fn();
const mockSendSwitch = jest.fn();
jest.mock('@/lib/email/subscription-emails', () => ({
  __esModule: true,
  sendSubscriptionUpgradedEmail: (...a: unknown[]) => mockSendUpgraded(...a),
  sendPlanSwitchScheduledEmail: (...a: unknown[]) => mockSendSwitch(...a),
}));

import { DELETE, POST } from '@/app/api/subscription/change-plan/route';
import { GET as PREVIEW } from '@/app/api/subscription/change-plan/preview/route';
import { MoneyServiceError } from '@/lib/money-service/write-routes';

const PERIOD_END = new Date('2026-11-21T00:00:00.000Z');
const PERIOD_END_S = PERIOD_END.getTime() / 1000;
const NEW_END_S = PERIOD_END_S + 365 * 86_400;
const nowS = (): number => Math.floor(Date.now() / 1000);

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'row_1',
    status: 'ACTIVE',
    planType: 'MONTHLY',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripeCurrentPeriodEnd: PERIOD_END,
    dLocalPaymentId: null,
    cancelAtPeriodEnd: false,
    pendingPlanType: null,
    pendingPlanEffectiveAt: null,
    stripeScheduleId: null,
    ...overrides,
  };
}

function live(
  interval: 'month' | 'year',
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'sub_1',
    status: 'active',
    customer: 'cus_1',
    schedule: null,
    cancel_at_period_end: false,
    current_period_end: PERIOD_END_S,
    trial_end: null,
    items: { data: [{ id: 'si_1', price: { recurring: { interval } } }] },
    ...overrides,
  };
}

type Result = { status: number; body: Record<string, any> };

async function post(body?: unknown): Promise<Result> {
  const request = { json: async () => body };
  const res = await POST(request as never);
  return { status: res.status, body: await res.json() };
}

async function del(): Promise<Result> {
  const res = await DELETE({} as never);
  return { status: res.status, body: await res.json() };
}

async function preview(search = '?billingPeriod=yearly'): Promise<Result> {
  const url = new URL(
    `http://localhost/api/subscription/change-plan/preview${search}`
  );
  const res = await PREVIEW({ nextUrl: url } as never);
  return { status: res.status, body: await res.json() };
}

const upgradeBody = (over: Record<string, unknown> = {}) => ({
  billingPeriod: 'yearly',
  prorationDate: nowS() - 5,
  ...over,
});

const cardError = () =>
  Object.assign(new Error('Your card was declined.'), {
    type: 'StripeCardError',
    statusCode: 402,
  });

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
  mockUseMoneyService.mockReturnValue(false);
  mockUserFindUnique.mockResolvedValue({
    tier: 'PRO',
    email: 'user@example.com',
    name: 'Una',
  });
  mockSubscriptionFindUnique.mockResolvedValue(row());
  mockSubscriptionUpdate.mockResolvedValue({});
  mockGetAnnualPrice.mockResolvedValue(290);
  mockGetBasePrice.mockResolvedValue(29);
  mockGetSubscription.mockResolvedValue(live('month'));
  mockBuildProLineItem.mockImplementation(
    async (_priceId: string, amount: number, period: string) => ({
      price_data: { unit_amount: amount * 100, period },
    })
  );
  mockPreview.mockResolvedValue({
    amountDueNowUsd: 270.35,
    creditUsd: 19.65,
    taxUsd: 0,
    renewsOn: new Date('2027-10-31T03:15:00.000Z'),
    inTrial: false,
  });
  mockUpgrade.mockResolvedValue({
    id: 'sub_1',
    current_period_end: NEW_END_S,
    latest_invoice: { amount_paid: 27035 },
  });
  mockSchedule.mockResolvedValue({ id: 'sub_sched_1' });
  mockRelease.mockResolvedValue('released');
  mockSendUpgraded.mockResolvedValue({ success: true });
  mockSendSwitch.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const expectNothingChanged = (): void => {
  expect(mockUpgrade).not.toHaveBeenCalled();
  expect(mockSchedule).not.toHaveBeenCalled();
  expect(mockRelease).not.toHaveBeenCalled();
  expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  expect(mockSendUpgraded).not.toHaveBeenCalled();
  expect(mockSendSwitch).not.toHaveBeenCalled();
};

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/subscription/change-plan/preview (W5a quote)', () => {
  it('quotes the upgrade at the SystemConfig yearly price and returns the quote time to confirm with', async () => {
    const before = nowS();
    const { status, body } = await preview();
    const after = nowS();

    expect(status).toBe(200);
    expect(body).toMatchObject({
      amountDueNowUsd: 270.35,
      yearlyPriceUsd: 290,
      creditUsd: 19.65,
      taxUsd: 0,
      renewsOn: '2027-10-31T03:15:00.000Z',
      inTrial: false,
    });
    expect(body.prorationDate).toBeGreaterThanOrEqual(before);
    expect(body.prorationDate).toBeLessThanOrEqual(after);
    expect(mockBuildProLineItem).toHaveBeenCalledWith(
      'price_pro',
      290,
      'yearly'
    );
    expect(mockPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_1',
        itemId: 'si_1',
        prorationDate: body.prorationDate,
      })
    );
  });

  it('is never cached', async () => {
    const res = await PREVIEW({
      nextUrl: new URL('http://localhost/x?billingPeriod=yearly'),
    } as never);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('quotes a free-trial upgrade as nothing due now (E3)', async () => {
    mockGetSubscription.mockResolvedValue(
      live('month', { status: 'trialing' })
    );
    mockPreview.mockResolvedValue({
      amountDueNowUsd: 0,
      creditUsd: 0,
      taxUsd: 0,
      renewsOn: new Date('2026-10-28T00:00:00.000Z'),
      inTrial: true,
    });

    const { body } = await preview();

    expect(body).toMatchObject({ amountDueNowUsd: 0, inTrial: true });
  });

  it.each([[''], ['?billingPeriod=monthly'], ['?billingPeriod=weekly']])(
    'INVALID_BILLING_PERIOD for %p, before anything is read',
    async (search) => {
      const { status, body } = await preview(search);
      expect(status).toBe(400);
      expect(body.code).toBe('INVALID_BILLING_PERIOD');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expect(mockPreview).not.toHaveBeenCalled();
    }
  );

  it('401 without a session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    expect((await preview()).status).toBe(401);
  });

  it.each([
    ['already yearly', live('year'), row({ planType: 'YEARLY' })],
    ['Stripe bills yearly although the row says MONTHLY', live('year'), row()],
    [
      'a scheduled cancellation',
      live('month', { cancel_at_period_end: true }),
      row(),
    ],
    ['a failed payment', live('month'), row({ status: 'PAST_DUE' })],
  ])('ACTION_NOT_ALLOWED: %s', async (_label, liveSub, subscription) => {
    mockGetSubscription.mockResolvedValue(liveSub);
    mockSubscriptionFindUnique.mockResolvedValue(subscription);

    const { status, body } = await preview();

    expect(status).toBe(400);
    expect(body.code).toBe('ACTION_NOT_ALLOWED');
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('DLOCAL_NO_CHANGE for a dLocal plan, without asking Stripe', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(
      row({ dLocalPaymentId: 'dl_1' })
    );
    const { status, body } = await preview();
    expect(status).toBe(400);
    expect(body.code).toBe('DLOCAL_NO_CHANGE');
    expect(mockGetSubscription).not.toHaveBeenCalled();
  });

  it('NO_SUBSCRIPTION for a FREE user and for no row; 404 for no user', async () => {
    mockUserFindUnique.mockResolvedValue({
      tier: 'FREE',
      email: null,
      name: null,
    });
    expect((await preview()).body.code).toBe('NO_SUBSCRIPTION');

    mockUserFindUnique.mockResolvedValue({
      tier: 'PRO',
      email: null,
      name: null,
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    expect((await preview()).body.code).toBe('NO_SUBSCRIPTION');

    mockUserFindUnique.mockResolvedValue(null);
    const missing = await preview();
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');
  });

  it('UNSUPPORTED_SUBSCRIPTION when the subscription does not have exactly one item', async () => {
    mockGetSubscription.mockResolvedValue({
      ...live('month'),
      items: {
        data: [
          { id: 'si_1', price: { recurring: { interval: 'month' } } },
          { id: 'si_2', price: { recurring: { interval: 'month' } } },
        ],
      },
    });
    const { status, body } = await preview();
    expect(status).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_SUBSCRIPTION');
  });

  it('500 PREVIEW_ERROR when Stripe fails, without leaking its message', async () => {
    mockPreview.mockRejectedValue(new Error('No such price: price_secret'));
    const { status, body } = await preview();
    expect(status).toBe(500);
    expect(body.code).toBe('PREVIEW_ERROR');
    expect(JSON.stringify(body)).not.toContain('price_secret');
  });

  it('writes nothing', async () => {
    await preview();
    expectNothingChanged();
  });

  it('forwards to money-service, query string included, when the flag is on', async () => {
    mockUseMoneyService.mockReturnValue(true);
    mockForward.mockResolvedValue({ amountDueNowUsd: 1 });

    const { status, body } = await preview();

    expect(status).toBe(200);
    expect(body).toEqual({ amountDueNowUsd: 1 });
    expect(mockForward).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/stripe/subscriptions/change-plan/preview?billingPeriod=yearly',
      { method: 'GET' }
    );
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('passes money-service refusals through with their status and body', async () => {
    mockUseMoneyService.mockReturnValue(true);
    mockForward.mockRejectedValue(
      new MoneyServiceError(400, { code: 'ACTION_NOT_ALLOWED' })
    );
    const { status, body } = await preview();
    expect(status).toBe(400);
    expect(body).toEqual({ code: 'ACTION_NOT_ALLOWED' });
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/subscription/change-plan: monthly to yearly, now (W5a)', () => {
  it('charges through Stripe at the quoted time, records YEARLY at the yearly price, and sends the e-mail with the amount charged', async () => {
    const body = upgradeBody();
    const { status, body: result } = await post(body);

    expect(status).toBe(200);
    expect(mockUpgrade).toHaveBeenCalledWith({
      subscriptionId: 'sub_1',
      itemId: 'si_1',
      yearlyLineItem: expect.anything(),
      prorationDate: body.prorationDate,
      idempotencyKey: `change-plan:sub_1:yearly:${body.prorationDate}`,
    });
    const newEnd = new Date(NEW_END_S * 1000);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'row_1' },
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
    expect(mockSendUpgraded).toHaveBeenCalledWith(
      'user@example.com',
      'Una',
      'PRO',
      270.35,
      290,
      newEnd,
      false
    );
    expect(result).toMatchObject({
      success: true,
      billingPeriod: 'yearly',
      amountChargedUsd: 270.35,
      renewsOn: newEnd.toISOString(),
      inTrial: false,
    });
  });

  it('charges Stripe before it writes anything', async () => {
    await post(upgradeBody());
    expect(mockUpgrade.mock.invocationCallOrder[0]!).toBeLessThan(
      mockSubscriptionUpdate.mock.invocationCallOrder[0]!
    );
  });

  it('in a free trial the price changes, nothing is charged, and the e-mail says so (E3)', async () => {
    mockGetSubscription.mockResolvedValue(
      live('month', { status: 'trialing' })
    );
    mockUpgrade.mockResolvedValue({
      id: 'sub_1',
      current_period_end: PERIOD_END_S,
      latest_invoice: { amount_paid: 0 },
    });

    const { body } = await post(upgradeBody());

    expect(body).toMatchObject({ amountChargedUsd: 0, inTrial: true });
    // A $0 invoice is skipped by the invoice webhook, so the row is written here.
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planType: 'YEARLY', amountUsd: 290 }),
      })
    );
    expect(mockSendUpgraded).toHaveBeenCalledWith(
      'user@example.com',
      'Una',
      'PRO',
      0,
      290,
      PERIOD_END,
      true
    );
  });

  it('E2: a declined card is a 402 PAYMENT_FAILED; the user stays monthly, nothing is recorded or sent', async () => {
    mockUpgrade.mockRejectedValue(cardError());

    const { status, body } = await post(upgradeBody());

    expect(status).toBe(402);
    expect(body.code).toBe('PAYMENT_FAILED');
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockSendUpgraded).not.toHaveBeenCalled();
  });

  it('E2: a 3-D Secure request (a 402 without a card-error type) is refused the same way', async () => {
    mockUpgrade.mockRejectedValue(
      Object.assign(new Error('authentication_required'), { statusCode: 402 })
    );
    const { status, body } = await post(upgradeBody());
    expect(status).toBe(402);
    expect(body.code).toBe('PAYMENT_FAILED');
  });

  it('any other Stripe failure is a 500 CHANGE_PLAN_ERROR that does not leak Stripe’s message', async () => {
    mockUpgrade.mockRejectedValue(new Error('No such item: si_secret'));
    const { status, body } = await post(upgradeBody());
    expect(status).toBe(500);
    expect(body.code).toBe('CHANGE_PLAN_ERROR');
    expect(JSON.stringify(body)).not.toContain('si_secret');
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('still answers success when Stripe has switched and charged but the row write fails', async () => {
    mockSubscriptionUpdate.mockRejectedValue(new Error('db down'));
    const { status, body } = await post(upgradeBody());
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    // The e-mail still goes: the customer was charged.
    expect(mockSendUpgraded).toHaveBeenCalled();
  });

  it('does not fail the switch when the e-mail fails', async () => {
    mockSendUpgraded.mockRejectedValue(new Error('Resend is down'));
    const { status } = await post(upgradeBody());
    expect(status).toBe(200);
  });

  it('PRICE_CHANGED (409) when the price on screen is no longer the yearly price, before anything is charged', async () => {
    const { status, body } = await post(
      upgradeBody({ expectedYearlyPriceUsd: 250 })
    );
    expect(status).toBe(409);
    expect(body).toMatchObject({
      code: 'PRICE_CHANGED',
      currentYearlyPriceUsd: 290,
    });
    expectNothingChanged();
  });

  it('proceeds when the price on screen matches to the cent', async () => {
    const { status } = await post(upgradeBody({ expectedYearlyPriceUsd: 290 }));
    expect(status).toBe(200);
  });

  it('releases a schedule left attached before changing the subscription', async () => {
    mockGetSubscription.mockResolvedValue(
      live('month', { schedule: 'sub_sched_leftover' })
    );
    await post(upgradeBody());
    expect(mockRelease).toHaveBeenCalledWith('sub_sched_leftover');
    expect(mockRelease.mock.invocationCallOrder[0]!).toBeLessThan(
      mockUpgrade.mock.invocationCallOrder[0]!
    );
  });

  describe('the quote time cannot be used to buy a bigger credit', () => {
    it.each([
      ['missing', undefined, 'INVALID_PRORATION_DATE'],
      ['a string', '1799999999', 'INVALID_PRORATION_DATE'],
      ['an hour old', nowS() - 3600, 'PRORATION_EXPIRED'],
      ['the start of the period', nowS() - 20 * 86_400, 'PRORATION_EXPIRED'],
      ['in the future', nowS() + 3600, 'PRORATION_EXPIRED'],
    ])(
      'refuses a quote time that is %s',
      async (_label, prorationDate, code) => {
        const { status, body } = await post({
          billingPeriod: 'yearly',
          prorationDate,
        });
        expect(status).toBe(400);
        expect(body.code).toBe(code);
        expect(mockGetSubscription).not.toHaveBeenCalled();
        expectNothingChanged();
      }
    );
  });

  describe('refusals (nothing is called or written)', () => {
    it.each([[undefined], [null], [{}], [{ billingPeriod: 'weekly' }]])(
      'INVALID_BILLING_PERIOD for %j',
      async (body) => {
        const { status, body: result } = await post(body);
        expect(status).toBe(400);
        expect(result.code).toBe('INVALID_BILLING_PERIOD');
        expectNothingChanged();
      }
    );

    it('a body that is not JSON is read as empty', async () => {
      const res = await POST({
        json: async () => {
          throw new SyntaxError('bad json');
        },
      } as never);
      expect((await res.json()).code).toBe('INVALID_BILLING_PERIOD');
    });

    it.each([
      ['already yearly', live('year'), row({ planType: 'YEARLY' })],
      [
        'a switch to monthly is pending (keep yearly first)',
        live('year', { schedule: 'sub_sched_1' }),
        row({
          planType: 'YEARLY',
          pendingPlanType: 'MONTHLY',
          pendingPlanEffectiveAt: PERIOD_END,
          stripeScheduleId: 'sub_sched_1',
        }),
      ],
      [
        'a scheduled cancellation',
        live('month', { cancel_at_period_end: true }),
        row(),
      ],
      ['a failed payment', live('month'), row({ status: 'PAST_DUE' })],
    ])('ACTION_NOT_ALLOWED: %s', async (_label, liveSub, subscription) => {
      mockGetSubscription.mockResolvedValue(liveSub);
      mockSubscriptionFindUnique.mockResolvedValue(subscription);

      const { status, body } = await post(upgradeBody());

      expect(status).toBe(400);
      expect(body.code).toBe('ACTION_NOT_ALLOWED');
      expectNothingChanged();
    });

    it('DLOCAL_NO_CHANGE for a dLocal plan', async () => {
      mockSubscriptionFindUnique.mockResolvedValue(
        row({ dLocalPaymentId: 'dl_1' })
      );
      const { body } = await post(upgradeBody());
      expect(body.code).toBe('DLOCAL_NO_CHANGE');
      expectNothingChanged();
    });

    it('NO_SUBSCRIPTION for a FREE user', async () => {
      mockUserFindUnique.mockResolvedValue({
        tier: 'FREE',
        email: null,
        name: null,
      });
      const { body } = await post(upgradeBody());
      expect(body.code).toBe('NO_SUBSCRIPTION');
      expectNothingChanged();
    });

    it('401 without a session', async () => {
      mockGetServerSession.mockResolvedValue(null);
      expect((await post(upgradeBody())).status).toBe(401);
      expectNothingChanged();
    });
  });

  describe('money-service', () => {
    it('forwards to the money-service endpoint when the flag is on, and touches no database', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockResolvedValue({ success: true, billingPeriod: 'yearly' });

      const { status, body } = await post(upgradeBody());

      expect(status).toBe(200);
      expect(body).toEqual({ success: true, billingPeriod: 'yearly' });
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        '/v1/stripe/subscriptions/change-plan'
      );
      expect(mockUserFindUnique).not.toHaveBeenCalled();
      expectNothingChanged();
    });

    it('passes a 402 PAYMENT_FAILED through with its status and body', async () => {
      mockUseMoneyService.mockReturnValue(true);
      mockForward.mockRejectedValue(
        new MoneyServiceError(402, { code: 'PAYMENT_FAILED' })
      );
      const { status, body } = await post(upgradeBody());
      expect(status).toBe(402);
      expect(body).toEqual({ code: 'PAYMENT_FAILED' });
    });
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/subscription/change-plan: yearly to monthly, at the renewal (W5b)', () => {
  const yearly = (over: Record<string, unknown> = {}) =>
    row({ planType: 'YEARLY', ...over });

  beforeEach(() => {
    mockGetSubscription.mockResolvedValue(live('year'));
    mockSubscriptionFindUnique.mockResolvedValue(yearly());
  });

  it('schedules the switch at the period end at the SystemConfig monthly price, stores it, and sends the e-mail', async () => {
    const { status, body } = await post({ billingPeriod: 'monthly' });

    expect(status).toBe(200);
    expect(mockBuildProLineItem).toHaveBeenCalledWith(
      'price_pro',
      29,
      'monthly'
    );
    expect(mockSchedule).toHaveBeenCalledWith({
      subscriptionId: 'sub_1',
      monthlyLineItem: expect.anything(),
    });
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: 'row_1' },
      data: {
        pendingPlanType: 'MONTHLY',
        pendingPlanEffectiveAt: PERIOD_END,
        stripeScheduleId: 'sub_sched_1',
      },
    });
    expect(mockSendSwitch).toHaveBeenCalledWith(
      'user@example.com',
      'Una',
      'PRO',
      PERIOD_END,
      29
    );
    expect(body).toMatchObject({
      success: true,
      billingPeriod: 'monthly',
      effectiveAt: PERIOD_END.toISOString(),
      monthlyPriceUsd: 29,
    });
  });

  it('charges and refunds nothing: no upgrade call', async () => {
    await post({ billingPeriod: 'monthly' });
    expect(mockUpgrade).not.toHaveBeenCalled();
  });

  it('PRICE_CHANGED when the monthly price on screen is no longer the monthly price', async () => {
    const { status, body } = await post({
      billingPeriod: 'monthly',
      expectedMonthlyPriceUsd: 19,
    });
    expect(status).toBe(409);
    expect(body).toMatchObject({
      code: 'PRICE_CHANGED',
      currentMonthlyPriceUsd: 29,
    });
    expectNothingChanged();
  });

  it('ALREADY_PENDING when a switch is already scheduled', async () => {
    mockGetSubscription.mockResolvedValue(
      live('year', { schedule: 'sub_sched_1' })
    );
    mockSubscriptionFindUnique.mockResolvedValue(
      yearly({
        pendingPlanType: 'MONTHLY',
        pendingPlanEffectiveAt: PERIOD_END,
        stripeScheduleId: 'sub_sched_1',
      })
    );
    const { status, body } = await post({ billingPeriod: 'monthly' });
    expect(status).toBe(400);
    expect(body.code).toBe('ALREADY_PENDING');
    expectNothingChanged();
  });

  it('a stale pending column Stripe no longer backs does not block a new switch', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(
      yearly({
        pendingPlanType: 'MONTHLY',
        pendingPlanEffectiveAt: PERIOD_END,
        stripeScheduleId: 'sub_sched_gone',
      })
    );
    const { status } = await post({ billingPeriod: 'monthly' });
    expect(status).toBe(200);
  });

  it('releases a schedule attached while the row says nothing is pending (an orphan) before creating the new one', async () => {
    mockGetSubscription.mockResolvedValue(
      live('year', { schedule: 'sub_sched_orphan' })
    );
    await post({ billingPeriod: 'monthly' });
    expect(mockRelease).toHaveBeenCalledWith('sub_sched_orphan');
    expect(mockRelease.mock.invocationCallOrder[0]!).toBeLessThan(
      mockSchedule.mock.invocationCallOrder[0]!
    );
  });

  it('is not offered on a monthly plan, in a free trial, after a cancellation, or with a failed payment', async () => {
    const cases: Array<[Record<string, unknown>, Record<string, unknown>]> = [
      [live('month'), yearly({ planType: 'MONTHLY' })],
      [live('year', { status: 'trialing' }), yearly()],
      [live('year', { cancel_at_period_end: true }), yearly()],
      [live('year'), yearly({ status: 'PAST_DUE' })],
    ];
    for (const [liveSub, subscription] of cases) {
      mockGetSubscription.mockResolvedValue(liveSub);
      mockSubscriptionFindUnique.mockResolvedValue(subscription);
      const { status, body } = await post({ billingPeriod: 'monthly' });
      expect(status).toBe(400);
      expect(body.code).toBe('ACTION_NOT_ALLOWED');
    }
    expectNothingChanged();
  });

  it('takes the schedule back and answers CHANGE_PLAN_ERROR when the row cannot be written', async () => {
    mockSubscriptionUpdate.mockRejectedValue(new Error('db down'));

    const { status, body } = await post({ billingPeriod: 'monthly' });

    expect(status).toBe(500);
    expect(body.code).toBe('CHANGE_PLAN_ERROR');
    expect(mockRelease).toHaveBeenCalledWith('sub_sched_1');
    expect(mockSendSwitch).not.toHaveBeenCalled();
  });

  it('records and sends nothing when Stripe cannot create the schedule', async () => {
    mockSchedule.mockRejectedValue(new Error('Invalid phases: secret detail'));
    const { status, body } = await post({ billingPeriod: 'monthly' });
    expect(status).toBe(500);
    expect(body.code).toBe('CHANGE_PLAN_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockSendSwitch).not.toHaveBeenCalled();
  });

  it('does not fail the switch when the e-mail fails', async () => {
    mockSendSwitch.mockRejectedValue(new Error('Resend is down'));
    expect((await post({ billingPeriod: 'monthly' })).status).toBe(200);
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('DELETE /api/subscription/change-plan: keep yearly (W5b undo)', () => {
  const pending = (over: Record<string, unknown> = {}) =>
    row({
      planType: 'YEARLY',
      pendingPlanType: 'MONTHLY',
      pendingPlanEffectiveAt: PERIOD_END,
      stripeScheduleId: 'sub_sched_1',
      ...over,
    });
  const cleared = {
    where: { id: 'row_1' },
    data: {
      pendingPlanType: null,
      pendingPlanEffectiveAt: null,
      stripeScheduleId: null,
    },
  };

  beforeEach(() => {
    mockGetSubscription.mockResolvedValue(
      live('year', { schedule: 'sub_sched_1' })
    );
    mockSubscriptionFindUnique.mockResolvedValue(pending());
  });

  it('releases the schedule and clears the three pending columns', async () => {
    const { status, body } = await del();

    expect(status).toBe(200);
    expect(body).toEqual({
      success: true,
      message: 'Your plan stays yearly.',
      billingPeriod: 'yearly',
    });
    expect(mockRelease).toHaveBeenCalledWith('sub_sched_1');
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(cleared);
    expect(mockRelease.mock.invocationCallOrder[0]!).toBeLessThan(
      mockSubscriptionUpdate.mock.invocationCallOrder[0]!
    );
  });

  it('charges nothing and sends nothing', async () => {
    await del();
    expect(mockUpgrade).not.toHaveBeenCalled();
    expect(mockSendUpgraded).not.toHaveBeenCalled();
    expect(mockSendSwitch).not.toHaveBeenCalled();
  });

  it('only clears the row when Stripe already dropped the schedule (released in its dashboard)', async () => {
    mockGetSubscription.mockResolvedValue(live('year'));
    mockSubscriptionFindUnique.mockResolvedValue(
      pending({ stripeScheduleId: null })
    );

    const { status } = await del();

    expect(status).toBe(200);
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(cleared);
  });

  it('uses the schedule the row names when Stripe no longer shows one', async () => {
    mockGetSubscription.mockResolvedValue(live('year'));
    await del();
    expect(mockRelease).toHaveBeenCalledWith('sub_sched_1');
  });

  it('NOT_PENDING when there is nothing to undo', async () => {
    mockGetSubscription.mockResolvedValue(live('year'));
    mockSubscriptionFindUnique.mockResolvedValue(row({ planType: 'YEARLY' }));

    const { status, body } = await del();

    expect(status).toBe(400);
    expect(body.code).toBe('NOT_PENDING');
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('KEEP_YEARLY_ERROR, with the row untouched, when Stripe cannot release the schedule', async () => {
    mockRelease.mockRejectedValue(new Error('Stripe is down'));

    const { status, body } = await del();

    expect(status).toBe(500);
    expect(body.code).toBe('KEEP_YEARLY_ERROR');
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it('DLOCAL_NO_CHANGE for a dLocal plan', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(
      pending({ dLocalPaymentId: 'dl_1' })
    );
    expect((await del()).body.code).toBe('DLOCAL_NO_CHANGE');
  });

  it('401 without a session', async () => {
    mockGetServerSession.mockResolvedValue(null);
    expect((await del()).status).toBe(401);
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it('forwards a DELETE to money-service when the flag is on', async () => {
    mockUseMoneyService.mockReturnValue(true);
    mockForward.mockResolvedValue({ success: true });

    const { status } = await del();

    expect(status).toBe(200);
    expect(mockForward).toHaveBeenCalledWith(
      expect.anything(),
      '/v1/stripe/subscriptions/change-plan',
      { method: 'DELETE' }
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
