/**
 * Wise Recipients API Route Tests (Session 4A-W3b, File 4/5)
 *
 * Tests for the server-side proxy routes under app/api/wise/recipients/*.
 *
 * @module __tests__/api/wise-recipients.test
 */

class MockRequest {
  url: string;
  method: string;
  private bodyContent: string | null;

  constructor(url: string, init?: { method?: string; body?: string }) {
    this.url = url;
    this.method = init?.method ?? 'GET';
    this.bodyContent = init?.body ?? null;
  }

  async json(): Promise<unknown> {
    if (!this.bodyContent) throw new Error('No body');
    return JSON.parse(this.bodyContent);
  }
}

global.Request = MockRequest as unknown as typeof Request;

// Mock NextResponse — must be a real function (not an arrow fn) so
// `new NextResponse(...)` works for the me/route.ts 204 case.
function MockNextResponse(
  this: { json: () => Promise<unknown>; status: number },
  body: unknown,
  init?: { status?: number }
) {
  this.json = async () => body;
  this.status = init?.status ?? 200;
}
MockNextResponse.json = (data: unknown, init?: { status?: number }) => ({
  json: async () => data,
  status: init?.status ?? 200,
});

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: MockNextResponse,
}));

// Mock auth
const mockRequireAffiliate = jest.fn();
const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
  requireAdmin: () => mockRequireAdmin(),
}));

class MockAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
jest.mock('@/lib/auth/errors', () => ({
  __esModule: true,
  AuthError: MockAuthError,
}));

// Mock money-service client (MoneyServiceError) + routes wrappers
class MockMoneyServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
jest.mock('@/lib/money-service/client', () => ({
  __esModule: true,
  MoneyServiceError: MockMoneyServiceError,
}));

const mockGetMoneyServiceToken = jest.fn();
const mockFetchWiseRecipientRequirements = jest.fn();
const mockRefreshWiseRecipientRequirements = jest.fn();
const mockFetchWiseRecipientMe = jest.fn();
const mockCreateWiseRecipient = jest.fn();
const mockFetchWiseRecipientsAdmin = jest.fn();
const mockRevalidateWiseRecipient = jest.fn();

jest.mock('@/lib/money-service/routes', () => ({
  __esModule: true,
  getMoneyServiceToken: () => mockGetMoneyServiceToken(),
  fetchWiseRecipientRequirements: (...args: unknown[]) =>
    mockFetchWiseRecipientRequirements(...args),
  refreshWiseRecipientRequirements: (...args: unknown[]) =>
    mockRefreshWiseRecipientRequirements(...args),
  fetchWiseRecipientMe: (...args: unknown[]) =>
    mockFetchWiseRecipientMe(...args),
  createWiseRecipient: (...args: unknown[]) => mockCreateWiseRecipient(...args),
  fetchWiseRecipientsAdmin: (...args: unknown[]) =>
    mockFetchWiseRecipientsAdmin(...args),
  revalidateWiseRecipient: (...args: unknown[]) =>
    mockRevalidateWiseRecipient(...args),
}));

describe('Wise Recipients API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetMoneyServiceToken.mockResolvedValue('test-token');
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/wise/recipients/requirements
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/wise/recipients/requirements', () => {
    it('returns 401 when not an affiliate', async () => {
      mockRequireAffiliate.mockRejectedValue(
        new MockAuthError('Affiliate access required', 403)
      );

      const { GET } =
        await import('@/app/api/wise/recipients/requirements/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements?targetCurrency=GBP'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(403);
    });

    it('returns 400 when targetCurrency is missing', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });

      const { GET } =
        await import('@/app/api/wise/recipients/requirements/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(400);
    });

    it('proxies to money-service and returns the groups', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      const payload = { quoteId: null, groups: [{ type: 'aba', title: 'x' }] };
      mockFetchWiseRecipientRequirements.mockResolvedValue(payload);

      const { GET } =
        await import('@/app/api/wise/recipients/requirements/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements?targetCurrency=GBP&recipientCountry=GB'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(payload);
      expect(mockFetchWiseRecipientRequirements).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({
          targetCurrency: 'GBP',
          recipientCountry: 'GB',
        })
      );
    });

    it('maps a MoneyServiceError to its own status', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      mockFetchWiseRecipientRequirements.mockRejectedValue(
        new MockMoneyServiceError(500, { error: 'Wise provider error' })
      );

      const { GET } =
        await import('@/app/api/wise/recipients/requirements/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements?targetCurrency=GBP'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(500);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/wise/recipients/requirements/refresh
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/wise/recipients/requirements/refresh', () => {
    it('returns 401 when not an affiliate', async () => {
      mockRequireAffiliate.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { POST } =
        await import('@/app/api/wise/recipients/requirements/refresh/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements/refresh',
        { method: 'POST', body: JSON.stringify({}) }
      );
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(401);
    });

    it('returns 400 when quoteId/partial are missing', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });

      const { POST } =
        await import('@/app/api/wise/recipients/requirements/refresh/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements/refresh',
        { method: 'POST', body: JSON.stringify({ quoteId: 'q1' }) }
      );
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(400);
    });

    it('proxies a refresh with a mocked quoteId', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      mockRefreshWiseRecipientRequirements.mockResolvedValue({ groups: [] });

      const { POST } =
        await import('@/app/api/wise/recipients/requirements/refresh/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/requirements/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ quoteId: 'q1', partial: { a: '1' } }),
        }
      );
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(200);
      expect(mockRefreshWiseRecipientRequirements).toHaveBeenCalledWith(
        'test-token',
        { quoteId: 'q1', partial: { a: '1' } }
      );
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/wise/recipients/me
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/wise/recipients/me', () => {
    it('returns 401 when not an affiliate', async () => {
      mockRequireAffiliate.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { GET } = await import('@/app/api/wise/recipients/me/route');
      const response = await GET();

      expect(response.status).toBe(401);
    });

    it('returns 204 when the affiliate has no recipient yet', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      mockFetchWiseRecipientMe.mockResolvedValue({});

      const { GET } = await import('@/app/api/wise/recipients/me/route');
      const response = await GET();

      expect(response.status).toBe(204);
    });

    it('returns 200 with the summary when a recipient exists', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      const summary = { id: 'r1', accountHolderName: 'Jane Doe' };
      mockFetchWiseRecipientMe.mockResolvedValue(summary);

      const { GET } = await import('@/app/api/wise/recipients/me/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(summary);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/wise/recipients & GET /api/wise/recipients (admin)
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/wise/recipients', () => {
    it('returns 401 when not an affiliate', async () => {
      mockRequireAffiliate.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { POST } = await import('@/app/api/wise/recipients/route');
      const request = new MockRequest('http://localhost/api/wise/recipients', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(401);
    });

    it('returns 201 with the created recipient on success', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      const created = { id: 'r1', status: 'ACTIVE' };
      mockCreateWiseRecipient.mockResolvedValue(created);

      const { POST } = await import('@/app/api/wise/recipients/route');
      const request = new MockRequest('http://localhost/api/wise/recipients', {
        method: 'POST',
        body: JSON.stringify({ targetCurrency: 'GBP' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual(created);
    });

    it('maps the confirmed live 403 (read-only token scope) through', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      mockCreateWiseRecipient.mockRejectedValue(
        new MockMoneyServiceError(500, {
          error: 'Wise provider error',
          providerStatus: 403,
        })
      );

      const { POST } = await import('@/app/api/wise/recipients/route');
      const request = new MockRequest('http://localhost/api/wise/recipients', {
        method: 'POST',
        body: JSON.stringify({ targetCurrency: 'GBP' }),
      });
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/wise/recipients (admin list)', () => {
    it('returns 403 when not an admin', async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError('Admin access required', 403)
      );

      const { GET } = await import('@/app/api/wise/recipients/route');
      const request = new MockRequest('http://localhost/api/wise/recipients');
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(403);
    });

    it('returns the paginated list', async () => {
      mockRequireAdmin.mockResolvedValue({ user: { id: 'admin1' } });
      const list = { items: [], total: 0, page: 1, pageSize: 25 };
      mockFetchWiseRecipientsAdmin.mockResolvedValue(list);

      const { GET } = await import('@/app/api/wise/recipients/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients?status=ACTIVE&page=2'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(list);
      expect(mockFetchWiseRecipientsAdmin).toHaveBeenCalledWith(
        'test-token',
        expect.objectContaining({ status: 'ACTIVE', page: 2 })
      );
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/wise/recipients/[id]/revalidate
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/wise/recipients/[id]/revalidate', () => {
    it('returns 401 when not an affiliate (self-service guard, not admin)', async () => {
      mockRequireAffiliate.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { POST } =
        await import('@/app/api/wise/recipients/[id]/revalidate/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/r1/revalidate',
        { method: 'POST' }
      );
      const response = await POST(request as unknown as Request, {
        params: Promise.resolve({ id: 'r1' }),
      });

      expect(response.status).toBe(401);
    });

    it('returns the revalidated summary on success', async () => {
      mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
      const updated = { id: 'r1', status: 'ACTIVE' };
      mockRevalidateWiseRecipient.mockResolvedValue(updated);

      const { POST } =
        await import('@/app/api/wise/recipients/[id]/revalidate/route');
      const request = new MockRequest(
        'http://localhost/api/wise/recipients/r1/revalidate',
        { method: 'POST' }
      );
      const response = await POST(request as unknown as Request, {
        params: Promise.resolve({ id: 'r1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(updated);
      expect(mockRevalidateWiseRecipient).toHaveBeenCalledWith(
        'test-token',
        'r1'
      );
    });
  });
});
