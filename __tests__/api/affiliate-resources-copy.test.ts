/**
 * Affiliate Resource Copy-Tracking API Route Tests
 *
 * Tests for POST /api/affiliate/dashboard/resources/[id]/copy.
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
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAffiliate: () => mockRequireAffiliate(),
}));

const mockRecordAssetEngagement = jest.fn();
jest.mock('@/lib/marketing-resources/service', () => ({
  __esModule: true,
  recordAssetEngagement: (...args: unknown[]) =>
    mockRecordAssetEngagement(...args),
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/affiliate/dashboard/resources/[id]/copy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when the caller is not an affiliate', async () => {
    mockRequireAffiliate.mockRejectedValue(new Error('AFFILIATE_REQUIRED'));

    const { POST } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/copy/route'
    );
    const response = await POST({} as never, makeContext('asset-1'));

    expect(response.status).toBe(403);
  });

  it('returns 404 for a non-existent or unpublished asset', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue(null);

    const { POST } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/copy/route'
    );
    const response = await POST({} as never, makeContext('missing'));

    expect(response.status).toBe(404);
  });

  it('rejects a non-SWIPE_COPY asset', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue({
      id: 'asset-1',
      category: 'BRAND_LOGOS',
      copyText: null,
    });

    const { POST } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/copy/route'
    );
    const response = await POST({} as never, makeContext('asset-1'));

    expect(response.status).toBe(400);
  });

  it('increments the counter and returns the server-authoritative copy text', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockResolvedValue({
      id: 'asset-1',
      category: 'SWIPE_COPY',
      copyText: 'Check out DavinTrade AI!',
      downloadCount: 43,
    });

    const { POST } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/copy/route'
    );
    const response = await POST({} as never, makeContext('asset-1'));
    const data = await response.json();

    expect(mockRecordAssetEngagement).toHaveBeenCalledWith('asset-1');
    expect(response.status).toBe(200);
    expect(data).toEqual({
      text: 'Check out DavinTrade AI!',
      downloadCount: 43,
    });
  });

  it('handles service errors', async () => {
    mockRequireAffiliate.mockResolvedValue({ user: { id: 'user-1' } });
    mockRecordAssetEngagement.mockRejectedValue(new Error('DB error'));

    const { POST } = await import(
      '@/app/api/affiliate/dashboard/resources/[id]/copy/route'
    );
    const response = await POST({} as never, makeContext('asset-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to record copy usage');
  });
});
