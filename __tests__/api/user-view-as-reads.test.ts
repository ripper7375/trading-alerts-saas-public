/**
 * The settings read routes under admin "view as user".
 *
 * With ?view_as=user and a valid view, each route must read the VIEWED
 * user's rows and must not forward to operation-service (which authenticates
 * as the caller, i.e. would return the admin's own data). With the opt-in
 * but no valid view it must answer 403 rather than the admin's own data.
 * Without the opt-in, nothing changes: the caller's own data, proxy and all.
 *
 * The real lib/admin/user-view-as.ts runs here; only its inputs (the
 * cookie jar and the database) are mocked.
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status ?? 200;
    }
    async json(): Promise<unknown> {
      return this.body;
    }
    static json(data: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(data, init);
    }
  }
  return { __esModule: true, NextResponse: MockNextResponse };
});

const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockGetServerSession(),
}));

const mockCookieGet = jest.fn();
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: async () => ({ get: (name: string) => mockCookieGet(name) }),
}));

// Every proxy is live, as in production; view mode must bypass it anyway.
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUserSessions: () => true,
  shouldUseOperationServiceForUser2FA: () => true,
  shouldUseOperationServiceForAlertsCrud: () => true,
}));
const mockForward = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  forwardRequestToOperationService: (...a: unknown[]) => mockForward(...a),
  OperationServiceError: class OperationServiceError extends Error {},
}));

jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  MAX_INVOICE_HISTORY: 1000,
  getAllCustomerInvoices: jest.fn(),
  getSubscription: jest.fn(),
  getCustomerPaymentMethods: jest.fn(),
}));
jest.mock('@/lib/billing/receipt-pdf', () => ({
  __esModule: true,
  renderReceiptPdf: async () => new Uint8Array([37, 80, 68, 70]),
}));

const CUSTOMER = {
  id: 'user_42',
  name: 'Carol Customer',
  email: 'carol@example.com',
  tier: 'FREE',
  role: 'USER',
  trialStatus: 'NOT_STARTED',
  trialConvertedAt: null,
  trialCancelledAt: null,
  hasUsedFreeTrial: false,
  twoFactorEnabled: true,
  twoFactorVerifiedAt: null,
};

const mockUserFindUnique = jest.fn();
const mockLoginFindMany = jest.fn();
const mockSecurityAlertFindMany = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockPaymentFindFirst = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockAlertFindMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    loginHistory: {
      findMany: (...a: unknown[]) => mockLoginFindMany(...a),
      count: async () => 0,
    },
    securityAlert: {
      findMany: (...a: unknown[]) => mockSecurityAlertFindMany(...a),
      count: async () => 0,
    },
    payment: {
      findMany: (...a: unknown[]) => mockPaymentFindMany(...a),
      findFirst: (...a: unknown[]) => mockPaymentFindFirst(...a),
    },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
    },
    invoice: { findMany: async () => [] },
    alert: { findMany: (...a: unknown[]) => mockAlertFindMany(...a) },
  },
}));

import {
  USER_VIEW_AS_COOKIE_NAME,
  USER_VIEW_AS_MAX_AGE_SECONDS,
  encodeUserViewAsCookie,
} from '@/lib/admin/user-view-as';
import { GET as getLoginHistory } from '@/app/api/user/login-history/route';
import { GET as getSecurityAlerts } from '@/app/api/user/security-alerts/route';
import { GET as get2FAStatus } from '@/app/api/user/2fa/setup/route';
import { GET as getSubscription } from '@/app/api/subscription/route';
import { GET as getInvoices } from '@/app/api/invoices/route';
import { GET as getReceipt } from '@/app/api/invoices/[id]/receipt/route';
import { GET as getAlerts } from '@/app/api/alerts/route';

const ADMIN_SESSION = { user: { id: 'admin_1', role: 'ADMIN', tier: 'PRO' } };

/** The clock every test runs on, so cookie ages are exact. */
const NOW_SEC = 1_793_000_000;

function viewCookie(
  adminId = 'admin_1',
  userId = 'user_42',
  issuedAtSec = NOW_SEC
): string {
  return encodeUserViewAsCookie(adminId, userId, issuedAtSec);
}

// A minimal request stand-in, typed loosely so it fits every route signature.
function req(path: string, query = ''): never {
  const url = `https://davintrade.app${path}${query}`;
  return { url, nextUrl: new URL(url) } as never;
}

function whereOf(mock: jest.Mock): unknown {
  return (mock.mock.calls[0]?.[0] as { where?: unknown } | undefined)?.where;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_SEC * 1000);
  mockGetServerSession.mockResolvedValue(ADMIN_SESSION);
  mockCookieGet.mockImplementation((name: string) =>
    name === USER_VIEW_AS_COOKIE_NAME ? { value: viewCookie() } : undefined
  );
  mockUserFindUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) =>
      where.id === 'user_42' ? CUSTOMER : null
  );
  mockForward.mockResolvedValue({ status: 200, body: { from: 'proxy' } });
  mockLoginFindMany.mockResolvedValue([]);
  mockSecurityAlertFindMany.mockResolvedValue([]);
  mockPaymentFindMany.mockResolvedValue([]);
  mockSubscriptionFindUnique.mockResolvedValue(null);
  mockAlertFindMany.mockResolvedValue([]);
});

describe('with ?view_as=user and a valid view', () => {
  const Q = '?view_as=user';

  it('login history reads the viewed user and skips the proxy', async () => {
    const res = await getLoginHistory(req('/api/user/login-history', Q));
    expect(res.status).toBe(200);
    expect(mockForward).not.toHaveBeenCalled();
    expect(whereOf(mockLoginFindMany)).toEqual({ userId: 'user_42' });
  });

  it('security activity reads the viewed user and skips the proxy', async () => {
    const res = await getSecurityAlerts(req('/api/user/security-alerts', Q));
    expect(res.status).toBe(200);
    expect(mockForward).not.toHaveBeenCalled();
    expect(whereOf(mockSecurityAlertFindMany)).toEqual({ userId: 'user_42' });
  });

  it("2FA status is the viewed user's", async () => {
    const res = await get2FAStatus(req('/api/user/2fa/setup', Q));
    expect(mockForward).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ enabled: true });
  });

  it("subscription reports the viewed user's tier, not the admin's", async () => {
    const res = await getSubscription(req('/api/subscription', Q));
    await expect(res.json()).resolves.toMatchObject({ tier: 'FREE' });
  });

  it('invoice receipt links carry the opt-in, so they open the viewed user', async () => {
    mockPaymentFindMany.mockResolvedValue([
      {
        id: 'pay_1',
        userId: 'user_42',
        provider: 'DLOCAL',
        status: 'COMPLETED',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        amount: '1930.34',
        amountUSD: '29',
        discountAmount: null,
        currency: 'INR',
        country: 'IN',
        planType: 'MONTHLY',
      },
    ]);
    const res = await getInvoices(req('/api/invoices', Q));
    expect(whereOf(mockPaymentFindMany)).toMatchObject({ userId: 'user_42' });
    const body = (await res.json()) as {
      invoices: { invoicePdfUrl: string }[];
    };
    expect(body.invoices[0]?.invoicePdfUrl).toBe(
      '/api/invoices/pay_1/receipt?view_as=user'
    );
  });

  it("a receipt is only found among the viewed user's payments", async () => {
    mockPaymentFindFirst.mockResolvedValue(null);
    const res = await getReceipt(req('/api/invoices/pay_1/receipt', Q), {
      params: Promise.resolve({ id: 'pay_1' }),
    });
    expect(res.status).toBe(404);
    expect(whereOf(mockPaymentFindFirst)).toMatchObject({
      id: 'pay_1',
      userId: 'user_42',
    });
  });

  it("the alert count is the viewed user's, not proxied", async () => {
    await getAlerts(req('/api/alerts', Q));
    expect(mockForward).not.toHaveBeenCalled();
    expect(whereOf(mockAlertFindMany)).toEqual({ userId: 'user_42' });
  });
});

describe('with ?view_as=user but no valid view', () => {
  it('403s instead of serving the admin their own data', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const results = await Promise.all([
      getLoginHistory(req('/api/user/login-history', '?view_as=user')),
      getSubscription(req('/api/subscription', '?view_as=user')),
      getInvoices(req('/api/invoices', '?view_as=user')),
      getAlerts(req('/api/alerts', '?view_as=user')),
    ]);
    expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(mockLoginFindMany).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('403s for a non-admin who adds the opt-in', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user_7', role: 'USER' },
    });
    // a correctly signed cookie, so only the role check can refuse it
    mockCookieGet.mockImplementation(() => ({
      value: viewCookie('user_7', 'user_42'),
    }));
    const res = await getSecurityAlerts(
      req('/api/user/security-alerts', '?view_as=user')
    );
    expect(res.status).toBe(403);
    expect(mockSecurityAlertFindMany).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsigned cookie', (): string => 'admin_1:user_42'],
    [
      'a cookie older than a view may last',
      (): string =>
        viewCookie(
          'admin_1',
          'user_42',
          NOW_SEC - USER_VIEW_AS_MAX_AGE_SECONDS - 1
        ),
    ],
    [
      'a signed cookie whose target was changed',
      (): string => viewCookie().replace('user_42', 'user_43'),
    ],
  ])('403s for %s', async (_label, makeValue) => {
    // every id exists, so only the cookie check can refuse the view
    mockUserFindUnique.mockResolvedValue(CUSTOMER);
    mockCookieGet.mockImplementation((name: string) =>
      name === USER_VIEW_AS_COOKIE_NAME ? { value: makeValue() } : undefined
    );
    const results = await Promise.all([
      getLoginHistory(req('/api/user/login-history', '?view_as=user')),
      getSubscription(req('/api/subscription', '?view_as=user')),
      getInvoices(req('/api/invoices', '?view_as=user')),
      getAlerts(req('/api/alerts', '?view_as=user')),
    ]);
    expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403]);
    expect(mockLoginFindMany).not.toHaveBeenCalled();
    expect(mockPaymentFindMany).not.toHaveBeenCalled();
    expect(mockAlertFindMany).not.toHaveBeenCalled();
    expect(mockForward).not.toHaveBeenCalled();
  });

  it('serves the same request once the cookie is valid again', async () => {
    // control for the table above: nothing else about the request differs
    mockUserFindUnique.mockResolvedValue(CUSTOMER);
    const res = await getLoginHistory(
      req('/api/user/login-history', '?view_as=user')
    );
    expect(res.status).toBe(200);
    expect(whereOf(mockLoginFindMany)).toEqual({ userId: 'user_42' });
  });
});

describe('without the opt-in (every other request)', () => {
  it('ignores the cookie and keeps the proxy for the caller', async () => {
    const res = await getLoginHistory(req('/api/user/login-history'));
    await expect(res.json()).resolves.toEqual({ from: 'proxy' });
    expect(mockForward).toHaveBeenCalledTimes(1);
    expect(mockCookieGet).not.toHaveBeenCalled();
  });

  it("reads the caller's own invoices", async () => {
    await getInvoices(req('/api/invoices'));
    expect(whereOf(mockPaymentFindMany)).toMatchObject({ userId: 'admin_1' });
    expect(mockCookieGet).not.toHaveBeenCalled();
  });
});
