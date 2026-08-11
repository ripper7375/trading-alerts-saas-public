/**
 * Security Alert Mark-As-Read API Route Tests
 *
 * Tests for POST /api/user/security-alerts/[id]/read. Ownership-scoped
 * updateMany (matches operation-service's UsersService.markSecurityAlertRead
 * convention) -- a non-existent id and someone else's alert both 404, no
 * id-enumeration surface.
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
const mockSecurityAlertUpdateMany = jest.fn();
const mockSecurityAlertFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    securityAlert: {
      updateMany: (...args: unknown[]) => mockSecurityAlertUpdateMany(...args),
      findFirst: (...args: unknown[]) => mockSecurityAlertFindFirst(...args),
    },
  },
}));

// Mock the operation-service transport (flag + forwarder)
const mockShouldUseOpService = jest.fn().mockReturnValue(false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForUserSessions: () => mockShouldUseOpService(),
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

describe('POST /api/user/security-alerts/[id]/read', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const response = await POST({} as never, makeContext('alert-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 for a non-existent or not-owned alert (no enumeration signal)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertUpdateMany.mockResolvedValue({ count: 0 });
    mockSecurityAlertFindFirst.mockResolvedValue(null);

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const response = await POST({} as never, makeContext('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Security alert not found');
  });

  it('already-read invariant: reports alreadyRead without a second write', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertUpdateMany.mockResolvedValue({ count: 0 });
    mockSecurityAlertFindFirst.mockResolvedValue({ id: 'alert-1' });

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const response = await POST({} as never, makeContext('alert-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      alreadyRead: true,
      message: 'Security alert was already marked as read',
    });
  });

  it('marks an unread alert read, scoped to the caller', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertUpdateMany.mockResolvedValue({ count: 1 });

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const response = await POST({} as never, makeContext('alert-1'));
    const data = await response.json();

    expect(mockSecurityAlertUpdateMany).toHaveBeenCalledWith({
      where: { id: 'alert-1', userId: 'user-1', read: false },
      data: { read: true, readAt: expect.any(Date) },
    });
    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      alreadyRead: false,
      message: 'Security alert marked as read',
    });
  });

  it('handles database errors', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertUpdateMany.mockRejectedValue(new Error('DB error'));

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const response = await POST({} as never, makeContext('alert-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to mark security alert as read');
  });

  it('forwards to operation-service when MIGRATE_USER_SESSIONS is on', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockResolvedValue({
      status: 200,
      body: { success: true, alreadyRead: true, message: 'already read' },
    });

    const { POST } = await import(
      '@/app/api/user/security-alerts/[id]/read/route'
    );
    const request = {} as never;
    const response = await POST(request, makeContext('alert-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alreadyRead).toBe(true);
    expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
      request,
      '/user/security-alerts/alert-1/read'
    );
    expect(mockSecurityAlertUpdateMany).not.toHaveBeenCalled();
  });
});
