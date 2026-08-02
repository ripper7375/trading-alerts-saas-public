/**
 * Notification Mark-As-Read API Route Tests
 *
 * Tests for POST /api/notifications/[id]/read. Session 4B-9: no test file
 * existed for this route before this session (an L28-class gap — closed
 * here rather than left). Covers the `alreadyRead` short-circuit invariant
 * this order explicitly calls out as load-bearing.
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
const mockNotificationUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    notification: {
      findUnique: (...args: unknown[]) => mockNotificationFindUnique(...args),
      update: (...args: unknown[]) => mockNotificationUpdate(...args),
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

describe('POST /api/notifications/[id]/read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('n-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when the notification does not exist', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockNotificationFindUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Not found');
  });

  it('returns 403 when owned by another user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockNotificationFindUnique.mockResolvedValue({
      id: 'n-1',
      userId: 'user-2',
      read: false,
    });

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('n-1'));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it('already-read invariant: short-circuits WITHOUT calling update, no success key', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const existing = {
      id: 'n-1',
      userId: 'user-1',
      read: true,
      readAt: new Date('2026-01-01'),
    };
    mockNotificationFindUnique
      .mockResolvedValueOnce({ id: 'n-1', userId: 'user-1', read: true })
      .mockResolvedValueOnce(existing);

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('n-1'));
    const data = await response.json();

    expect(mockNotificationUpdate).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(data).toEqual({
      notification: existing,
      alreadyRead: true,
      message: 'Notification was already marked as read',
    });
    expect(data.success).toBeUndefined();
  });

  it('marks an unread notification as read and returns { notification, success, message }', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockNotificationFindUnique.mockResolvedValue({
      id: 'n-1',
      userId: 'user-1',
      read: false,
    });
    const updated = {
      id: 'n-1',
      userId: 'user-1',
      read: true,
      readAt: new Date('2026-01-02'),
    };
    mockNotificationUpdate.mockResolvedValue(updated);

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('n-1'));
    const data = await response.json();

    expect(mockNotificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n-1' },
        data: { read: true, readAt: expect.any(Date) },
      })
    );
    expect(response.status).toBe(200);
    expect(data).toEqual({
      notification: updated,
      success: true,
      message: 'Notification marked as read',
    });
  });

  it('handles database errors', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockNotificationFindUnique.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const response = await POST({} as never, makeContext('n-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to mark as read');
  });

  it('forwards to operation-service when MIGRATE_NOTIFICATIONS is on', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockResolvedValue({
      status: 200,
      body: {
        notification: { id: 'op-notif-1' },
        alreadyRead: true,
        message: 'Notification was already marked as read',
      },
    });

    const { POST } = await import('@/app/api/notifications/[id]/read/route');
    const request = {} as never;
    const response = await POST(request, makeContext('n-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alreadyRead).toBe(true);
    expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
      request,
      '/notifications/n-1/read'
    );
    expect(mockNotificationFindUnique).not.toHaveBeenCalled();
  });
});
