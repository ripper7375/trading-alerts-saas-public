/**
 * GET /api/subscription -- Manage Subscription S1, defect B2 (and the
 * allowedActions / displayState / openInvoiceUrl additions).
 *
 * A user whose renewal failed must still receive the subscription block, even
 * when the tier is FREE (UNPAID, or a PAST_DUE row downgraded before the grace
 * fix), so the billing page can offer "Pay now" and "Update card".
 *
 * @module __tests__/api/subscription-get.test
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
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
    },
  },
}));

const mockResolveViewAsSubject = jest.fn();
jest.mock('@/lib/admin/user-view-as', () => ({
  __esModule: true,
  VIEW_AS_DENIED_BODY: { error: 'denied' },
  resolveViewAsSubject: (...a: unknown[]) => mockResolveViewAsSubject(...a),
}));

const mockGetSubscription = jest.fn();
const mockGetCustomerPaymentMethods = jest.fn();
const mockGetOpenInvoiceUrl = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  getSubscription: (...a: unknown[]) => mockGetSubscription(...a),
  getCustomerPaymentMethods: (...a: unknown[]) =>
    mockGetCustomerPaymentMethods(...a),
  getOpenInvoiceUrl: (...a: unknown[]) => mockGetOpenInvoiceUrl(...a),
}));

import { GET } from '@/app/api/subscription/route';

const INVOICE_URL = 'https://invoice.stripe.com/i/acct_1/test_1';

const TRIAL_FIELDS = {
  trialStatus: 'CONVERTED',
  trialConvertedAt: null,
  trialCancelledAt: null,
  hasUsedFreeTrial: true,
};

function stripeRow(status: string): Record<string, unknown> {
  return {
    id: 'row_1',
    status,
    planType: 'MONTHLY',
    amountUsd: 29,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripeCurrentPeriodEnd: new Date('2026-11-21T00:00:00.000Z'),
    expiresAt: new Date('2026-11-21T00:00:00.000Z'),
    dLocalPaymentId: null,
    dLocalPaymentMethod: null,
    dLocalCountry: null,
  };
}

async function get(): Promise<{
  status: number;
  body: Record<string, any>;
}> {
  const res = await GET({} as never);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
  mockResolveViewAsSubject.mockResolvedValue({ kind: 'self', userId: 'u1' });
  mockGetSubscription.mockResolvedValue({
    cancel_at_period_end: false,
    trial_end: null,
  });
  mockGetCustomerPaymentMethods.mockResolvedValue([
    { card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
  ]);
  mockGetOpenInvoiceUrl.mockResolvedValue(null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/subscription -- failed payments (B2)', () => {
  it('returns the subscription block, the invoice URL and pay now for a PRO user in grace (PAST_DUE)', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'PRO', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('PAST_DUE'));
    mockGetOpenInvoiceUrl.mockResolvedValue(INVOICE_URL);

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.tier).toBe('PRO');
    expect(body.status).toBe('PAST_DUE');
    expect(body.displayState).toBe('PAST_DUE');
    expect(body.allowedActions).toEqual(['pay_now', 'update_card']);
    expect(body.subscription.openInvoiceUrl).toBe(INVOICE_URL);
    expect(body.subscription.paymentMethod).toEqual({
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2030,
    });
    expect(mockGetOpenInvoiceUrl).toHaveBeenCalledWith('sub_1');
  });

  it('returns the block for a FREE user whose subscription is UNPAID, instead of subscription: null', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'FREE', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('UNPAID'));
    mockGetOpenInvoiceUrl.mockResolvedValue(INVOICE_URL);

    const { body } = await get();

    expect(body.tier).toBe('FREE');
    expect(body.status).toBe('UNPAID');
    expect(body.displayState).toBe('UNPAID');
    expect(body.allowedActions).toEqual(['pay_now', 'update_card']);
    expect(body.subscription).not.toBeNull();
    expect(body.subscription.openInvoiceUrl).toBe(INVOICE_URL);
  });

  it('returns the block for a FREE user whose row is still PAST_DUE (downgraded before the grace fix)', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'FREE', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('PAST_DUE'));
    mockGetOpenInvoiceUrl.mockResolvedValue(INVOICE_URL);

    const { body } = await get();

    expect(body.displayState).toBe('PAST_DUE');
    expect(body.subscription).not.toBeNull();
    expect(body.allowedActions).toEqual(['pay_now', 'update_card']);
  });

  it('still answers, with update card only, when Stripe cannot find the open invoice', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'PRO', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('PAST_DUE'));
    mockGetOpenInvoiceUrl.mockRejectedValue(new Error('stripe is down'));

    const { status, body } = await get();

    expect(status).toBe(200);
    expect(body.subscription.openInvoiceUrl).toBeNull();
    expect(body.allowedActions).toEqual(['update_card']);
  });

  it('keeps subscription: null for a FREE user whose subscription is CANCELED', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'FREE', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('CANCELED'));

    const { body } = await get();

    expect(body).toMatchObject({
      tier: 'FREE',
      status: 'none',
      displayState: 'FREE',
      allowedActions: [],
      subscription: null,
    });
    expect(mockGetOpenInvoiceUrl).not.toHaveBeenCalled();
  });

  it('does not look for an invoice while the subscription is healthy', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'PRO', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('ACTIVE'));

    const { body } = await get();

    expect(body.displayState).toBe('ACTIVE');
    expect(body.allowedActions).toEqual(['update_card', 'cancel']);
    expect(body.subscription.openInvoiceUrl).toBeNull();
    expect(mockGetOpenInvoiceUrl).not.toHaveBeenCalled();
  });
});

describe('GET /api/subscription -- other providers and view-as', () => {
  it('offers cancel only (no card update, no invoice) for a dLocal subscription', async () => {
    mockUserFindUnique.mockResolvedValue({ tier: 'PRO', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue({
      ...stripeRow('ACTIVE'),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      dLocalPaymentId: 'dl_1',
    });

    const { body } = await get();

    expect(body.subscription.provider).toBe('DLOCAL');
    expect(body.allowedActions).toEqual(['cancel']);
    expect(mockGetSubscription).not.toHaveBeenCalled();
    expect(mockGetOpenInvoiceUrl).not.toHaveBeenCalled();
  });

  it('hides every action and the invoice URL in admin view-as, and never asks Stripe for the invoice', async () => {
    mockResolveViewAsSubject.mockResolvedValue({
      kind: 'view-as',
      userId: 'u2',
      target: {},
    });
    mockUserFindUnique.mockResolvedValue({ tier: 'FREE', ...TRIAL_FIELDS });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow('UNPAID'));
    mockGetOpenInvoiceUrl.mockResolvedValue(INVOICE_URL);

    const { body } = await get();

    // The viewed user's state is still shown...
    expect(body.displayState).toBe('UNPAID');
    expect(body.subscription).not.toBeNull();
    // ...but nothing can be started from the admin's session.
    expect(body.allowedActions).toEqual([]);
    expect(body.subscription.openInvoiceUrl).toBeNull();
    expect(mockGetOpenInvoiceUrl).not.toHaveBeenCalled();
  });

  it('answers 401 without a session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { status } = await get();

    expect(status).toBe(401);
  });
});
