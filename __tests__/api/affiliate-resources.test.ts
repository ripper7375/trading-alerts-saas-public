/**
 * Affiliate Resources API Route Tests
 *
 * Tests for GET /api/affiliate/dashboard/resources.
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

const mockRequireAffiliate = jest.fn();
const mockGetAffiliateProfile = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
  getAffiliateProfile: () => mockGetAffiliateProfile(),
}));

const mockAffiliateCodeFindMany = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    affiliateCode: {
      findMany: (...args: unknown[]) => mockAffiliateCodeFindMany(...args),
    },
  },
}));

const mockListPublishedAssets = jest.fn();
jest.mock('@/lib/marketing-resources/service', () => ({
  __esModule: true,
  listPublishedAssets: (...args: unknown[]) => mockListPublishedAssets(...args),
}));

function makeRequest(url: string) {
  const parsed = new URL(url);
  return { nextUrl: { searchParams: parsed.searchParams } } as never;
}

describe('GET /api/affiliate/dashboard/resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an affiliate', async () => {
    mockRequireAffiliate.mockRejectedValue(new Error('AFFILIATE_REQUIRED'));

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/route'
    );
    const response = await GET(
      makeRequest('http://localhost/api/affiliate/dashboard/resources')
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('AFFILIATE_REQUIRED');
  });

  it('returns 404 when the affiliate has no profile yet', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetAffiliateProfile.mockResolvedValue(null);

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/route'
    );
    const response = await GET(
      makeRequest('http://localhost/api/affiliate/dashboard/resources')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe('PROFILE_NOT_FOUND');
  });

  it("returns the affiliate's active codes and published assets", async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetAffiliateProfile.mockResolvedValue({ id: 'profile-1' });
    mockAffiliateCodeFindMany.mockResolvedValue([
      {
        id: 'code-1',
        code: 'GOLDPRO20',
        discountPercent: 20,
        expiresAt: new Date(),
      },
    ]);
    mockListPublishedAssets.mockResolvedValue([
      {
        id: 'asset-1',
        title: 'Logo',
        category: 'BRAND_LOGOS',
        format: 'PNG',
        resolution: '512x512',
        fileUrl: '/logo.png',
        fileSize: 100,
        copyText: null,
        downloadCount: 5,
        updatedAt: new Date(),
        createdByUserId: 'admin-1',
      },
    ]);

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/route'
    );
    const response = await GET(
      makeRequest('http://localhost/api/affiliate/dashboard/resources')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockAffiliateCodeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { affiliateProfileId: 'profile-1', status: 'ACTIVE' },
      })
    );
    expect(data.codes).toHaveLength(1);
    expect(data.assets).toHaveLength(1);
    expect(data.assets[0].createdByUserId).toBeUndefined();
  });

  it('passes an optional category filter through to the service', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetAffiliateProfile.mockResolvedValue({ id: 'profile-1' });
    mockAffiliateCodeFindMany.mockResolvedValue([]);
    mockListPublishedAssets.mockResolvedValue([]);

    const { GET } = await import(
      '@/app/api/affiliate/dashboard/resources/route'
    );
    await GET(
      makeRequest(
        'http://localhost/api/affiliate/dashboard/resources?category=SWIPE_COPY'
      )
    );

    expect(mockListPublishedAssets).toHaveBeenCalledWith({
      category: 'SWIPE_COPY',
    });
  });
});
