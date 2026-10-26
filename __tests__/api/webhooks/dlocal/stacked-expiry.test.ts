/**
 * POST /api/webhooks/dlocal -- stacked expiry (Manage Subscription S4,
 * decision D6, defect B10; plan §7 W6).
 *
 * A dLocal payment buys a period that ends at `expiresAt`. A customer who pays
 * again BEFORE the plan ends keeps the days they have left:
 * `max(now, current expiry) + duration`. Before S4 the webhook wrote
 * `now + duration` and threw the remaining days away. Stacking makes a replayed
 * webhook dangerous (it would add the period twice), so the payment is claimed
 * inside the transaction and a replay changes nothing.
 *
 * money-service's controller has the same cases in
 * `dlocal-webhook.controller.spec.ts`.
 *
 * @module __tests__/api/webhooks/dlocal/stacked-expiry.test
 */

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/dlocal/dlocal-payment.service', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/dlocal/dlocal-payment.service'),
  verifyWebhookSignature: jest.fn().mockReturnValue(true),
}));

const mockMarkThreeDayPlanUsed = jest.fn();
jest.mock('@/lib/dlocal/three-day-validator.service', () => ({
  __esModule: true,
  markThreeDayPlanUsed: (...a: unknown[]) => mockMarkThreeDayPlanUsed(...a),
}));

const mockProcessAffiliateConversion = jest.fn();
jest.mock('@/lib/affiliate/conversion-processor', () => ({
  __esModule: true,
  processAffiliateConversion: (...a: unknown[]) =>
    mockProcessAffiliateConversion(...a),
}));

jest.mock('@/lib/affiliate/db', () => ({
  __esModule: true,
  getAnnualPriceUsd: jest.fn().mockResolvedValue(350),
  getBasePriceUsd: jest.fn().mockResolvedValue(35),
  getThreeDayPriceUsd: jest.fn().mockResolvedValue(2.49),
}));

const tx = {
  payment: { updateMany: jest.fn(), update: jest.fn() },
  user: { update: jest.fn() },
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
};
const mockPaymentFindFirst = jest.fn();
const mockNotificationCreate = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    payment: {
      findFirst: (...a: unknown[]) => mockPaymentFindFirst(...a),
      update: jest.fn(),
    },
    subscription: { findUnique: jest.fn().mockResolvedValue({ id: 'sub-r' }) },
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
    },
    $transaction: (cb: (t: typeof tx) => unknown) => cb(tx),
  },
}));

import { POST } from '@/app/api/webhooks/dlocal/route';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-21T12:00:00.000Z');

type PlanType = 'MONTHLY' | 'YEARLY' | 'THREE_DAY';

function payment(planType: PlanType): Record<string, unknown> {
  return {
    id: 'payment-r',
    userId: 'user-r',
    planType,
    amountUSD: 29,
    currency: 'INR',
    country: 'IN',
    paymentMethod: 'UPI',
    providerPaymentId: 'dl-payment-r',
    discountCode: null,
  };
}

function livePlan(daysLeft: number): Record<string, unknown> {
  return {
    id: 'sub-r',
    status: 'ACTIVE',
    dLocalPaymentId: 'dl-payment-old',
    stripeSubscriptionId: null,
    expiresAt: new Date(NOW + daysLeft * DAY),
    renewalReminderSent: true,
  };
}

/** Delivers a PAID webhook for `planType` with `existing` as the current row. */
async function pay(
  planType: PlanType,
  existing: Record<string, unknown> | null
): Promise<{ status: number; data: Record<string, unknown> | null }> {
  mockPaymentFindFirst.mockResolvedValue(payment(planType));
  tx.subscription.findUnique
    .mockResolvedValueOnce(existing)
    .mockResolvedValueOnce({ id: 'sub-r' });

  const body = JSON.stringify({ id: 'dl-payment-r', status: 'PAID' });
  const response = await POST({
    text: async () => body,
    headers: { get: () => 'signature' },
  } as never);

  const updated = tx.subscription.update.mock.calls[0]?.[0] as
    | { data: Record<string, unknown> }
    | undefined;
  const created = tx.subscription.create.mock.calls[0]?.[0] as
    | { data: Record<string, unknown> }
    | undefined;
  return {
    status: response.status,
    data: (updated ?? created)?.data ?? null,
  };
}

const expiryOf = (data: Record<string, unknown> | null): number =>
  (data?.['expiresAt'] as Date).getTime();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  tx.payment.updateMany.mockResolvedValue({ count: 1 });
  tx.payment.update.mockResolvedValue({});
  tx.user.update.mockResolvedValue({});
  tx.subscription.update.mockResolvedValue({});
  tx.subscription.create.mockResolvedValue({});
  mockNotificationCreate.mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('dLocal webhook: an early renewal stacks the days left (D6, B10)', () => {
  it('10 days left + a monthly payment = 40 days, not 30', async () => {
    const { status, data } = await pay('MONTHLY', livePlan(10));

    expect(status).toBe(200);
    expect(expiryOf(data)).toBe(NOW + 40 * DAY);
    expect(expiryOf(data)).not.toBe(NOW + 30 * DAY);
  });

  it('2 days left + a yearly payment = 367 days', async () => {
    const { data } = await pay('YEARLY', livePlan(2));
    expect(expiryOf(data)).toBe(NOW + 367 * DAY);
  });

  it('1 day left + a 3-day payment = 4 days', async () => {
    const { data } = await pay('THREE_DAY', livePlan(1));
    expect(expiryOf(data)).toBe(NOW + 4 * DAY);
  });

  it('a payment after the plan ended starts now', async () => {
    const { data } = await pay('MONTHLY', livePlan(-2));
    expect(expiryOf(data)).toBe(NOW + 30 * DAY);
  });

  it('a first purchase (no row) starts now and creates the row', async () => {
    const { data } = await pay('MONTHLY', null);

    expect(tx.subscription.create).toHaveBeenCalledTimes(1);
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(expiryOf(data)).toBe(NOW + 30 * DAY);
  });

  it('a lapsed dLocal row is not stacked onto', async () => {
    const { data } = await pay('MONTHLY', {
      ...livePlan(20),
      status: 'CANCELED',
    });
    expect(expiryOf(data)).toBe(NOW + 30 * DAY);
  });

  it('a Stripe row with a date months ahead is not stacked onto', async () => {
    const { data } = await pay('MONTHLY', {
      id: 'sub-r',
      status: 'ACTIVE',
      dLocalPaymentId: null,
      stripeSubscriptionId: 'sub_stripe_1',
      expiresAt: new Date(NOW + 300 * DAY),
    });
    expect(expiryOf(data)).toBe(NOW + 30 * DAY);
  });

  it('resets renewalReminderSent so the next reminder can go out', async () => {
    const { data } = await pay('MONTHLY', livePlan(2));
    expect(data?.['renewalReminderSent']).toBe(false);
  });

  it('records the new payment on the row and keeps the plan ACTIVE', async () => {
    const { data } = await pay('YEARLY', livePlan(5));
    expect(data).toEqual(
      expect.objectContaining({
        status: 'ACTIVE',
        planType: 'YEARLY',
        dLocalPaymentId: 'dl-payment-r',
      })
    );
  });
});

describe('dLocal webhook: a replay adds nothing (the claim)', () => {
  it('claims the payment inside the transaction before it writes the subscription', async () => {
    await pay('MONTHLY', livePlan(10));

    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'payment-r', status: { not: 'COMPLETED' } },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
    const claim = tx.payment.updateMany.mock.invocationCallOrder[0] as number;
    const write = tx.subscription.update.mock.invocationCallOrder[0] as number;
    expect(claim).toBeLessThan(write);
  });

  it('a payment that is already COMPLETED changes neither the tier nor the expiry', async () => {
    tx.payment.updateMany.mockResolvedValue({ count: 0 });

    const { status, data } = await pay('MONTHLY', livePlan(10));

    expect(status).toBe(200);
    expect(data).toBeNull();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.subscription.create).not.toHaveBeenCalled();
  });

  it('two deliveries of one payment add the period once', async () => {
    tx.payment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await pay('MONTHLY', livePlan(10));
    await pay('MONTHLY', livePlan(10));

    expect(tx.subscription.update).toHaveBeenCalledTimes(1);
  });
});
