/**
 * Tests for Disbursement Batches API (Part 19B)
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/disbursement/batches/route';

// Mock auth
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    paymentBatch: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    disbursementAuditLog: {
      create: jest.fn(),
    },
    commission: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    affiliateProfile: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Batch API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/disbursement/batches', () => {
    it('should require authentication', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { AuthError } = await import('@/lib/auth/errors');

      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
      );

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 200 with batches for admin', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      (prisma.paymentBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentBatch.aggregate as jest.Mock).mockResolvedValue({
        _count: 0,
        _sum: { totalAmount: null, paymentCount: null },
      });
      (prisma.paymentBatch.groupBy as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('batches');
      expect(data).toHaveProperty('statistics');
    });

    it('should filter by status when provided', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      (prisma.paymentBatch.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.paymentBatch.aggregate as jest.Mock).mockResolvedValue({
        _count: 0,
        _sum: { totalAmount: null, paymentCount: null },
      });
      (prisma.paymentBatch.groupBy as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches?status=PENDING'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/disbursement/batches', () => {
    it('should require authentication', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { AuthError } = await import('@/lib/auth/errors');

      (requireAdmin as jest.Mock).mockRejectedValueOnce(
        new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
      );

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'MOCK' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid provider', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'INVALID' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when no payable affiliates', async () => {
      const { requireAdmin } = await import('@/lib/auth/session');
      const { prisma } = await import('@/lib/db/prisma');

      (requireAdmin as jest.Mock).mockResolvedValueOnce({
        user: { id: 'admin-123', role: 'ADMIN' },
      });

      // No commissions = no payable affiliates
      (prisma.commission.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/disbursement/batches',
        {
          method: 'POST',
          body: JSON.stringify({ provider: 'MOCK' }),
        }
      );
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('No payable affiliates');
    });
  });
});
