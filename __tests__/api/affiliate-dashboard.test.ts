/**
 * Affiliate Dashboard API Route Tests
 *
 * Tests for GET /api/affiliate/dashboard/* endpoints
 *
 * @module __tests__/api/affiliate-dashboard.test
 */

// Mock Next.js server globals
class MockHeaders {
  private headers: Map<string, string> = new Map();
  constructor(init?: Record<string, string>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value);
      });
    }
  }
  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }
  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  private bodyContent: string | null = null;

  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string }
  ) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
    this.bodyContent = init?.body || null;
  }

  async json(): Promise<unknown> {
    if (!this.bodyContent) throw new Error('No body');
    return JSON.parse(this.bodyContent);
  }
}

global.Headers = MockHeaders as unknown as typeof Headers;
global.Request = MockRequest as unknown as typeof Request;

// Mock NextResponse
jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

// Mock session helpers
const mockRequireAffiliate = jest.fn();
const mockGetAffiliateProfile = jest.fn();

jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
  getAffiliateProfile: () => mockGetAffiliateProfile(),
}));

// Mock report builder functions
const mockBuildDashboardStats = jest.fn();
const mockBuildCodeInventoryReport = jest.fn();
const mockBuildCommissionReport = jest.fn();

jest.mock('@/lib/affiliate/report-builder', () => ({
  __esModule: true,
  buildDashboardStats: (profileId: string) => mockBuildDashboardStats(profileId),
  buildCodeInventoryReport: (profileId: string, opts: unknown) =>
    mockBuildCodeInventoryReport(profileId, opts),
  buildCommissionReport: (profileId: string, opts: unknown) =>
    mockBuildCommissionReport(profileId, opts),
}));

// Mock Prisma
const mockAffiliateCodeFindMany = jest.fn();
const mockAffiliateCodeCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateCode: {
      findMany: (...args: unknown[]) => mockAffiliateCodeFindMany(...args),
      count: (...args: unknown[]) => mockAffiliateCodeCount(...args),
    },
  },
}));

describe('Affiliate Dashboard API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockAffiliateProfile = {
    id: 'aff-profile-123',
    userId: 'user-1',
    fullName: 'John Doe',
    country: 'US',
    status: 'ACTIVE',
    totalCodesDistributed: 30,
    totalCodesUsed: 5,
    totalEarnings: 23.2,
    pendingCommissions: 9.28,
    paidCommissions: 13.92,
  };

  describe('GET /api/affiliate/dashboard/stats', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAffiliate.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('@/app/api/affiliate/dashboard/stats/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/stats');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not an affiliate', async () => {
      mockRequireAffiliate.mockRejectedValue(new Error('AFFILIATE_REQUIRED'));

      const { GET } = await import('@/app/api/affiliate/dashboard/stats/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/stats');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('AFFILIATE_REQUIRED');
    });

    it('should return 404 when profile not found', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(null);

      const { GET } = await import('@/app/api/affiliate/dashboard/stats/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/stats');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('PROFILE_NOT_FOUND');
    });

    it('should return dashboard stats successfully', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);

      const expectedStats = {
        activeCodes: 25,
        usedCodes: 5,
        expiredCodes: 0,
        totalEarnings: 23.2,
        pendingBalance: 9.28,
        paidBalance: 13.92,
        conversionRate: 16.67,
      };
      mockBuildDashboardStats.mockResolvedValue(expectedStats);

      const { GET } = await import('@/app/api/affiliate/dashboard/stats/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/stats');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(expectedStats);
      expect(mockBuildDashboardStats).toHaveBeenCalledWith(mockAffiliateProfile.id);
    });

    it('should handle errors gracefully', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);
      mockBuildDashboardStats.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/affiliate/dashboard/stats/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/stats');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.code).toBe('STATS_ERROR');
    });
  });

  describe('GET /api/affiliate/dashboard/codes', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAffiliate.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('@/app/api/affiliate/dashboard/codes/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/codes');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return paginated codes list', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);

      const mockCodes = [
        {
          id: 'code-1',
          code: 'ABCD1234',
          status: 'ACTIVE',
          distributedAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-31'),
          usedAt: null,
        },
        {
          id: 'code-2',
          code: 'EFGH5678',
          status: 'USED',
          distributedAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-31'),
          usedAt: new Date('2024-01-15'),
        },
      ];
      mockAffiliateCodeFindMany.mockResolvedValue(mockCodes);
      mockAffiliateCodeCount.mockResolvedValue(2);

      const { GET } = await import('@/app/api/affiliate/dashboard/codes/route');
      const request = new MockRequest('http://localhost/api/affiliate/dashboard/codes');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.codes).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
    });

    it('should filter codes by status', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);
      mockAffiliateCodeFindMany.mockResolvedValue([]);
      mockAffiliateCodeCount.mockResolvedValue(0);

      const { GET } = await import('@/app/api/affiliate/dashboard/codes/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/codes?status=ACTIVE'
      );
      await GET(request as unknown as Request);

      expect(mockAffiliateCodeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            affiliateProfileId: mockAffiliateProfile.id,
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should support pagination parameters', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);
      mockAffiliateCodeFindMany.mockResolvedValue([]);
      mockAffiliateCodeCount.mockResolvedValue(50);

      const { GET } = await import('@/app/api/affiliate/dashboard/codes/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/codes?page=2&limit=10'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(data.page).toBe(2);
      expect(data.limit).toBe(10);
      expect(mockAffiliateCodeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('GET /api/affiliate/dashboard/code-inventory', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAffiliate.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('@/app/api/affiliate/dashboard/code-inventory/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/code-inventory'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return code inventory report', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);

      const expectedReport = {
        period: {
          start: '2024-01-01T00:00:00.000Z',
          end: '2024-01-31T23:59:59.999Z',
        },
        openingBalance: 15,
        additions: {
          monthlyDistribution: 15,
          bonusDistribution: 0,
          total: 15,
        },
        reductions: {
          used: 5,
          expired: 2,
          cancelled: 0,
          total: 7,
        },
        closingBalance: 23,
      };
      mockBuildCodeInventoryReport.mockResolvedValue(expectedReport);

      const { GET } = await import('@/app/api/affiliate/dashboard/code-inventory/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/code-inventory'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(expectedReport);
    });
  });

  describe('GET /api/affiliate/dashboard/commission-report', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAffiliate.mockRejectedValue(new Error('Unauthorized'));

      const { GET } = await import('@/app/api/affiliate/dashboard/commission-report/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/commission-report'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return commission report', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);

      const expectedReport = {
        commissions: [
          {
            id: 'comm-1',
            amount: 4.64,
            status: 'PENDING',
            earnedAt: '2024-01-15T10:00:00.000Z',
            affiliateCode: { code: 'TEST1234' },
          },
          {
            id: 'comm-2',
            amount: 4.64,
            status: 'PAID',
            earnedAt: '2024-01-10T10:00:00.000Z',
            paidAt: '2024-02-01T10:00:00.000Z',
            affiliateCode: { code: 'TEST5678' },
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
      };
      mockBuildCommissionReport.mockResolvedValue(expectedReport);

      const { GET } = await import('@/app/api/affiliate/dashboard/commission-report/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/commission-report'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.commissions).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockRequireAffiliate.mockResolvedValue({
        user: { id: 'user-1', isAffiliate: true },
      });
      mockGetAffiliateProfile.mockResolvedValue(mockAffiliateProfile);
      mockBuildCommissionReport.mockResolvedValue({
        commissions: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const { GET } = await import('@/app/api/affiliate/dashboard/commission-report/route');
      const request = new MockRequest(
        'http://localhost/api/affiliate/dashboard/commission-report?status=PAID'
      );
      await GET(request as unknown as Request);

      expect(mockBuildCommissionReport).toHaveBeenCalledWith(
        mockAffiliateProfile.id,
        expect.objectContaining({
          status: 'PAID',
        })
      );
    });
  });
});
