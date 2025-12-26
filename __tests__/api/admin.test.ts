/**
 * Admin API Route Tests (Tier 3 - Minimal Coverage)
 *
 * Tests for admin-only endpoints
 */

// Mock Next.js server globals
class MockHeaders {
  private headers: Map<string, string> = new Map();
  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }
}

class MockURLSearchParams {
  private params: Map<string, string> = new Map();
  [Symbol.iterator](): Iterator<[string, string]> {
    return this.params.entries();
  }
}

class MockURL {
  searchParams: MockURLSearchParams;
  constructor() {
    this.searchParams = new MockURLSearchParams();
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  nextUrl: MockURL;

  constructor(url: string) {
    this.url = url;
    this.method = 'GET';
    this.headers = new MockHeaders();
    this.nextUrl = new MockURL();
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

// Mock next-auth
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: () => mockGetServerSession(),
}));

jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock Prisma
const mockUserCount = jest.fn();
const mockUserFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}));

describe('Admin API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/admin/users/route');
      const request = new MockRequest('http://localhost/api/admin/users');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when not admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', role: 'USER' },
      });

      const { GET } = await import('@/app/api/admin/users/route');
      const request = new MockRequest('http://localhost/api/admin/users');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should return users when admin', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
      });

      mockUserCount.mockResolvedValue(2);
      mockUserFindMany.mockResolvedValue([
        {
          id: 'user-1',
          name: 'User One',
          email: 'user1@example.com',
          tier: 'FREE',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          sessions: [],
          _count: { alerts: 3, watchlists: 1 },
        },
        {
          id: 'user-2',
          name: 'User Two',
          email: 'user2@example.com',
          tier: 'PRO',
          role: 'USER',
          isActive: true,
          createdAt: new Date(),
          sessions: [],
          _count: { alerts: 10, watchlists: 5 },
        },
      ]);

      const { GET } = await import('@/app/api/admin/users/route');
      const request = new MockRequest('http://localhost/api/admin/users');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should handle database errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN' },
      });
      mockUserCount.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/admin/users/route');
      const request = new MockRequest('http://localhost/api/admin/users');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch users');
    });
  });
});
