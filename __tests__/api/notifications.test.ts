/**
 * Notifications API Route Tests
 *
 * Tests for GET/POST /api/notifications
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

class MockURLSearchParams {
  private params: Map<string, string> = new Map();

  constructor(init?: Record<string, string> | string) {
    if (typeof init === 'string') {
      const pairs = init.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) this.params.set(key, value || '');
      }
    } else if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.params.set(key, value);
      });
    }
  }

  get(name: string): string | null {
    return this.params.get(name) || null;
  }

  [Symbol.iterator](): Iterator<[string, string]> {
    return this.params.entries();
  }
}

class MockURL {
  searchParams: MockURLSearchParams;
  pathname: string;

  constructor(url: string) {
    const [path, query] = url.split('?');
    this.pathname = path || '';
    this.searchParams = new MockURLSearchParams(query || '');
  }
}

class MockRequest {
  url: string;
  method: string;
  headers: MockHeaders;
  nextUrl: MockURL;

  constructor(
    url: string,
    init?: { method?: string; headers?: Record<string, string> }
  ) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
    this.nextUrl = new MockURL(url);
  }

  async json(): Promise<unknown> {
    return {};
  }
}

global.Headers = MockHeaders as unknown as typeof Headers;
global.Request = MockRequest as unknown as typeof Request;
global.URL = MockURL as unknown as typeof URL;

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
const mockNotificationCount = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationUpdateMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    notification: {
      count: (...args: unknown[]) => mockNotificationCount(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
      updateMany: (...args: unknown[]) => mockNotificationUpdateMany(...args),
    },
  },
}));

describe('Notifications API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest('http://localhost/api/notifications');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return paginated notifications', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });

      const notifications = [
        {
          id: 'notif-1',
          userId: 'user-1',
          type: 'ALERT',
          title: 'Alert Triggered',
          body: 'Your gold alert was triggered',
          priority: 'normal',
          read: false,
          readAt: null,
          link: '/alerts/alert-1',
          createdAt: new Date(),
        },
      ];

      mockNotificationCount.mockResolvedValueOnce(1); // total
      mockNotificationFindMany.mockResolvedValue(notifications);
      mockNotificationCount.mockResolvedValueOnce(1); // unread

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest('http://localhost/api/notifications');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.notifications).toEqual(notifications);
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(20);
      expect(data.totalPages).toBe(1);
      expect(data.unreadCount).toBe(1);
    });

    it('should filter by status=unread', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?status=unread'
      );
      await GET(request as unknown as Request);

      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            read: false,
          }),
        })
      );
    });

    it('should filter by status=read', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?status=read'
      );
      await GET(request as unknown as Request);

      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            read: true,
          }),
        })
      );
    });

    it('should filter by notification type', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?type=ALERT'
      );
      await GET(request as unknown as Request);

      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            type: 'ALERT',
          }),
        })
      );
    });

    it('should handle pagination parameters', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(100);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?page=3&pageSize=25'
      );
      await GET(request as unknown as Request);

      expect(mockNotificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50, // (3-1) * 25
          take: 25,
        })
      );
    });

    it('should handle database errors', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest('http://localhost/api/notifications');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch notifications');
    });

    it('should calculate total pages correctly', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValueOnce(45); // total
      mockNotificationFindMany.mockResolvedValue([]);
      mockNotificationCount.mockResolvedValueOnce(10); // unread

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?pageSize=20'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(data.totalPages).toBe(3); // Math.ceil(45/20)
    });
  });

  describe('POST /api/notifications - Mark All Read', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import('@/app/api/notifications/route');
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should mark all unread notifications as read', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationUpdateMany.mockResolvedValue({ count: 5 });

      const { POST } = await import('@/app/api/notifications/route');
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(5);
      expect(data.message).toBe('5 notification(s) marked as read');
    });

    it('should handle zero unread notifications', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationUpdateMany.mockResolvedValue({ count: 0 });

      const { POST } = await import('@/app/api/notifications/route');
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updatedCount).toBe(0);
    });

    it('should update with correct timestamp', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationUpdateMany.mockResolvedValue({ count: 3 });

      const { POST } = await import('@/app/api/notifications/route');
      await POST();

      expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          read: false,
        },
        data: {
          read: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationUpdateMany.mockRejectedValue(new Error('Database error'));

      const { POST } = await import('@/app/api/notifications/route');
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to mark all as read');
    });
  });

  describe('Notification Types', () => {
    it('should support ALERT type', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?type=ALERT'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(200);
    });

    it('should support SUBSCRIPTION type', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?type=SUBSCRIPTION'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(200);
    });

    it('should support PAYMENT type', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?type=PAYMENT'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(200);
    });

    it('should support SYSTEM type', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationCount.mockResolvedValue(0);
      mockNotificationFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/notifications/route');
      const request = new MockRequest(
        'http://localhost/api/notifications?type=SYSTEM'
      );
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(200);
    });
  });
});
