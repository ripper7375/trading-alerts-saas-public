/**
 * POST /api/payments/dlocal/create -- an early renewal by an active dLocal
 * subscriber (Manage Subscription S4, workflow W6).
 *
 * The route used to answer 403 to every active PRO subscriber, so "renew
 * before the plan ends" (decision D6) could not happen at all. It now lets one
 * case through, and only one: the request says `renew: true` AND the server's
 * own reading of the subscription offers `renew_now` (a live dLocal plan). The
 * flag alone proves nothing. A discount code is ignored on a renewal.
 *
 * money-service's controller has the same cases in
 * `dlocal-payment.controller.spec.ts`.
 *
 * @module __tests__/api/payments/dlocal-create-renew.test
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

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  shouldUseMoneyServiceForDlocalWrite: jest.fn().mockReturnValue(false),
}));
jest.mock('@/lib/money-service/write-routes', () => ({
  __esModule: true,
  forwardWriteRequestToMoneyService: jest.fn(),
  MoneyServiceError: class MoneyServiceError extends Error {},
}));

jest.mock('@/lib/affiliate/db', () => ({
  __esModule: true,
  getAnnualPriceUsd: jest.fn().mockResolvedValue(350),
  getBasePriceUsd: jest.fn().mockResolvedValue(35),
  getThreeDayPriceUsd: jest.fn().mockResolvedValue(2.49),
}));
jest.mock('@/lib/dlocal/currency-converter.service', () => ({
  __esModule: true,
  convertUSDToLocal: jest
    .fn()
    .mockResolvedValue({ localAmount: 2900, exchangeRate: 83 }),
}));
jest.mock('@/lib/dlocal/payment-methods.service', () => ({
  __esModule: true,
  isValidPaymentMethod: jest.fn().mockReturnValue(true),
}));
const mockCreatePayment = jest.fn();
const mockAcquireLock = jest.fn();
jest.mock('@/lib/dlocal/dlocal-payment.service', () => ({
  __esModule: true,
  createPayment: (...a: unknown[]) => mockCreatePayment(...a),
  acquireCreatePaymentLock: (...a: unknown[]) => mockAcquireLock(...a),
}));

const mockUserFindUnique = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockPaymentCreate = jest.fn();
const mockAffiliateCodeFindFirst = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
    },
    payment: {
      create: (...a: unknown[]) => mockPaymentCreate(...a),
      update: jest.fn().mockResolvedValue({}),
    },
    affiliateCode: {
      findFirst: (...a: unknown[]) => mockAffiliateCodeFindFirst(...a),
    },
  },
}));

import { POST } from '@/app/api/payments/dlocal/create/route';

const baseBody = {
  country: 'IN',
  paymentMethod: 'UPI',
  planType: 'MONTHLY',
  currency: 'INR',
};

async function create(
  body: Record<string, unknown>
): Promise<{ status: number; json: Record<string, any> }> {
  const response = await POST({ json: async () => body } as never);
  return { status: response.status, json: await response.json() };
}

const activeDlocal = {
  status: 'ACTIVE',
  dLocalPaymentId: 'dl-old',
  stripeSubscriptionId: null,
  expiresAt: new Date('2026-10-30T00:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetServerSession.mockResolvedValue({
    user: { id: 'user-1', email: 'u@example.com', name: 'U' },
  });
  mockUserFindUnique.mockResolvedValue({
    tier: 'PRO',
    hasUsedThreeDayPlan: true,
  });
  mockSubscriptionFindUnique.mockResolvedValue(activeDlocal);
  mockAcquireLock.mockResolvedValue(true);
  mockPaymentCreate.mockResolvedValue({ id: 'payment-1' });
  mockCreatePayment.mockResolvedValue({
    paymentId: 'dl-pay-1',
    orderId: 'order-1',
    paymentUrl: 'https://sandbox.dlocal.com/pay/1',
    status: 'PENDING',
  });
});

describe('POST /api/payments/dlocal/create -- early renewal (W6)', () => {
  it('creates the payment for an active dLocal subscriber who asks to renew', async () => {
    const { status, json } = await create({ ...baseBody, renew: true });

    expect(status).toBe(200);
    expect(json.paymentId).toBe('dl-pay-1');
    expect(mockPaymentCreate).toHaveBeenCalledTimes(1);
  });

  it('still answers 403 without the renew flag', async () => {
    const { status, json } = await create(baseBody);

    expect(status).toBe(403);
    expect(json.error).toBe('You already have an active subscription');
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it('answers 403 when renew is claimed by an active STRIPE subscriber', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      status: 'ACTIVE',
      dLocalPaymentId: null,
      stripeSubscriptionId: 'sub_1',
    });

    const { status } = await create({ ...baseBody, renew: true });

    expect(status).toBe(403);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it('answers 403 when renew is claimed and the row has no provider', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      status: 'ACTIVE',
      dLocalPaymentId: null,
      stripeSubscriptionId: null,
    });

    const { status } = await create({ ...baseBody, renew: true });

    expect(status).toBe(403);
  });

  it('ignores a discount code on a renewal: no lookup, no discount, no code stored', async () => {
    await create({ ...baseBody, renew: true, discountCode: 'SAVE10' });

    expect(mockAffiliateCodeFindFirst).not.toHaveBeenCalled();
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          discountCode: null,
          discountAmount: 0,
        }),
      })
    );
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 35, discountCode: undefined })
    );
  });

  it('charges the SystemConfig price of the plan chosen at renewal (yearly here)', async () => {
    await create({ ...baseBody, planType: 'YEARLY', renew: true });

    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 350, planType: 'YEARLY' })
    );
  });

  it('rejects a non-boolean renew flag as a validation error', async () => {
    const { status } = await create({ ...baseBody, renew: 'yes' });

    expect(status).toBe(400);
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  it('does not change a new buyer: a FREE user who sends renew keeps the discount check', async () => {
    mockUserFindUnique.mockResolvedValue({
      tier: 'FREE',
      hasUsedThreeDayPlan: false,
    });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockAffiliateCodeFindFirst.mockResolvedValue(null);

    const { status } = await create({
      ...baseBody,
      renew: true,
      discountCode: 'SAVE10',
    });

    expect(status).toBe(400);
    expect(mockAffiliateCodeFindFirst).toHaveBeenCalled();
  });
});
