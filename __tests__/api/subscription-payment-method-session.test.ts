/**
 * POST /api/subscription/payment-method-session -- Manage Subscription S1,
 * workflow W1 (update the card through Stripe's portal, card form only).
 *
 * @module __tests__/api/subscription-payment-method-session.test
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

const mockCreateSession = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  createPaymentMethodUpdateSession: (...a: unknown[]) =>
    mockCreateSession(...a),
}));

import { POST } from '@/app/api/subscription/payment-method-session/route';
import { MoneyServiceError } from '@/lib/money-service/write-routes';

const PORTAL_URL = 'https://billing.stripe.com/p/session/bps_1';

function stripeRow(
  status: string,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    status,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    dLocalPaymentId: null,
    ...overrides,
  };
}

async function post(): Promise<{ status: number; body: Record<string, any> }> {
  const res = await POST({} as never);
  return { status: res.status, body: await res.json() };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  process.env['STRIPE_PORTAL_CONFIGURATION_ID'] = 'bpc_test_1';
  process.env['NEXTAUTH_URL'] = 'https://app.example.com';
  mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
  mockUseMoneyService.mockReturnValue(false);
  mockUserFindUnique.mockResolvedValue({ tier: 'PRO' });
  mockSubscriptionFindUnique.mockResolvedValue(stripeRow('ACTIVE'));
  mockCreateSession.mockResolvedValue({ url: PORTAL_URL });
});

afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /api/subscription/payment-method-session', () => {
  it('opens the card form only and returns the portal URL', async () => {
    const { status, body } = await post();

    expect(status).toBe(200);
    expect(body).toEqual({ url: PORTAL_URL });
    expect(mockCreateSession).toHaveBeenCalledWith(
      'cus_1',
      'bpc_test_1',
      'https://app.example.com/settings/billing',
      'https://app.example.com/settings/billing?done=card'
    );
  });

  it('reads the subscription with an explicit select', async () => {
    await post();

    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: {
        status: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        dLocalPaymentId: true,
      },
    });
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { tier: true },
    });
  });

  it.each([
    ['PRO', 'ACTIVE'],
    ['PRO', 'TRIALING'],
    ['PRO', 'PAST_DUE'],
    ['FREE', 'UNPAID'],
    ['FREE', 'PAST_DUE'],
  ])('allows a %s user whose subscription is %s', async (tier, status) => {
    mockUserFindUnique.mockResolvedValue({ tier });
    mockSubscriptionFindUnique.mockResolvedValue(stripeRow(status));

    const { status: httpStatus } = await post();

    expect(httpStatus).toBe(200);
  });

  it.each([
    ['FREE', 'CANCELED'],
    ['FREE', 'INACTIVE'],
  ])(
    'refuses a %s user whose subscription is %s with ACTION_NOT_ALLOWED',
    async (tier, status) => {
      mockUserFindUnique.mockResolvedValue({ tier });
      mockSubscriptionFindUnique.mockResolvedValue(stripeRow(status));

      const { status: httpStatus, body } = await post();

      expect(httpStatus).toBe(400);
      expect(body.code).toBe('ACTION_NOT_ALLOWED');
      expect(mockCreateSession).not.toHaveBeenCalled();
    }
  );

  it('refuses a dLocal subscription', async () => {
    mockSubscriptionFindUnique.mockResolvedValue(
      stripeRow('ACTIVE', { dLocalPaymentId: 'dl_1' })
    );

    const { status, body } = await post();

    expect(status).toBe(400);
    expect(body.code).toBe('ACTION_NOT_ALLOWED');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it.each([
    ['no subscription row', null],
    ['no Stripe customer', stripeRow('ACTIVE', { stripeCustomerId: null })],
  ])('answers 400 NO_STRIPE_SUBSCRIPTION with %s', async (_label, row) => {
    mockSubscriptionFindUnique.mockResolvedValue(row);

    const { status, body } = await post();

    expect(status).toBe(400);
    expect(body.code).toBe('NO_STRIPE_SUBSCRIPTION');
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it('answers 404 when the user record is missing', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const { status, body } = await post();

    expect(status).toBe(404);
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('answers 401 without a session, before anything else', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { status, body } = await post();

    expect(status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });

  it.each(['STRIPE_PORTAL_CONFIGURATION_ID', 'NEXTAUTH_URL'])(
    'answers 503 PORTAL_NOT_CONFIGURED, creating nothing, when %s is unset',
    async (name) => {
      delete process.env[name];

      const { status, body } = await post();

      expect(status).toBe(503);
      expect(body.code).toBe('PORTAL_NOT_CONFIGURED');
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    }
  );

  it('answers 500 with a generic message when Stripe fails', async () => {
    mockCreateSession.mockRejectedValue(
      new Error('No such configuration: bpc_test_1')
    );

    const { status, body } = await post();

    expect(status).toBe(500);
    expect(body.code).toBe('PORTAL_SESSION_ERROR');
    expect(JSON.stringify(body)).not.toContain('bpc_test_1');
  });

  describe('when money-service handles Stripe writes', () => {
    beforeEach(() => {
      mockUseMoneyService.mockReturnValue(true);
    });

    it('forwards to money-service and creates nothing itself', async () => {
      mockForward.mockResolvedValue({ url: PORTAL_URL });

      const { status, body } = await post();

      expect(status).toBe(200);
      expect(body).toEqual({ url: PORTAL_URL });
      expect(mockForward).toHaveBeenCalledWith(
        expect.anything(),
        '/v1/stripe/subscriptions/payment-method-session'
      );
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
    });

    it("passes money-service's refusal through with its status and body", async () => {
      mockForward.mockRejectedValue(
        // The mocked class takes (status, body); the real one is typed alike.
        new (MoneyServiceError as unknown as new (
          status: number,
          body: unknown
        ) => Error)(503, { code: 'PORTAL_NOT_CONFIGURED' })
      );

      const { status, body } = await post();

      expect(status).toBe(503);
      expect(body).toEqual({ code: 'PORTAL_NOT_CONFIGURED' });
    });
  });
});
