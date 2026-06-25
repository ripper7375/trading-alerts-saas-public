/**
 * Admin Affiliates API Route Tests
 *
 * Tests for admin affiliate management endpoints:
 * - GET /api/admin/affiliates
 *
 * @module __tests__/api/admin-affiliates.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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

// Mock requireAdmin
const mockRequireAdmin = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdmin: () => mockRequireAdmin(),
}));

// Mock AuthError
class MockAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

jest.mock('@/lib/auth/errors', () => ({
  __esModule: true,
  AuthError: MockAuthError,
}));

// Mock getAffiliatesList
const mockGetAffiliatesList = jest.fn();
jest.mock('@/lib/admin/affiliate-management', () => ({
  __esModule: true,
  getAffiliatesList: (...args: unknown[]) => mockGetAffiliatesList(...args),
}));

// Mock Request class
class MockRequest {
  nextUrl: URL;

  constructor(url: string) {
    this.nextUrl = new URL(url);
  }
}

describe('Admin Affiliates API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/admin/affiliates
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/admin/affiliates', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest('http://localhost/api/admin/affiliates');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest('http://localhost/api/admin/affiliates');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return affiliates list when admin', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockGetAffiliatesList.mockResolvedValue({
        affiliates: [
          {
            id: 'aff-1',
            fullName: 'John Doe',
            user: { email: 'john@example.com' },
            status: 'ACTIVE',
            totalEarnings: 100.0,
          },
          {
            id: 'aff-2',
            fullName: 'Jane Smith',
            user: { email: 'jane@example.com' },
            status: 'ACTIVE',
            totalEarnings: 200.0,
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest('http://localhost/api/admin/affiliates');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.affiliates).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockGetAffiliatesList.mockResolvedValue({
        affiliates: [
          {
            id: 'aff-1',
            fullName: 'John Doe',
            status: 'ACTIVE',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates?status=ACTIVE'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetAffiliatesList).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACTIVE' })
      );
    });

    it('should handle pagination', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockGetAffiliatesList.mockResolvedValue({
        affiliates: [],
        total: 50,
        page: 3,
        limit: 10,
        totalPages: 5,
      });

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates?page=3&limit=10'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetAffiliatesList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 10 })
      );
    });

    it('should handle database errors', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockGetAffiliatesList.mockRejectedValue(new Error('Database error'));

      const { GET } = await import('@/app/api/admin/affiliates/route');
      const request = new MockRequest('http://localhost/api/admin/affiliates');
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch affiliates');
    });
  });
});
