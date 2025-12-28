/**
 * Cache Statistics API Route Tests
 */

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

// Mock cache functions
const mockGetCacheStats = jest.fn();
const mockGetCacheSize = jest.fn();

jest.mock('@/lib/cache/indicator-cache', () => ({
  __esModule: true,
  getCacheStats: () => mockGetCacheStats(),
  getCacheSize: () => mockGetCacheSize(),
}));

describe('Cache Statistics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/cache/stats', () => {
    it('should return 401 when not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const { GET } = await import('@/app/api/cache/stats/route');
      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return cache statistics when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      mockGetCacheStats.mockReturnValue({
        hits: 100,
        misses: 25,
        sets: 25,
        deletes: 5,
        hitRate: 0.8,
      });

      mockGetCacheSize.mockReturnValue(20);

      const { GET } = await import('@/app/api/cache/stats/route');
      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.stats).toMatchObject({
        hits: 100,
        misses: 25,
        sets: 25,
        deletes: 5,
        total: 125,
        hitRate: '80.00%',
        hitRateDecimal: 0.8,
        cacheSize: 20,
      });
    });

    it('should handle zero cache operations gracefully', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'user-1' },
      });

      mockGetCacheStats.mockReturnValue({
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        hitRate: 0,
      });

      mockGetCacheSize.mockReturnValue(0);

      const { GET } = await import('@/app/api/cache/stats/route');
      const request = {} as any;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats.hitRate).toBe('0.00%');
      expect(data.stats.total).toBe(0);
    });
  });
});
