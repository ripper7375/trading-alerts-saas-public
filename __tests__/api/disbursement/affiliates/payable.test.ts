/**
 * Payable Affiliates API Tests (Part 19B)
 *
 * TDD tests for GET /api/disbursement/affiliates/payable endpoint
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/disbursement/affiliates/payable/route';

// Mock the auth session
jest.mock('@/lib/auth/session', () => ({
  requireAdmin: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    affiliateProfile: {
      findMany: jest.fn(),
    },
    commission: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

// Mock CommissionAggregator
jest.mock('@/lib/disbursement/services/commission-aggregator', () => ({
  CommissionAggregator: jest.fn().mockImplementation(() => ({
    getPayableAffiliatesWithDetails: jest.fn().mockResolvedValue([
      {
        id: 'aff-123',
        fullName: 'John Doe',
        email: 'john@example.com',
        country: 'US',
        pendingAmount: 150.0,
        paidAmount: 500.0,
        pendingCommissionCount: 3,
        oldestPendingDate: new Date('2025-01-01'),
        readyForPayout: true,
        riseAccount: {
          hasAccount: true,
          riseId: '0xABC123',
          kycStatus: 'APPROVED',
          canReceivePayments: true,
        },
      },
      {
        id: 'aff-456',
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        country: 'UK',
        pendingAmount: 75.0,
        paidAmount: 200.0,
        pendingCommissionCount: 2,
        oldestPendingDate: new Date('2025-01-15'),
        readyForPayout: true,
        riseAccount: {
          hasAccount: true,
          riseId: '0xDEF456',
          kycStatus: 'APPROVED',
          canReceivePayments: true,
        },
      },
    ]),
  })),
}));

import { requireAdmin } from '@/lib/auth/session';

describe('GET /api/disbursement/affiliates/payable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return payable affiliates for admin user', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('affiliates');
    expect(Array.isArray(data.affiliates)).toBe(true);
    expect(data.affiliates).toHaveLength(2);
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('totalAffiliates');
    expect(data.summary).toHaveProperty('totalPendingAmount');
    expect(data.summary).toHaveProperty('readyForPayout');
  });

  it('should return affiliate details with RiseWorks account info', async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      user: { id: 'admin-123', role: 'ADMIN' },
    });

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const affiliate = data.affiliates[0];
    expect(affiliate).toHaveProperty('id');
    expect(affiliate).toHaveProperty('fullName');
    expect(affiliate).toHaveProperty('email');
    expect(affiliate).toHaveProperty('pendingAmount');
    expect(affiliate).toHaveProperty('readyForPayout');
    expect(affiliate).toHaveProperty('riseAccount');
    expect(affiliate.riseAccount).toHaveProperty('hasAccount');
    expect(affiliate.riseAccount).toHaveProperty('kycStatus');
  });

  it('should return 401 for unauthorized user', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Unauthorized', 'UNAUTHORIZED', 401)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 403 for non-admin user', async () => {
    const { AuthError } = await import('@/lib/auth/errors');
    (requireAdmin as jest.Mock).mockRejectedValue(
      new AuthError('Admin required', 'ADMIN_REQUIRED', 403)
    );

    const request = new NextRequest(
      'http://localhost:3000/api/disbursement/affiliates/payable'
    );

    const response = await GET(request);

    expect(response.status).toBe(403);
  });
});
