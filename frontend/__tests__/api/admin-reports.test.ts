/**
 * Admin Reports API Route Tests
 *
 * Tests for admin report endpoints:
 * - GET /api/admin/affiliates/reports/profit-loss
 *
 * @module __tests__/api/admin-reports.test.ts
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

// Mock getReportingPeriod
const mockGetReportingPeriod = jest.fn();
jest.mock('@/lib/admin/pnl-calculator', () => ({
  __esModule: true,
  getReportingPeriod: (...args: unknown[]) => mockGetReportingPeriod(...args),
}));

// Mock Prisma
const mockFindMany = jest.fn();
const mockSystemConfigFindMany = jest.fn().mockResolvedValue([
  { key: 'affiliate_discount_percent', value: '20.0' },
  { key: 'affiliate_commission_percent', value: '20.0' },
  { key: 'affiliate_codes_per_month', value: '15' },
  { key: 'affiliate_base_price', value: '29.0' },
]);
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    commission: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    systemConfig: {
      findMany: (...args: unknown[]) => mockSystemConfigFindMany(...args),
    },
  },
}));

// Mock Request class
class MockRequest {
  nextUrl: URL;

  constructor(url: string) {
    this.nextUrl = new URL(url);
  }
}

describe('Admin Reports API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetReportingPeriod.mockReturnValue({
      start: new Date('2024-10-01'),
      end: new Date('2024-12-31'),
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /api/admin/affiliates/reports/profit-loss
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('GET /api/admin/affiliates/reports/profit-loss', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAdmin.mockRejectedValue(
        new MockAuthError('Unauthorized', 401)
      );

      const { GET } = await import(
        '@/app/api/admin/affiliates/reports/profit-loss/route'
      );
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates/reports/profit-loss'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when not admin', async () => {
      mockRequireAdmin.mockRejectedValue(new MockAuthError('Forbidden', 403));

      const { GET } = await import(
        '@/app/api/admin/affiliates/reports/profit-loss/route'
      );
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates/reports/profit-loss'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return P&L report when admin', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockFindMany.mockResolvedValue([
        {
          grossRevenue: 29.0,
          discountAmount: 5.8,
          netRevenue: 23.2,
          commissionAmount: 4.64,
          status: 'PAID',
        },
        {
          grossRevenue: 29.0,
          discountAmount: 5.8,
          netRevenue: 23.2,
          commissionAmount: 4.64,
          status: 'PENDING',
        },
      ]);

      const { GET } = await import(
        '@/app/api/admin/affiliates/reports/profit-loss/route'
      );
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates/reports/profit-loss?period=3months'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.revenue).toBeDefined();
      expect(data.revenue.grossRevenue).toBe(58.0);
      expect(data.costs.totalCommissions).toBe(9.28);
      expect(data.volume.totalSales).toBe(2);
    });

    it('should return empty report when no data', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockFindMany.mockResolvedValue([]);

      const { GET } = await import(
        '@/app/api/admin/affiliates/reports/profit-loss/route'
      );
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates/reports/profit-loss'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.volume.totalSales).toBe(0);
      expect(data.revenue.grossRevenue).toBe(0);
    });

    it('should handle database errors', async () => {
      mockRequireAdmin.mockResolvedValue(undefined);
      mockFindMany.mockRejectedValue(new Error('Database error'));

      const { GET } = await import(
        '@/app/api/admin/affiliates/reports/profit-loss/route'
      );
      const request = new MockRequest(
        'http://localhost/api/admin/affiliates/reports/profit-loss'
      );
      const response = await GET(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to generate P&L report');
    });
  });
});
