/**
 * Affiliate dashboard read routes under admin "view as affiliate".
 *
 * In view-as mode a route must serve the TARGET's data, must not require the
 * admin to be an affiliate, and must not forward to the money-service proxy
 * (which authenticates as the caller, i.e. would return the admin's own data
 * or refuse). The profile route must never auto-create a profile for it.
 */

jest.mock('next/server', () => ({
  __esModule: true,
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

const mockGetAdminViewAs = jest.fn();
jest.mock('@/lib/affiliate/view-as', () => ({
  __esModule: true,
  getAdminViewAs: () => mockGetAdminViewAs(),
}));

const mockRequireAffiliate = jest.fn();
const mockGetAffiliateProfile = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
  getAffiliateProfile: () => mockGetAffiliateProfile(),
}));

const mockBuildDashboardStats = jest.fn();
jest.mock('@/lib/affiliate/report-builder', () => ({
  __esModule: true,
  buildDashboardStats: (id: string) => mockBuildDashboardStats(id),
}));

jest.mock('@/lib/money-service/flags', () => ({
  __esModule: true,
  // The proxy is live in production; view-as must bypass it anyway.
  isAffiliateReadApiMigrated: () => true,
}));

const mockGetMoneyServiceToken = jest.fn();
const mockFetchStats = jest.fn();
jest.mock('@/lib/money-service/routes', () => ({
  __esModule: true,
  getMoneyServiceToken: () => mockGetMoneyServiceToken(),
  fetchAffiliateDashboardStats: (t: string) => mockFetchStats(t),
}));

const mockProfileUpsert = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateProfile: { upsert: (...a: unknown[]) => mockProfileUpsert(...a) },
  },
}));

import { GET as getStats } from '@/app/api/affiliate/dashboard/stats/route';
import { GET as getProfile } from '@/app/api/affiliate/profile/route';

type Req = Parameters<typeof getStats>[0];
const req = {} as Req;

const TARGET_PROFILE = {
  id: 'prof_target',
  fullName: 'Alice Affiliate',
  paymentDetails: {},
};

beforeEach(() => {
  jest.resetAllMocks();
  mockGetMoneyServiceToken.mockResolvedValue('admins-own-token');
});

describe('admin in view-as mode', () => {
  beforeEach(() => {
    mockGetAdminViewAs.mockResolvedValue({
      adminUserId: 'admin_1',
      target: { profileId: 'prof_target' },
      profile: TARGET_PROFILE,
    });
  });

  it('stats: serves the target from Prisma, skipping the affiliate check and the proxy', async () => {
    mockBuildDashboardStats.mockResolvedValue({ totalEarnings: 42 });

    const res = await getStats(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ totalEarnings: 42 });
    expect(mockBuildDashboardStats).toHaveBeenCalledWith('prof_target');
    expect(mockRequireAffiliate).not.toHaveBeenCalled();
    expect(mockFetchStats).not.toHaveBeenCalled();
    expect(mockGetAffiliateProfile).not.toHaveBeenCalled();
  });

  it('profile: returns the target profile and never creates one', async () => {
    const res = await getProfile(req);

    expect(await res.json()).toEqual(TARGET_PROFILE);
    expect(mockRequireAffiliate).not.toHaveBeenCalled();
    expect(mockProfileUpsert).not.toHaveBeenCalled();
  });
});

describe('everyone else (no view-as)', () => {
  beforeEach(() => {
    mockGetAdminViewAs.mockResolvedValue(null);
  });

  it('stats: still requires affiliate access and uses the proxy as before', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'u1' } });
    mockFetchStats.mockResolvedValue({ totalEarnings: 7 });

    const res = await getStats(req);

    expect(mockRequireAffiliate).toHaveBeenCalled();
    expect(mockFetchStats).toHaveBeenCalledWith('admins-own-token');
    expect(await res.json()).toEqual({ totalEarnings: 7 });
  });

  it('stats: an admin without view-as is still refused as a non-affiliate', async () => {
    mockRequireAffiliate.mockRejectedValue(new Error('AFFILIATE_REQUIRED'));

    const res = await getStats(req);

    expect(res.status).toBe(403);
    expect(mockBuildDashboardStats).not.toHaveBeenCalled();
  });
});
