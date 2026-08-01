/**
 * Alerts API Route Tests
 *
 * Tests for GET/POST /api/alerts and GET/PATCH/DELETE /api/alerts/[id]
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

// Mock session
const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  getSession: () => mockSession(),
}));

// Mock Prisma
const mockAlertFindMany = jest.fn();
const mockAlertFindUnique = jest.fn();
const mockAlertCreate = jest.fn();
const mockAlertUpdate = jest.fn();
const mockAlertDelete = jest.fn();
const mockAlertCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    alert: {
      findMany: (...args: unknown[]) => mockAlertFindMany(...args),
      findUnique: (...args: unknown[]) => mockAlertFindUnique(...args),
      create: (...args: unknown[]) => mockAlertCreate(...args),
      update: (...args: unknown[]) => mockAlertUpdate(...args),
      delete: (...args: unknown[]) => mockAlertDelete(...args),
      count: (...args: unknown[]) => mockAlertCount(...args),
    },
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

describe('Alerts API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks() does not reset mockReturnValue() -- re-pin the flag to
    // its default OFF state before every test so a flag-on test earlier in
    // the file can never leak into a later, flag-off-assuming test.
    mockShouldUseOpService.mockReturnValue(false);
  });

  describe('GET /api/alerts', () => {
    it('should return 401 when not authenticated', async () => {
      mockSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user alerts', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });

      const alerts = [
        {
          id: 'alert-1',
          name: 'Gold Alert',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: '{"type":"price_above","targetValue":1900}',
          alertType: 'PRICE_ALERT',
          isActive: true,
          lastTriggered: null,
          triggerCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockAlertFindMany.mockResolvedValue(alerts);

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alerts).toEqual(alerts);
    });

    it('should filter alerts by status=active', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest(
        'http://localhost/api/alerts?status=active'
      );
      await GET(request as unknown as Request);

      expect(mockAlertFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            isActive: true,
          }),
        })
      );
    });

    it('should filter alerts by symbol', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindMany.mockResolvedValue([]);

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest(
        'http://localhost/api/alerts?symbol=XAUUSD'
      );
      await GET(request as unknown as Request);

      expect(mockAlertFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            symbol: 'XAUUSD',
          }),
        })
      );
    });

    it('should handle database errors', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindMany.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch alerts');
    });
  });

  describe('POST /api/alerts', () => {
    it('should return 401 when not authenticated', async () => {
      mockSession.mockResolvedValue(null);

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'H1',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 PRO_FEATURE for FREE users (V8)', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('PRO_FEATURE');
      expect(data.upgradeUrl).toBe('/pricing');
    });

    it('should return 400 for invalid JSON', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('INVALID_JSON');
    });

    it('should return 400 for invalid input', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: '', // Empty symbol
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for unsupported symbol (V8: XAUUSD only)', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'AUDJPY', // No longer a platform symbol
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 95,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for unsupported timeframe (V8: M5/M15 only)', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'H1', // No longer supported
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 when PRO alert limit (100) exceeded', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertCount.mockResolvedValue(100); // PRO tier limit is 100

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('ALERT_LIMIT_EXCEEDED');
    });

    it('should create alert successfully for PRO user', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertCount.mockResolvedValue(2);

      const createdAlert = {
        id: 'new-alert',
        name: 'XAUUSD M5 Alert',
        symbol: 'XAUUSD',
        timeframe: 'M5',
        condition: '{"type":"price_above","targetValue":1900}',
        alertType: 'PRICE_ALERT',
        isActive: true,
        lastTriggered: null,
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAlertCreate.mockResolvedValue(createdAlert);

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.alert).toEqual(createdAlert);
      expect(data.message).toBe('Alert created successfully');
    });

    it('should allow PRO user to create M15 alerts', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertCount.mockResolvedValue(5);
      mockAlertCreate.mockResolvedValue({
        id: 'new-alert',
        symbol: 'XAUUSD',
        timeframe: 'M15',
      });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'M15',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/alerts/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when alert not found', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/alerts/nonexistent'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('ALERT_NOT_FOUND');
    });

    it('should return 403 when alert belongs to another user', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindUnique.mockResolvedValue({
        id: 'alert-1',
        userId: 'user-2', // Different user
        name: 'Alert',
      });

      const { GET } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should return alert when authorized', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });

      const alert = {
        id: 'alert-1',
        userId: 'user-1',
        name: 'Gold Alert',
        symbol: 'XAUUSD',
        timeframe: 'H1',
      };
      mockAlertFindUnique.mockResolvedValue(alert);

      const { GET } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alert.id).toBe('alert-1');
      expect(data.alert.userId).toBeUndefined(); // userId should be removed
    });
  });

  describe('PATCH /api/alerts/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSession.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 PRO_FEATURE for FREE users (V8)', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('PRO_FEATURE');
    });

    it('should return 404 when alert not found', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertFindUnique.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/alerts/nonexistent',
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        }
      );
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('ALERT_NOT_FOUND');
    });

    it('should return 403 when alert belongs to another user', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertFindUnique.mockResolvedValue({
        userId: 'user-2',
        condition: '{}',
      });

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should update alert isActive status', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertFindUnique.mockResolvedValue({
        userId: 'user-1',
        condition: '{"type":"price_above","targetValue":1900}',
      });
      mockAlertUpdate.mockResolvedValue({
        id: 'alert-1',
        isActive: false,
      });

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Alert updated successfully');
    });

    it('should update alert target value', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockAlertFindUnique.mockResolvedValue({
        userId: 'user-1',
        condition: '{"type":"price_above","targetValue":1900}',
      });
      mockAlertUpdate.mockResolvedValue({
        id: 'alert-1',
        condition: '{"type":"price_above","targetValue":2000}',
      });

      const { PATCH } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'PATCH',
        body: JSON.stringify({ targetValue: 2000 }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });

      expect(mockAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            condition: expect.stringContaining('"targetValue":2000'),
          }),
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/alerts/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockSession.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when alert not found', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindUnique.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/alerts/nonexistent',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('ALERT_NOT_FOUND');
    });

    it('should return 403 when alert belongs to another user', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindUnique.mockResolvedValue({
        userId: 'user-2',
      });

      const { DELETE } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should delete alert successfully', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
      mockAlertFindUnique.mockResolvedValue({
        userId: 'user-1',
      });
      mockAlertDelete.mockResolvedValue({});

      const { DELETE } = await import('@/app/api/alerts/[id]/route');
      const request = new MockRequest('http://localhost/api/alerts/alert-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'alert-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Alert deleted successfully');
      expect(mockAlertDelete).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
      });
    });
  });

  // Session 4B-6: MIGRATE_ALERTS_CRUD flag-on forwarding to operation-service.
  // Auth still runs first (unchanged); Prisma mocks are never called on this
  // path -- proves the flag branch short-circuits before any monolith logic.
  describe('MIGRATE_ALERTS_CRUD forwarding', () => {
    it('GET /api/alerts forwards to operation-service, preserving status and query params', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 200,
        body: { alerts: [{ id: 'op-alert-1' }] },
      });

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest(
        'http://localhost/api/alerts?status=active'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.alerts).toEqual([{ id: 'op-alert-1' }]);
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/alerts?status=active'
      );
      expect(mockAlertFindMany).not.toHaveBeenCalled();
    });

    it('POST /api/alerts forwards to operation-service and preserves a 201 Created', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockResolvedValue({
        status: 201,
        body: { alert: { id: 'op-alert-2' } },
      });

      const { POST } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts', {
        method: 'POST',
        body: JSON.stringify({
          symbol: 'XAUUSD',
          timeframe: 'M5',
          conditionType: 'price_above',
          targetValue: 1900,
        }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.alert).toEqual({ id: 'op-alert-2' });
      expect(mockForwardRequestToOperationService).toHaveBeenCalledWith(
        request,
        '/alerts'
      );
      expect(mockAlertCreate).not.toHaveBeenCalled();
    });

    it('GET /api/alerts maps an OperationServiceError to its own status/body', async () => {
      mockSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
      mockShouldUseOpService.mockReturnValue(true);
      mockForwardRequestToOperationService.mockRejectedValue(
        new MockOperationServiceError(503, { error: 'operation-service down' })
      );

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('operation-service down');
    });

    it('does not forward when unauthenticated -- auth check still runs first', async () => {
      mockSession.mockResolvedValue(null);
      mockShouldUseOpService.mockReturnValue(true);

      const { GET } = await import('@/app/api/alerts/route');
      const request = new MockRequest('http://localhost/api/alerts');
      const response = await GET(request as unknown as Request);

      expect(response.status).toBe(401);
      expect(mockForwardRequestToOperationService).not.toHaveBeenCalled();
    });
  });
});
