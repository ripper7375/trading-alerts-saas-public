/**
 * Watchlist API Route Tests
 *
 * Tests for GET/POST /api/watchlist and GET/PATCH/DELETE /api/watchlist/[id]
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

// Mock tier-validation
const mockCanAccessSymbol = jest.fn();
const mockValidateTimeframeAccess = jest.fn();

jest.mock('@/lib/tier-validation', () => ({
  __esModule: true,
  canAccessSymbol: (...args: unknown[]) => mockCanAccessSymbol(...args),
  validateTimeframeAccess: (...args: unknown[]) =>
    mockValidateTimeframeAccess(...args),
}));

// Mock Prisma
const mockWatchlistFindFirst = jest.fn();
const mockWatchlistCreate = jest.fn();
const mockWatchlistItemCreate = jest.fn();
const mockWatchlistItemFindUnique = jest.fn();
const mockWatchlistItemUpdate = jest.fn();
const mockWatchlistItemDelete = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    watchlist: {
      findFirst: (...args: unknown[]) => mockWatchlistFindFirst(...args),
      create: (...args: unknown[]) => mockWatchlistCreate(...args),
    },
    watchlistItem: {
      create: (...args: unknown[]) => mockWatchlistItemCreate(...args),
      findUnique: (...args: unknown[]) => mockWatchlistItemFindUnique(...args),
      update: (...args: unknown[]) => mockWatchlistItemUpdate(...args),
      delete: (...args: unknown[]) => mockWatchlistItemDelete(...args),
    },
  },
}));

describe('Watchlist API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default tier validation behavior
    mockCanAccessSymbol.mockReturnValue(true);
    mockValidateTimeframeAccess.mockReturnValue({ allowed: true });
  });

  describe('GET /api/watchlist', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/watchlist/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return empty items when no watchlist exists', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistFindFirst.mockResolvedValue(null);

      const { GET } = await import('@/app/api/watchlist/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items).toEqual([]);
      expect(data.watchlist).toBeUndefined();
    });

    it('should return watchlist with items', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const watchlist = {
        id: 'watchlist-1',
        name: 'My Watchlist',
        items: [
          {
            id: 'item-1',
            symbol: 'XAUUSD',
            timeframe: 'H1',
            order: 0,
            createdAt: new Date(),
          },
          {
            id: 'item-2',
            symbol: 'EURUSD',
            timeframe: 'D1',
            order: 1,
            createdAt: new Date(),
          },
        ],
      };
      mockWatchlistFindFirst.mockResolvedValue(watchlist);

      const { GET } = await import('@/app/api/watchlist/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.watchlist.id).toBe('watchlist-1');
      expect(data.items).toHaveLength(2);
    });

    it('should handle database errors', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistFindFirst.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/watchlist/route');
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch watchlist');
    });
  });

  describe('POST /api/watchlist', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid input', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: '', timeframe: 'H1' }), // Empty symbol
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid input');
    });

    it('should return 403 for symbol not in tier', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockCanAccessSymbol.mockReturnValue(false);

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'AUDJPY', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Symbol access denied');
    });

    it('should return 403 for timeframe not in tier', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockCanAccessSymbol.mockReturnValue(true);
      mockValidateTimeframeAccess.mockReturnValue({
        allowed: false,
        reason: 'M5 requires PRO',
      });

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'M5' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Timeframe access denied');
    });

    it('should return 403 when watchlist limit reached', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockCanAccessSymbol.mockReturnValue(true);
      mockValidateTimeframeAccess.mockReturnValue({ allowed: true });

      // FREE tier limit is 5 items
      const watchlist = {
        id: 'watchlist-1',
        items: [
          { symbol: 'A', timeframe: 'H1' },
          { symbol: 'B', timeframe: 'H1' },
          { symbol: 'C', timeframe: 'H1' },
          { symbol: 'D', timeframe: 'H1' },
          { symbol: 'E', timeframe: 'H1' },
        ],
      };
      mockWatchlistFindFirst.mockResolvedValue(watchlist);

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Watchlist limit reached');
    });

    it('should return 409 for duplicate combination', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const watchlist = {
        id: 'watchlist-1',
        items: [{ symbol: 'XAUUSD', timeframe: 'H1' }],
      };
      mockWatchlistFindFirst.mockResolvedValue(watchlist);

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Duplicate combination');
    });

    it('should create watchlist item successfully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const watchlist = { id: 'watchlist-1', items: [] };
      mockWatchlistFindFirst.mockResolvedValue(watchlist);

      const newItem = {
        id: 'item-1',
        symbol: 'XAUUSD',
        timeframe: 'H1',
        order: 0,
        createdAt: new Date(),
      };
      mockWatchlistItemCreate.mockResolvedValue(newItem);

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.item.symbol).toBe('XAUUSD');
      expect(data.item.timeframe).toBe('H1');
    });

    it('should create default watchlist if none exists', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      // First call returns null, second call (after create) returns the new watchlist
      mockWatchlistFindFirst.mockResolvedValue(null);
      mockWatchlistCreate.mockResolvedValue({ id: 'new-watchlist', items: [] });
      mockWatchlistItemCreate.mockResolvedValue({
        id: 'item-1',
        symbol: 'XAUUSD',
        timeframe: 'H1',
        order: 0,
        createdAt: new Date(),
      });

      const { POST } = await import('@/app/api/watchlist/route');
      const request = new MockRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ symbol: 'XAUUSD', timeframe: 'H1' }),
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(mockWatchlistCreate).toHaveBeenCalled();
    });
  });

  describe('GET /api/watchlist/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 404 when item not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/watchlist/nonexistent'
      );
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Not found');
    });

    it('should return 403 when item belongs to another user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue({
        id: 'item-1',
        userId: 'user-2', // Different user
        symbol: 'XAUUSD',
        timeframe: 'H1',
      });

      const { GET } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Forbidden');
    });

    it('should return item when authorized', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const item = {
        id: 'item-1',
        userId: 'user-1',
        symbol: 'XAUUSD',
        timeframe: 'H1',
        order: 0,
        createdAt: new Date(),
      };
      mockWatchlistItemFindUnique.mockResolvedValue(item);

      const { GET } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1');
      const response = await GET(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.item.id).toBe('item-1');
      expect(data.item.symbol).toBe('XAUUSD');
    });
  });

  describe('PATCH /api/watchlist/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'PATCH',
        body: JSON.stringify({ order: 5 }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 404 when item not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/watchlist/nonexistent',
        {
          method: 'PATCH',
          body: JSON.stringify({ order: 5 }),
        }
      );
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 403 when item belongs to another user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue({
        id: 'item-1',
        userId: 'user-2',
      });

      const { PATCH } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'PATCH',
        body: JSON.stringify({ order: 5 }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should update item order successfully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      const existingItem = {
        id: 'item-1',
        userId: 'user-1',
        symbol: 'XAUUSD',
        timeframe: 'H1',
        order: 0,
      };
      mockWatchlistItemFindUnique.mockResolvedValue(existingItem);

      const updatedItem = { ...existingItem, order: 5 };
      mockWatchlistItemUpdate.mockResolvedValue(updatedItem);

      const { PATCH } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'PATCH',
        body: JSON.stringify({ order: 5 }),
      });
      const response = await PATCH(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.item.order).toBe(5);
    });
  });

  describe('DELETE /api/watchlist/[id]', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return 404 when item not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue(null);

      const { DELETE } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest(
        'http://localhost/api/watchlist/nonexistent',
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should return 403 when item belongs to another user', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });
      mockWatchlistItemFindUnique.mockResolvedValue({
        id: 'item-1',
        userId: 'user-2',
      });

      const { DELETE } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should delete item successfully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1', tier: 'FREE' },
      });

      mockWatchlistItemFindUnique.mockResolvedValue({
        id: 'item-1',
        userId: 'user-1',
      });
      mockWatchlistItemDelete.mockResolvedValue({});

      const { DELETE } = await import('@/app/api/watchlist/[id]/route');
      const request = new MockRequest('http://localhost/api/watchlist/item-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request as unknown as Request, {
        params: Promise.resolve({ id: 'item-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Watchlist item deleted successfully');
      expect(mockWatchlistItemDelete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });
  });
});
