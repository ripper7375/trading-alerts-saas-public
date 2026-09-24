/**
 * Invoice history + dLocal receipt API tests
 *
 * GET /api/invoices:
 * - returns the WHOLE history (the old route stopped at 12 per provider)
 * - reports each charge in the currency it was actually charged in, with
 *   a separate net-of-discount USD value for indicative conversion
 * - links dLocal rows to the generated receipt
 *
 * GET /api/invoices/[id]/receipt:
 * - 401 signed out; 404 for a payment that isn't the caller's own
 *   completed dLocal payment (the ownership check lives in the query)
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: Map<string, string>;
    body: unknown;
    constructor(
      body: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
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
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

const mockPaymentFindMany = jest.fn();
const mockPaymentFindFirst = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockInvoiceFindMany = jest.fn();
const mockUserFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    payment: {
      findMany: (...a: unknown[]) => mockPaymentFindMany(...a),
      findFirst: (...a: unknown[]) => mockPaymentFindFirst(...a),
    },
    subscription: {
      findUnique: (...a: unknown[]) => mockSubscriptionFindUnique(...a),
    },
    invoice: { findMany: (...a: unknown[]) => mockInvoiceFindMany(...a) },
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
  },
}));

const mockGetAllCustomerInvoices = jest.fn();
jest.mock('@/lib/stripe/stripe', () => ({
  __esModule: true,
  MAX_INVOICE_HISTORY: 1000,
  getAllCustomerInvoices: (...a: unknown[]) => mockGetAllCustomerInvoices(...a),
}));

const SESSION = { user: { id: 'user-1' } };

function request(query = ''): { nextUrl: URL } {
  return { nextUrl: new URL(`https://davintrade.app/api/invoices${query}`) };
}

const dLocalPayment = {
  id: 'pay_1',
  userId: 'user-1',
  provider: 'DLOCAL',
  status: 'COMPLETED',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  amount: '1930.34',
  amountUSD: '29',
  currency: 'INR',
  country: 'IN',
  paymentMethod: 'UPI',
  planType: 'MONTHLY',
  duration: 30,
  discountCode: 'DAVIN20',
  discountAmount: '5.8',
};

function stripeInvoice(i: number): Record<string, unknown> {
  return {
    id: `in_${i}`,
    created: Date.UTC(2025, 0, 1) / 1000 + i * 86400 * 30,
    amount_paid: 2900,
    currency: 'usd',
    status: 'paid',
    invoice_pdf: `https://pay.stripe.com/invoice/in_${i}/pdf`,
    hosted_invoice_url: null,
    lines: { data: [{ description: 'Trading Alerts PRO - Monthly' }] },
  };
}

describe('GET /api/invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockPaymentFindMany.mockResolvedValue([]);
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockInvoiceFindMany.mockResolvedValue([]);
    mockGetAllCustomerInvoices.mockResolvedValue([]);
  });

  it('returns 401 when signed out', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/invoices/route');
    const response = await GET(request() as never);
    expect(response.status).toBe(401);
  });

  it('reports a dLocal charge in local currency, with net USD and a receipt link', async () => {
    mockPaymentFindMany.mockResolvedValue([dLocalPayment]);
    const { GET } = await import('@/app/api/invoices/route');
    const data = (await (await GET(request() as never)).json()) as {
      invoices: Array<Record<string, unknown>>;
    };

    expect(data.invoices[0]).toMatchObject({
      id: 'pay_1',
      amount: 1930.34,
      currency: 'INR',
      // Net of the 20% discount -- NOT the $29 gross list price.
      amountUsd: 23.2,
      provider: 'DLOCAL',
      invoicePdfUrl: '/api/invoices/pay_1/receipt',
    });
  });

  it('returns the complete history across both providers, newest first', async () => {
    mockPaymentFindMany.mockResolvedValue([dLocalPayment]);
    mockSubscriptionFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    mockGetAllCustomerInvoices.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => stripeInvoice(i))
    );

    const { GET } = await import('@/app/api/invoices/route');
    const data = (await (await GET(request() as never)).json()) as {
      invoices: Array<{ id: string; date: string; amountUsd: number | null }>;
      total: number;
      hasMore: boolean;
    };

    expect(mockGetAllCustomerInvoices).toHaveBeenCalledWith('cus_1');
    expect(data.total).toBe(31);
    expect(data.invoices).toHaveLength(31);
    expect(data.hasMore).toBe(false);
    const dates = data.invoices.map((inv) => new Date(inv.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(data.invoices.find((inv) => inv.id === 'in_0')?.amountUsd).toBe(29);
  });

  it('still honours an explicit ?limit', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    mockGetAllCustomerInvoices.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => stripeInvoice(i))
    );
    const { GET } = await import('@/app/api/invoices/route');
    const data = (await (await GET(request('?limit=5') as never)).json()) as {
      invoices: unknown[];
      total: number;
      hasMore: boolean;
    };
    expect(data.invoices).toHaveLength(5);
    expect(data.total).toBe(30);
    expect(data.hasMore).toBe(true);
  });

  it('has no USD value for a Stripe invoice charged in another currency', async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
    mockGetAllCustomerInvoices.mockResolvedValue([
      { ...stripeInvoice(1), currency: 'eur', amount_paid: 3451 },
    ]);
    const { GET } = await import('@/app/api/invoices/route');
    const data = (await (await GET(request() as never)).json()) as {
      invoices: Array<Record<string, unknown>>;
    };
    expect(data.invoices[0]).toMatchObject({
      amount: 34.51,
      currency: 'EUR',
      amountUsd: null,
    });
  });
});

describe('GET /api/invoices/[id]/receipt', () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockUserFindUnique.mockResolvedValue({
      name: 'Priya Sharma',
      email: 'priya@example.com',
    });
  });

  it('returns 401 when signed out', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import('@/app/api/invoices/[id]/receipt/route');
    const response = await GET({} as never, params('pay_1'));
    expect(response.status).toBe(401);
    expect(mockPaymentFindFirst).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the caller's own completed dLocal payment", async () => {
    mockPaymentFindFirst.mockResolvedValue(null);
    const { GET } = await import('@/app/api/invoices/[id]/receipt/route');
    const response = await GET({} as never, params('someone-elses'));

    expect(response.status).toBe(404);
    expect(mockPaymentFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'someone-elses',
        userId: 'user-1',
        provider: 'DLOCAL',
        status: 'COMPLETED',
      },
    });
  });

  it('serves a private, downloadable PDF', async () => {
    mockPaymentFindFirst.mockResolvedValue(dLocalPayment);
    const { GET } = await import('@/app/api/invoices/[id]/receipt/route');
    const response = (await GET({} as never, params('pay_1'))) as unknown as {
      status: number;
      headers: Map<string, string>;
      body: Buffer;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="DavinTrade-Receipt-\d{4}-\d{4}\.pdf"$/
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(Buffer.from(response.body).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
