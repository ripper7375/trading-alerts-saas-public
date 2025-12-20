/**
 * Cron Jobs API Route Tests
 *
 * Tests for cron job endpoints:
 * - POST /api/cron/distribute-codes
 * - POST /api/cron/expire-codes
 * - POST /api/cron/send-monthly-reports
 *
 * @module __tests__/api/cron-jobs.test.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock environment
const originalEnv = process.env;

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

// Mock runMonthlyDistribution
const mockRunMonthlyDistribution = jest.fn();
jest.mock('@/lib/cron/monthly-distribution', () => ({
  __esModule: true,
  runMonthlyDistribution: () => mockRunMonthlyDistribution(),
}));

// Mock Prisma
const mockAffiliateCodeUpdateMany = jest.fn();
const mockAffiliateFindMany = jest.fn();
const mockCommissionAggregate = jest.fn();
const mockAffiliateCodeCount = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateCode: {
      updateMany: (...args: unknown[]) => mockAffiliateCodeUpdateMany(...args),
      count: (...args: unknown[]) => mockAffiliateCodeCount(...args),
    },
    affiliateProfile: {
      findMany: (...args: unknown[]) => mockAffiliateFindMany(...args),
    },
    commission: {
      aggregate: (...args: unknown[]) => mockCommissionAggregate(...args),
    },
  },
}));

// Mock Request class
class MockRequest {
  private _headers: Map<string, string>;

  constructor(
    public url: string,
    options?: { headers?: Record<string, string> }
  ) {
    this._headers = new Map(Object.entries(options?.headers || {}));
  }

  get headers() {
    return {
      get: (name: string): string | null => {
        return this._headers.get(name.toLowerCase()) || null;
      },
    };
  }
}

describe('Cron Jobs API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: 'test-cron-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/cron/distribute-codes
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/cron/distribute-codes', () => {
    it('should return 401 without authorization', async () => {
      const { POST } = await import('@/app/api/cron/distribute-codes/route');
      const request = new MockRequest('http://localhost/api/cron/distribute-codes');
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 with wrong secret', async () => {
      const { POST } = await import('@/app/api/cron/distribute-codes/route');
      const request = new MockRequest('http://localhost/api/cron/distribute-codes', {
        headers: { authorization: 'Bearer wrong-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should distribute codes with valid secret', async () => {
      mockRunMonthlyDistribution.mockResolvedValue({
        distributed: 25,
        totalAffiliates: 25,
        emailsSent: 25,
        errors: [],
      });

      const { POST } = await import('@/app/api/cron/distribute-codes/route');
      const request = new MockRequest('http://localhost/api/cron/distribute-codes', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.distributed).toBe(25);
      expect(data.message).toContain('25 affiliates');
    });

    it('should handle distribution errors', async () => {
      mockRunMonthlyDistribution.mockRejectedValue(new Error('Database error'));

      const { POST } = await import('@/app/api/cron/distribute-codes/route');
      const request = new MockRequest('http://localhost/api/cron/distribute-codes', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Cron job failed');
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/cron/expire-codes
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/cron/expire-codes', () => {
    it('should return 401 without authorization', async () => {
      const { POST } = await import('@/app/api/cron/expire-codes/route');
      const request = new MockRequest('http://localhost/api/cron/expire-codes');
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should expire codes with valid secret', async () => {
      mockAffiliateCodeUpdateMany.mockResolvedValue({ count: 42 });

      const { POST } = await import('@/app/api/cron/expire-codes/route');
      const request = new MockRequest('http://localhost/api/cron/expire-codes', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.expiredCount).toBe(42);
      expect(data.message).toContain('42 codes');
    });

    it('should handle zero expired codes', async () => {
      mockAffiliateCodeUpdateMany.mockResolvedValue({ count: 0 });

      const { POST } = await import('@/app/api/cron/expire-codes/route');
      const request = new MockRequest('http://localhost/api/cron/expire-codes', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.expiredCount).toBe(0);
    });
  });

  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /api/cron/send-monthly-reports
  //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe('POST /api/cron/send-monthly-reports', () => {
    it('should return 401 without authorization', async () => {
      const { POST } = await import('@/app/api/cron/send-monthly-reports/route');
      const request = new MockRequest('http://localhost/api/cron/send-monthly-reports');
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should send reports with valid secret', async () => {
      mockAffiliateFindMany.mockResolvedValue([
        {
          id: 'aff-1',
          user: { email: 'affiliate1@example.com' },
          pendingCommissions: 100.0,
        },
        {
          id: 'aff-2',
          user: { email: 'affiliate2@example.com' },
          pendingCommissions: 200.0,
        },
      ]);
      mockAffiliateCodeCount.mockResolvedValue(15);
      mockCommissionAggregate.mockResolvedValue({
        _sum: { commissionAmount: 50.0 },
      });

      const { POST } = await import('@/app/api/cron/send-monthly-reports/route');
      const request = new MockRequest('http://localhost/api/cron/send-monthly-reports', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sent).toBe(2);
      expect(data.totalAffiliates).toBe(2);
    });

    it('should handle no active affiliates', async () => {
      mockAffiliateFindMany.mockResolvedValue([]);

      const { POST } = await import('@/app/api/cron/send-monthly-reports/route');
      const request = new MockRequest('http://localhost/api/cron/send-monthly-reports', {
        headers: { authorization: 'Bearer test-cron-secret' },
      });
      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sent).toBe(0);
    });
  });
});
