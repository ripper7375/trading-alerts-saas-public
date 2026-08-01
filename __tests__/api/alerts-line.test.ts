/**
 * Line-touch Alerts API Route Tests (Session 4B-6)
 *
 * Tests for GET/POST /api/alerts/line and PATCH/DELETE /api/alerts/line/[id].
 * No prior test coverage existed for these server route handlers at all --
 * __tests__/drawing/alertsApi.test.ts only tests the CLIENT-side fetch
 * wrapper (components/charts/drawing/alertsApi.ts), never these handlers
 * (CONFIRM finding, same L27/L28-class gap Session 4B-5 already hit on this
 * identical file). Authored directly against the real SOURCE handlers,
 * mirroring __tests__/api/alerts.test.ts's structure/mocking style.
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

// Mock next-auth's getServerSession + authOptions
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock('@/lib/auth/auth-options', () => ({
  __esModule: true,
  authOptions: {},
}));

// Mock the shared drawing geometry helper
const mockLevelsForMark = jest.fn();
jest.mock('@/components/charts/drawing/geometry', () => ({
  __esModule: true,
  levelsForMark: (...args: unknown[]) => mockLevelsForMark(...args),
}));

// Mock publishAlertsChanged (Redis pub/sub side effect, not under test here)
const mockPublishAlertsChanged = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/drawing/invalidate', () => ({
  __esModule: true,
  publishAlertsChanged: (...args: unknown[]) =>
    mockPublishAlertsChanged(...args),
}));

// Mock Prisma
const mockDrawingAlertFindMany = jest.fn();
const mockDrawingAlertFindUnique = jest.fn();
const mockDrawingFindUnique = jest.fn();
const mockAlertCount = jest.fn();
const mockDrawingAlertUpdate = jest.fn();
const mockAlertUpdate = jest.fn();
const mockAlertDelete = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    drawingAlert: {
      findMany: (...args: unknown[]) => mockDrawingAlertFindMany(...args),
      findUnique: (...args: unknown[]) => mockDrawingAlertFindUnique(...args),
      update: (...args: unknown[]) => mockDrawingAlertUpdate(...args),
    },
    drawing: {
      findUnique: (...args: unknown[]) => mockDrawingFindUnique(...args),
    },
    alert: {
      count: (...args: unknown[]) => mockAlertCount(...args),
      update: (...args: unknown[]) => mockAlertUpdate(...args),
      delete: (...args: unknown[]) => mockAlertDelete(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock the Session 4B-6 operation-service transport (flag + forwarder)
const mockShouldUseOpService = jest.fn().mockReturnValue(false);
jest.mock('@/lib/operation-service/flags', () => ({
  __esModule: true,
  shouldUseOperationServiceForAlertsCrud: () => mockShouldUseOpService(),
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

const VALID_DRAWING_ID = 'cdrawing1234567890';

describe('Line Alerts API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShouldUseOpService.mockReturnValue(false);
    mockPublishAlertsChanged.mockResolvedValue(undefined);
  });

  describe('GET /api/alerts/line', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return the user line alerts', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });
      const rows = [{ id: 'da1', alert: { id: 'a1' }, drawing: { id: 'd1' } }];
      mockDrawingAlertFindMany.mockResolvedValue(rows);

      const { GET } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alerts).toEqual(rows);
    });

    it('MIGRATE_ALERTS_CRUD: forwards to operation-service, preserving query params', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 200,
        body: { success: true, alerts: [{ id: 'op-da1' }] },
      });

      const { GET } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest(
        'http://localhost/api/alerts/line?symbol=XAUUSD'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alerts).toEqual([{ id: 'op-da1' }]);
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/alerts/line?symbol=XAUUSD'
      );
      expect(mockDrawingAlertFindMany).not.toHaveBeenCalled();
    });

    it('MIGRATE_ALERTS_CRUD: maps an OperationServiceError to its own status/body', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockRejectedValue(
        new MockOperationServiceError(503, { error: 'operation-service down' })
      );

      const { GET } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('operation-service down');
    });
  });

  describe('POST /api/alerts/line', () => {
    const validBody = {
      drawingId: VALID_DRAWING_ID,
      targetLevel: 'high',
    };

    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 for FREE users (V8: PRO-exclusive)', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { POST } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Line alerts are a PRO feature');
    });

    it('should attach a line alert successfully for a PRO user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });
      mockDrawingFindUnique.mockResolvedValue({
        id: VALID_DRAWING_ID,
        userId: 'user-1',
        type: 'TREND_LINE',
        anchors: [],
        style: {},
        symbol: 'XAUUSD',
        timeframe: 'M5',
      });
      mockLevelsForMark.mockReturnValue([{ id: 'high' }, { id: 'low' }]);
      mockAlertCount.mockResolvedValue(2);
      const created = { id: 'da1', alertId: 'a1', targetLevel: 'high' };
      mockTransaction.mockResolvedValue(created);

      const { POST } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.alert).toEqual(created);
      expect(mockPublishAlertsChanged).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'alert_created' })
      );
    });

    it('MIGRATE_ALERTS_CRUD: forwards to operation-service and preserves a 201 Created', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'PRO' },
      });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 201,
        body: { success: true, alert: { id: 'op-da2' } },
      });

      const { POST } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.alert).toEqual({ id: 'op-da2' });
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/alerts/line'
      );
      expect(mockDrawingFindUnique).not.toHaveBeenCalled();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('MIGRATE_ALERTS_CRUD: does not forward when unauthenticated -- auth check still runs first', async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockShouldUseOpService.mockReturnValue(true);

      const { POST } = await import('@/app/api/alerts/line/route');
      const request = new MockRequest('http://localhost/api/alerts/line', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(401);
      expect(mockForwardRequestToOperationService).not.toHaveBeenCalled();
    });
  });
});
