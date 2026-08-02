/**
 * Notification Item API Route Tests
 *
 * Tests for GET/DELETE /api/notifications/[id]. Session 4B-9: no test file
 * existed for this route before this session (an L28-class gap — closed
 * here rather than left, since the PORT+CUTOVER order relies on this
 * behavior staying byte-identical when the flag is off).
 */

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
const mockNotificationFindUnique = jest.fn();
const mockNotificationDelete = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    notification: {
      findUnique: (...args: unknown[]) => mockNotificationFindUnique(...args),
      delete: (...args: unknown[]) => mockNotificationDelete(...args),
    },
  },
}));

// Mock the Session 4B-9 operation-service transport (flag + forwarder)
const mockShouldUseOpService = jest.fn().mockReturnValue(false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForNotifications: () => mockShouldUseOpService(),
}));

class MockOperationServiceError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body.message ?? 'error'));
    this.status = status;
    this.body = body;
  }
}
const mockForwardRequestToOperationService = jest.fn();
jest.mock('@/lib/operation-service/write-routes', () => ({
  __esModule: true,
  OperationServiceError: MockOperationServiceError,
  forwardRequestToOperationService: (...args: unknown[]) =>
    mockForwardRequestToOperationService(...args),
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Notification Item API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
  });

  describe('GET /api/notifications/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const response = await GET({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when the notification does not exist', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const response = await GET({} as never, makeContext('missing'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('returns 403 when owned by another user', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-2',
      });

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const response = await GET({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('returns the raw notification object (no wrapper) when found and owned', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      const notification = { id: 'n-1', userId: 'user-1', title: 'Hi' };
      mockNotificationFindUnique.mockResolvedValue(notification);

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const response = await GET({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(notification);
    });

    it('handles database errors', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockRejectedValue(new Error('DB error'));

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const response = await GET({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch notification');
    });

    it('forwards to operation-service when MIGRATE_NOTIFICATIONS is on', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 200,
        body: { id: 'op-notif-1' },
      });

      const { GET } = await import('@/app/api/notifications/[id]/route');
      const request = {} as never;
      const response = await GET(request, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ id: 'op-notif-1' });
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/notifications/n-1'
      );
      expect(mockNotificationFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/notifications/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/notifications/[id]/route');
      const response = await DELETE({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 404 when the notification does not exist', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/notifications/[id]/route');
      const response = await DELETE({} as never, makeContext('missing'));

      expect(response.status).toBe(404);
      expect(mockNotificationDelete).not.toHaveBeenCalled();
    });

    it('returns 403 when owned by another user', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-2',
      });

      const { DELETE } = await import('@/app/api/notifications/[id]/route');
      const response = await DELETE({} as never, makeContext('n-1'));

      expect(response.status).toBe(403);
      expect(mockNotificationDelete).not.toHaveBeenCalled();
    });

    it('hard-deletes and returns { success, message }', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockNotificationFindUnique.mockResolvedValue({
        id: 'n-1',
        userId: 'user-1',
      });
      mockNotificationDelete.mockResolvedValue({});

      const { DELETE } = await import('@/app/api/notifications/[id]/route');
      const response = await DELETE({} as never, makeContext('n-1'));
      const data = await response.json();

      expect(mockNotificationDelete).toHaveBeenCalledWith({
        where: { id: 'n-1' },
      });
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        message: 'Notification deleted successfully',
      });
    });

    it('forwards to operation-service when MIGRATE_NOTIFICATIONS is on', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 200,
        body: { success: true, message: 'Notification deleted successfully' },
      });

      const { DELETE } = await import('@/app/api/notifications/[id]/route');
      const request = {} as never;
      const response = await DELETE(request, makeContext('n-1'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/notifications/n-1'
      );
      expect(mockNotificationFindUnique).not.toHaveBeenCalled();
    });
  });
});
