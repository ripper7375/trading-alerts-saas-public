/**
 * Security Alerts API Route Tests
 *
 * Tests for GET /api/user/security-alerts. Post-6-12 gap-matrix correction
 * (A1-9/A2-12): `SecurityAlert` has had real writers since Session 3-4 with
 * no UI-reachable reader anywhere -- this is the first test coverage for
 * that read path.
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
const mockSecurityAlertFindMany = jest.fn();
const mockSecurityAlertCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    securityAlert: {
      findMany: (...args: unknown[]) => mockSecurityAlertFindMany(...args),
      count: (...args: unknown[]) => mockSecurityAlertCount(...args),
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

function makeRequest(url: string) {
  return { url } as never;
}

describe('GET /api/user/security-alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/user/security-alerts/route');
    const response = await GET(
      makeRequest('http://localhost/api/user/security-alerts')
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns paginated alerts scoped to the caller, defaulting limit to 20', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    const alerts = [
      {
        id: 'alert-1',
        type: 'PASSWORD_CHANGED',
        title: 'Password changed',
        message: 'Your password was changed',
        ipAddress: '1.2.3.4',
        deviceInfo: 'Chrome on Windows',
        location: 'Unknown',
        read: false,
        readAt: null,
        createdAt: new Date(),
      },
    ];
    mockSecurityAlertFindMany.mockResolvedValue(alerts);
    mockSecurityAlertCount.mockResolvedValue(1);

    const { GET } = await import('@/app/api/user/security-alerts/route');
    const response = await GET(
      makeRequest('http://localhost/api/user/security-alerts')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alerts).toEqual(alerts);
    expect(data.pagination).toEqual({
      total: 1,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
    expect(mockSecurityAlertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        take: 20,
        skip: 0,
      })
    );
  });

  it('clamps limit to 100 and honors a real offset', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertFindMany.mockResolvedValue([]);
    mockSecurityAlertCount.mockResolvedValue(0);

    const { GET } = await import('@/app/api/user/security-alerts/route');
    await GET(
      makeRequest(
        'http://localhost/api/user/security-alerts?limit=500&offset=40'
      )
    );

    expect(mockSecurityAlertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 40 })
    );
  });

  it('handles database errors', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockSecurityAlertFindMany.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/user/security-alerts/route');
    const response = await GET(
      makeRequest('http://localhost/api/user/security-alerts')
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch security alerts');
  });

  it('forwards to operation-service when MIGRATE_USER_SESSIONS is on', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockShouldUseOpService.mockReturnValue(true);
    mockForwardRequestToOperationService.mockResolvedValue({
      status: 200,
      body: {
        alerts: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      },
    });

    const { GET } = await import('@/app/api/user/security-alerts/route');
    const request = makeRequest(
      'http://localhost/api/user/security-alerts?limit=5'
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.alerts).toEqual([]);
    expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
      request,
      '/user/security-alerts?limit=5'
    );
    expect(mockSecurityAlertFindMany).not.toHaveBeenCalled();
  });
});
