/**
 * Tests for Disbursement Affiliates API (Part 19B)
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/disbursement/affiliates/payable/route';

// Mock auth
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    commission: {
      findMany: jest.fn(),
    },
    affiliateProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/disbursement/affiliates/payable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should require admin authentication', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { AuthError } = await import('@/lib/auth/errors');

    (requireAdmin as jest.Mock).mockRejectedValueOnce(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 for non-admin users', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { AuthError } = await import('@/lib/auth/errors');

    (requireAdmin as jest.Mock).mockRejectedValueOnce(
      new AuthError('Admin required', 'ADMIN_REQUIRED', 403)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Admin required');
  });

  it('should return 200 with valid admin session', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    // Mock commission data (no payable affiliates)
    (prisma.commission.findMany as jest.Mock).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('affiliates');
    expect(data).toHaveProperty('summary');
    expect(Array.isArray(data.affiliates)).toBe(true);
  });

  it('should return affiliates meeting payout threshold', async () => {
    const { requireAdmin } = await import('@/lib/auth/session');
    const { prisma } = await import('@/lib/db/prisma');

    (requireAdmin as jest.Mock).mockResolvedValueOnce({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    // Mock commission data meeting threshold ($50+)
    (prisma.commission.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'comm-1',
        affiliateProfileId: 'aff-123',
        commissionAmount: 60,
        createdAt: new Date('2025-01-01'),
        affiliateProfile: { id: 'aff-123' },
      },
    ]);

    // Mock affiliate profile
    (prisma.affiliateProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff-123',
      fullName: 'Test Affiliate',
      country: 'US',
      paidCommissions: 100,
      user: { email: 'test@example.com' },
      riseAccount: {
        riseId: 'rise-123',
        kycStatus: 'APPROVED',
      },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.affiliates.length).toBeGreaterThan(0);
  });
});
