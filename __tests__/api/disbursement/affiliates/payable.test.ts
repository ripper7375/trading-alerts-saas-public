/**
 * Tests for Payable Affiliates API (Part 19B)
 */

import { NextRequest } from 'next/server';

// Mock modules before importing route handlers
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    affiliateProfile: {
      findUnique: jest.fn(),
    },
    commission: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  CommissionAggregator: jest.fn().mockImplementation(() => ({
    getAllPayableAffiliates: jest.fn().mockResolvedValue([]),
    getAggregatesByAffiliate: jest.fn().mockResolvedValue({
      affiliateId: 'aff-123',
      commissionIds: [],
      totalAmount: 0,
      commissionCount: 0,
      oldestDate: new Date(),
      canPayout: false,
    }),
  })),
}));

import { GET } from '@/app/api/disbursement/affiliates/payable/route';
import { requireAdmin } from '@/lib/auth/session';
import { AuthError } from '@/lib/auth/errors';
import { CommissionAggregator } from '@/lib/disbursement/services/commission-aggregator';
import { prisma } from '@/lib/db/prisma';

describe('GET /api/disbursement/affiliates/payable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: admin is authenticated
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return payable affiliates', async () => {
    // Mock aggregator
    const mockAggregates = [
      {
        affiliateId: 'aff-123',
        commissionIds: ['comm-1', 'comm-2'],
        totalAmount: 100.0,
        commissionCount: 2,
        oldestDate: new Date('2024-01-01'),
        canPayout: true,
      },
    ];

    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockResolvedValue(mockAggregates),
    }));

    // Mock profile lookup
    (prisma.affiliateProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff-123',
      fullName: 'John Doe',
      country: 'US',
      paidCommissions: 500,
      user: { email: 'john@example.com' },
      riseAccount: {
        riseId: '0xABC...',
        kycStatus: 'APPROVED',
      },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('affiliates');
    expect(data).toHaveProperty('summary');
    expect(Array.isArray(data.affiliates)).toBe(true);
  });

  it('should return empty list when no payable affiliates', async () => {
    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockResolvedValue([]),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.affiliates).toHaveLength(0);
    expect(data.summary.totalAffiliates).toBe(0);
    expect(data.summary.totalPendingAmount).toBe(0);
  });

  it('should require admin authentication', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject non-admin users', async () => {
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Admin access required', 'ADMIN_REQUIRED', 403)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Admin access required');
  });

  it('should handle database errors gracefully', async () => {
    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockRejectedValue(
        new Error('Database connection error')
      ),
    }));

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch payable affiliates');
  });

  it('should include Rise account status in response', async () => {
    const mockAggregates = [
      {
        affiliateId: 'aff-no-rise',
        commissionIds: ['comm-1'],
        totalAmount: 60.0,
        commissionCount: 1,
        oldestDate: new Date(),
        canPayout: true,
      },
    ];

    (CommissionAggregator as jest.Mock).mockImplementation(() => ({
      getAllPayableAffiliates: jest.fn().mockResolvedValue(mockAggregates),
    }));

    // Affiliate without Rise account
    (prisma.affiliateProfile.findUnique as jest.Mock).mockResolvedValue({
      id: 'aff-no-rise',
      fullName: 'Jane Doe',
      country: 'UK',
      paidCommissions: 0,
      user: { email: 'jane@example.com' },
      riseAccount: null, // No Rise account
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.affiliates[0].riseAccount.hasAccount).toBe(false);
    expect(data.affiliates[0].riseAccount.canReceivePayments).toBe(false);
    expect(data.summary.awaitingRiseAccount).toBe(1);
  });
});
