/**
 * Admin User Detail Page Tests (Session 6-6, A1-17/A2-10)
 *
 * Verifies the new /admin/users/[id] server component renders all 5
 * sections from real (mocked) Prisma reads, 404s via notFound() for a
 * missing user, and shows the correct "not an affiliate" state.
 *
 * @module __tests__/pages/admin/user-detail.test
 */

import { render, screen } from '@testing-library/react';

import AdminUserDetailPage from '@/app/admin/users/[id]/page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

const mockUserFindUnique = jest.fn();
const mockSubscriptionFindUnique = jest.fn();
const mockUserSessionCount = jest.fn();
const mockFraudAlertFindMany = jest.fn();
const mockAffiliateProfileFindUnique = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    subscription: {
      findUnique: (...args: unknown[]) => mockSubscriptionFindUnique(...args),
    },
    userSession: {
      count: (...args: unknown[]) => mockUserSessionCount(...args),
    },
    fraudAlert: {
      findMany: (...args: unknown[]) => mockFraudAlertFindMany(...args),
    },
    affiliateProfile: {
      findUnique: (...args: unknown[]) =>
        mockAffiliateProfileFindUnique(...args),
    },
  },
}));

const realUser = {
  id: 'user-1',
  email: 'trader@example.com',
  name: 'Jane Trader',
  role: 'USER',
  tier: 'PRO' as const,
  isActive: true,
  isAffiliate: true,
  emailVerified: new Date('2026-01-01'),
  trialStatus: 'CONVERTED' as const,
  trialStartDate: null,
  trialEndDate: null,
  twoFactorEnabled: true,
  twoFactorVerifiedAt: new Date('2026-02-01'),
  createdAt: new Date('2025-12-01'),
  sessions: [{ expires: new Date('2026-08-01') }],
};

const realSubscription = {
  status: 'ACTIVE',
  stripeSubscriptionId: 'sub_123',
  dLocalPaymentId: null,
  planType: 'MONTHLY',
  expiresAt: new Date('2026-09-01'),
  stripeCurrentPeriodEnd: new Date('2026-09-01'),
};

const realFraudAlert = {
  id: 'fraud-1',
  pattern: 'VELOCITY_LIMIT',
  severity: 'HIGH',
  status: 'PENDING',
  createdAt: new Date('2026-07-01'),
};

const realAffiliateProfile = {
  status: 'ACTIVE',
  totalEarnings: { toString: () => '250.00' },
  pendingCommissions: { toString: () => '40.00' },
  _count: { affiliateCodes: 12 },
};

describe('AdminUserDetailPage (server component)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all 5 sections with real data', async () => {
    mockUserFindUnique.mockResolvedValue(realUser);
    mockSubscriptionFindUnique.mockResolvedValue(realSubscription);
    mockUserSessionCount.mockResolvedValue(2);
    mockFraudAlertFindMany.mockResolvedValue([realFraudAlert]);
    mockAffiliateProfileFindUnique.mockResolvedValue(realAffiliateProfile);

    const jsx = await AdminUserDetailPage({
      params: Promise.resolve({ id: 'user-1' }),
    });
    render(jsx);

    // 1. Profile & Account Status (email appears in both the page header
    // and the Profile card)
    expect(screen.getAllByText('trader@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Profile & Account Status')).toBeInTheDocument();

    // 2. Subscription & Billing ('ACTIVE' also appears on the affiliate
    // status badge below, so assert count rather than a single match)
    expect(screen.getByText('Subscription & Billing')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Stripe')).toBeInTheDocument();

    // 3. Security & 2FA
    expect(screen.getByText('Security & 2FA')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // active sessions

    // 4. Fraud Alerts
    expect(screen.getByText('VELOCITY_LIMIT')).toBeInTheDocument();

    // 5. Affiliate & Code Info
    expect(screen.getByText('Affiliate & Code Info')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    );
    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });

  it('shows "Not an affiliate" when isAffiliate is false', async () => {
    mockUserFindUnique.mockResolvedValue({ ...realUser, isAffiliate: false });
    mockSubscriptionFindUnique.mockResolvedValue(null);
    mockUserSessionCount.mockResolvedValue(0);
    mockFraudAlertFindMany.mockResolvedValue([]);
    mockAffiliateProfileFindUnique.mockResolvedValue(null);

    const jsx = await AdminUserDetailPage({
      params: Promise.resolve({ id: 'user-1' }),
    });
    render(jsx);

    expect(screen.getByText('Not an affiliate.')).toBeInTheDocument();
    expect(screen.getByText('No fraud alerts on record.')).toBeInTheDocument();
    expect(screen.getByText('No subscription on record.')).toBeInTheDocument();
  });

  it('calls notFound() for a non-existent user ID', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await expect(
      AdminUserDetailPage({ params: Promise.resolve({ id: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockSubscriptionFindUnique).not.toHaveBeenCalled();
  });
});
